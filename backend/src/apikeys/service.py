"""API Key service for key generation and validation."""

import hashlib
import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.apikeys.models import ApiKey
from src.apikeys.repository import ApiKeyRepository
from src.apikeys.schemas import VALID_SCOPES


class ApiKeyService:
    """Service for API key operations."""

    # Key format: homerp_<32 random bytes as base64>
    KEY_PREFIX = "homerp_"
    KEY_BYTES = 32

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = ApiKeyRepository(session)

    @staticmethod
    def generate_key() -> str:
        """Generate a new random API key."""
        random_bytes = secrets.token_urlsafe(ApiKeyService.KEY_BYTES)
        return f"{ApiKeyService.KEY_PREFIX}{random_bytes}"

    @staticmethod
    def hash_key(key: str) -> str:
        """Hash an API key using SHA-256."""
        return hashlib.sha256(key.encode()).hexdigest()

    @staticmethod
    def get_key_prefix(key: str) -> str:
        """Get the first 8 characters after the prefix for identification."""
        # Remove the "homerp_" prefix and take first 8 chars
        if key.startswith(ApiKeyService.KEY_PREFIX):
            return key[
                len(ApiKeyService.KEY_PREFIX) : len(ApiKeyService.KEY_PREFIX) + 8
            ]
        return key[:8]

    @staticmethod
    def validate_scopes(scopes: list[str]) -> list[str]:
        """Validate and filter scopes to only valid ones."""
        return [s for s in scopes if s in VALID_SCOPES]

    async def create_key(
        self,
        user_id: UUID,
        name: str,
        scopes: list[str],
        expires_at: datetime | None = None,
    ) -> tuple[ApiKey, str]:
        """
        Create a new API key.

        Returns the created ApiKey model and the raw key (shown only once).
        """
        # Generate the key
        raw_key = self.generate_key()
        key_hash = self.hash_key(raw_key)
        key_prefix = self.get_key_prefix(raw_key)

        # Validate scopes
        valid_scopes = self.validate_scopes(scopes)

        # Create the API key in the database
        api_key = await self.repository.create(
            user_id=user_id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            scopes=valid_scopes,
            expires_at=expires_at,
        )

        return api_key, raw_key

    async def validate_key(self, raw_key: str) -> ApiKey | None:
        """
        Validate an API key and return the associated ApiKey if valid.

        Returns None if the key is invalid, inactive, or expired.
        """
        key_hash = self.hash_key(raw_key)
        api_key = await self.repository.get_by_hash(key_hash)

        if api_key is None:
            return None

        # Check if key is active
        if not api_key.is_active:
            return None

        # Check if key is expired
        if api_key.expires_at is not None and api_key.expires_at < datetime.now(UTC):
            return None

        # Update last_used_at
        await self.repository.update_last_used(api_key)

        return api_key

    def has_scope(self, api_key: ApiKey, required_scope: str) -> bool:
        """
        Check if an API key has the required scope.

        Supports wildcard scopes (e.g., "admin:*" matches "admin:read").
        """
        if "admin:*" in api_key.scopes:
            return True

        if required_scope in api_key.scopes:
            return True

        # Check for wildcard match
        scope_prefix = required_scope.split(":")[0]
        return f"{scope_prefix}:*" in api_key.scopes
