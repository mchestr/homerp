"""HTTP integration tests for admin pricing endpoints."""

import uuid

from httpx import AsyncClient

from src.billing.models import CreditPricing


class TestListPricingEndpoint:
    """Tests for GET /api/v1/admin/pricing."""

    async def test_list_pricing_as_admin(
        self, admin_client: AsyncClient, credit_pricing_list: list[CreditPricing]
    ):
        """Test listing pricing configurations as admin."""
        response = await admin_client.get("/api/v1/admin/pricing")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == len(credit_pricing_list)

        # Verify all expected fields are present
        for item in data:
            assert "id" in item
            assert "operation_type" in item
            assert "credits_per_operation" in item
            assert "display_name" in item
            assert "description" in item
            assert "is_active" in item
            assert "created_at" in item
            assert "updated_at" in item

    async def test_list_pricing_empty(self, admin_client: AsyncClient):
        """Test listing pricing when no configurations exist."""
        response = await admin_client.get("/api/v1/admin/pricing")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    async def test_list_pricing_as_non_admin(self, authenticated_client: AsyncClient):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/admin/pricing")

        assert response.status_code == 403

    async def test_list_pricing_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/admin/pricing")

        assert response.status_code == 401


class TestGetPricingEndpoint:
    """Tests for GET /api/v1/admin/pricing/{pricing_id}."""

    async def test_get_pricing_as_admin(
        self, admin_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test getting a pricing configuration as admin."""
        response = await admin_client.get(f"/api/v1/admin/pricing/{credit_pricing.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(credit_pricing.id)
        assert data["operation_type"] == credit_pricing.operation_type
        assert data["credits_per_operation"] == credit_pricing.credits_per_operation
        assert data["display_name"] == credit_pricing.display_name
        assert data["is_active"] == credit_pricing.is_active

    async def test_get_pricing_not_found(self, admin_client: AsyncClient):
        """Test getting non-existent pricing configuration."""
        response = await admin_client.get(f"/api/v1/admin/pricing/{uuid.uuid4()}")

        assert response.status_code == 404

    async def test_get_pricing_as_non_admin(
        self, authenticated_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get(
            f"/api/v1/admin/pricing/{credit_pricing.id}"
        )

        assert response.status_code == 403

    async def test_get_pricing_unauthenticated(
        self, unauthenticated_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get(
            f"/api/v1/admin/pricing/{credit_pricing.id}"
        )

        assert response.status_code == 401


class TestUpdatePricingEndpoint:
    """Tests for PUT /api/v1/admin/pricing/{pricing_id}."""

    async def test_update_pricing_credits_as_admin(
        self, admin_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test updating credits per operation as admin."""
        response = await admin_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={"credits_per_operation": 5},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["credits_per_operation"] == 5
        # Other fields should remain unchanged
        assert data["display_name"] == credit_pricing.display_name
        assert data["is_active"] == credit_pricing.is_active

    async def test_update_pricing_display_name_as_admin(
        self, admin_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test updating display name as admin."""
        response = await admin_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={"display_name": "Updated Display Name"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["display_name"] == "Updated Display Name"

    async def test_update_pricing_description_as_admin(
        self, admin_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test updating description as admin."""
        response = await admin_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={"description": "Updated description for the operation"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Updated description for the operation"

    async def test_update_pricing_is_active_as_admin(
        self, admin_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test updating is_active status as admin."""
        response = await admin_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={"is_active": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    async def test_update_pricing_multiple_fields_as_admin(
        self, admin_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test updating multiple fields at once as admin."""
        response = await admin_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={
                "credits_per_operation": 3,
                "display_name": "New Name",
                "description": "New description",
                "is_active": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["credits_per_operation"] == 3
        assert data["display_name"] == "New Name"
        assert data["description"] == "New description"
        assert data["is_active"] is False

    async def test_update_pricing_not_found(self, admin_client: AsyncClient):
        """Test updating non-existent pricing configuration."""
        response = await admin_client.put(
            f"/api/v1/admin/pricing/{uuid.uuid4()}",
            json={"credits_per_operation": 5},
        )

        assert response.status_code == 404

    async def test_update_pricing_as_non_admin(
        self, authenticated_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={"credits_per_operation": 5},
        )

        assert response.status_code == 403

    async def test_update_pricing_unauthenticated(
        self, unauthenticated_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={"credits_per_operation": 5},
        )

        assert response.status_code == 401

    async def test_update_pricing_invalid_credits(
        self, admin_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test that invalid credits value returns 422."""
        response = await admin_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={"credits_per_operation": 0},
        )

        assert response.status_code == 422

    async def test_update_pricing_negative_credits(
        self, admin_client: AsyncClient, credit_pricing: CreditPricing
    ):
        """Test that negative credits value returns 422."""
        response = await admin_client.put(
            f"/api/v1/admin/pricing/{credit_pricing.id}",
            json={"credits_per_operation": -1},
        )

        assert response.status_code == 422
