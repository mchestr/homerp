"""HTTP integration tests for gridfinity router."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.gridfinity.models import GridfinityPlacement, GridfinityUnit
from src.items.models import Item


@pytest.fixture
async def test_gridfinity_unit(
    async_session: AsyncSession, user_id: uuid.UUID
) -> GridfinityUnit:
    """Create a test gridfinity unit."""
    unit = GridfinityUnit(
        user_id=user_id,
        name="Test Unit",
        description="Test Description",
        container_width_mm=252,
        container_depth_mm=252,
        container_height_mm=50,
        grid_columns=6,
        grid_rows=6,
    )
    async_session.add(unit)
    await async_session.commit()
    await async_session.refresh(unit)
    return unit


@pytest.fixture
async def test_placement(
    async_session: AsyncSession,
    user_id: uuid.UUID,
    test_gridfinity_unit: GridfinityUnit,
    test_item: Item,
) -> GridfinityPlacement:
    """Create a test placement."""
    placement = GridfinityPlacement(
        user_id=user_id,
        unit_id=test_gridfinity_unit.id,
        item_id=test_item.id,
        grid_x=0,
        grid_y=0,
        width_units=1,
        depth_units=1,
    )
    async_session.add(placement)
    await async_session.commit()
    await async_session.refresh(placement)
    return placement


class TestListUnitsEndpoint:
    """Tests for GET /api/v1/gridfinity/units."""

    async def test_list_units_empty(self, authenticated_client: AsyncClient):
        """Test listing units when none exist."""
        response = await authenticated_client.get("/api/v1/gridfinity/units")

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_units_with_data(
        self, authenticated_client: AsyncClient, test_gridfinity_unit: GridfinityUnit
    ):
        """Test listing units with existing data."""
        response = await authenticated_client.get("/api/v1/gridfinity/units")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_gridfinity_unit.name

    async def test_list_units_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/gridfinity/units")

        assert response.status_code == 401


class TestGetUnitEndpoint:
    """Tests for GET /api/v1/gridfinity/units/{unit_id}."""

    async def test_get_unit(
        self, authenticated_client: AsyncClient, test_gridfinity_unit: GridfinityUnit
    ):
        """Test getting a unit by ID."""
        response = await authenticated_client.get(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_gridfinity_unit.id)
        assert data["name"] == test_gridfinity_unit.name

    async def test_get_unit_not_found(self, authenticated_client: AsyncClient):
        """Test getting a non-existent unit."""
        response = await authenticated_client.get(
            f"/api/v1/gridfinity/units/{uuid.uuid4()}"
        )

        assert response.status_code == 404


class TestGetUnitLayoutEndpoint:
    """Tests for GET /api/v1/gridfinity/units/{unit_id}/layout."""

    async def test_get_unit_layout(
        self, authenticated_client: AsyncClient, test_gridfinity_unit: GridfinityUnit
    ):
        """Test getting a unit with placements."""
        response = await authenticated_client.get(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}/layout"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_gridfinity_unit.id)
        assert "placements" in data

    async def test_get_unit_layout_with_placements(
        self,
        authenticated_client: AsyncClient,
        test_gridfinity_unit: GridfinityUnit,
        test_placement: GridfinityPlacement,
    ):
        """Test getting a unit with existing placements."""
        response = await authenticated_client.get(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}/layout"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["placements"]) == 1
        assert data["placements"][0]["item_id"] == str(test_placement.item_id)


class TestCreateUnitEndpoint:
    """Tests for POST /api/v1/gridfinity/units."""

    async def test_create_unit(self, authenticated_client: AsyncClient):
        """Test creating a new unit."""
        response = await authenticated_client.post(
            "/api/v1/gridfinity/units",
            json={
                "name": "New Unit",
                "description": "A new gridfinity unit",
                "container_width_mm": 252,
                "container_depth_mm": 252,
                "container_height_mm": 50,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Unit"
        assert data["grid_columns"] == 6
        assert data["grid_rows"] == 6

    async def test_create_unit_calculates_grid_size(
        self, authenticated_client: AsyncClient
    ):
        """Test that grid size is correctly calculated from dimensions."""
        response = await authenticated_client.post(
            "/api/v1/gridfinity/units",
            json={
                "name": "Large Unit",
                "container_width_mm": 420,  # 10 grid units
                "container_depth_mm": 168,  # 4 grid units
                "container_height_mm": 50,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["grid_columns"] == 10
        assert data["grid_rows"] == 4

    async def test_create_unit_duplicate_name(
        self, authenticated_client: AsyncClient, test_gridfinity_unit: GridfinityUnit
    ):
        """Test creating a unit with duplicate name."""
        response = await authenticated_client.post(
            "/api/v1/gridfinity/units",
            json={
                "name": test_gridfinity_unit.name,
                "container_width_mm": 252,
                "container_depth_mm": 252,
                "container_height_mm": 50,
            },
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    async def test_create_unit_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/gridfinity/units",
            json={
                "name": "Test",
                "container_width_mm": 252,
                "container_depth_mm": 252,
                "container_height_mm": 50,
            },
        )

        assert response.status_code == 401


class TestUpdateUnitEndpoint:
    """Tests for PUT /api/v1/gridfinity/units/{unit_id}."""

    async def test_update_unit(
        self, authenticated_client: AsyncClient, test_gridfinity_unit: GridfinityUnit
    ):
        """Test updating a unit."""
        response = await authenticated_client.put(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}",
            json={"name": "Updated Unit", "description": "Updated description"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Unit"
        assert data["description"] == "Updated description"

    async def test_update_unit_recalculates_grid(
        self, authenticated_client: AsyncClient, test_gridfinity_unit: GridfinityUnit
    ):
        """Test that updating dimensions recalculates grid size."""
        response = await authenticated_client.put(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}",
            json={"container_width_mm": 420},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["grid_columns"] == 10

    async def test_update_unit_not_found(self, authenticated_client: AsyncClient):
        """Test updating a non-existent unit."""
        response = await authenticated_client.put(
            f"/api/v1/gridfinity/units/{uuid.uuid4()}", json={"name": "Test"}
        )

        assert response.status_code == 404


class TestDeleteUnitEndpoint:
    """Tests for DELETE /api/v1/gridfinity/units/{unit_id}."""

    async def test_delete_unit(
        self, authenticated_client: AsyncClient, test_gridfinity_unit: GridfinityUnit
    ):
        """Test deleting a unit."""
        response = await authenticated_client.delete(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}"
        )

        assert response.status_code == 204

        # Verify unit is deleted
        get_response = await authenticated_client.get(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}"
        )
        assert get_response.status_code == 404

    async def test_delete_unit_not_found(self, authenticated_client: AsyncClient):
        """Test deleting a non-existent unit."""
        response = await authenticated_client.delete(
            f"/api/v1/gridfinity/units/{uuid.uuid4()}"
        )

        assert response.status_code == 404


class TestCreatePlacementEndpoint:
    """Tests for POST /api/v1/gridfinity/units/{unit_id}/placements."""

    async def test_create_placement(
        self,
        authenticated_client: AsyncClient,
        test_gridfinity_unit: GridfinityUnit,
        test_item: Item,
    ):
        """Test creating a new placement."""
        response = await authenticated_client.post(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}/placements",
            json={
                "item_id": str(test_item.id),
                "grid_x": 0,
                "grid_y": 0,
                "width_units": 1,
                "depth_units": 1,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["item_id"] == str(test_item.id)
        assert data["grid_x"] == 0
        assert data["grid_y"] == 0
        assert data["position_code"] == "A1"

    async def test_create_placement_out_of_bounds(
        self,
        authenticated_client: AsyncClient,
        test_gridfinity_unit: GridfinityUnit,
        test_item: Item,
    ):
        """Test creating a placement that exceeds grid bounds."""
        response = await authenticated_client.post(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}/placements",
            json={
                "item_id": str(test_item.id),
                "grid_x": 10,  # Out of bounds for 6x6 grid
                "grid_y": 0,
            },
        )

        assert response.status_code == 400
        assert "exceeds unit bounds" in response.json()["detail"]

    async def test_create_placement_overlap(
        self,
        authenticated_client: AsyncClient,
        test_gridfinity_unit: GridfinityUnit,
        test_placement: GridfinityPlacement,
    ):
        """Test creating a placement that overlaps with existing one."""
        # Get another item
        response = await authenticated_client.post(
            "/api/v1/items",
            json={"name": "Another Item"},
        )
        new_item_id = response.json()["id"]

        # Try to place at same position
        response = await authenticated_client.post(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}/placements",
            json={
                "item_id": new_item_id,
                "grid_x": 0,
                "grid_y": 0,
            },
        )

        assert response.status_code == 409
        assert "overlap" in response.json()["detail"].lower()

    async def test_create_placement_item_already_placed(
        self,
        authenticated_client: AsyncClient,
        test_gridfinity_unit: GridfinityUnit,
        test_placement: GridfinityPlacement,
    ):
        """Test placing the same item twice in a unit."""
        response = await authenticated_client.post(
            f"/api/v1/gridfinity/units/{test_gridfinity_unit.id}/placements",
            json={
                "item_id": str(test_placement.item_id),
                "grid_x": 1,
                "grid_y": 1,
            },
        )

        assert response.status_code == 409
        assert "already placed" in response.json()["detail"]


class TestUpdatePlacementEndpoint:
    """Tests for PUT /api/v1/gridfinity/placements/{placement_id}."""

    async def test_update_placement_move(
        self,
        authenticated_client: AsyncClient,
        test_placement: GridfinityPlacement,
    ):
        """Test moving a placement to a new position."""
        response = await authenticated_client.put(
            f"/api/v1/gridfinity/placements/{test_placement.id}",
            json={"grid_x": 2, "grid_y": 2},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["grid_x"] == 2
        assert data["grid_y"] == 2
        assert data["position_code"] == "C3"

    async def test_update_placement_not_found(self, authenticated_client: AsyncClient):
        """Test updating a non-existent placement."""
        response = await authenticated_client.put(
            f"/api/v1/gridfinity/placements/{uuid.uuid4()}",
            json={"grid_x": 1},
        )

        assert response.status_code == 404


class TestDeletePlacementEndpoint:
    """Tests for DELETE /api/v1/gridfinity/placements/{placement_id}."""

    async def test_delete_placement(
        self, authenticated_client: AsyncClient, test_placement: GridfinityPlacement
    ):
        """Test deleting a placement."""
        response = await authenticated_client.delete(
            f"/api/v1/gridfinity/placements/{test_placement.id}"
        )

        assert response.status_code == 204

    async def test_delete_placement_not_found(self, authenticated_client: AsyncClient):
        """Test deleting a non-existent placement."""
        response = await authenticated_client.delete(
            f"/api/v1/gridfinity/placements/{uuid.uuid4()}"
        )

        assert response.status_code == 404


class TestCalculateGridEndpoint:
    """Tests for GET /api/v1/gridfinity/calculate-grid."""

    async def test_calculate_grid(self, authenticated_client: AsyncClient):
        """Test calculating grid size from dimensions."""
        response = await authenticated_client.get(
            "/api/v1/gridfinity/calculate-grid?width_mm=252&depth_mm=168"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["columns"] == 6
        assert data["rows"] == 4
        assert data["total_cells"] == 24

    async def test_calculate_grid_wasted_space(self, authenticated_client: AsyncClient):
        """Test that wasted space is calculated correctly."""
        response = await authenticated_client.get(
            "/api/v1/gridfinity/calculate-grid?width_mm=250&depth_mm=250"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["columns"] == 5  # floor(250/42) = 5
        assert data["rows"] == 5
        assert data["wasted_width_mm"] == 40  # 250 - 5*42 = 40
        assert data["wasted_depth_mm"] == 40

    async def test_calculate_grid_invalid_dimensions(
        self, authenticated_client: AsyncClient
    ):
        """Test with invalid dimensions."""
        response = await authenticated_client.get(
            "/api/v1/gridfinity/calculate-grid?width_mm=0&depth_mm=252"
        )

        assert response.status_code == 400
        assert "positive" in response.json()["detail"]
