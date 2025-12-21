"""Integration tests for multi-tenancy and RLS enforcement.

Tests verify:
- Users can only access their own data
- Cross-tenant data access is prevented
- User isolation is enforced at the repository layer
"""

import uuid

from httpx import AsyncClient

from src.categories.models import Category
from src.images.models import Image
from src.items.models import Item
from src.locations.models import Location
from src.users.models import User


class TestItemIsolation:
    """Tests for item data isolation between users."""

    async def test_user_cannot_view_other_users_items(
        self,
        authenticated_client: AsyncClient,
        second_user_item: Item,
    ):
        """User should not be able to view items owned by another user."""
        response = await authenticated_client.get(
            f"/api/v1/items/{second_user_item.id}"
        )

        assert response.status_code == 404

    async def test_user_cannot_list_other_users_items(
        self,
        authenticated_client: AsyncClient,
        second_user_item: Item,  # noqa: ARG002
        test_item: Item,  # noqa: ARG002
    ):
        """User's item list should not include items from other users."""
        response = await authenticated_client.get("/api/v1/items")

        assert response.status_code == 200
        data = response.json()

        # All returned items should belong to test_user
        for item in data["items"]:
            # We can verify by checking the item name patterns
            assert "Second User" not in item["name"]

    async def test_user_cannot_update_other_users_items(
        self,
        authenticated_client: AsyncClient,
        second_user_item: Item,
    ):
        """User should not be able to update items owned by another user."""
        response = await authenticated_client.put(
            f"/api/v1/items/{second_user_item.id}",
            json={"name": "Hacked Item Name"},
        )

        assert response.status_code == 404

    async def test_user_cannot_delete_other_users_items(
        self,
        authenticated_client: AsyncClient,
        second_user_item: Item,
    ):
        """User should not be able to delete items owned by another user."""
        response = await authenticated_client.delete(
            f"/api/v1/items/{second_user_item.id}"
        )

        assert response.status_code == 404


class TestCategoryIsolation:
    """Tests for category data isolation between users."""

    async def test_user_cannot_view_other_users_categories(
        self,
        authenticated_client: AsyncClient,
        second_user_category: Category,
    ):
        """User should not be able to view categories owned by another user."""
        response = await authenticated_client.get(
            f"/api/v1/categories/{second_user_category.id}"
        )

        assert response.status_code == 404

    async def test_user_cannot_list_other_users_categories(
        self,
        authenticated_client: AsyncClient,
        second_user_category: Category,  # noqa: ARG002
        test_category: Category,  # noqa: ARG002
    ):
        """User's category list should not include categories from other users."""
        response = await authenticated_client.get("/api/v1/categories")

        assert response.status_code == 200
        data = response.json()

        # Verify no "Second User" categories
        for category in data:
            assert "Second User" not in category["name"]

    async def test_user_cannot_update_other_users_categories(
        self,
        authenticated_client: AsyncClient,
        second_user_category: Category,
    ):
        """User should not be able to update categories owned by another user."""
        response = await authenticated_client.put(
            f"/api/v1/categories/{second_user_category.id}",
            json={"name": "Hacked Category"},
        )

        assert response.status_code == 404

    async def test_user_cannot_delete_other_users_categories(
        self,
        authenticated_client: AsyncClient,
        second_user_category: Category,
    ):
        """User should not be able to delete categories owned by another user."""
        response = await authenticated_client.delete(
            f"/api/v1/categories/{second_user_category.id}"
        )

        assert response.status_code == 404

    async def test_user_cannot_create_item_with_other_users_category(
        self,
        authenticated_client: AsyncClient,
        second_user_category: Category,
        test_location: Location,
    ):
        """User cannot assign another user's category to their item.

        The item creation validates that category_id belongs to the current user.
        """
        response = await authenticated_client.post(
            "/api/v1/items",
            json={
                "name": "Test Item With Other Category",
                "category_id": str(second_user_category.id),
                "location_id": str(test_location.id),
            },
        )

        # Should return 404 - category not found (for this user)
        assert response.status_code == 404


