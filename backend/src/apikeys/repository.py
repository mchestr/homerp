"""API Key repository for database operations."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.apikeys.models import ApiKey
from src.apikeys.schemas import ApiKeyUpdate


class ApiKeyRepository:
    """Repository for API key database operations."""

    def __init__(self, session: AsyncSession, user_id: UUID | None = None):
        self.session = session
        self.user_id = user_id

    async def create(
        self,
        user_id: UUID,
        name: str,
        key_hash: str,
        key_prefix: str,
        scopes: list[str],
        expires_at: datetime | None = None,
    ) -> ApiKey:
        """Create a new API key."""
        api_key = ApiKey(
            user_id=user_id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            scopes=scopes,
            expires_at=expires_at,
        )
        self.session.add(api_key)
        await self.session.commit()
        await self.session.refresh(api_key)
        return api_key

    async def get_by_id(self, api_key_id: UUID) -> ApiKey | None:
        """Get an API key by ID."""
        result = await self.session.execute(
            select(ApiKey)
            .options(selectinload(ApiKey.user))
            .where(ApiKey.id == api_key_id)
        )
        return result.scalar_one_or_none()

    async def get_by_hash(self, key_hash: str) -> ApiKey | None:
        """Get an API key by its hash (for validation)."""
        result = await self.session.execute(
            select(ApiKey)
            .options(selectinload(ApiKey.user))
            .where(ApiKey.key_hash == key_hash)
        )
        return result.scalar_one_or_none()

    async def get_user_keys(
        self, user_id: UUID, offset: int = 0, limit: int = 20
    ) -> list[ApiKey]:
        """Get all API keys for a user."""
        result = await self.session.execute(
            select(ApiKey)
            .where(ApiKey.user_id == user_id)
            .order_by(ApiKey.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_user_keys(self, user_id: UUID) -> int:
        """Count API keys for a user."""
        result = await self.session.execute(
            select(func.count(ApiKey.id)).where(ApiKey.user_id == user_id)
        )
        return result.scalar_one()

    async def update(self, api_key: ApiKey, data: ApiKeyUpdate) -> ApiKey:
        """Update an API key."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(api_key, field, value)
        await self.session.commit()
        await self.session.refresh(api_key)
        return api_key

    async def update_last_used(self, api_key: ApiKey) -> None:
        """Update the last_used_at timestamp."""
        api_key.last_used_at = datetime.now(UTC)
        await self.session.commit()

    async def delete(self, api_key: ApiKey) -> None:
        """Delete an API key."""
        await self.session.delete(api_key)
        await self.session.commit()
