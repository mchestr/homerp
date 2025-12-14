"""HTTP integration tests for API keys router."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.apikeys.models import ApiKey
from src.apikeys.service import ApiKeyService
from src.users.models import User


@pytest.fixture
async def test_api_key(
    async_session: AsyncSession, admin_user: User
) -> tuple[ApiKey, str]:
    """Create a test API key and return both the model and raw key."""
    service = ApiKeyService(async_session)
    api_key, raw_key = await service.create_key(
        user_id=admin_user.id,
        name="Test API Key",
        scopes=["feedback:read", "feedback:write"],
        expires_at=None,
    )
    return api_key, raw_key


@pytest.fixture
async def expired_api_key(
    async_session: AsyncSession, admin_user: User
) -> tuple[ApiKey, str]:
    """Create an expired API key."""
    service = ApiKeyService(async_session)
    api_key, raw_key = await service.create_key(
        user_id=admin_user.id,
        name="Expired API Key",
        scopes=["feedback:read"],
        expires_at=datetime.now(UTC) - timedelta(days=1),
    )
    return api_key, raw_key


class TestCreateApiKeyEndpoint:
    """Tests for POST /api/v1/admin/apikeys."""

    async def test_create_api_key_as_admin(self, admin_client: AsyncClient):
        """Test creating an API key as admin."""
        response = await admin_client.post(
            "/api/v1/admin/apikeys",
            json={
                "name": "My API Key",
                "scopes": ["feedback:read", "feedback:write"],
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My API Key"
        assert "key" in data  # Full key is only returned once
        assert data["key"].startswith("homerp_")
        assert "key_prefix" in data
        assert data["scopes"] == ["feedback:read", "feedback:write"]
        assert data["is_active"] is True

    async def test_create_api_key_with_expiration(self, admin_client: AsyncClient):
        """Test creating an API key with expiration date."""
        expires_at = (datetime.now(UTC) + timedelta(days=30)).isoformat()
        response = await admin_client.post(
            "/api/v1/admin/apikeys",
            json={
                "name": "Expiring Key",
                "scopes": ["feedback:read"],
                "expires_at": expires_at,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["expires_at"] is not None

    async def test_create_api_key_invalid_scopes_filtered(
        self, admin_client: AsyncClient
    ):
        """Test that invalid scopes are filtered out."""
        response = await admin_client.post(
            "/api/v1/admin/apikeys",
            json={
                "name": "Key with Invalid Scopes",
                "scopes": ["feedback:read", "invalid:scope", "admin:*"],
            },
        )

        assert response.status_code == 201
        data = response.json()
        # Invalid scope should be filtered out
        assert "invalid:scope" not in data["scopes"]
        assert "feedback:read" in data["scopes"]
        assert "admin:*" in data["scopes"]

    async def test_create_api_key_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.post(
            "/api/v1/admin/apikeys",
            json={
                "name": "My API Key",
                "scopes": ["feedback:read"],
            },
        )

        assert response.status_code == 403

    async def test_create_api_key_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/admin/apikeys",
            json={
                "name": "My API Key",
                "scopes": ["feedback:read"],
            },
        )

        assert response.status_code == 401


class TestListApiKeysEndpoint:
    """Tests for GET /api/v1/admin/apikeys."""

    async def test_list_api_keys_as_admin(
        self, admin_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test listing API keys as admin."""
        response = await admin_client.get("/api/v1/admin/apikeys")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1
        # Key should NOT include the full key
        assert "key" not in data["items"][0]
        assert "key_prefix" in data["items"][0]

    async def test_list_api_keys_pagination(self, admin_client: AsyncClient):
        """Test pagination of API keys."""
        # Create multiple keys
        for i in range(3):
            await admin_client.post(
                "/api/v1/admin/apikeys",
                json={"name": f"Key {i}", "scopes": ["feedback:read"]},
            )

        response = await admin_client.get(
            "/api/v1/admin/apikeys", params={"page": 1, "limit": 2}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) <= 2

    async def test_list_api_keys_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/apikeys")

        assert response.status_code == 403


