"""Tests for AI classification service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.ai.service import AIClassificationService


def create_mock_openai_response(content: str, model: str = "gpt-4o") -> MagicMock:
    """Create a mock OpenAI response with proper usage data."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content=content))]
    mock_response.model = model
    mock_response.usage = MagicMock()
    mock_response.usage.prompt_tokens = 100
    mock_response.usage.completion_tokens = 50
    mock_response.usage.total_tokens = 150
    return mock_response


class TestAIClassificationService:
    """Tests for the AIClassificationService class."""

    @pytest.fixture
    def mock_settings(self):
        """Create mock settings."""
        settings = MagicMock()
        settings.openai_api_key = "test-api-key"
        settings.openai_model = "gpt-4-vision-preview"
        settings.ai_templates_dir = None
        return settings

    @pytest.fixture
    def mock_template_manager(self):
        """Create mock template manager."""
        manager = MagicMock()
        manager.get_system_prompt.return_value = (
            "You are an expert inventory assistant."
        )
        manager.get_user_prompt.return_value = (
            "Analyze this image and return JSON with identified_name."
        )
        return manager

    @pytest.fixture
    def mock_model_settings_service(self):
        """Create mock model settings service."""
        service = MagicMock()
        service.get_operation_settings = AsyncMock(
            return_value={
                "model_name": "gpt-4o",
                "temperature": 0.3,
                "max_tokens": 2000,
            }
        )
        return service

    @pytest.fixture
    def service(
        self, mock_settings, mock_template_manager, mock_model_settings_service
    ):
        """Create AI service with mocked dependencies."""
        with patch("src.ai.service.AsyncOpenAI"):
            service = AIClassificationService(
                settings=mock_settings,
                template_manager=mock_template_manager,
                model_settings_service=mock_model_settings_service,
            )
            return service

    async def test_classify_image_without_custom_prompt(
        self, service, mock_template_manager
    ):
        """Test classification without custom prompt uses default prompts."""
        # Mock the OpenAI response - AI returns dict format
        mock_response = create_mock_openai_response(
            '{"identified_name": "Test Item", "confidence": 0.95, '
            '"category_path": "Test > Category", "description": "A test item", '
            '"specifications": {}}'
        )
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Call classify_image without custom_prompt
        result = await service.classify_image(
            b"fake_image_data", mime_type="image/jpeg"
        )

        # Verify result
        assert result.identified_name == "Test Item"
        assert result.confidence == 0.95
        # Specifications should be converted to array format (empty array)
        assert result.specifications == []

        # Verify that template manager was called
        mock_template_manager.get_system_prompt.assert_called_once()
        mock_template_manager.get_user_prompt.assert_called_once()

        # Verify the user prompt was NOT modified
        call_args = service.client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        user_message = messages[1]
        user_content = user_message["content"][0]["text"]
        assert "Additional context from the user" not in user_content

    async def test_classify_image_with_custom_prompt(
        self, service, mock_template_manager
    ):
        """Test classification with custom prompt appends user context."""
        # Mock the OpenAI response - AI returns dict format
        mock_response = create_mock_openai_response(
            '{"identified_name": "Bin A1", "confidence": 0.92, '
            '"category_path": "Storage > Bins", "description": "A storage bin", '
            '"specifications": {"location": "A1"}}'
        )
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        custom_prompt = "Label bins using the format Row-Column (e.g., A1, B3)"

        # Call classify_image with custom_prompt
        result = await service.classify_image(
            b"fake_image_data", mime_type="image/jpeg", custom_prompt=custom_prompt
        )

        # Verify result
        assert result.identified_name == "Bin A1"
        # Specifications should be converted to array format
        assert len(result.specifications) == 1
        assert result.specifications[0].key == "location"
        assert result.specifications[0].value == "A1"

        # Verify the user prompt was modified to include custom context
        call_args = service.client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        user_message = messages[1]
        user_content = user_message["content"][0]["text"]
        assert "Additional context from the user" in user_content
        assert custom_prompt in user_content

    async def test_classify_image_with_empty_custom_prompt(
        self, service, mock_template_manager
    ):
        """Test classification with empty custom prompt behaves like no custom prompt."""
        # Mock the OpenAI response
        mock_response = create_mock_openai_response(
            '{"identified_name": "Test Item", "confidence": 0.9, '
            '"category_path": "Test", "description": "Item", "specifications": {}}'
        )
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Call with empty string
        await service.classify_image(
            b"fake_image_data", mime_type="image/jpeg", custom_prompt=""
        )

        # Verify the user prompt was NOT modified
        call_args = service.client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        user_message = messages[1]
        user_content = user_message["content"][0]["text"]
        assert "Additional context from the user" not in user_content

    async def test_classify_image_with_none_custom_prompt(
        self, service, mock_template_manager
    ):
        """Test classification with None custom prompt behaves like no custom prompt."""
        # Mock the OpenAI response
        mock_response = create_mock_openai_response(
            '{"identified_name": "Test Item", "confidence": 0.9, '
            '"category_path": "Test", "description": "Item", "specifications": {}}'
        )
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Call with None (explicit)
        await service.classify_image(
            b"fake_image_data", mime_type="image/jpeg", custom_prompt=None
        )

        # Verify the user prompt was NOT modified
        call_args = service.client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        user_message = messages[1]
        user_content = user_message["content"][0]["text"]
        assert "Additional context from the user" not in user_content

    async def test_classify_image_custom_prompt_preserved_in_api_call(
        self, service, mock_template_manager
    ):
        """Test that custom prompt is correctly included in the API call."""
        # Mock the OpenAI response
        mock_response = create_mock_openai_response(
            '{"identified_name": "Component", "confidence": 0.85, '
            '"category_path": "Electronics", "description": "Electronic component", '
            '"specifications": {}}'
        )
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        custom_prompt = "This is a custom electronic component from my PCB project"

        await service.classify_image(
            b"fake_image_data", mime_type="image/png", custom_prompt=custom_prompt
        )

        # Verify the full message structure
        call_args = service.client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]

        # Check system message
        assert messages[0]["role"] == "system"

        # Check user message structure
        assert messages[1]["role"] == "user"
        assert isinstance(messages[1]["content"], list)

        # First content should be text with the combined prompt
        text_content = messages[1]["content"][0]
        assert text_content["type"] == "text"
        assert "Additional context from the user:" in text_content["text"]
        assert "custom electronic component" in text_content["text"]
        assert "PCB project" in text_content["text"]

        # Second content should be image
        image_content = messages[1]["content"][1]
        assert image_content["type"] == "image_url"
        assert image_content["image_url"]["url"].startswith("data:image/png;base64,")

    async def test_suggest_item_location_calls_get_user_prompt_with_kwargs(
        self, service, mock_template_manager
    ):
        """Test that suggest_item_location passes context as keyword arguments."""
        # Mock the OpenAI response
        mock_response = create_mock_openai_response('{"suggestions": []}')
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Call suggest_item_location
        await service.suggest_item_location(
            item_name="Test Screw",
            item_category="Hardware > Fasteners",
            item_description="A small screw",
            item_specifications={"size": "M3"},
            locations=[
                {
                    "id": "12345678-1234-1234-1234-123456789abc",
                    "name": "Hardware Drawer",
                    "type": "drawer",
                    "item_count": 10,
                    "sample_items": ["Nails", "Bolts"],
                }
            ],
            similar_items=[{"name": "M4 Screw", "location": "Hardware Drawer"}],
        )

        # Verify get_user_prompt was called with keyword arguments
        call_args = mock_template_manager.get_user_prompt.call_args
        # The call should be (category, **context)
        assert call_args[0][0] == "location_suggestion"
        # Verify all expected context keys are passed as kwargs
        assert "item_name" in call_args[1]
        assert call_args[1]["item_name"] == "Test Screw"
        assert "item_category" in call_args[1]
        assert call_args[1]["item_category"] == "Hardware > Fasteners"
        assert "item_description" in call_args[1]
        assert "item_specifications" in call_args[1]
        assert "locations" in call_args[1]
        assert "similar_items" in call_args[1]

    async def test_suggest_item_location_returns_suggestions(
        self, service, mock_template_manager
    ):
        """Test that suggest_item_location correctly parses AI suggestions."""
        # Mock the OpenAI response with valid suggestions
        mock_response = create_mock_openai_response(
            '{"suggestions": [{"location_id": '
            '"12345678-1234-1234-1234-123456789abc", '
            '"location_name": "Hardware Drawer", '
            '"confidence": 0.95, '
            '"reasoning": "Good match for fasteners"}]}'
        )
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Call suggest_item_location
        result = await service.suggest_item_location(
            item_name="Test Screw",
            item_category="Hardware > Fasteners",
            item_description="A small screw",
            item_specifications=None,
            locations=[],
        )

        # Verify result
        assert len(result.suggestions) == 1
        assert result.suggestions[0].location_name == "Hardware Drawer"
        assert result.suggestions[0].confidence == 0.95
        assert result.suggestions[0].reasoning == "Good match for fasteners"
