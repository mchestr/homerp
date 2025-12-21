"""Tests for AI chat with tools endpoint and session management endpoints."""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.models import AIConversationSession
from src.ai.schemas import TokenUsage
from src.billing.models import CreditPricing
from src.users.models import User


@pytest.fixture
async def assistant_query_pricing(async_session: AsyncSession) -> CreditPricing:
    """Create credit pricing for assistant queries."""
    pricing = CreditPricing(
        id=uuid.uuid4(),
        operation_type="assistant_query",
        credits_per_operation=1,
        display_name="AI Assistant Query",
        description="Ask the AI assistant questions",
        is_active=True,
    )
    async_session.add(pricing)
    await async_session.commit()
    return pricing


def create_mock_token_usage() -> TokenUsage:
    """Create a mock token usage object."""
    return TokenUsage(
        prompt_tokens=100,
        completion_tokens=50,
        total_tokens=150,
        model="gpt-4o",
        estimated_cost_usd=Decimal("0.001"),
    )


class TestSessionEndpoints:
    """Tests for session management endpoints."""

    async def test_create_session(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test creating a new conversation session."""
        response = await authenticated_client.post(
            "/api/v1/ai/sessions",
            json={"title": "My Test Session"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "My Test Session"
        assert data["is_active"] is True
        assert data["message_count"] == 0

    async def test_create_session_default_title(
        self, authenticated_client: AsyncClient
    ):
        """Test creating session without title uses default."""
        response = await authenticated_client.post(
            "/api/v1/ai/sessions",
            json={},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "New Conversation"

    async def test_create_session_requires_auth(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated requests are rejected."""
        response = await unauthenticated_client.post(
            "/api/v1/ai/sessions",
            json={"title": "Test"},
        )
        assert response.status_code == 401

    async def test_list_sessions(self, authenticated_client: AsyncClient):
        """Test listing user's sessions."""
        # Create some sessions
        await authenticated_client.post(
            "/api/v1/ai/sessions", json={"title": "Session 1"}
        )
        await authenticated_client.post(
            "/api/v1/ai/sessions", json={"title": "Session 2"}
        )

        response = await authenticated_client.get("/api/v1/ai/sessions")

        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert len(data["sessions"]) >= 2
        assert data["total"] >= 2

    async def test_list_sessions_pagination(self, authenticated_client: AsyncClient):
        """Test session listing with pagination."""
        # Create 5 sessions
        for i in range(5):
            await authenticated_client.post(
                "/api/v1/ai/sessions", json={"title": f"Session {i}"}
            )

        response = await authenticated_client.get(
            "/api/v1/ai/sessions", params={"page": 1, "limit": 2}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["sessions"]) == 2
        assert data["page"] == 1
        assert data["limit"] == 2

    async def test_get_session(self, authenticated_client: AsyncClient):
        """Test getting a session with messages."""
        # Create a session
        create_response = await authenticated_client.post(
            "/api/v1/ai/sessions", json={"title": "Get Test"}
        )
        session_id = create_response.json()["id"]

        response = await authenticated_client.get(f"/api/v1/ai/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id
        assert data["title"] == "Get Test"
        assert "messages" in data

    async def test_get_session_not_found(self, authenticated_client: AsyncClient):
        """Test getting non-existent session returns 404."""
        response = await authenticated_client.get(f"/api/v1/ai/sessions/{uuid.uuid4()}")
        assert response.status_code == 404

    async def test_update_session_title(self, authenticated_client: AsyncClient):
        """Test updating session title."""
        # Create a session
        create_response = await authenticated_client.post(
            "/api/v1/ai/sessions", json={"title": "Original"}
        )
        session_id = create_response.json()["id"]

        response = await authenticated_client.patch(
            f"/api/v1/ai/sessions/{session_id}",
            json={"title": "Updated Title"},
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    async def test_update_session_not_found(self, authenticated_client: AsyncClient):
        """Test updating non-existent session returns 404."""
        response = await authenticated_client.patch(
            f"/api/v1/ai/sessions/{uuid.uuid4()}",
            json={"title": "New Title"},
        )
        assert response.status_code == 404

    async def test_delete_session_archive(self, authenticated_client: AsyncClient):
        """Test archiving (soft delete) a session."""
        # Create a session
        create_response = await authenticated_client.post(
            "/api/v1/ai/sessions", json={"title": "To Archive"}
        )
        session_id = create_response.json()["id"]

        response = await authenticated_client.delete(
            f"/api/v1/ai/sessions/{session_id}"
        )
        assert response.status_code == 204

        # Session should no longer appear in active list
        list_response = await authenticated_client.get(
            "/api/v1/ai/sessions", params={"active_only": True}
        )
        session_ids = [s["id"] for s in list_response.json()["sessions"]]
        assert session_id not in session_ids

    async def test_delete_session_permanent(self, authenticated_client: AsyncClient):
        """Test permanently deleting a session."""
        # Create a session
        create_response = await authenticated_client.post(
            "/api/v1/ai/sessions", json={"title": "To Delete"}
        )
        session_id = create_response.json()["id"]

        response = await authenticated_client.delete(
            f"/api/v1/ai/sessions/{session_id}",
            params={"permanent": True},
        )
        assert response.status_code == 204

        # Session should not be found
        get_response = await authenticated_client.get(
            f"/api/v1/ai/sessions/{session_id}"
        )
        assert get_response.status_code == 404

    async def test_delete_session_not_found(self, authenticated_client: AsyncClient):
        """Test deleting non-existent session returns 404."""
        response = await authenticated_client.delete(
            f"/api/v1/ai/sessions/{uuid.uuid4()}"
        )
        assert response.status_code == 404


class TestChatWithToolsEndpoint:
    """Tests for the /chat endpoint with tool calling."""

    @pytest.fixture(autouse=True)
    async def setup_pricing(self, assistant_query_pricing: CreditPricing):
        """Ensure pricing is set up for all chat tests."""
        pass

    async def test_chat_requires_auth(self, unauthenticated_client: AsyncClient):
        """Test that unauthenticated requests are rejected."""
        response = await unauthenticated_client.post(
            "/api/v1/ai/chat",
            json={"prompt": "Test prompt"},
        )
        assert response.status_code == 401

    async def test_chat_requires_credits(
        self,
        authenticated_client: AsyncClient,
        user_with_no_credits: User,
    ):
        """Test that users without credits get 402 error."""
        from src.auth.dependencies import get_current_user_id
        from src.main import app

        app.dependency_overrides[get_current_user_id] = lambda: user_with_no_credits.id

        response = await authenticated_client.post(
            "/api/v1/ai/chat",
            json={"prompt": "Test prompt"},
        )
        assert response.status_code == 402

    async def test_chat_creates_session_if_not_provided(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
    ):
        """Test that chat creates a new session if session_id not provided."""
        from src.ai.service import get_ai_service
        from src.ai.usage_service import get_ai_usage_service
        from src.main import app

        # Mock the AI service
        mock_service = MagicMock()
        mock_service.query_assistant_with_tools = AsyncMock(
            return_value=(
                "Here is your response",
                [
                    {"role": "user", "content": "Test prompt"},
                    {"role": "assistant", "content": "Here is your response"},
                ],
                create_mock_token_usage(),
            )
        )

        mock_usage_service = MagicMock()
        mock_usage_service.log_usage = AsyncMock()

        app.dependency_overrides[get_ai_service] = lambda: mock_service
        app.dependency_overrides[get_ai_usage_service] = lambda: mock_usage_service

        try:
            response = await authenticated_client.post(
                "/api/v1/ai/chat",
                json={"prompt": "Test prompt"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["session_id"] is not None
            assert data["response"] == "Here is your response"
        finally:
            app.dependency_overrides.pop(get_ai_service, None)
            app.dependency_overrides.pop(get_ai_usage_service, None)

    async def test_chat_continues_existing_session(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
    ):
        """Test that chat can continue an existing session."""
        from src.ai.service import get_ai_service
        from src.ai.usage_service import get_ai_usage_service
        from src.main import app

        # Create a session first
        create_response = await authenticated_client.post(
            "/api/v1/ai/sessions", json={"title": "Test Session"}
        )
        session_id = create_response.json()["id"]

        # Mock the AI service
        mock_service = MagicMock()
        mock_service.query_assistant_with_tools = AsyncMock(
            return_value=(
                "Continuing conversation",
                [
                    {"role": "user", "content": "Continue"},
                    {"role": "assistant", "content": "Continuing conversation"},
                ],
                create_mock_token_usage(),
            )
        )

        mock_usage_service = MagicMock()
        mock_usage_service.log_usage = AsyncMock()

        app.dependency_overrides[get_ai_service] = lambda: mock_service
        app.dependency_overrides[get_ai_usage_service] = lambda: mock_usage_service

        try:
            response = await authenticated_client.post(
                "/api/v1/ai/chat",
                json={"prompt": "Continue", "session_id": session_id},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["session_id"] == session_id
        finally:
            app.dependency_overrides.pop(get_ai_service, None)
            app.dependency_overrides.pop(get_ai_usage_service, None)

    async def test_chat_session_not_found(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
    ):
        """Test that using non-existent session_id returns 404."""
        response = await authenticated_client.post(
            "/api/v1/ai/chat",
            json={"prompt": "Test", "session_id": str(uuid.uuid4())},
        )
        assert response.status_code == 404

    async def test_chat_returns_tools_used(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
    ):
        """Test that chat response includes tools_used."""
        from src.ai.service import get_ai_service
        from src.ai.usage_service import get_ai_usage_service
        from src.main import app

        mock_service = MagicMock()
        mock_service.query_assistant_with_tools = AsyncMock(
            return_value=(
                "Found 5 items",
                [
                    {"role": "user", "content": "Search for drills"},
                    {
                        "role": "assistant",
                        "tool_calls": [
                            {
                                "id": "call_1",
                                "type": "function",
                                "function": {
                                    "name": "search_items",
                                    "arguments": '{"query":"drill"}',
                                },
                            }
                        ],
                    },
                    {
                        "role": "tool",
                        "name": "search_items",
                        "tool_call_id": "call_1",
                        "content": '{"items": [], "count": 0}',
                    },
                    {"role": "assistant", "content": "Found 5 items"},
                ],
                create_mock_token_usage(),
            )
        )

        mock_usage_service = MagicMock()
        mock_usage_service.log_usage = AsyncMock()

        app.dependency_overrides[get_ai_service] = lambda: mock_service
        app.dependency_overrides[get_ai_usage_service] = lambda: mock_usage_service

        try:
            response = await authenticated_client.post(
                "/api/v1/ai/chat",
                json={"prompt": "Search for drills"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "tools_used" in data
            assert "search_items" in data["tools_used"]
        finally:
            app.dependency_overrides.pop(get_ai_service, None)
            app.dependency_overrides.pop(get_ai_usage_service, None)

    async def test_chat_deducts_credit(
        self,
        authenticated_client: AsyncClient,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test that successful chat deducts credit."""
        from src.ai.service import get_ai_service
        from src.ai.usage_service import get_ai_usage_service
        from src.main import app

        initial_credits = test_user.free_credits_remaining

        mock_service = MagicMock()
        mock_service.query_assistant_with_tools = AsyncMock(
            return_value=(
                "Response",
                [
                    {"role": "user", "content": "Test"},
                    {"role": "assistant", "content": "Response"},
                ],
                create_mock_token_usage(),
            )
        )

        mock_usage_service = MagicMock()
        mock_usage_service.log_usage = AsyncMock()

        app.dependency_overrides[get_ai_service] = lambda: mock_service
        app.dependency_overrides[get_ai_usage_service] = lambda: mock_usage_service

        try:
            response = await authenticated_client.post(
                "/api/v1/ai/chat",
                json={"prompt": "Test"},
            )

            assert response.status_code == 200
            assert response.json()["credits_used"] == 1

            await async_session.refresh(test_user)
            assert test_user.free_credits_remaining == initial_credits - 1
        finally:
            app.dependency_overrides.pop(get_ai_service, None)
            app.dependency_overrides.pop(get_ai_usage_service, None)

    async def test_chat_handles_ai_error(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
    ):
        """Test that AI errors are handled gracefully."""
        from src.ai.service import get_ai_service
        from src.main import app

        mock_service = MagicMock()
        mock_service.query_assistant_with_tools = AsyncMock(
            side_effect=Exception("OpenAI API error")
        )

        app.dependency_overrides[get_ai_service] = lambda: mock_service

        try:
            response = await authenticated_client.post(
                "/api/v1/ai/chat",
                json={"prompt": "Test"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert "error" in data
            assert "OpenAI API error" in data["error"]
        finally:
            app.dependency_overrides.pop(get_ai_service, None)

    async def test_chat_new_session_uses_generic_title(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
    ):
        """Test that new sessions use generic title for privacy."""
        from src.ai.service import get_ai_service
        from src.ai.usage_service import get_ai_usage_service
        from src.main import app

        mock_service = MagicMock()
        mock_service.query_assistant_with_tools = AsyncMock(
            return_value=(
                "Response",
                [
                    {"role": "user", "content": "Sensitive prompt content here"},
                    {"role": "assistant", "content": "Response"},
                ],
                create_mock_token_usage(),
            )
        )

        mock_usage_service = MagicMock()
        mock_usage_service.log_usage = AsyncMock()

        app.dependency_overrides[get_ai_service] = lambda: mock_service
        app.dependency_overrides[get_ai_usage_service] = lambda: mock_usage_service

        try:
            response = await authenticated_client.post(
                "/api/v1/ai/chat",
                json={"prompt": "Sensitive prompt content here"},
            )

            assert response.status_code == 200
            session_id = response.json()["session_id"]

            # Check the session title
            session_response = await authenticated_client.get(
                f"/api/v1/ai/sessions/{session_id}"
            )
            assert session_response.json()["title"] == "New Conversation"
        finally:
            app.dependency_overrides.pop(get_ai_service, None)
            app.dependency_overrides.pop(get_ai_usage_service, None)


class TestSessionIsolation:
    """Tests for user data isolation in session endpoints."""

    @pytest.fixture(autouse=True)
    async def setup_pricing(self, assistant_query_pricing: CreditPricing):
        """Ensure pricing is set up for tests that need it."""
        pass

    @pytest.fixture
    async def other_user(self, async_session: AsyncSession) -> User:
        """Create another user for isolation tests."""
        user = User(
            id=uuid.uuid4(),
            email="other@example.com",
            name="Other User",
            oauth_provider="google",
            oauth_id="google_other_123",
            free_credits_remaining=5,
        )
        async_session.add(user)
        await async_session.commit()
        return user

    @pytest.fixture
    async def other_user_session(
        self, async_session: AsyncSession, other_user: User
    ) -> AIConversationSession:
        """Create a session belonging to another user."""
        session = AIConversationSession(
            id=uuid.uuid4(),
            user_id=other_user.id,
            title="Other User's Session",
        )
        async_session.add(session)
        await async_session.commit()
        return session

    async def test_cannot_access_other_users_session(
        self,
        authenticated_client: AsyncClient,
        other_user_session: AIConversationSession,
    ):
        """Test that users cannot access other users' sessions."""
        response = await authenticated_client.get(
            f"/api/v1/ai/sessions/{other_user_session.id}"
        )
        assert response.status_code == 404

    async def test_cannot_update_other_users_session(
        self,
        authenticated_client: AsyncClient,
        other_user_session: AIConversationSession,
    ):
        """Test that users cannot update other users' sessions."""
        response = await authenticated_client.patch(
            f"/api/v1/ai/sessions/{other_user_session.id}",
            json={"title": "Hacked Title"},
        )
        assert response.status_code == 404

    async def test_cannot_delete_other_users_session(
        self,
        authenticated_client: AsyncClient,
        other_user_session: AIConversationSession,
    ):
        """Test that users cannot delete other users' sessions."""
        response = await authenticated_client.delete(
            f"/api/v1/ai/sessions/{other_user_session.id}"
        )
        assert response.status_code == 404

    async def test_list_sessions_only_shows_own(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        other_user_session: AIConversationSession,
    ):
        """Test that listing sessions only shows user's own sessions."""
        # Create a session for the authenticated user
        await authenticated_client.post(
            "/api/v1/ai/sessions", json={"title": "My Session"}
        )

        response = await authenticated_client.get("/api/v1/ai/sessions")

        data = response.json()
        session_ids = [s["id"] for s in data["sessions"]]

        # Should not include other user's session
        assert str(other_user_session.id) not in session_ids

    async def test_cannot_chat_in_other_users_session(
        self,
        authenticated_client: AsyncClient,
        other_user_session: AIConversationSession,
    ):
        """Test that users cannot chat in other users' sessions."""
        response = await authenticated_client.post(
            "/api/v1/ai/chat",
            json={
                "prompt": "Test",
                "session_id": str(other_user_session.id),
            },
        )
        assert response.status_code == 404
