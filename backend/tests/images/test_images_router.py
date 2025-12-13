"""HTTP integration tests for images router."""

import uuid

from httpx import AsyncClient

from src.images.models import Image


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
