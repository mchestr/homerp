"""HTTP integration tests for billing router."""

import uuid

from httpx import AsyncClient

from src.billing.models import CreditPack
from src.users.models import User


class TestGetBalanceEndpoint:
    """Tests for GET /api/v1/billing/balance."""

    async def test_get_balance(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test getting credit balance."""
        response = await authenticated_client.get("/api/v1/billing/balance")

        assert response.status_code == 200
        data = response.json()
        assert "purchased_credits" in data
        assert "free_credits" in data
        assert "total_credits" in data

    async def test_get_balance_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/billing/balance")

        assert response.status_code == 401


class TestListPacksEndpoint:
    """Tests for GET /api/v1/billing/packs."""

    async def test_list_packs(
        self, authenticated_client: AsyncClient, credit_pack: CreditPack
    ):
        """Test listing available credit packs."""
        response = await authenticated_client.get("/api/v1/billing/packs")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_packs_includes_best_value(
        self, authenticated_client: AsyncClient, credit_packs: list[CreditPack]
    ):
        """Test that packs include best_value indicator."""
        response = await authenticated_client.get("/api/v1/billing/packs")

        assert response.status_code == 200
        data = response.json()
        # At least one should be marked as best value
        best_values = [p for p in data if p.get("is_best_value")]
        assert len(best_values) <= 1


class TestCreateCheckoutEndpoint:
    """Tests for POST /api/v1/billing/checkout."""

    async def test_create_checkout_pack_not_found(
        self, authenticated_client: AsyncClient
    ):
        """Test checkout with non-existent pack."""
        response = await authenticated_client.post(
            "/api/v1/billing/checkout", json={"pack_id": str(uuid.uuid4())}
        )

        assert response.status_code == 404

    async def test_create_checkout_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/billing/checkout", json={"pack_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401


class TestListTransactionsEndpoint:
    """Tests for GET /api/v1/billing/transactions."""

    async def test_list_transactions(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test listing transaction history."""
        response = await authenticated_client.get("/api/v1/billing/transactions")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data

    async def test_list_transactions_pagination(
        self, authenticated_client: AsyncClient
    ):
        """Test transaction history pagination."""
        response = await authenticated_client.get(
            "/api/v1/billing/transactions", params={"page": 1, "limit": 10}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10

    async def test_list_transactions_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/billing/transactions")

        assert response.status_code == 401


class TestCreatePortalEndpoint:
    """Tests for POST /api/v1/billing/portal."""

    async def test_create_portal_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post("/api/v1/billing/portal")

        assert response.status_code == 401


class TestRequestRefundEndpoint:
    """Tests for POST /api/v1/billing/refund."""

    async def test_refund_nonexistent_transaction(
        self, authenticated_client: AsyncClient
    ):
        """Test refund with non-existent transaction."""
        response = await authenticated_client.post(
            "/api/v1/billing/refund", json={"transaction_id": str(uuid.uuid4())}
        )

        assert response.status_code == 400

    async def test_refund_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/billing/refund", json={"transaction_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401


class TestWebhookEndpoint:
    """Tests for POST /api/v1/billing/webhook."""

    async def test_webhook_missing_signature(
        self, unauthenticated_client: AsyncClient
    ):
        """Test webhook without signature header."""
        response = await unauthenticated_client.post(
            "/api/v1/billing/webhook", content="{}"
        )

        assert response.status_code == 422  # Missing required header

    async def test_webhook_invalid_signature(
        self, unauthenticated_client: AsyncClient
    ):
        """Test webhook with invalid signature."""
        response = await unauthenticated_client.post(
            "/api/v1/billing/webhook",
            content="{}",
            headers={"Stripe-Signature": "invalid"},
        )

        assert response.status_code == 400
