"""HTTP integration tests for images router."""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.collaboration.models import (
    CollaboratorRole,
    CollaboratorStatus,
    InventoryCollaborator,
)
from src.config import Settings
from src.images.models import Image
from src.users.models import User


class TestGetImageEndpoint:
    """Tests for GET /api/v1/images/{image_id}."""

    async def test_get_image(
        self, authenticated_client: AsyncClient, test_image: Image
    ):
        """Test getting image metadata."""
        response = await authenticated_client.get(f"/api/v1/images/{test_image.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_image.id)
        assert data["original_filename"] == test_image.original_filename

    async def test_get_image_not_found(self, authenticated_client: AsyncClient):
        """Test getting non-existent image."""
        response = await authenticated_client.get(f"/api/v1/images/{uuid.uuid4()}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Image not found"

    async def test_get_image_unauthenticated(
        self, unauthenticated_client: AsyncClient, test_image: Image
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get(f"/api/v1/images/{test_image.id}")

        assert response.status_code == 401


class TestGetImageSignedUrlEndpoint:
    """Tests for GET /api/v1/images/{image_id}/signed-url."""

    async def test_get_signed_url(
        self, authenticated_client: AsyncClient, test_image: Image
    ):
        """Test getting signed URL for image."""
        response = await authenticated_client.get(
            f"/api/v1/images/{test_image.id}/signed-url"
        )

        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "token=" in data["url"]

    async def test_get_signed_url_thumbnail(
        self, authenticated_client: AsyncClient, test_image: Image
    ):
        """Test getting signed URL for thumbnail."""
        response = await authenticated_client.get(
            f"/api/v1/images/{test_image.id}/signed-url", params={"thumbnail": True}
        )

        assert response.status_code == 200
        data = response.json()
        assert "thumbnail" in data["url"]

    async def test_get_signed_url_not_found(self, authenticated_client: AsyncClient):
        """Test getting signed URL for non-existent image."""
        response = await authenticated_client.get(
            f"/api/v1/images/{uuid.uuid4()}/signed-url"
        )

        assert response.status_code == 404


class TestGetImageFileEndpoint:
    """Tests for GET /api/v1/images/{image_id}/file."""

    async def test_get_file_without_token(
        self, authenticated_client: AsyncClient, test_image: Image
    ):
        """Test getting file without token returns 401."""
        response = await authenticated_client.get(
            f"/api/v1/images/{test_image.id}/file"
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Token required"

    async def test_get_file_invalid_token(
        self, authenticated_client: AsyncClient, test_image: Image
    ):
        """Test getting file with invalid token returns 401."""
        response = await authenticated_client.get(
            f"/api/v1/images/{test_image.id}/file", params={"token": "invalid"}
        )

        assert response.status_code == 401


class TestGetImageThumbnailEndpoint:
    """Tests for GET /api/v1/images/{image_id}/thumbnail."""

    async def test_get_thumbnail_without_token(
        self, authenticated_client: AsyncClient, test_image: Image
    ):
        """Test getting thumbnail without token returns 401."""
        response = await authenticated_client.get(
            f"/api/v1/images/{test_image.id}/thumbnail"
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Token required"


class TestListClassifiedImagesEndpoint:
    """Tests for GET /api/v1/images/classified."""

    async def test_list_classified_images(self, authenticated_client: AsyncClient):
        """Test listing classified images."""
        response = await authenticated_client.get("/api/v1/images/classified")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data

    async def test_list_classified_images_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/images/classified")

        assert response.status_code == 401

    async def test_list_classified_images_with_search(
        self, authenticated_client: AsyncClient, classified_images: list[Image]
    ):
        """Test searching classified images by identified name."""
        # Search for "screwdriver"
        response = await authenticated_client.get(
            "/api/v1/images/classified", params={"search": "screwdriver"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert (
            data["items"][0]["ai_result"]["identified_name"]
            == "Phillips Head Screwdriver"
        )

    async def test_list_classified_images_search_case_insensitive(
        self, authenticated_client: AsyncClient, classified_images: list[Image]
    ):
        """Test that search is case-insensitive."""
        # Search for "HAMMER" (uppercase)
        response = await authenticated_client.get(
            "/api/v1/images/classified", params={"search": "HAMMER"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["ai_result"]["identified_name"] == "Claw Hammer"

    async def test_list_classified_images_search_partial_match(
        self, authenticated_client: AsyncClient, classified_images: list[Image]
    ):
        """Test that search works with partial matches."""
        # Search for "drill" should match "Cordless Drill"
        response = await authenticated_client.get(
            "/api/v1/images/classified", params={"search": "drill"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert "Drill" in data["items"][0]["ai_result"]["identified_name"]

    async def test_list_classified_images_search_no_results(
        self, authenticated_client: AsyncClient, classified_images: list[Image]
    ):
        """Test search with no matching results."""
        response = await authenticated_client.get(
            "/api/v1/images/classified", params={"search": "nonexistent"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert len(data["items"]) == 0

    async def test_list_classified_images_empty_search(
        self, authenticated_client: AsyncClient, classified_images: list[Image]
    ):
        """Test that empty search returns all classified images."""
        response = await authenticated_client.get(
            "/api/v1/images/classified", params={"search": ""}
        )

        assert response.status_code == 200
        data = response.json()
        # Empty search should return all classified images
        assert data["total"] == len(classified_images)

    async def test_list_classified_images_search_with_pagination(
        self, authenticated_client: AsyncClient, classified_images: list[Image]
    ):
        """Test search with pagination parameters."""
        response = await authenticated_client.get(
            "/api/v1/images/classified",
            params={"search": "screwdriver", "page": 1, "limit": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10
        assert data["total"] == 1


class TestDeleteImageEndpoint:
    """Tests for DELETE /api/v1/images/{image_id}."""

    async def test_delete_image_not_found(self, authenticated_client: AsyncClient):
        """Test deleting non-existent image."""
        response = await authenticated_client.delete(f"/api/v1/images/{uuid.uuid4()}")

        assert response.status_code == 404

    async def test_delete_image_unauthenticated(
        self, unauthenticated_client: AsyncClient, test_image: Image
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.delete(
            f"/api/v1/images/{test_image.id}"
        )

        assert response.status_code == 401


class TestAttachImageEndpoint:
    """Tests for POST /api/v1/images/{image_id}/attach/{item_id}."""

    async def test_attach_image_not_found(self, authenticated_client: AsyncClient):
        """Test attaching non-existent image."""
        response = await authenticated_client.post(
            f"/api/v1/images/{uuid.uuid4()}/attach/{uuid.uuid4()}"
        )

        assert response.status_code == 404

    async def test_attach_image_unauthenticated(
        self, unauthenticated_client: AsyncClient, test_image: Image
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            f"/api/v1/images/{test_image.id}/attach/{uuid.uuid4()}"
        )

        assert response.status_code == 401


class TestSetPrimaryImageEndpoint:
    """Tests for POST /api/v1/images/{image_id}/set-primary."""

    async def test_set_primary_image(
        self, authenticated_client: AsyncClient, test_image: Image
    ):
        """Test setting an image as primary for its item."""
        response = await authenticated_client.post(
            f"/api/v1/images/{test_image.id}/set-primary"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_image.id)
        assert data["is_primary"] is True

    async def test_set_primary_image_not_found(self, authenticated_client: AsyncClient):
        """Test setting non-existent image as primary."""
        response = await authenticated_client.post(
            f"/api/v1/images/{uuid.uuid4()}/set-primary"
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Image not found"

    async def test_set_primary_image_not_attached(
        self, authenticated_client: AsyncClient, unattached_image: Image
    ):
        """Test setting an image as primary when it's not attached to any item."""
        response = await authenticated_client.post(
            f"/api/v1/images/{unattached_image.id}/set-primary"
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Image is not attached to any item"

    async def test_set_primary_image_unauthenticated(
        self, unauthenticated_client: AsyncClient, test_image: Image
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            f"/api/v1/images/{test_image.id}/set-primary"
        )

        assert response.status_code == 401


class TestDetachImageEndpoint:
    """Tests for POST /api/v1/images/{image_id}/detach."""

    async def test_detach_image(
        self, authenticated_client: AsyncClient, test_image: Image
    ):
        """Test detaching an image from its item."""
        response = await authenticated_client.post(
            f"/api/v1/images/{test_image.id}/detach"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_image.id)
        assert data["item_id"] is None
        assert data["is_primary"] is False

    async def test_detach_image_not_found(self, authenticated_client: AsyncClient):
        """Test detaching non-existent image."""
        response = await authenticated_client.post(
            f"/api/v1/images/{uuid.uuid4()}/detach"
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Image not found"

    async def test_detach_image_unauthenticated(
        self, unauthenticated_client: AsyncClient, test_image: Image
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            f"/api/v1/images/{test_image.id}/detach"
        )

        assert response.status_code == 401


class TestCollaboratorImageAccess:
    """Tests for collaborator access to images via signed URLs."""

    @pytest.fixture
    async def collaborator_user(self, async_session: AsyncSession) -> User:
        """Create a collaborator user for testing."""
        user = User(
            id=uuid.uuid4(),
            email="collaborator@example.com",
            name="Collaborator User",
            oauth_provider="google",
            oauth_id="google_collaborator_123",
            credit_balance=0,
            free_credits_remaining=5,
            is_admin=False,
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)
        return user

    @pytest.fixture
    async def accepted_collaboration(
        self,
        async_session: AsyncSession,
        test_user: User,
        collaborator_user: User,
    ) -> InventoryCollaborator:
        """Create an accepted collaboration between test_user and collaborator_user."""
        collaboration = InventoryCollaborator(
            id=uuid.uuid4(),
            owner_id=test_user.id,
            collaborator_id=collaborator_user.id,
            invited_email=collaborator_user.email,
            role=CollaboratorRole.VIEWER.value,
            status=CollaboratorStatus.ACCEPTED.value,
            accepted_at=datetime.now(UTC),
        )
        async_session.add(collaboration)
        await async_session.commit()
        await async_session.refresh(collaboration)
        return collaboration

    @pytest.fixture
    async def collaborator_client(
        self,
        async_session: AsyncSession,
        test_settings: Settings,  # noqa: ARG002
        collaborator_user: User,
    ) -> AsyncGenerator[AsyncClient, None]:
        """Create an authenticated client for the collaborator user."""
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: collaborator_user.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

        app.dependency_overrides.clear()

    async def test_collaborator_can_get_signed_url_for_shared_image(
        self,
        collaborator_client: AsyncClient,
        test_user: User,
        test_image: Image,
        accepted_collaboration: InventoryCollaborator,  # noqa: ARG002
    ):
        """Test that a collaborator can get a signed URL for an image in a shared inventory.

        This is a regression test for the bug where collaborators couldn't view
        images because the signed URL was generated with the wrong user_id.
        """
        # Request signed URL with X-Inventory-Context header set to owner's ID
        response = await collaborator_client.get(
            f"/api/v1/images/{test_image.id}/signed-url",
            headers={"X-Inventory-Context": str(test_user.id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "token=" in data["url"]

    async def test_collaborator_can_get_signed_url_for_thumbnail(
        self,
        collaborator_client: AsyncClient,
        test_user: User,
        test_image: Image,
        accepted_collaboration: InventoryCollaborator,  # noqa: ARG002
    ):
        """Test that a collaborator can get a signed URL for a thumbnail in shared inventory."""
        response = await collaborator_client.get(
            f"/api/v1/images/{test_image.id}/signed-url",
            params={"thumbnail": True},
            headers={"X-Inventory-Context": str(test_user.id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert "thumbnail" in data["url"]

    async def test_non_collaborator_cannot_access_other_users_images(
        self,
        collaborator_client: AsyncClient,
        test_user: User,
        test_image: Image,
        # Note: no accepted_collaboration fixture - user is not a collaborator
    ):
        """Test that a non-collaborator cannot access another user's images."""
        response = await collaborator_client.get(
            f"/api/v1/images/{test_image.id}/signed-url",
            headers={"X-Inventory-Context": str(test_user.id)},
        )

        # Should get 403 because user doesn't have collaboration access
        assert response.status_code == 403
