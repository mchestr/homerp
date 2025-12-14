"""Tests for AI classification service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.ai.service import AIClassificationService


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
    def service(self, mock_settings, mock_template_manager):
        """Create AI service with mocked dependencies."""
        with patch("src.ai.service.AsyncOpenAI"):
            service = AIClassificationService(
                settings=mock_settings, template_manager=mock_template_manager
            )
            return service

    async def test_classify_image_without_custom_prompt(
        self, service, mock_template_manager
    ):
        """Test classification without custom prompt uses default prompts."""
        # Mock the OpenAI response
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"identified_name": "Test Item", "confidence": 0.95, '
                    '"category_path": "Test > Category", "description": "A test item", '
                    '"specifications": {}}'
                )
            )
        ]
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Call classify_image without custom_prompt
        result = await service.classify_image(
            b"fake_image_data", mime_type="image/jpeg"
        )

        # Verify result
        assert result.identified_name == "Test Item"
        assert result.confidence == 0.95

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
        # Mock the OpenAI response
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"identified_name": "Bin A1", "confidence": 0.92, '
                    '"category_path": "Storage > Bins", "description": "A storage bin", '
                    '"specifications": {"location": "A1"}}'
                )
            )
        ]
        service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        custom_prompt = "Label bins using the format Row-Column (e.g., A1, B3)"

        # Call classify_image with custom_prompt
        result = await service.classify_image(
            b"fake_image_data", mime_type="image/jpeg", custom_prompt=custom_prompt
        )

        # Verify result
        assert result.identified_name == "Bin A1"

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
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"identified_name": "Test Item", "confidence": 0.9, '
                    '"category_path": "Test", "description": "Item", "specifications": {}}'
                )
            )
        ]
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
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"identified_name": "Test Item", "confidence": 0.9, '
                    '"category_path": "Test", "description": "Item", "specifications": {}}'
                )
            )
        ]
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
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"identified_name": "Component", "confidence": 0.85, '
                    '"category_path": "Electronics", "description": "Electronic component", '
                    '"specifications": {}}'
                )
            )
        ]
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
