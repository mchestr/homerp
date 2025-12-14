"""Tests for AI assistant service and router."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.service import AIClassificationService
from src.users.models import User


class TestAIAssistantService:
    """Tests for the AIClassificationService.query_assistant method."""

    @pytest.fixture
    def mock_settings(self):
        """Create mock settings."""
        settings = MagicMock()
        settings.openai_api_key = "test-api-key"
        settings.openai_model = "gpt-4"
        settings.ai_templates_dir = None
        return settings

    @pytest.fixture
    def mock_template_manager(self):
        """Create mock template manager."""
        manager = MagicMock()
        manager.get_system_prompt.return_value = (
            "You are HomERP AI Assistant, a helpful assistant."
        )
        manager.get_user_prompt.return_value = "User request: {user_prompt}"
        return manager

    @pytest.fixture
    def service(self, mock_settings, mock_template_manager):
        """Create AI service with mocked dependencies."""
        with patch("src.ai.service.AsyncOpenAI"):
            service = AIClassificationService(
                settings=mock_settings, template_manager=mock_template_manager
            )
            return service

    async def test_query_assistant_basic(self, service):
        """Test basic assistant query without context."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="Here is a planting schedule for your seeds..."
                )
            )
        ]
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await service.query_assistant(
            user_prompt="Create a planting schedule for my seeds",
            inventory_context=None,
        )

        assert "planting schedule" in result

    async def test_query_assistant_with_context(self, service, mock_template_manager):
        """Test assistant query with inventory context."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="Based on your inventory of 10 tomato seeds and 5 pepper seeds..."
                )
            )
        ]
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        inventory_context = {
            "total_items": 2,
            "total_categories": 1,
            "total_locations": 1,
            "items_summary": [
                {
                    "name": "Tomato Seeds",
                    "quantity": 10,
                    "quantity_unit": "packs",
                    "category": "Seeds",
                    "location": "Garden Shed",
                },
                {
                    "name": "Pepper Seeds",
                    "quantity": 5,
                    "quantity_unit": "packs",
                    "category": "Seeds",
                    "location": "Garden Shed",
                },
            ],
        }

        result = await service.query_assistant(
            user_prompt="Create a planting schedule for my seeds",
            inventory_context=inventory_context,
        )

        assert "inventory" in result or "seeds" in result.lower()
        # Verify template manager was called with context
        mock_template_manager.get_user_prompt.assert_called()

    async def test_query_assistant_uses_correct_model(self, service, mock_settings):
        """Test that assistant uses the configured model."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Response"))]
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        await service.query_assistant(user_prompt="Test query")

        call_args = service.client.chat.completions.create.call_args
        assert call_args.kwargs["model"] == mock_settings.openai_model

    async def test_query_assistant_empty_response(self, service):
        """Test handling of empty response from AI."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=""))]
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await service.query_assistant(user_prompt="Test query")

        assert result == ""

    async def test_query_assistant_none_response(self, service):
        """Test handling of None response from AI."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=None))]
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await service.query_assistant(user_prompt="Test query")

        assert result == ""


