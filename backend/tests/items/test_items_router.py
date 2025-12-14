"""HTTP integration tests for items router."""

import uuid

from httpx import AsyncClient

from src.categories.models import Category
from src.items.models import Item
from src.locations.models import Location


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


class TestCheckInEndpoint:
    """Tests for POST /api/v1/items/{item_id}/check-in."""

    async def test_check_in_item_after_checkout(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test checking in an item after it has been checked out."""
        # First check out the item
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 2},
        )
        assert checkout_response.status_code == 201

        # Now check in the item
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
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
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that checking in more than checked out returns 400."""
        # First check out 2 items
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 2},
        )
        assert checkout_response.status_code == 201

        # Try to check in 3 items (more than checked out)
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
            json={"quantity": 3},
        )

        assert response.status_code == 400
        assert "Cannot check in 3 items" in response.json()["detail"]
        assert "Only 2 currently checked out" in response.json()["detail"]

    async def test_check_in_exact_amount_succeeds(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test checking in exact amount that was checked out."""
        # First check out 3 items
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 3},
        )
        assert checkout_response.status_code == 201

        # Check in all 3
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
            json={"quantity": 3},
        )

        assert response.status_code == 201

        # Check usage stats - should be 0 currently checked out
        stats_response = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/usage-stats"
        )
        assert stats_response.status_code == 200
        assert stats_response.json()["currently_checked_out"] == 0

    async def test_check_in_after_full_return_fails(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that check in fails after all items have been returned."""
        # Check out 2 items
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 2},
        )
        assert checkout_response.status_code == 201

        # Check in all 2
        checkin_response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
            json={"quantity": 2},
        )
        assert checkin_response.status_code == 201

        # Try to check in 1 more (should fail as currently_checked_out is 0)
        response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
            json={"quantity": 1},
        )

        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Cannot check in item that has not been checked out"
        )

    async def test_check_in_prevents_negative_count_sequential(
        self, authenticated_client: AsyncClient, test_item: Item
    ):
        """Test that sequential check-ins properly prevent negative currently_checked_out.

        This test verifies that the validation logic correctly prevents
        check-ins that would result in negative counts, even when attempted
        back-to-back.
        """
        # First check out 2 items
        checkout_response = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-out",
            json={"quantity": 2},
        )
        assert checkout_response.status_code == 201

        # Verify currently checked out is 2
        stats = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/usage-stats"
        )
        assert stats.json()["currently_checked_out"] == 2

        # First check-in of 2 should succeed
        first_checkin = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
            json={"quantity": 2},
        )
        assert first_checkin.status_code == 201

        # Verify currently checked out is now 0
        stats_after_first = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/usage-stats"
        )
        assert stats_after_first.json()["currently_checked_out"] == 0

        # Second check-in should fail since nothing is checked out
        second_checkin = await authenticated_client.post(
            f"/api/v1/items/{test_item.id}/check-in",
            json={"quantity": 2},
        )
        assert second_checkin.status_code == 400
        assert (
            second_checkin.json()["detail"]
            == "Cannot check in item that has not been checked out"
        )

        # Verify final state: currently_checked_out should be exactly 0, not negative
        final_stats = await authenticated_client.get(
            f"/api/v1/items/{test_item.id}/usage-stats"
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
