"""HTTP integration tests for admin router."""

import uuid

from httpx import AsyncClient

from src.billing.models import CreditPack
from src.users.models import User


class TestListPacksEndpoint:
    """Tests for GET /api/v1/admin/packs."""

    async def test_list_packs_as_admin(
        self, admin_client: AsyncClient, credit_pack: CreditPack
    ):
        """Test listing packs as admin."""
        response = await admin_client.get("/api/v1/admin/packs")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_packs_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/packs")

        assert response.status_code == 403

    async def test_list_packs_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/admin/packs")

        assert response.status_code == 401


class TestCreatePackEndpoint:
    """Tests for POST /api/v1/admin/packs."""

    async def test_create_pack_as_admin(self, admin_client: AsyncClient):
        """Test creating a credit pack as admin."""
        response = await admin_client.post(
            "/api/v1/admin/packs",
            json={
                "name": "Test Pack",
                "credits": 50,
                "price_cents": 500,
                "stripe_price_id": "price_test_new",
                "is_active": True,
                "sort_order": 10,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Pack"
        assert data["credits"] == 50

    async def test_create_pack_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.post(
            "/api/v1/admin/packs",
            json={
                "name": "Test",
                "credits": 10,
                "price_cents": 100,
                "stripe_price_id": "price_test",
            },
        )

        assert response.status_code == 403


class TestGetPackEndpoint:
    """Tests for GET /api/v1/admin/packs/{pack_id}."""

    async def test_get_pack_as_admin(
        self, admin_client: AsyncClient, credit_pack: CreditPack
    ):
        """Test getting a credit pack as admin."""
        response = await admin_client.get(f"/api/v1/admin/packs/{credit_pack.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(credit_pack.id)

    async def test_get_pack_not_found(self, admin_client: AsyncClient):
        """Test getting non-existent pack."""
        response = await admin_client.get(f"/api/v1/admin/packs/{uuid.uuid4()}")

        assert response.status_code == 404

    async def test_get_pack_as_non_admin(
        self, authenticated_client: AsyncClient, credit_pack: CreditPack
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get(
            f"/api/v1/admin/packs/{credit_pack.id}"
        )

        assert response.status_code == 403


class TestUpdatePackEndpoint:
    """Tests for PUT /api/v1/admin/packs/{pack_id}."""

    async def test_update_pack_as_admin(
        self, admin_client: AsyncClient, credit_pack: CreditPack
    ):
        """Test updating a credit pack as admin."""
        response = await admin_client.put(
            f"/api/v1/admin/packs/{credit_pack.id}",
            json={"name": "Updated Pack Name", "is_active": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Pack Name"
        assert data["is_active"] is False

    async def test_update_pack_not_found(self, admin_client: AsyncClient):
        """Test updating non-existent pack."""
        response = await admin_client.put(
            f"/api/v1/admin/packs/{uuid.uuid4()}", json={"name": "Test"}
        )

        assert response.status_code == 404


class TestDeletePackEndpoint:
    """Tests for DELETE /api/v1/admin/packs/{pack_id}."""

    async def test_delete_pack_as_admin(
        self, admin_client: AsyncClient, credit_pack: CreditPack
    ):
        """Test deleting (soft delete) a credit pack as admin."""
        response = await admin_client.delete(f"/api/v1/admin/packs/{credit_pack.id}")

        assert response.status_code == 204

    async def test_delete_pack_not_found(self, admin_client: AsyncClient):
        """Test deleting non-existent pack."""
        response = await admin_client.delete(f"/api/v1/admin/packs/{uuid.uuid4()}")

        assert response.status_code == 404


class TestListUsersEndpoint:
    """Tests for GET /api/v1/admin/users."""

    async def test_list_users_as_admin(
        self, admin_client: AsyncClient, test_user: User
    ):
        """Test listing users as admin."""
        response = await admin_client.get("/api/v1/admin/users")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_list_users_with_search(
        self, admin_client: AsyncClient, test_user: User
    ):
        """Test searching users."""
        response = await admin_client.get(
            "/api/v1/admin/users", params={"search": "test@example.com"}
        )

        assert response.status_code == 200

    async def test_list_users_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/users")

        assert response.status_code == 403


class TestGetUserEndpoint:
    """Tests for GET /api/v1/admin/users/{user_id}."""

    async def test_get_user_as_admin(self, admin_client: AsyncClient, test_user: User):
        """Test getting a user as admin."""
        response = await admin_client.get(f"/api/v1/admin/users/{test_user.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)

    async def test_get_user_not_found(self, admin_client: AsyncClient):
        """Test getting non-existent user."""
        response = await admin_client.get(f"/api/v1/admin/users/{uuid.uuid4()}")

        assert response.status_code == 404


class TestUpdateUserEndpoint:
    """Tests for PUT /api/v1/admin/users/{user_id}."""

    async def test_update_user_admin_status(
        self, admin_client: AsyncClient, test_user: User
    ):
        """Test updating user admin status."""
        response = await admin_client.put(
            f"/api/v1/admin/users/{test_user.id}", json={"is_admin": True}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_admin"] is True

    async def test_update_user_not_found(self, admin_client: AsyncClient):
        """Test updating non-existent user."""
        response = await admin_client.put(
            f"/api/v1/admin/users/{uuid.uuid4()}", json={"is_admin": True}
        )

        assert response.status_code == 404


class TestAdjustCreditsEndpoint:
    """Tests for POST /api/v1/admin/users/{user_id}/credits."""

    async def test_grant_credits_as_admin(
        self, admin_client: AsyncClient, test_user: User
    ):
        """Test granting credits as admin."""
        response = await admin_client.post(
            f"/api/v1/admin/users/{test_user.id}/credits",
            json={"amount": 10, "reason": "Test grant"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 10
        assert data["reason"] == "Test grant"

    async def test_grant_free_credits_as_admin(
        self, admin_client: AsyncClient, test_user: User
    ):
        """Test granting free credits as admin."""
        response = await admin_client.post(
            f"/api/v1/admin/users/{test_user.id}/credits",
            json={"amount": 0, "free_credits_amount": 5, "reason": "Test free grant"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["free_credits_amount"] == 5

    async def test_grant_zero_credits_fails(
        self, admin_client: AsyncClient, test_user: User
    ):
        """Test that granting zero credits fails."""
        response = await admin_client.post(
            f"/api/v1/admin/users/{test_user.id}/credits",
            json={"amount": 0, "reason": "Test"},
        )

        assert response.status_code == 400

    async def test_grant_credits_not_found(self, admin_client: AsyncClient):
        """Test granting credits to non-existent user."""
        response = await admin_client.post(
            f"/api/v1/admin/users/{uuid.uuid4()}/credits",
            json={"amount": 10, "reason": "Test"},
        )

        assert response.status_code == 404


class TestGetStatsEndpoint:
    """Tests for GET /api/v1/admin/stats."""

    async def test_get_stats_as_admin(self, admin_client: AsyncClient):
        """Test getting admin stats."""
        response = await admin_client.get("/api/v1/admin/stats")

        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_items" in data
        assert "total_revenue_cents" in data
        assert "recent_activity" in data

    async def test_get_stats_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/stats")

        assert response.status_code == 403
