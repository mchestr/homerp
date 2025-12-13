"""HTTP integration tests for locations router."""

import uuid

from httpx import AsyncClient

from src.locations.models import Location


class TestListLocationsEndpoint:
    """Tests for GET /api/v1/locations."""

    async def test_list_locations_empty(self, authenticated_client: AsyncClient):
        """Test listing locations when none exist."""
        response = await authenticated_client.get("/api/v1/locations")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_list_locations_with_data(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test listing locations with existing data."""
        response = await authenticated_client.get("/api/v1/locations")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_location.name

    async def test_list_locations_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/locations")

        assert response.status_code == 401


class TestGetLocationTreeEndpoint:
    """Tests for GET /api/v1/locations/tree."""

    async def test_get_location_tree_empty(self, authenticated_client: AsyncClient):
        """Test getting tree when no locations exist."""
        response = await authenticated_client.get("/api/v1/locations/tree")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_get_location_tree_with_data(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test getting location tree with data."""
        response = await authenticated_client.get("/api/v1/locations/tree")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_location.name


class TestCreateLocationEndpoint:
    """Tests for POST /api/v1/locations."""

    async def test_create_location(self, authenticated_client: AsyncClient):
        """Test creating a new location."""
        response = await authenticated_client.post(
            "/api/v1/locations",
            json={
                "name": "Garage",
                "description": "Main garage",
                "location_type": "room",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Garage"
        assert data["description"] == "Main garage"

    async def test_create_location_with_parent(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test creating a location with a parent."""
        response = await authenticated_client.post(
            "/api/v1/locations",
            json={"name": "Shelf 1", "parent_id": str(test_location.id)},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["parent_id"] == str(test_location.id)

    async def test_create_location_duplicate_name(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test creating a location with duplicate name."""
        response = await authenticated_client.post(
            "/api/v1/locations", json={"name": test_location.name}
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    async def test_create_location_invalid_parent(
        self, authenticated_client: AsyncClient
    ):
        """Test creating a location with non-existent parent."""
        response = await authenticated_client.post(
            "/api/v1/locations",
            json={"name": "Test", "parent_id": str(uuid.uuid4())},
        )

        assert response.status_code == 404
        assert "Parent location not found" in response.json()["detail"]

    async def test_create_location_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/locations", json={"name": "Test"}
        )

        assert response.status_code == 401


class TestCreateLocationBulkEndpoint:
    """Tests for POST /api/v1/locations/bulk."""

    async def test_create_bulk_locations(self, authenticated_client: AsyncClient):
        """Test creating parent with children in bulk."""
        response = await authenticated_client.post(
            "/api/v1/locations/bulk",
            json={
                "parent": {"name": "Storage Room", "location_type": "room"},
                "children": [
                    {"name": "Shelf A"},
                    {"name": "Shelf B"},
                    {"name": "Shelf C"},
                ],
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["parent"]["name"] == "Storage Room"
        assert len(data["children"]) == 3

    async def test_create_bulk_duplicate_children(
        self, authenticated_client: AsyncClient
    ):
        """Test creating bulk with duplicate child names."""
        response = await authenticated_client.post(
            "/api/v1/locations/bulk",
            json={
                "parent": {"name": "Room"},
                "children": [{"name": "Same"}, {"name": "Same"}],
            },
        )

        assert response.status_code == 400
        assert "Duplicate" in response.json()["detail"]


class TestGetLocationEndpoint:
    """Tests for GET /api/v1/locations/{location_id}."""

    async def test_get_location(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test getting a location by ID."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{test_location.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_location.id)
        assert data["name"] == test_location.name

    async def test_get_location_not_found(self, authenticated_client: AsyncClient):
        """Test getting a non-existent location."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{uuid.uuid4()}"
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Location not found"


class TestGetLocationDescendantsEndpoint:
    """Tests for GET /api/v1/locations/{location_id}/descendants."""

    async def test_get_descendants(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test getting location descendants."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{test_location.id}/descendants"
        )

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_get_descendants_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test getting descendants for non-existent location."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{uuid.uuid4()}/descendants"
        )

        assert response.status_code == 404


class TestGetLocationWithAncestorsEndpoint:
    """Tests for GET /api/v1/locations/{location_id}/with-ancestors."""

    async def test_get_with_ancestors(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test getting location with ancestors."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{test_location.id}/with-ancestors"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_location.id)
        assert "ancestors" in data

    async def test_get_with_ancestors_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test getting with ancestors for non-existent location."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{uuid.uuid4()}/with-ancestors"
        )

        assert response.status_code == 404


class TestUpdateLocationEndpoint:
    """Tests for PUT /api/v1/locations/{location_id}."""

    async def test_update_location(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test updating a location."""
        response = await authenticated_client.put(
            f"/api/v1/locations/{test_location.id}",
            json={"name": "Updated Workshop", "description": "Updated description"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Workshop"
        assert data["description"] == "Updated description"

    async def test_update_location_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test updating a non-existent location."""
        response = await authenticated_client.put(
            f"/api/v1/locations/{uuid.uuid4()}", json={"name": "Test"}
        )

        assert response.status_code == 404


class TestMoveLocationEndpoint:
    """Tests for PATCH /api/v1/locations/{location_id}/move."""

    async def test_move_location_to_root(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test moving a location to root level."""
        response = await authenticated_client.patch(
            f"/api/v1/locations/{test_location.id}/move",
            json={"new_parent_id": None},
        )

        assert response.status_code == 200

    async def test_move_location_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test moving a non-existent location."""
        response = await authenticated_client.patch(
            f"/api/v1/locations/{uuid.uuid4()}/move", json={"new_parent_id": None}
        )

        assert response.status_code == 404


class TestGetLocationQREndpoint:
    """Tests for GET /api/v1/locations/{location_id}/qr."""

    async def test_get_location_qr(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test getting QR code for a location."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{test_location.id}/qr"
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"

    async def test_get_location_qr_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test getting QR for non-existent location."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{uuid.uuid4()}/qr"
        )

        assert response.status_code == 404


class TestDeleteLocationEndpoint:
    """Tests for DELETE /api/v1/locations/{location_id}."""

    async def test_delete_location(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test deleting a location."""
        response = await authenticated_client.delete(
            f"/api/v1/locations/{test_location.id}"
        )

        assert response.status_code == 204

        # Verify location is deleted
        get_response = await authenticated_client.get(
            f"/api/v1/locations/{test_location.id}"
        )
        assert get_response.status_code == 404

    async def test_delete_location_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test deleting a non-existent location."""
        response = await authenticated_client.delete(
            f"/api/v1/locations/{uuid.uuid4()}"
        )

        assert response.status_code == 404