class TestAIAssistantRouter:
    """Tests for the AI assistant router endpoints."""

    async def test_query_assistant_requires_auth(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated requests are rejected."""
        response = await unauthenticated_client.post(
            "/api/v1/ai/query",
            json={"prompt": "Test prompt"},
        )
        assert response.status_code == 401

    async def test_query_assistant_requires_credits(
        self,
        authenticated_client: AsyncClient,
        user_with_no_credits: User,
    ):
        """Test that users without credits get 402 error."""
        # Override to use user with no credits
        from src.auth.dependencies import get_current_user_id
        from src.main import app

        app.dependency_overrides[get_current_user_id] = lambda: user_with_no_credits.id

        response = await authenticated_client.post(
            "/api/v1/ai/query",
            json={"prompt": "Test prompt"},
        )
        assert response.status_code == 402

    @patch("src.ai.router.get_ai_service")
    async def test_query_assistant_success(
        self,
        mock_get_ai_service,
        authenticated_client: AsyncClient,
        test_user: User,
    ):
        """Test successful assistant query."""
        # Mock the AI service
        mock_service = MagicMock()
        mock_service.query_assistant = AsyncMock(
            return_value="Here is your planting schedule..."
        )
        mock_get_ai_service.return_value = mock_service

        response = await authenticated_client.post(
            "/api/v1/ai/query",
            json={
                "prompt": "Create a planting schedule",
                "include_inventory_context": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "planting schedule" in data["response"]
        assert data["credits_used"] == 1

    @patch("src.ai.router.get_ai_service")
    async def test_query_assistant_with_context(
        self,
        mock_get_ai_service,
        authenticated_client: AsyncClient,
        test_item,
    ):
        """Test assistant query includes inventory context."""
        mock_service = MagicMock()
        mock_service.query_assistant = AsyncMock(return_value="Based on your items...")
        mock_get_ai_service.return_value = mock_service

        response = await authenticated_client.post(
            "/api/v1/ai/query",
            json={
                "prompt": "What projects can I do?",
                "include_inventory_context": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["context_used"] is True
        assert data["items_in_context"] >= 1

    @patch("src.ai.router.get_ai_service")
    async def test_query_assistant_deducts_credit(
        self,
        mock_get_ai_service,
        authenticated_client: AsyncClient,
        async_session,
        test_user: User,
    ):
        """Test that successful query deducts one credit."""
        initial_credits = test_user.free_credits_remaining

        mock_service = MagicMock()
        mock_service.query_assistant = AsyncMock(return_value="Response")
        mock_get_ai_service.return_value = mock_service

        response = await authenticated_client.post(
            "/api/v1/ai/query",
            json={"prompt": "Test", "include_inventory_context": False},
        )

        assert response.status_code == 200

        await async_session.refresh(test_user)
        assert test_user.free_credits_remaining == initial_credits - 1

    async def test_query_assistant_validates_prompt(
        self, authenticated_client: AsyncClient
    ):
        """Test that empty prompts are rejected."""
        response = await authenticated_client.post(
            "/api/v1/ai/query",
            json={"prompt": ""},
        )
        assert response.status_code == 422

    async def test_query_assistant_max_prompt_length(
        self, authenticated_client: AsyncClient
    ):
        """Test that prompts over max length are rejected."""
        long_prompt = "x" * 2001  # Max is 2000

        response = await authenticated_client.post(
            "/api/v1/ai/query",
            json={"prompt": long_prompt},
        )
        assert response.status_code == 422

    async def test_query_assistant_handles_ai_error(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test that AI errors are handled gracefully."""
        from src.ai.service import AIClassificationService
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        # Create a mock service that raises an error
        mock_service = MagicMock(spec=AIClassificationService)
        mock_service.query_assistant = AsyncMock(
            side_effect=Exception("OpenAI API error")
        )

        def get_mock_ai_service():
            return mock_service

        async def override_session():
            yield async_session

        # Override dependencies
        from src.ai.router import get_ai_service

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: test_user.id
        app.dependency_overrides[get_ai_service] = get_mock_ai_service

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(
                transport=transport, base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/v1/ai/query",
                    json={"prompt": "Test", "include_inventory_context": False},
                )

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is False
                assert "error" in data
                assert "OpenAI API error" in data["error"]
        finally:
            app.dependency_overrides.clear()

    @patch("src.ai.router.get_ai_service")
    async def test_admin_bypasses_credit_check(
        self,
        mock_get_ai_service,
        admin_client: AsyncClient,
        admin_user: User,
        async_session,
    ):
        """Test that admin users bypass credit check."""
        admin_user.free_credits_remaining = 0
        admin_user.credit_balance = 0
        await async_session.commit()

        mock_service = MagicMock()
        mock_service.query_assistant = AsyncMock(return_value="Admin response")
        mock_get_ai_service.return_value = mock_service

        response = await admin_client.post(
            "/api/v1/ai/query",
            json={"prompt": "Test", "include_inventory_context": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
