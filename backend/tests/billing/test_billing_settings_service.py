"""Unit tests for BillingSettingsService."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import AppSetting
from src.billing.settings_service import DEFAULT_SETTINGS, BillingSettingsService


class TestBillingSettingsService:
    """Tests for BillingSettingsService."""

    async def test_get_all_settings(
        self, async_session: AsyncSession, app_settings: list[AppSetting]
    ):
        """Test getting all settings."""
        service = BillingSettingsService(async_session)
        settings = await service.get_all_settings()

        assert len(settings) == 2
        setting_keys = {s.setting_key for s in settings}
        assert "signup_credits" in setting_keys
        assert "max_images_per_item" in setting_keys

    async def test_get_all_settings_empty(self, async_session: AsyncSession):
        """Test getting all settings when none exist."""
        service = BillingSettingsService(async_session)
        settings = await service.get_all_settings()

        assert len(settings) == 0

    async def test_get_setting_by_id(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test getting settings by ID."""
        service = BillingSettingsService(async_session)

        setting = await service.get_setting_by_id(app_setting.id)

        assert setting is not None
        assert setting.id == app_setting.id
        assert setting.setting_key == "signup_credits"

    async def test_get_setting_by_id_not_found(self, async_session: AsyncSession):
        """Test getting settings with non-existent ID."""
        service = BillingSettingsService(async_session)
        setting = await service.get_setting_by_id(uuid.uuid4())

        assert setting is None

    async def test_get_setting_by_key(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test getting settings by key."""
        service = BillingSettingsService(async_session)
        setting = await service.get_setting_by_key("signup_credits")

        assert setting is not None
        assert setting.setting_key == "signup_credits"
        assert setting.value_int == 5

    async def test_get_setting_by_key_not_found(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test getting settings for non-existent key."""
        service = BillingSettingsService(async_session)
        setting = await service.get_setting_by_key("nonexistent_key")

        assert setting is None

    async def test_get_signup_credits(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test getting signup credits value."""
        service = BillingSettingsService(async_session)
        credits = await service.get_signup_credits()

        assert credits == 5

    async def test_get_signup_credits_fallback_to_default(
        self, async_session: AsyncSession
    ):
        """Test fallback to default when no setting exists."""
        service = BillingSettingsService(async_session)
        credits = await service.get_signup_credits()

        assert credits == DEFAULT_SETTINGS["signup_credits"]

    async def test_update_setting_value(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test updating setting value."""
        service = BillingSettingsService(async_session)

        updated = await service.update_setting(app_setting.id, value_int=10)

        assert updated is not None
        assert updated.value_int == 10

    async def test_update_setting_display_name(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test updating display name."""
        service = BillingSettingsService(async_session)

        updated = await service.update_setting(
            app_setting.id, display_name="New Display Name"
        )

        assert updated is not None
        assert updated.display_name == "New Display Name"

    async def test_update_setting_description(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test updating description."""
        service = BillingSettingsService(async_session)

        updated = await service.update_setting(
            app_setting.id, description="New description"
        )

        assert updated is not None
        assert updated.description == "New description"

    async def test_update_setting_invalid_negative_value(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test that negative value_int raises ValueError."""
        service = BillingSettingsService(async_session)

        with pytest.raises(ValueError, match="value_int must be non-negative"):
            await service.update_setting(app_setting.id, value_int=-1)

    async def test_update_setting_not_found(self, async_session: AsyncSession):
        """Test updating non-existent settings returns None."""
        service = BillingSettingsService(async_session)
        result = await service.update_setting(uuid.uuid4(), value_int=10)

        assert result is None

    async def test_cache_invalidation_on_update(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test that cache is invalidated after update."""
        service = BillingSettingsService(async_session)

        # Populate cache
        await service.get_setting_by_key("signup_credits")
        assert len(service._cache) > 0
        assert service._cache_expiry is not None

        # Update settings
        await service.update_setting(app_setting.id, value_int=20)

        # Cache should be invalidated
        assert len(service._cache) == 0
        assert service._cache_expiry is None

    async def test_cache_is_populated_on_first_access(
        self, async_session: AsyncSession, app_settings: list[AppSetting]
    ):
        """Test that cache is populated on first access."""
        service = BillingSettingsService(async_session)

        # Cache should be empty initially
        assert len(service._cache) == 0
        assert service._cache_expiry is None

        # Access settings
        await service.get_setting_by_key("signup_credits")

        # Cache should be populated with all settings
        assert len(service._cache) == 2
        assert service._cache_expiry is not None

    async def test_default_settings_has_signup_credits(self):
        """Test that DEFAULT_SETTINGS contains signup_credits."""
        assert "signup_credits" in DEFAULT_SETTINGS
        assert isinstance(DEFAULT_SETTINGS["signup_credits"], int)
        assert DEFAULT_SETTINGS["signup_credits"] >= 0

    async def test_update_setting_boundary_zero(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test updating setting with zero value."""
        service = BillingSettingsService(async_session)

        updated = await service.update_setting(app_setting.id, value_int=0)

        assert updated is not None
        assert updated.value_int == 0

    async def test_get_signup_credits_with_null_value(
        self, async_session: AsyncSession
    ):
        """Test that null value_int falls back to default."""
        setting = AppSetting(
            id=uuid.uuid4(),
            setting_key="signup_credits",
            value_int=None,  # Explicitly null
            display_name="Signup Credits",
            description="Test",
        )
        async_session.add(setting)
        await async_session.commit()

        service = BillingSettingsService(async_session)
        credits = await service.get_signup_credits()

        assert credits == DEFAULT_SETTINGS["signup_credits"]
