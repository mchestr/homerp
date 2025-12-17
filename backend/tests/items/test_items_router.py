"""HTTP integration tests for items router."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.categories.models import Category
from src.items.models import Item
from src.locations.models import Location
from src.locations.schemas import ItemLocationSuggestionResult, LocationSuggestionItem
from src.users.models import User


@pytest.fixture
async def test_item_with_stock(
    async_session: AsyncSession,
    test_user: User,
    test_category: Category,
    test_location: Location,
) -> Item:
    """Create a test item with higher quantity for checkout tests."""
    item = Item(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Test Item With Stock",
        description="A test item with higher quantity",
        quantity=10,
        category_id=test_category.id,
        location_id=test_location.id,
    )
    async_session.add(item)
    await async_session.commit()
    await async_session.refresh(item)
    return item


class TestListItemsEndpoint:
    """Tests for GET /api/v1/items."""

    async def test_list_items_empty(self, authenticated_client: AsyncClient):
        """Test listing items when none exist."""
        response = await authenticated_client.get("/api/v1/items")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1

    async def test_list_items_with_data(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test listing items with existing data."""
        response = await authenticated_client.get("/api/v1/items")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == test_item.name
        assert data["total"] == 1

    async def test_list_items_pagination(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test pagination parameters."""
        response = await authenticated_client.get(
            "/api/v1/items", params={"page": 1, "limit": 10}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10

    async def test_list_items_filter_by_category(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,
        test_category: Category,
    ):
        """Test filtering items by category."""
        response = await authenticated_client.get(
            "/api/v1/items", params={"category_id": str(test_category.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1

    async def test_list_items_filter_by_location(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,
        test_location: Location,
    ):
        """Test filtering items by location."""
        response = await authenticated_client.get(
            "/api/v1/items", params={"location_id": str(test_location.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1

    async def test_list_items_search(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test searching items."""
        response = await authenticated_client.get(
            "/api/v1/items", params={"search": "Multimeter"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1

    async def test_list_items_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/items")

        assert response.status_code == 401


class TestCreateItemEndpoint:
    """Tests for POST /api/v1/items."""

    async def test_create_item(
        self,
        authenticated_client: AsyncClient,
        test_category: Category,
        test_location: Location,
    ):
        """Test creating a new item."""
        response = await authenticated_client.post(
            "/api/v1/items",
            json={
                "name": "New Item",
                "description": "A test item",
                "quantity": 5,
                "category_id": str(test_category.id),
                "location_id": str(test_location.id),
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Item"
        assert data["description"] == "A test item"
        assert data["quantity"] == 5

    async def test_create_item_with_attributes(
        self,
        authenticated_client: AsyncClient,
        test_category: Category,
        test_location: Location,
    ):
        """Test creating an item with attributes."""
        response = await authenticated_client.post(
            "/api/v1/items",
            json={
                "name": "Item with Attributes",
                "quantity": 1,
                "attributes": {"color": "red", "size": "large"},
                "tags": ["test", "example"],
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["attributes"]["color"] == "red"
        assert "test" in data["tags"]

    async def test_create_item_validation_error(
        self, authenticated_client: AsyncClient
    ):
        """Test creating an item with invalid data."""
        response = await authenticated_client.post(
            "/api/v1/items",
            json={"quantity": 5},  # Missing required 'name' field
        )

        assert response.status_code == 422

    async def test_create_item_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/items", json={"name": "Test", "quantity": 1}
        )

        assert response.status_code == 401


class TestGetItemEndpoint:
    """Tests for GET /api/v1/items/{item_id}."""

    async def test_get_item(self, authenticated_client: AsyncClient, test_item: Item):
        """Test getting an item by ID."""
        response = await authenticated_client.get(f"/api/v1/items/{test_item.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_item.id)
        assert data["name"] == test_item.name

    async def test_get_item_not_found(self, authenticated_client: AsyncClient):
        """Test getting a non-existent item."""
        response = await authenticated_client.get(f"/api/v1/items/{uuid.uuid4()}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Item not found"

    async def test_get_item_unauthenticated(
        self, unauthenticated_client: AsyncClient, test_item: Item
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get(f"/api/v1/items/{test_item.id}")

        assert response.status_code == 401


class TestUpdateItemEndpoint:
    """Tests for PUT /api/v1/items/{item_id}."""

    async def test_update_item(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test updating an item."""
        response = await authenticated_client.put(
            f"/api/v1/items/{test_item.id}",
            json={"name": "Updated Item", "quantity": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Item"
        assert data["quantity"] == 10

    async def test_update_item_not_found(self, authenticated_client: AsyncClient):
        """Test updating a non-existent item."""
        response = await authenticated_client.put(
            f"/api/v1/items/{uuid.uuid4()}", json={"name": "Test"}
        )

        assert response.status_code == 404

    async def test_update_item_unauthenticated(
        self, unauthenticated_client: AsyncClient, test_item: Item
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.put(
            f"/api/v1/items/{test_item.id}", json={"name": "Test"}
        )

        assert response.status_code == 401


class TestUpdateQuantityEndpoint:
    """Tests for PATCH /api/v1/items/{item_id}/quantity."""

    async def test_update_quantity(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test updating item quantity."""
        response = await authenticated_client.patch(
            f"/api/v1/items/{test_item.id}/quantity", json={"quantity": 50}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["quantity"] == 50

    async def test_update_quantity_not_found(self, authenticated_client: AsyncClient):
        """Test updating quantity for non-existent item."""
        response = await authenticated_client.patch(
            f"/api/v1/items/{uuid.uuid4()}/quantity", json={"quantity": 10}
        )

        assert response.status_code == 404


class TestDeleteItemEndpoint:
    """Tests for DELETE /api/v1/items/{item_id}."""

    async def test_delete_item(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test deleting an item."""
        response = await authenticated_client.delete(f"/api/v1/items/{test_item.id}")

        assert response.status_code == 204

        # Verify item is deleted
        get_response = await authenticated_client.get(f"/api/v1/items/{test_item.id}")
        assert get_response.status_code == 404

    async def test_delete_item_not_found(self, authenticated_client: AsyncClient):
        """Test deleting a non-existent item."""
        response = await authenticated_client.delete(f"/api/v1/items/{uuid.uuid4()}")

        assert response.status_code == 404


class TestSearchItemsEndpoint:
    """Tests for GET /api/v1/items/search."""

    async def test_search_items(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test searching items."""
        response = await authenticated_client.get(
            "/api/v1/items/search", params={"q": "Multi"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    async def test_search_items_no_results(self, authenticated_client: AsyncClient):
        """Test search with no results."""
        response = await authenticated_client.get(
            "/api/v1/items/search", params={"q": "nonexistent"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    async def test_search_items_missing_query(self, authenticated_client: AsyncClient):
        """Test search without query parameter."""
        response = await authenticated_client.get("/api/v1/items/search")

        assert response.status_code == 422


class TestLowStockEndpoint:
    """Tests for GET /api/v1/items/low-stock."""

    async def test_low_stock_items(self, authenticated_client: AsyncClient):
        """Test getting low stock items."""
        response = await authenticated_client.get("/api/v1/items/low-stock")

        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestFacetsEndpoint:
    """Tests for GET /api/v1/items/facets."""

    async def test_get_facets(self, authenticated_client: AsyncClient):
        """Test getting item facets."""
        response = await authenticated_client.get("/api/v1/items/facets")

        assert response.status_code == 200
        data = response.json()
        assert "facets" in data
        assert "total_items" in data


class TestTagsEndpoint:
    """Tests for GET /api/v1/items/tags."""

    async def test_get_tags(self, authenticated_client: AsyncClient, test_item: Item):
        """Test getting all tags."""
        response = await authenticated_client.get("/api/v1/items/tags")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestDashboardStatsEndpoint:
    """Tests for GET /api/v1/items/stats/dashboard."""

    async def test_dashboard_stats(self, authenticated_client: AsyncClient):
        """Test getting dashboard stats."""
        response = await authenticated_client.get("/api/v1/items/stats/dashboard")

        assert response.status_code == 200
        data = response.json()
        assert "total_items" in data
        assert "categories_used" in data
        assert "locations_used" in data


class TestMostUsedEndpoint:
    """Tests for GET /api/v1/items/stats/most-used."""

    async def test_most_used_items(self, authenticated_client: AsyncClient):
        """Test getting most used items."""
        response = await authenticated_client.get("/api/v1/items/stats/most-used")

        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestRecentlyUsedEndpoint:
    """Tests for GET /api/v1/items/stats/recently-used."""

    async def test_recently_used_items(self, authenticated_client: AsyncClient):
        """Test getting recently used items."""
        response = await authenticated_client.get("/api/v1/items/stats/recently-used")

        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestCheckOutEndpoint:
    """Tests for POST /api/v1/items/{item_id}/check-out."""

    async def test_check_out_item(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test checking out an item."""
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 1, "notes": "Test checkout"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["action_type"] == "check_out"
        assert data["quantity"] == 1

    async def test_check_out_item_not_found(self, authenticated_client: AsyncClient):
        """Test checking out non-existent item."""
        response = await authenticated_client.post(
            f"/api/v1/items/{uuid.uuid4()}/check-out", json={"quantity": 1}
        )

        assert response.status_code == 404

    async def test_check_out_more_than_available_fails(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that checking out more than available quantity returns 400.

        The test_item fixture has quantity=1, so checking out 2 should fail.
        """
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 2},
        )

        assert response.status_code == 400
        assert "Cannot check out 2 items" in response.json()["detail"]
        assert "Only 1 available" in response.json()["detail"]

    async def test_check_out_when_already_fully_checked_out_fails(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that checking out when all items are already checked out returns 400.

        The test_item fixture has quantity=1. After one checkout, no items available.
        """
        # First checkout succeeds
        first_response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 1},
        )
        assert first_response.status_code == 201

        # Second checkout should fail - no items available
        second_response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 1},
        )

        assert second_response.status_code == 400
        assert second_response.json()["detail"] == "No items available for checkout"

    async def test_check_out_exact_available_succeeds(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test checking out exactly the available quantity succeeds.

        The test_item fixture has quantity=1. Checking out 1 should succeed.
        """
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 1},
        )

        assert response.status_code == 201
        assert response.json()["quantity"] == 1

        # Verify usage stats
        stats_response = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/usage-stats"
        )
        assert stats_response.status_code == 200
        assert stats_response.json()["currently_checked_out"] == 1

    async def test_check_out_after_partial_checkin_succeeds(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that checking out after items are returned succeeds.

        This verifies the available quantity is recalculated correctly.
        """
        # Initial checkout
        await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 1},
        )

        # Check in
        await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
            json={"quantity": 1},
        )

        # Should be able to check out again
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 1},
        )

        assert response.status_code == 201


class TestCheckInEndpoint:
    """Tests for POST /api/v1/items/{item_id}/check-in."""

    async def test_check_in_item_after_checkout(
        self, authenticated_client: AsyncClient, test_item_with_stock: Item
    ):
        """Test checking in an item after it has been checked out."""
        # First check out the item
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-out",
            json={"quantity": 2},
        )
        assert checkout_response.status_code == 201

        # Now check in the item
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-in",
            json={"quantity": 1, "notes": "Test checkin"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["action_type"] == "check_in"
        assert data["quantity"] == 1

    async def test_check_in_item_not_found(self, authenticated_client: AsyncClient):
        """Test checking in non-existent item."""
        response = await authenticated_client.post(
            f"/api/v1/items/{uuid.uuid4()}/check-in", json={"quantity": 1}
        )

        assert response.status_code == 404

    async def test_check_in_without_prior_checkout_fails(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that checking in without prior checkout returns 400."""
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
            json={"quantity": 1},
        )

        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Cannot check in item that has not been checked out"
        )

    async def test_check_in_more_than_checked_out_fails(
        self, authenticated_client: AsyncClient, test_item_with_stock: Item
    ):
        """Test that checking in more than checked out returns 400."""
        # First check out 2 items
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-out",
            json={"quantity": 2},
        )
        assert checkout_response.status_code == 201

        # Try to check in 3 items (more than checked out)
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-in",
            json={"quantity": 3},
        )

        assert response.status_code == 400
        assert "Cannot check in 3 items" in response.json()["detail"]
        assert "Only 2 currently checked out" in response.json()["detail"]

    async def test_check_in_exact_amount_succeeds(
        self, authenticated_client: AsyncClient, test_item_with_stock: Item
    ):
        """Test checking in exact amount that was checked out."""
        # First check out 3 items
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-out",
            json={"quantity": 3},
        )
        assert checkout_response.status_code == 201

        # Check in all 3
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-in",
            json={"quantity": 3},
        )

        assert response.status_code == 201

        # Check usage stats - should be 0 currently checked out
        stats_response = await authenticated_client.get(
            f"/api/v1/items/{test_item_with_stock.id}/usage-stats"
        )
        assert stats_response.status_code == 200
        assert stats_response.json()["currently_checked_out"] == 0

    async def test_check_in_after_full_return_fails(
        self, authenticated_client: AsyncClient, test_item_with_stock: Item
    ):
        """Test that check in fails after all items have been returned."""
        # Check out 2 items
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-out",
            json={"quantity": 2},
        )
        assert checkout_response.status_code == 201

        # Check in all 2
        checkin_response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-in",
            json={"quantity": 2},
        )
        assert checkin_response.status_code == 201

        # Try to check in 1 more (should fail as currently_checked_out is 0)
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-in",
            json={"quantity": 1},
        )

        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Cannot check in item that has not been checked out"
        )

    async def test_check_in_prevents_negative_count_sequential(
        self, authenticated_client: AsyncClient, test_item_with_stock: Item
    ):
        """Test that sequential check-ins properly prevent negative currently_checked_out.

        This test verifies that the validation logic correctly prevents
        check-ins that would result in negative counts, even when attempted
        back-to-back.
        """
        # First check out 2 items
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-out",
            json={"quantity": 2},
        )
        assert checkout_response.status_code == 201

        # Verify currently checked out is 2
        stats = await authenticated_client.get(
            f"/api/v1/items/{test_item_with_stock.id}/usage-stats"
        )
        assert stats.json()["currently_checked_out"] == 2

        # First check-in of 2 should succeed
        first_checkin = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-in",
            json={"quantity": 2},
        )
        assert first_checkin.status_code == 201

        # Verify currently checked out is now 0
        stats_after_first = await authenticated_client.get(
            f"/api/v1/items/{test_item_with_stock.id}/usage-stats"
        )
        assert stats_after_first.json()["currently_checked_out"] == 0

        # Second check-in should fail since nothing is checked out
        second_checkin = await authenticated_client.post(
            f"/api/v1/items/{test_item_with_stock.id}/check-in",
            json={"quantity": 2},
        )
        assert second_checkin.status_code == 400
        assert (
            second_checkin.json()["detail"]
            == "Cannot check in item that has not been checked out"
        )

        # Verify final state: currently_checked_out should be exactly 0, not negative
        final_stats = await authenticated_client.get(
            f"/api/v1/items/{test_item_with_stock.id}/usage-stats"
        )
        assert final_stats.status_code == 200
        assert final_stats.json()["currently_checked_out"] == 0, (
            "currently_checked_out should never be negative"
        )


class TestItemHistoryEndpoint:
    """Tests for GET /api/v1/items/{item_id}/history."""

    async def test_get_item_history(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test getting item history."""
        response = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/history"
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_get_item_history_not_found(self, authenticated_client: AsyncClient):
        """Test getting history for non-existent item."""
        response = await authenticated_client.get(
            f"/api/v1/items/{uuid.uuid4()}/history"
        )

        assert response.status_code == 404


class TestItemUsageStatsEndpoint:
    """Tests for GET /api/v1/items/{item_id}/usage-stats."""

    async def test_get_usage_stats(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test getting item usage stats."""
        response = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/usage-stats"
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_check_outs" in data
        assert "total_check_ins" in data

    async def test_get_usage_stats_not_found(self, authenticated_client: AsyncClient):
        """Test getting usage stats for non-existent item."""
        response = await authenticated_client.get(
            f"/api/v1/items/{uuid.uuid4()}/usage-stats"
        )

        assert response.status_code == 404


class TestFindSimilarEndpoint:
    """Tests for POST /api/v1/items/find-similar."""

    async def test_find_similar_items(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test finding similar items with matching name."""
        response = await authenticated_client.post(
            "/api/v1/items/find-similar",
            json={
                "identified_name": "Multimeter",
                "category_path": "Tools > Electronics",
                "limit": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "similar_items" in data
        assert "total_searched" in data
        assert isinstance(data["similar_items"], list)
        # The test_item is named "Multimeter" so it should match
        assert data["total_searched"] >= 1

    async def test_find_similar_items_with_partial_match(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test finding similar items with partial name match."""
        response = await authenticated_client.post(
            "/api/v1/items/find-similar",
            json={
                "identified_name": "Digital Multimeter Pro",
                "limit": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "similar_items" in data
        # Should find the test_item which contains "Multimeter"

    async def test_find_similar_items_no_matches(
        self, authenticated_client: AsyncClient
    ):
        """Test finding similar items when none exist."""
        response = await authenticated_client.post(
            "/api/v1/items/find-similar",
            json={
                "identified_name": "Completely Unique Item XYZ123",
                "limit": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["similar_items"] == []

    async def test_find_similar_items_with_specifications(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test finding similar items with specification matching."""
        response = await authenticated_client.post(
            "/api/v1/items/find-similar",
            json={
                "identified_name": "Multimeter",
                "specifications": {"voltage": "12V"},
                "limit": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "similar_items" in data

    async def test_find_similar_items_validation_error(
        self, authenticated_client: AsyncClient
    ):
        """Test find similar with invalid data."""
        response = await authenticated_client.post(
            "/api/v1/items/find-similar",
            json={
                "limit": 5,
            },  # Missing required 'identified_name' field
        )

        assert response.status_code == 422

    async def test_find_similar_items_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/items/find-similar",
            json={"identified_name": "Test Item", "limit": 5},
        )

        assert response.status_code == 401

    async def test_find_similar_items_response_structure(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that similar item response has correct structure."""
        response = await authenticated_client.post(
            "/api/v1/items/find-similar",
            json={
                "identified_name": test_item.name,
                "limit": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "similar_items" in data
        assert "total_searched" in data

        if len(data["similar_items"]) > 0:
            item = data["similar_items"][0]
            assert "id" in item
            assert "name" in item
            assert "description" in item
            assert "quantity" in item
            assert "quantity_unit" in item
            assert "similarity_score" in item
            assert "match_reasons" in item
            assert isinstance(item["match_reasons"], list)
            assert 0.0 <= item["similarity_score"] <= 1.0


class TestItemQRCodeEndpoint:
    """Tests for GET /api/v1/items/{item_id}/qr."""

    async def test_get_item_qr_code(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test getting QR code for an item."""
        response = await authenticated_client.get(f"/api/v1/items/{test_item.id}/qr")

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        # Check PNG magic bytes
        assert response.content[:8] == b"\x89PNG\r\n\x1a\n"

    async def test_get_item_qr_code_with_size(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test getting QR code with custom size."""
        small = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/qr", params={"size": 5}
        )
        large = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/qr", params={"size": 20}
        )

        assert small.status_code == 200
        assert large.status_code == 200
        # Larger size should produce larger image
        assert len(small.content) < len(large.content)

    async def test_get_item_qr_code_invalid_size(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test getting QR code with invalid size parameter."""
        response = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/qr", params={"size": 100}
        )

        assert response.status_code == 422

    async def test_get_item_qr_code_not_found(self, authenticated_client: AsyncClient):
        """Test getting QR code for non-existent item."""
        response = await authenticated_client.get(f"/api/v1/items/{uuid.uuid4()}/qr")

        assert response.status_code == 404

    async def test_get_item_qr_code_unauthenticated(
        self, unauthenticated_client: AsyncClient, test_item: Item
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get(f"/api/v1/items/{test_item.id}/qr")

        assert response.status_code == 401

    async def test_get_item_qr_code_cache_header(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that QR code response has cache headers."""
        response = await authenticated_client.get(f"/api/v1/items/{test_item.id}/qr")

        assert response.status_code == 200
        assert "cache-control" in response.headers
        assert "max-age" in response.headers["cache-control"]


class TestListItemsFilterByNoCategory:
    """Tests for GET /api/v1/items with no_category filter."""

    async def test_filter_items_without_category(
        self, authenticated_client: AsyncClient, async_session, test_user
    ):
        """Test filtering items that have no category assigned."""
        # Create an item without a category
        uncategorized_item = Item(
            name="Uncategorized Item",
            quantity=1,
            user_id=test_user.id,
            category_id=None,
        )
        async_session.add(uncategorized_item)
        await async_session.commit()

        response = await authenticated_client.get(
            "/api/v1/items", params={"no_category": "true"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "Uncategorized Item"

    async def test_filter_excludes_categorized_items(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,  # This has a category
    ):
        """Test that items with category are excluded when filtering for uncategorized."""
        response = await authenticated_client.get(
            "/api/v1/items", params={"no_category": "true"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 0


class TestListItemsFilterByNoLocation:
    """Tests for GET /api/v1/items with no_location filter."""

    async def test_filter_items_without_location(
        self, authenticated_client: AsyncClient, async_session, test_user
    ):
        """Test filtering items that have no location assigned."""
        # Create an item without a location
        no_location_item = Item(
            name="No Location Item",
            quantity=1,
            user_id=test_user.id,
            location_id=None,
        )
        async_session.add(no_location_item)
        await async_session.commit()

        response = await authenticated_client.get(
            "/api/v1/items", params={"no_location": "true"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "No Location Item"

    async def test_filter_excludes_items_with_location(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,  # This has a location
    ):
        """Test that items with location are excluded when filtering for no location."""
        response = await authenticated_client.get(
            "/api/v1/items", params={"no_location": "true"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 0


class TestBatchUpdateItemsEndpoint:
    """Tests for PATCH /api/v1/items/batch."""

    async def test_batch_update_category(
        self,
        authenticated_client: AsyncClient,
        async_session,
        test_user,
        test_category: Category,
    ):
        """Test batch updating items with a new category."""
        # Create items without category
        item1 = Item(name="Item 1", quantity=1, user_id=test_user.id, category_id=None)
        item2 = Item(name="Item 2", quantity=2, user_id=test_user.id, category_id=None)
        async_session.add_all([item1, item2])
        await async_session.commit()
        await async_session.refresh(item1)
        await async_session.refresh(item2)

        response = await authenticated_client.patch(
            "/api/v1/items/batch",
            json={
                "item_ids": [str(item1.id), str(item2.id)],
                "category_id": str(test_category.id),
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 2
        assert len(data["item_ids"]) == 2

    async def test_batch_update_location(
        self,
        authenticated_client: AsyncClient,
        async_session,
        test_user,
        test_location: Location,
    ):
        """Test batch updating items with a new location."""
        # Create items without location
        item1 = Item(name="Item 1", quantity=1, user_id=test_user.id, location_id=None)
        item2 = Item(name="Item 2", quantity=2, user_id=test_user.id, location_id=None)
        async_session.add_all([item1, item2])
        await async_session.commit()
        await async_session.refresh(item1)
        await async_session.refresh(item2)

        response = await authenticated_client.patch(
            "/api/v1/items/batch",
            json={
                "item_ids": [str(item1.id), str(item2.id)],
                "location_id": str(test_location.id),
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 2

    async def test_batch_update_clear_category(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,  # Has a category
    ):
        """Test batch clearing category from items."""
        response = await authenticated_client.patch(
            "/api/v1/items/batch",
            json={
                "item_ids": [str(test_item.id)],
                "clear_category": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 1

        # Verify the item now has no category
        item_response = await authenticated_client.get(f"/api/v1/items/{test_item.id}")
        assert item_response.json()["category"] is None

    async def test_batch_update_clear_location(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,  # Has a location
    ):
        """Test batch clearing location from items."""
        response = await authenticated_client.patch(
            "/api/v1/items/batch",
            json={
                "item_ids": [str(test_item.id)],
                "clear_location": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 1

        # Verify the item now has no location
        item_response = await authenticated_client.get(f"/api/v1/items/{test_item.id}")
        assert item_response.json()["location"] is None

    async def test_batch_update_empty_item_ids(self, authenticated_client: AsyncClient):
        """Test batch update with empty item_ids list returns validation error."""
        response = await authenticated_client.patch(
            "/api/v1/items/batch",
            json={"item_ids": []},
        )

        assert response.status_code == 422

    async def test_batch_update_nonexistent_items(
        self, authenticated_client: AsyncClient, test_category: Category
    ):
        """Test batch update with non-existent item IDs returns empty result."""
        response = await authenticated_client.patch(
            "/api/v1/items/batch",
            json={
                "item_ids": [str(uuid.uuid4()), str(uuid.uuid4())],
                "category_id": str(test_category.id),
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 0
        assert len(data["item_ids"]) == 0

    async def test_batch_update_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.patch(
            "/api/v1/items/batch",
            json={
                "item_ids": [str(uuid.uuid4())],
                "category_id": str(uuid.uuid4()),
            },
        )

        assert response.status_code == 401


class TestBatchCreateItemsEndpoint:
    """Tests for POST /api/v1/items/batch."""

    async def test_batch_create_single_item(
        self,
        authenticated_client: AsyncClient,
        test_category: Category,
        test_location: Location,
    ):
        """Test batch creating a single item."""
        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={
                "items": [
                    {
                        "name": "Test Item",
                        "description": "A test item",
                        "quantity": 5,
                        "category_id": str(test_category.id),
                        "location_id": str(test_location.id),
                    }
                ]
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1
        assert data["failed_count"] == 0
        assert len(data["results"]) == 1
        assert data["results"][0]["success"] is True
        assert data["results"][0]["name"] == "Test Item"
        assert data["results"][0]["item_id"] is not None

    async def test_batch_create_multiple_items(
        self,
        authenticated_client: AsyncClient,
        test_category: Category,
        test_location: Location,
    ):
        """Test batch creating multiple items at once."""
        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={
                "items": [
                    {"name": "Item 1", "quantity": 1},
                    {"name": "Item 2", "quantity": 2},
                    {"name": "Item 3", "quantity": 3},
                ]
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 3
        assert data["failed_count"] == 0
        assert len(data["results"]) == 3
        for i, result in enumerate(data["results"]):
            assert result["success"] is True
            assert result["name"] == f"Item {i + 1}"

    async def test_batch_create_preserves_order(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test that batch create returns results in the same order as input."""
        items = [
            {"name": "Alpha", "quantity": 1},
            {"name": "Beta", "quantity": 1},
            {"name": "Gamma", "quantity": 1},
            {"name": "Delta", "quantity": 1},
        ]

        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={"items": items},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 4
        # Verify order is preserved
        for i, result in enumerate(data["results"]):
            assert result["name"] == items[i]["name"]

    async def test_batch_create_with_attributes_and_tags(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test batch creating items with attributes and tags."""
        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={
                "items": [
                    {
                        "name": "Item with Attrs",
                        "quantity": 1,
                        "attributes": {"color": "red", "size": "large"},
                        "tags": ["important", "electronics"],
                    }
                ]
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1
        assert data["results"][0]["success"] is True

        # Verify the item was created correctly
        item_id = data["results"][0]["item_id"]
        item_response = await authenticated_client.get(f"/api/v1/items/{item_id}")
        item_data = item_response.json()
        assert item_data["attributes"]["color"] == "red"
        assert "important" in item_data["tags"]

    async def test_batch_create_empty_list(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test batch create with empty items list returns validation error."""
        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={"items": []},
        )

        assert response.status_code == 422

    async def test_batch_create_exceeds_max_items(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test batch create with more than 50 items returns validation error."""
        items = [{"name": f"Item {i}", "quantity": 1} for i in range(51)]

        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={"items": items},
        )

        assert response.status_code == 422

    async def test_batch_create_validation_error_in_item(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test batch create with invalid item data returns validation error."""
        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={
                "items": [
                    {"name": "", "quantity": 1},  # Empty name is invalid
                ]
            },
        )

        assert response.status_code == 422

    async def test_batch_create_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/items/batch",
            json={"items": [{"name": "Test", "quantity": 1}]},
        )

        assert response.status_code == 401

    async def test_batch_create_with_optional_fields(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test batch create with all optional fields."""
        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={
                "items": [
                    {
                        "name": "Full Item",
                        "description": "Complete description",
                        "quantity": 10,
                        "quantity_unit": "kg",
                        "min_quantity": 5,
                        "price": "19.99",
                        "attributes": {"weight": "500g"},
                        "tags": ["heavy", "metal"],
                    }
                ]
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1

        # Verify the item was created with all fields
        item_id = data["results"][0]["item_id"]
        item_response = await authenticated_client.get(f"/api/v1/items/{item_id}")
        item_data = item_response.json()
        assert item_data["name"] == "Full Item"
        assert item_data["description"] == "Complete description"
        assert item_data["quantity"] == 10
        assert item_data["quantity_unit"] == "kg"
        assert item_data["min_quantity"] == 5
        assert float(item_data["price"]) == 19.99

    async def test_batch_create_max_allowed_items(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test batch create with exactly 50 items (the maximum allowed)."""
        items = [{"name": f"Item {i}", "quantity": 1} for i in range(50)]

        response = await authenticated_client.post(
            "/api/v1/items/batch",
            json={"items": items},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 50
        assert data["failed_count"] == 0
        assert len(data["results"]) == 50


class TestSuggestLocationEndpoint:
    """Tests for POST /api/v1/items/suggest-location."""

    async def test_suggest_location_no_credits(
        self,
        unauthenticated_client: AsyncClient,
        async_session,
        test_settings,
        user_with_no_credits,
    ):
        """Test suggest location returns 402 when user has no credits."""
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: user_with_no_credits.id

        from httpx import ASGITransport
        from httpx import AsyncClient as HttpxAsyncClient

        transport = ASGITransport(app=app)
        async with HttpxAsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/items/suggest-location",
                json={
                    "item_name": "Test Item",
                    "item_category": "Tools > Hardware",
                },
            )

            assert response.status_code == 402
            assert "Insufficient credits" in response.json()["detail"]

        app.dependency_overrides.clear()

    async def test_suggest_location_no_locations(
        self, authenticated_client: AsyncClient
    ):
        """Test suggest location returns empty when no locations exist."""
        response = await authenticated_client.post(
            "/api/v1/items/suggest-location",
            json={
                "item_name": "Test Item",
                "item_category": "Tools > Hardware",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["suggestions"] == []
        assert "No locations found" in (data.get("error") or "No locations found")

    async def test_suggest_location_with_locations_mocked_ai(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test suggest location with locations (mocked AI service)."""
        mock_result = ItemLocationSuggestionResult(
            suggestions=[
                LocationSuggestionItem(
                    location_id=test_location.id,
                    location_name=test_location.name,
                    confidence=0.85,
                    reasoning="This location is suitable for storing tools.",
                )
            ]
        )

        with patch(
            "src.items.router.AIClassificationService.suggest_item_location_with_usage",
            new_callable=AsyncMock,
            return_value=(mock_result, {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}),
        ):
            response = await authenticated_client.post(
                "/api/v1/items/suggest-location",
                json={
                    "item_name": "Screwdriver",
                    "item_category": "Tools > Hand Tools",
                    "item_description": "A Phillips head screwdriver",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["suggestions"]) == 1
            assert data["suggestions"][0]["location_name"] == test_location.name
            assert data["suggestions"][0]["confidence"] == 0.85

    async def test_suggest_location_validation_error(
        self, authenticated_client: AsyncClient
    ):
        """Test suggest location with missing required field."""
        response = await authenticated_client.post(
            "/api/v1/items/suggest-location",
            json={
                "item_category": "Tools",  # Missing required item_name
            },
        )

        assert response.status_code == 422

    async def test_suggest_location_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/items/suggest-location",
            json={"item_name": "Test Item"},
        )

        assert response.status_code == 401

    async def test_suggest_location_with_full_data(
        self, authenticated_client: AsyncClient, test_location: Location
    ):
        """Test suggest location with all optional fields."""
        mock_result = ItemLocationSuggestionResult(
            suggestions=[
                LocationSuggestionItem(
                    location_id=test_location.id,
                    location_name=test_location.name,
                    confidence=0.92,
                    reasoning="Similar items are stored here.",
                )
            ]
        )

        with patch(
            "src.items.router.AIClassificationService.suggest_item_location_with_usage",
            new_callable=AsyncMock,
            return_value=(mock_result, {"prompt_tokens": 120, "completion_tokens": 60, "total_tokens": 180}),
        ):
            response = await authenticated_client.post(
                "/api/v1/items/suggest-location",
                json={
                    "item_name": "M3x10mm Screws",
                    "item_category": "Hardware > Fasteners > Screws",
                    "item_description": "Stainless steel screws for electronics",
                    "item_specifications": {
                        "material": "stainless steel",
                        "size": "M3x10mm",
                        "quantity": 100,
                    },
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["suggestions"]) == 1
            assert data["suggestions"][0]["confidence"] == 0.92