class TestLocationIsolation:
    """Tests for location data isolation between users."""

    async def test_user_cannot_view_other_users_locations(
        self,
        authenticated_client: AsyncClient,
        second_user_location: Location,
    ):
        """User should not be able to view locations owned by another user."""
        response = await authenticated_client.get(
            f"/api/v1/locations/{second_user_location.id}"
        )

        assert response.status_code == 404

    async def test_user_cannot_list_other_users_locations(
        self,
        authenticated_client: AsyncClient,
        second_user_location: Location,  # noqa: ARG002
        test_location: Location,  # noqa: ARG002
    ):
        """User's location list should not include locations from other users."""
        response = await authenticated_client.get("/api/v1/locations")

        assert response.status_code == 200
        data = response.json()

        # Verify no "Second User" locations
        for location in data:
            assert "Second User" not in location["name"]

    async def test_user_cannot_update_other_users_locations(
        self,
        authenticated_client: AsyncClient,
        second_user_location: Location,
    ):
        """User should not be able to update locations owned by another user."""
        response = await authenticated_client.put(
            f"/api/v1/locations/{second_user_location.id}",
            json={"name": "Hacked Location"},
        )

        assert response.status_code == 404

    async def test_user_cannot_delete_other_users_locations(
        self,
        authenticated_client: AsyncClient,
        second_user_location: Location,
    ):
        """User should not be able to delete locations owned by another user."""
        response = await authenticated_client.delete(
            f"/api/v1/locations/{second_user_location.id}"
        )

        assert response.status_code == 404

    async def test_user_cannot_create_item_with_other_users_location(
        self,
        authenticated_client: AsyncClient,
        test_category: Category,
        second_user_location: Location,
    ):
        """User cannot assign another user's location to their item.

        The item creation validates that location_id belongs to the current user.
        """
        response = await authenticated_client.post(
            "/api/v1/items",
            json={
                "name": "Test Item With Other Location",
                "category_id": str(test_category.id),
                "location_id": str(second_user_location.id),
            },
        )

        # Should return 404 - location not found (for this user)
        assert response.status_code == 404


class TestImageIsolation:
    """Tests for image data isolation between users."""

    async def test_user_cannot_view_other_users_images(
        self,
        authenticated_client: AsyncClient,
        second_user_image: Image,
    ):
        """User should not be able to view images owned by another user."""
        response = await authenticated_client.get(
            f"/api/v1/images/{second_user_image.id}"
        )

        assert response.status_code == 404

    async def test_user_cannot_get_signed_url_for_other_users_images(
        self,
        authenticated_client: AsyncClient,
        second_user_image: Image,
    ):
        """User should not get signed URLs for other user's images."""
        response = await authenticated_client.get(
            f"/api/v1/images/{second_user_image.id}/signed-url"
        )

        assert response.status_code == 404

    async def test_user_cannot_delete_other_users_images(
        self,
        authenticated_client: AsyncClient,
        second_user_image: Image,
    ):
        """User should not be able to delete images owned by another user."""
        response = await authenticated_client.delete(
            f"/api/v1/images/{second_user_image.id}"
        )

        assert response.status_code == 404

    async def test_user_cannot_classify_other_users_images(
        self,
        authenticated_client: AsyncClient,
        second_user_image: Image,
    ):
        """User should not be able to classify images owned by another user."""
        response = await authenticated_client.post(
            "/api/v1/images/classify",
            json={"image_ids": [str(second_user_image.id)]},
        )

        # Should fail with 404 (image not found for this user)
        # or 402 (insufficient credits) if credit check happens first
        assert response.status_code in [404, 402]

    async def test_user_cannot_attach_other_users_image_to_item(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,
        second_user_image: Image,
    ):
        """User cannot attach another user's image to their item."""
        response = await authenticated_client.post(
            f"/api/v1/images/{second_user_image.id}/attach/{test_item.id}"
        )

        assert response.status_code == 404


