"""Billing settings service for managing configurable billing parameters."""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import AppSetting
from src.database import get_session

# Default values for settings if not found in database
DEFAULT_SETTINGS = {
    "signup_credits": 5,
}


class BillingSettingsService:
    """Service for managing billing-related application settings with caching."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._cache: dict[str, AppSetting] = {}
        self._cache_expiry: datetime | None = None
        self._cache_ttl = timedelta(minutes=5)

    async def get_all_settings(self) -> list[AppSetting]:
        """Get all billing settings records ordered by display name."""
        result = await self.session.execute(
            select(AppSetting).order_by(AppSetting.display_name)
        )
        return list(result.scalars().all())

    async def get_setting_by_id(self, setting_id: UUID) -> AppSetting | None:
        """Get setting by ID."""
        result = await self.session.execute(
            select(AppSetting).where(AppSetting.id == setting_id)
        )
        return result.scalar_one_or_none()

    async def get_setting_by_key(self, setting_key: str) -> AppSetting | None:
        """Get setting by key with caching.

        Cache is shared across all settings and expires after 5 minutes.
        """
        now = datetime.now(UTC)

        # Check if cache is valid
        if self._cache_expiry is None or now > self._cache_expiry:
            # Cache expired or not initialized - reload all settings
            all_settings = await self.get_all_settings()
            self._cache = {s.setting_key: s for s in all_settings}
            self._cache_expiry = now + self._cache_ttl

        return self._cache.get(setting_key)

    async def get_signup_credits(self) -> int:
        """Get the number of credits granted to new users.

        Falls back to default value if not found in database.
        """
        setting = await self.get_setting_by_key("signup_credits")
        if setting and setting.value_int is not None:
            return setting.value_int
        return DEFAULT_SETTINGS["signup_credits"]

    async def update_setting(
        self,
        setting_id: UUID,
        value_int: int | None = None,
        display_name: str | None = None,
        description: str | None = None,
    ) -> AppSetting | None:
        """Update a billing setting and invalidate cache.

        Raises:
            ValueError: If validation fails
        """
        setting = await self.get_setting_by_id(setting_id)
        if not setting:
            return None

        # Validate and update fields
        if value_int is not None:
            if value_int < 0:
                raise ValueError("value_int must be non-negative")
            setting.value_int = value_int

        if display_name is not None:
            setting.display_name = display_name

        if description is not None:
            setting.description = description

        await self.session.commit()
        await self.session.refresh(setting)

        # Invalidate cache after update
        self._invalidate_cache()

        return setting

    def _invalidate_cache(self):
        """Clear the cache to force reload on next access."""
        self._cache.clear()
        self._cache_expiry = None


async def get_billing_settings_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BillingSettingsService:
    """Dependency to get billing settings service."""
    return BillingSettingsService(session)
