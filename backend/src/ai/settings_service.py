"""AI model settings service for managing model configuration with caching."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.models import AIModelSettings
from src.database import get_session

# Default settings for operations if not found in database
# These match the current hardcoded values in ai/service.py
DEFAULT_SETTINGS = {
    "image_classification": {
        "model_name": "gpt-4o",
        "temperature": 1.0,
        "max_tokens": 1000,
    },
    "location_analysis": {
        "model_name": "gpt-4o",
        "temperature": 1.0,
        "max_tokens": 2000,
    },
    "location_suggestion": {
        "model_name": "gpt-4o",
        "temperature": 1.0,
        "max_tokens": 1000,
    },
    "assistant_query": {
        "model_name": "gpt-4o",
        "temperature": 1.0,
        "max_tokens": 2000,
    },
}


class AIModelSettingsService:
    """Service for managing AI model settings with in-memory caching."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._cache: dict[str, AIModelSettings] = {}
        self._cache_expiry: datetime | None = None
        self._cache_ttl = timedelta(minutes=5)

    async def get_all_settings(self) -> list[AIModelSettings]:
        """Get all settings records ordered by display name."""
        result = await self.session.execute(
            select(AIModelSettings).order_by(AIModelSettings.display_name)
        )
        return list(result.scalars().all())

    async def get_settings_by_id(self, settings_id: UUID) -> AIModelSettings | None:
        """Get settings by ID."""
        result = await self.session.execute(
            select(AIModelSettings).where(AIModelSettings.id == settings_id)
        )
        return result.scalar_one_or_none()

    async def get_settings_by_operation(
        self, operation_type: str
    ) -> AIModelSettings | None:
        """Get settings for a specific operation type with caching.

        Cache is shared across all operation types and expires after 5 minutes.
        """
        now = datetime.now(UTC)

        # Check if cache is valid
        if self._cache_expiry is None or now > self._cache_expiry:
            # Cache expired or not initialized - reload all settings
            all_settings = await self.get_all_settings()
            self._cache = {s.operation_type: s for s in all_settings}
            self._cache_expiry = now + self._cache_ttl

        return self._cache.get(operation_type)

    async def get_operation_settings(self, operation_type: str) -> dict[str, Any]:
        """Get settings for an operation with fallback to defaults.

        Returns dict with: model_name, temperature, max_tokens

        Falls back to DEFAULT_SETTINGS if:
        - Settings not found in database
        - Settings are inactive
        """
        settings = await self.get_settings_by_operation(operation_type)

        # Use settings if found and active
        if settings and settings.is_active:
            return {
                "model_name": settings.model_name,
                "temperature": float(settings.temperature),
                "max_tokens": settings.max_tokens,
            }

        # Fall back to defaults
        return DEFAULT_SETTINGS.get(
            operation_type,
            {
                "model_name": "gpt-4o",
                "temperature": 1.0,
                "max_tokens": 1000,
            },
        )

    async def update_settings(
        self,
        settings_id: UUID,
        model_name: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        display_name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
    ) -> AIModelSettings | None:
        """Update settings configuration and invalidate cache.

        Raises:
            ValueError: If validation fails for temperature or max_tokens
        """
        settings = await self.get_settings_by_id(settings_id)
        if not settings:
            return None

        # Validate and update fields
        if model_name is not None:
            settings.model_name = model_name

        if temperature is not None:
            if not 0.0 <= temperature <= 2.0:
                raise ValueError("temperature must be between 0.0 and 2.0")
            settings.temperature = Decimal(str(temperature))

        if max_tokens is not None:
            if max_tokens < 1:
                raise ValueError("max_tokens must be at least 1")
            if max_tokens > 100000:
                raise ValueError("max_tokens must not exceed 100,000")
            settings.max_tokens = max_tokens

        if display_name is not None:
            settings.display_name = display_name

        if description is not None:
            settings.description = description

        if is_active is not None:
            settings.is_active = is_active

        await self.session.commit()
        await self.session.refresh(settings)

        # Invalidate cache after update
        self._invalidate_cache()

        return settings

    def _invalidate_cache(self):
        """Clear the cache to force reload on next access."""
        self._cache.clear()
        self._cache_expiry = None


async def get_ai_model_settings_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AIModelSettingsService:
    """Dependency to get AI model settings service."""
    return AIModelSettingsService(session)