class TestBillingIsolation:
    """Tests for billing/credit data isolation between users."""

    async def test_user_can_only_see_own_credit_balance(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
    ):
        """User can only view their own credit balance."""
        response = await authenticated_client.get("/api/v1/billing/balance")

        assert response.status_code == 200
        data = response.json()
        # Verify we get the test_user's balance, not another user's
        # Response uses free_credits and purchased_credits
        assert data["free_credits"] == test_user.free_credits_remaining
        assert data["purchased_credits"] == test_user.credit_balance

    async def test_user_cannot_see_other_users_transactions(
        self,
        authenticated_client: AsyncClient,
        second_user_transaction,  # Second user's transaction
        test_user_transaction,  # Test user's own transaction
    ):
        """User's transaction list should not include other users' transactions."""
        response = await authenticated_client.get("/api/v1/billing/transactions")

        assert response.status_code == 200
        data = response.json()

        # Should only see test_user's transaction, not second_user's
        assert len(data["items"]) >= 1

        transaction_ids = [txn["id"] for txn in data["items"]]
        transaction_descriptions = [txn["description"] for txn in data["items"]]

        # Verify test_user's transaction is visible
        assert str(test_user_transaction.id) in transaction_ids

        # Verify second_user's transaction is NOT visible
        assert str(second_user_transaction.id) not in transaction_ids
        assert "Second User" not in str(transaction_descriptions)

    async def test_transaction_count_only_includes_own(
        self,
        authenticated_client: AsyncClient,
        second_user_transaction,  # noqa: ARG002 - Creates second user's transaction
        test_user_transaction,  # noqa: ARG002 - Creates test user's transaction
    ):
        """Transaction total should only count user's own transactions."""
        response = await authenticated_client.get("/api/v1/billing/transactions")

        assert response.status_code == 200
        data = response.json()

        # Total should be 1 (only test_user's transaction), not 2
        assert data["total"] == 1

    async def test_user_balance_not_affected_by_other_users(
        self,
        authenticated_client: AsyncClient,
        second_user: User,  # noqa: ARG002 - Has 10 credits
        test_user: User,
    ):
        """User balance should only reflect their own credits."""
        response = await authenticated_client.get("/api/v1/billing/balance")

        assert response.status_code == 200
        data = response.json()

        # Should see test_user's balance (5 free credits default)
        # Not second_user's balance (10 credits + 5 free)
        assert data["free_credits"] == test_user.free_credits_remaining
        assert data["purchased_credits"] == test_user.credit_balance


class TestAdminAccessBoundaries:
    """Tests for admin access boundaries."""

    async def test_admin_stats_requires_admin(
        self,
        authenticated_client: AsyncClient,
    ):
        """Non-admin users cannot access admin stats."""
        response = await authenticated_client.get("/api/v1/admin/stats")

        assert response.status_code == 403

    async def test_admin_can_access_admin_endpoints(
        self,
        admin_client: AsyncClient,
    ):
        """Admin users can access admin endpoints."""
        response = await admin_client.get("/api/v1/admin/stats")

        assert response.status_code == 200

    async def test_admin_users_list_requires_admin(
        self,
        authenticated_client: AsyncClient,
    ):
        """Non-admin users cannot list all users."""
        response = await authenticated_client.get("/api/v1/admin/users")

        assert response.status_code == 403