class TestGetApiKeyEndpoint:
    """Tests for GET /api/v1/admin/apikeys/{api_key_id}."""

    async def test_get_api_key_as_admin(
        self, admin_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test getting a specific API key as admin."""
        api_key, _ = test_api_key
        response = await admin_client.get(f"/api/v1/admin/apikeys/{api_key.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(api_key.id)
        assert data["name"] == api_key.name
        # Full key should not be returned
        assert "key" not in data

    async def test_get_api_key_not_found(self, admin_client: AsyncClient):
        """Test getting non-existent API key."""
        response = await admin_client.get(f"/api/v1/admin/apikeys/{uuid.uuid4()}")

        assert response.status_code == 404

    async def test_get_api_key_as_non_admin(
        self, authenticated_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test that non-admin gets 403."""
        api_key, _ = test_api_key
        response = await authenticated_client.get(f"/api/v1/admin/apikeys/{api_key.id}")

        assert response.status_code == 403


class TestUpdateApiKeyEndpoint:
    """Tests for PATCH /api/v1/admin/apikeys/{api_key_id}."""

    async def test_update_api_key_name(
        self, admin_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test updating API key name."""
        api_key, _ = test_api_key
        response = await admin_client.patch(
            f"/api/v1/admin/apikeys/{api_key.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"

    async def test_update_api_key_scopes(
        self, admin_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test updating API key scopes."""
        api_key, _ = test_api_key
        response = await admin_client.patch(
            f"/api/v1/admin/apikeys/{api_key.id}",
            json={"scopes": ["admin:*"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["scopes"] == ["admin:*"]

    async def test_deactivate_api_key(
        self, admin_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test deactivating an API key."""
        api_key, _ = test_api_key
        response = await admin_client.patch(
            f"/api/v1/admin/apikeys/{api_key.id}",
            json={"is_active": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    async def test_update_api_key_not_found(self, admin_client: AsyncClient):
        """Test updating non-existent API key."""
        response = await admin_client.patch(
            f"/api/v1/admin/apikeys/{uuid.uuid4()}",
            json={"name": "New Name"},
        )

        assert response.status_code == 404

    async def test_update_api_key_as_non_admin(
        self, authenticated_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test that non-admin gets 403."""
        api_key, _ = test_api_key
        response = await authenticated_client.patch(
            f"/api/v1/admin/apikeys/{api_key.id}",
            json={"name": "Hacked"},
        )

        assert response.status_code == 403


class TestDeleteApiKeyEndpoint:
    """Tests for DELETE /api/v1/admin/apikeys/{api_key_id}."""

    async def test_delete_api_key_as_admin(
        self, admin_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test deleting an API key as admin."""
        api_key, _ = test_api_key
        response = await admin_client.delete(f"/api/v1/admin/apikeys/{api_key.id}")

        assert response.status_code == 204

        # Verify key is deleted
        get_response = await admin_client.get(f"/api/v1/admin/apikeys/{api_key.id}")
        assert get_response.status_code == 404

    async def test_delete_api_key_not_found(self, admin_client: AsyncClient):
        """Test deleting non-existent API key."""
        response = await admin_client.delete(f"/api/v1/admin/apikeys/{uuid.uuid4()}")

        assert response.status_code == 404

    async def test_delete_api_key_as_non_admin(
        self, authenticated_client: AsyncClient, test_api_key: tuple[ApiKey, str]
    ):
        """Test that non-admin gets 403."""
        api_key, _ = test_api_key
        response = await authenticated_client.delete(
            f"/api/v1/admin/apikeys/{api_key.id}"
        )

        assert response.status_code == 403


class TestApiKeyAuthenticationEndpoint:
    """Tests for using API key authentication on endpoints."""

    async def test_feedback_resolve_with_api_key(
        self,
        unauthenticated_client: AsyncClient,
        test_api_key: tuple[ApiKey, str],
        test_feedback,  # noqa: ANN001 - Feedback fixture
    ):
        """Test using API key to resolve feedback."""
        _, raw_key = test_api_key
        response = await unauthenticated_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}/resolve",
            headers={"X-API-Key": raw_key},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "resolved"

    async def test_feedback_resolve_with_invalid_api_key(
        self,
        unauthenticated_client: AsyncClient,
        test_feedback,  # noqa: ANN001 - Feedback fixture
    ):
        """Test using invalid API key."""
        response = await unauthenticated_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}/resolve",
            headers={"X-API-Key": "invalid_key"},
        )

        assert response.status_code == 401

    async def test_feedback_resolve_with_expired_api_key(
        self,
        unauthenticated_client: AsyncClient,
        expired_api_key: tuple[ApiKey, str],
        test_feedback,  # noqa: ANN001 - Feedback fixture
    ):
        """Test using expired API key."""
        _, raw_key = expired_api_key
        response = await unauthenticated_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}/resolve",
            headers={"X-API-Key": raw_key},
        )

        assert response.status_code == 401

    async def test_feedback_resolve_with_deactivated_api_key(
        self,
        async_session: AsyncSession,
        admin_user: User,
        unauthenticated_client: AsyncClient,
        test_feedback,  # noqa: ANN001 - Feedback fixture
    ):
        """Test using deactivated API key."""
        # Create and immediately deactivate a key
        service = ApiKeyService(async_session)
        api_key, raw_key = await service.create_key(
            user_id=admin_user.id,
            name="Inactive Key",
            scopes=["feedback:read", "feedback:write"],
        )
        # Deactivate the key in the database
        api_key.is_active = False
        await async_session.commit()

        # Try to use it
        response = await unauthenticated_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}/resolve",
            headers={"X-API-Key": raw_key},
        )

        assert response.status_code == 401


class TestApiKeyService:
    """Unit tests for ApiKeyService."""

    async def test_key_generation_format(self, async_session: AsyncSession):
        """Test that generated keys have correct format."""
        service = ApiKeyService(async_session)
        key = service.generate_key()

        assert key.startswith("homerp_")
        assert len(key) > 20  # Should be reasonably long

    async def test_key_hashing_is_deterministic(self, async_session: AsyncSession):
        """Test that hashing the same key produces same hash."""
        service = ApiKeyService(async_session)
        key = "homerp_test_key_12345"

        hash1 = service.hash_key(key)
        hash2 = service.hash_key(key)

        assert hash1 == hash2

    async def test_different_keys_have_different_hashes(
        self, async_session: AsyncSession
    ):
        """Test that different keys produce different hashes."""
        service = ApiKeyService(async_session)

        hash1 = service.hash_key("homerp_key1")
        hash2 = service.hash_key("homerp_key2")

        assert hash1 != hash2

    async def test_scope_validation(self, async_session: AsyncSession):
        """Test that invalid scopes are filtered."""
        service = ApiKeyService(async_session)

        valid = service.validate_scopes(
            ["feedback:read", "invalid:scope", "feedback:write"]
        )

        assert "feedback:read" in valid
        assert "feedback:write" in valid
        assert "invalid:scope" not in valid

    async def test_has_scope_direct_match(
        self, async_session: AsyncSession, admin_user: User
    ):
        """Test scope checking with direct match."""
        service = ApiKeyService(async_session)
        api_key, _ = await service.create_key(
            user_id=admin_user.id,
            name="Test",
            scopes=["feedback:read"],
        )

        assert service.has_scope(api_key, "feedback:read") is True
        assert service.has_scope(api_key, "feedback:write") is False

    async def test_has_scope_admin_wildcard(
        self, async_session: AsyncSession, admin_user: User
    ):
        """Test that admin:* grants all permissions."""
        service = ApiKeyService(async_session)
        api_key, _ = await service.create_key(
            user_id=admin_user.id,
            name="Test",
            scopes=["admin:*"],
        )

        assert service.has_scope(api_key, "feedback:read") is True
        assert service.has_scope(api_key, "feedback:write") is True
        assert service.has_scope(api_key, "anything:else") is True

    async def test_key_prefix_extraction(self, async_session: AsyncSession):
        """Test key prefix extraction."""
        service = ApiKeyService(async_session)
        key = "homerp_abcdefgh12345678"

        prefix = service.get_key_prefix(key)

        assert prefix == "abcdefgh"  # First 8 chars after prefix
