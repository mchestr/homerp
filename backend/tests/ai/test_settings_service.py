"""Unit tests for AIModelSettingsService."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.models import AIModelSettings
from src.ai.settings_service import DEFAULT_SETTINGS, AIModelSettingsService


class TestAIModelSettingsService:
    """Tests for AIModelSettingsService."""

    async def test_get_all_settings(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test getting all settings."""
        service = AIModelSettingsService(async_session)
        settings = await service.get_all_settings()

        assert len(settings) == 4
        operation_types = {s.operation_type for s in settings}
        assert "image_classification" in operation_types
        assert "location_analysis" in operation_types
        assert "location_suggestion" in operation_types
        assert "assistant_query" in operation_types

    async def test_get_settings_by_id(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test getting settings by ID."""
        service = AIModelSettingsService(async_session)
        expected = ai_model_settings[0]

        settings = await service.get_settings_by_id(expected.id)

        assert settings is not None
        assert settings.id == expected.id
        assert settings.operation_type == expected.operation_type

    async def test_get_settings_by_id_not_found(self, async_session: AsyncSession):
        """Test getting settings with non-existent ID."""
        import uuid

        service = AIModelSettingsService(async_session)
        settings = await service.get_settings_by_id(uuid.uuid4())

        assert settings is None

    async def test_get_settings_by_operation(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test getting settings by operation type."""
        service = AIModelSettingsService(async_session)
        settings = await service.get_settings_by_operation("image_classification")

        assert settings is not None
        assert settings.operation_type == "image_classification"

    async def test_get_settings_by_operation_not_found(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test getting settings for non-existent operation type."""
        service = AIModelSettingsService(async_session)
        settings = await service.get_settings_by_operation("nonexistent_operation")

        assert settings is None

    async def test_get_operation_settings_returns_dict(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test that get_operation_settings returns expected dict format."""
        service = AIModelSettingsService(async_session)
        settings = await service.get_operation_settings("image_classification")

        assert isinstance(settings, dict)
        assert "model_name" in settings
        assert "temperature" in settings
        assert "max_tokens" in settings
        assert settings["model_name"] == "gpt-4o"
        assert settings["temperature"] == 1.0
        assert settings["max_tokens"] == 1000

    async def test_get_operation_settings_fallback_for_unknown(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test fallback to defaults for unknown operation type."""
        service = AIModelSettingsService(async_session)
        settings = await service.get_operation_settings("unknown_operation")

        # Should fallback to default settings
        assert settings["model_name"] == "gpt-4o"
        assert settings["temperature"] == 1.0
        assert settings["max_tokens"] == 1000

    async def test_get_operation_settings_fallback_for_inactive(
        self, async_session: AsyncSession, inactive_ai_model_settings: AIModelSettings
    ):
        """Test fallback to defaults for inactive settings."""
        service = AIModelSettingsService(async_session)
        settings = await service.get_operation_settings("inactive_operation")

        # Should fallback to default settings since the operation is inactive
        assert settings["model_name"] == "gpt-4o"  # Default, not gpt-4o-mini
        assert settings["temperature"] == 1.0  # Default, not 0.5
        assert settings["max_tokens"] == 1000  # Default, not 500

    async def test_update_settings_model_name(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test updating model name."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        updated = await service.update_settings(settings.id, model_name="gpt-4o-mini")

        assert updated is not None
        assert updated.model_name == "gpt-4o-mini"

    async def test_update_settings_temperature(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test updating temperature."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        updated = await service.update_settings(settings.id, temperature=0.7)

        assert updated is not None
        assert float(updated.temperature) == 0.7

    async def test_update_settings_max_tokens(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test updating max_tokens."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        updated = await service.update_settings(settings.id, max_tokens=2000)

        assert updated is not None
        assert updated.max_tokens == 2000

    async def test_update_settings_invalid_temperature_low(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test that temperature < 0 raises ValueError."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        with pytest.raises(ValueError, match="temperature must be between 0.0 and 2.0"):
            await service.update_settings(settings.id, temperature=-0.1)

    async def test_update_settings_invalid_temperature_high(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test that temperature > 2 raises ValueError."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        with pytest.raises(ValueError, match="temperature must be between 0.0 and 2.0"):
            await service.update_settings(settings.id, temperature=2.1)

    async def test_update_settings_invalid_max_tokens_low(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test that max_tokens < 1 raises ValueError."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        with pytest.raises(ValueError, match="max_tokens must be at least 1"):
            await service.update_settings(settings.id, max_tokens=0)

    async def test_update_settings_invalid_max_tokens_high(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test that max_tokens > 100000 raises ValueError."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        with pytest.raises(ValueError, match="max_tokens must not exceed 100,000"):
            await service.update_settings(settings.id, max_tokens=100001)

    async def test_update_settings_not_found(self, async_session: AsyncSession):
        """Test updating non-existent settings returns None."""
        import uuid

        service = AIModelSettingsService(async_session)
        result = await service.update_settings(uuid.uuid4(), model_name="test")

        assert result is None

    async def test_cache_invalidation_on_update(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test that cache is invalidated after update."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        # Populate cache
        await service.get_settings_by_operation("image_classification")
        assert len(service._cache) > 0
        assert service._cache_expiry is not None

        # Update settings
        await service.update_settings(settings.id, model_name="gpt-4o-mini")

        # Cache should be invalidated
        assert len(service._cache) == 0
        assert service._cache_expiry is None

    async def test_cache_is_populated_on_first_access(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test that cache is populated on first access."""
        service = AIModelSettingsService(async_session)

        # Cache should be empty initially
        assert len(service._cache) == 0
        assert service._cache_expiry is None

        # Access settings
        await service.get_settings_by_operation("image_classification")

        # Cache should be populated with all settings
        assert len(service._cache) == 4
        assert service._cache_expiry is not None

    async def test_default_settings_has_all_operation_types(self):
        """Test that DEFAULT_SETTINGS contains all expected operation types."""
        expected_operations = [
            "image_classification",
            "location_analysis",
            "location_suggestion",
            "assistant_query",
        ]
        for op in expected_operations:
            assert op in DEFAULT_SETTINGS
            assert "model_name" in DEFAULT_SETTINGS[op]
            assert "temperature" in DEFAULT_SETTINGS[op]
            assert "max_tokens" in DEFAULT_SETTINGS[op]

    async def test_temperature_boundary_values(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test boundary values for temperature."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        # Test lower boundary (0.0)
        updated = await service.update_settings(settings.id, temperature=0.0)
        assert updated is not None
        assert float(updated.temperature) == 0.0

        # Test upper boundary (2.0)
        updated = await service.update_settings(settings.id, temperature=2.0)
        assert updated is not None
        assert float(updated.temperature) == 2.0

    async def test_max_tokens_boundary_values(
        self, async_session: AsyncSession, ai_model_settings: list[AIModelSettings]
    ):
        """Test boundary values for max_tokens."""
        service = AIModelSettingsService(async_session)
        settings = ai_model_settings[0]

        # Test lower boundary (1)
        updated = await service.update_settings(settings.id, max_tokens=1)
        assert updated is not None
        assert updated.max_tokens == 1

        # Test upper boundary (100000)
        updated = await service.update_settings(settings.id, max_tokens=100000)
        assert updated is not None
        assert updated.max_tokens == 100000