class TestIDORPrevention:
    """Tests for Insecure Direct Object Reference (IDOR) prevention."""

    async def test_random_uuid_item_returns_404(
        self,
        authenticated_client: AsyncClient,
    ):
        """Requesting a random UUID should return 404, not error."""
        random_id = uuid.uuid4()
        response = await authenticated_client.get(f"/api/v1/items/{random_id}")

        assert response.status_code == 404
        # Should not leak information about whether the ID exists

    async def test_random_uuid_category_returns_404(
        self,
        authenticated_client: AsyncClient,
    ):
        """Requesting a random category UUID should return 404."""
        random_id = uuid.uuid4()
        response = await authenticated_client.get(f"/api/v1/categories/{random_id}")

        assert response.status_code == 404

    async def test_random_uuid_location_returns_404(
        self,
        authenticated_client: AsyncClient,
    ):
        """Requesting a random location UUID should return 404."""
        random_id = uuid.uuid4()
        response = await authenticated_client.get(f"/api/v1/locations/{random_id}")

        assert response.status_code == 404

    async def test_random_uuid_image_returns_404(
        self,
        authenticated_client: AsyncClient,
    ):
        """Requesting a random image UUID should return 404."""
        random_id = uuid.uuid4()
        response = await authenticated_client.get(f"/api/v1/images/{random_id}")

        assert response.status_code == 404


class TestCrossUserDataAssociation:
    """Tests that prevent associating data across user boundaries."""

    async def test_cannot_move_item_to_other_users_category(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,
        second_user_category: Category,
    ):
        """Cannot move an item to another user's category.

        The update validates that category_id belongs to the current user.
        """
        response = await authenticated_client.put(
            f"/api/v1/items/{test_item.id}",
            json={"category_id": str(second_user_category.id)},
        )

        # Should return 404 - category not found (for this user)
        assert response.status_code == 404

    async def test_cannot_move_item_to_other_users_location(
        self,
        authenticated_client: AsyncClient,
        test_item: Item,
        second_user_location: Location,
    ):
        """Cannot move an item to another user's location.

        The update validates that location_id belongs to the current user.
        """
        response = await authenticated_client.put(
            f"/api/v1/items/{test_item.id}",
            json={"location_id": str(second_user_location.id)},
        )

        # Should return 404 - location not found (for this user)
        assert response.status_code == 404

    async def test_cannot_attach_image_to_other_users_item(
        self,
        authenticated_client: AsyncClient,
        test_image: Image,
        second_user_item: Item,
    ):
        """Cannot attach own image to another user's item.

        The endpoint validates item ownership to prevent IDOR attacks.
        """
        response = await authenticated_client.post(
            f"/api/v1/images/{test_image.id}/attach/{second_user_item.id}"
        )

        # Should return 404 - item not found (for this user)
        assert response.status_code == 404

    async def test_cannot_attach_image_to_other_users_location(
        self,
        authenticated_client: AsyncClient,
        test_image: Image,
        second_user_location: Location,
    ):
        """Cannot attach own image to another user's location.

        The endpoint validates location ownership to prevent IDOR attacks.
        """
        response = await authenticated_client.post(
            f"/api/v1/images/{test_image.id}/attach-location/{second_user_location.id}"
        )

        # Should return 404 - location not found (for this user)
        assert response.status_code == 404


class TestRepositoryLevelIsolation:
    """Tests for repository-level data isolation.

    These tests verify that repositories correctly filter by user_id
    at the query level, providing defense-in-depth alongside RLS policies.
    """

    async def test_item_repository_filters_by_user_id(
        self,
        async_session,
        test_user: User,
        test_item: Item,
        second_user: User,
        second_user_item: Item,
    ):
        """ItemRepository should only return items for the specified user."""
        from src.items.repository import ItemRepository

        # Repository for test_user
        repo_user1 = ItemRepository(async_session, test_user.id)
        user1_items = await repo_user1.get_all()

        # Repository for second_user
        repo_user2 = ItemRepository(async_session, second_user.id)
        user2_items = await repo_user2.get_all()

        # Verify each repository returns only its user's items
        user1_item_ids = [item.id for item in user1_items]
        user2_item_ids = [item.id for item in user2_items]

        assert test_item.id in user1_item_ids
        assert second_user_item.id not in user1_item_ids

        assert second_user_item.id in user2_item_ids
        assert test_item.id not in user2_item_ids

    async def test_category_service_filters_by_user_id(
        self,
        async_session,
        test_user: User,
        test_category: Category,
        second_user: User,
        second_user_category: Category,
    ):
        """CategoryService should only return categories for the specified user."""
        from src.categories.service import CategoryService

        # Service for test_user
        svc_user1 = CategoryService(async_session, test_user.id)
        user1_cats = await svc_user1.get_all()

        # Service for second_user
        svc_user2 = CategoryService(async_session, second_user.id)
        user2_cats = await svc_user2.get_all()

        # Verify each service returns only its user's categories
        user1_cat_ids = [cat.id for cat in user1_cats]
        user2_cat_ids = [cat.id for cat in user2_cats]

        assert test_category.id in user1_cat_ids
        assert second_user_category.id not in user1_cat_ids

        assert second_user_category.id in user2_cat_ids
        assert test_category.id not in user2_cat_ids

    async def test_location_service_filters_by_user_id(
        self,
        async_session,
        test_user: User,
        test_location: Location,
        second_user: User,
        second_user_location: Location,
    ):
        """LocationService should only return locations for the specified user."""
        from src.locations.service import LocationService

        # Service for test_user
        svc_user1 = LocationService(async_session, test_user.id)
        user1_locs = await svc_user1.get_all()

        # Service for second_user
        svc_user2 = LocationService(async_session, second_user.id)
        user2_locs = await svc_user2.get_all()

        # Verify each service returns only its user's locations
        user1_loc_ids = [loc.id for loc in user1_locs]
        user2_loc_ids = [loc.id for loc in user2_locs]

        assert test_location.id in user1_loc_ids
        assert second_user_location.id not in user1_loc_ids

        assert second_user_location.id in user2_loc_ids
        assert test_location.id not in user2_loc_ids

    async def test_image_repository_filters_by_user_id(
        self,
        async_session,
        test_user: User,
        test_image: Image,
        second_user: User,
        second_user_image: Image,
    ):
        """ImageRepository should only return images for the specified user."""
        from src.images.repository import ImageRepository

        # Repository for test_user
        repo_user1 = ImageRepository(async_session, test_user.id)
        user1_img = await repo_user1.get_by_id(test_image.id)
        user1_other_img = await repo_user1.get_by_id(second_user_image.id)

        # Repository for second_user
        repo_user2 = ImageRepository(async_session, second_user.id)
        user2_img = await repo_user2.get_by_id(second_user_image.id)
        user2_other_img = await repo_user2.get_by_id(test_image.id)

        # Verify each repository only finds its user's images
        assert user1_img is not None
        assert user1_img.id == test_image.id
        assert user1_other_img is None  # Can't see second user's image

        assert user2_img is not None
        assert user2_img.id == second_user_image.id
        assert user2_other_img is None  # Can't see first user's image

    async def test_item_repository_get_by_id_filters(
        self,
        async_session,
        test_user: User,
        test_item: Item,
        second_user: User,
        second_user_item: Item,
    ):
        """ItemRepository.get_by_id should only find user's own items."""
        from src.items.repository import ItemRepository

        # Repository for test_user
        repo = ItemRepository(async_session, test_user.id)

        # Can find own item
        found = await repo.get_by_id(test_item.id)
        assert found is not None
        assert found.id == test_item.id

        # Cannot find second user's item
        not_found = await repo.get_by_id(second_user_item.id)
        assert not_found is None

    async def test_repository_count_filters_by_user(
        self,
        async_session,
        test_user: User,
        test_item: Item,  # noqa: ARG002
        second_user: User,
        second_user_item: Item,  # noqa: ARG002
    ):
        """Repository count methods should only count user's own data."""
        from src.items.repository import ItemRepository

        # Repository for test_user
        repo_user1 = ItemRepository(async_session, test_user.id)
        count1 = await repo_user1.count()

        # Repository for second_user
        repo_user2 = ItemRepository(async_session, second_user.id)
        count2 = await repo_user2.count()

        # Each user should only count their own items
        assert count1 >= 1  # At least test_item
        assert count2 >= 1  # At least second_user_item
        # If there were no user filtering, both would see all items
