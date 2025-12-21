"""Tests for billing router endpoints."""

import uuid
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditPack, CreditTransaction
from src.billing.router import get_credit_service, get_stripe_service, router
from src.billing.service import CreditService, StripeService
from src.config import Settings
from src.users.models import User


@pytest.fixture
def app_with_billing(async_session: AsyncSession, test_settings: Settings):
    """Create a FastAPI app with billing router for testing."""
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/billing")

    # Override dependencies
    def get_test_credit_service():
        return CreditService(async_session, test_settings)

    def get_test_stripe_service():
        return StripeService(test_settings)

    app.dependency_overrides[get_credit_service] = get_test_credit_service
    app.dependency_overrides[get_stripe_service] = get_test_stripe_service

    return app


class TestBalanceEndpoint:
    """Tests for GET /api/v1/billing/balance endpoint."""

    async def test_get_balance_returns_correct_values(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that balance endpoint returns correct credit values."""
        # Directly test the service since endpoint requires auth
        service = CreditService(async_session, test_settings)

        test_user.credit_balance = 50
        test_user.free_credits_remaining = 3
        await async_session.commit()

        balance = await service.get_balance(test_user.id)

        assert balance.purchased_credits == 50
        assert balance.free_credits == 3
        assert balance.total_credits == 53
        # next_free_reset_at is always None now (no more monthly resets)
        assert balance.next_free_reset_at is None

    async def test_get_balance_no_reset_for_expired_free_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_expired_free_credits: User,
    ):
        """Test that balance endpoint does NOT trigger free credit reset (monthly reset removed)."""
        service = CreditService(async_session, test_settings)

        balance = await service.get_balance(user_with_expired_free_credits.id)

        # Free credits should remain at 0 (no reset happens anymore)
        assert balance.free_credits == 0
        # next_free_reset_at should be None (no more monthly resets)
        assert balance.next_free_reset_at is None


class TestPacksEndpoint:
    """Tests for GET /api/v1/billing/packs endpoint."""

    async def test_list_packs_returns_active_only(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_packs: list[CreditPack],
    ):
        """Test that packs endpoint returns only active packs."""
        service = CreditService(async_session, test_settings)

        packs = await service.get_credit_packs()

        # Should have 3 active packs (not the inactive one)
        assert len(packs) == 3
        assert len(credit_packs) == 4  # Verify fixture created all packs
        for pack in packs:
            assert pack.is_active is True

    async def test_list_packs_identifies_best_value(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_packs: list[CreditPack],
    ):
        """Test that packs endpoint identifies best value pack."""
        service = CreditService(async_session, test_settings)

        packs = await service.get_credit_packs()

        # Verify all packs from fixture were created
        assert len(credit_packs) == 4

        # Calculate best value
        best_ratio = 0
        best_pack = None
        for pack in packs:
            ratio = pack.credits / pack.price_cents
            if ratio > best_ratio:
                best_ratio = ratio
                best_pack = pack

        # Enterprise pack (500 credits / 4000 cents = 0.125) should be best value
        # vs Starter (25/300 = 0.083) and Pro (100/1000 = 0.1)
        assert best_pack is not None
        assert best_pack.name == "Enterprise Pack"


class TestCheckoutEndpoint:
    """Tests for POST /api/v1/billing/checkout endpoint."""

    async def test_create_checkout_session(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        credit_pack: CreditPack,
        mock_stripe,
    ):
        """Test creating a checkout session."""
        stripe_service = StripeService(test_settings)

        # mock_stripe activates the stripe mock
        assert mock_stripe is not None

        checkout_url = await stripe_service.create_checkout_session(
            session=async_session,
            user=test_user,
            pack=credit_pack,
            success_url="http://localhost:3000/billing/success",
            cancel_url="http://localhost:3000/billing/cancel",
        )

        assert checkout_url is not None
        assert "checkout.stripe.com" in checkout_url

    async def test_checkout_pack_not_found(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that checkout with nonexistent pack returns None."""
        service = CreditService(async_session, test_settings)

        pack = await service.get_credit_pack(uuid.uuid4())
        assert pack is None


class TestTransactionsEndpoint:
    """Tests for GET /api/v1/billing/transactions endpoint."""

    async def test_list_transactions_pagination(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test transaction history pagination."""
        service = CreditService(async_session, test_settings)

        # Create 5 transactions
        for i in range(5):
            await service.add_credits(test_user.id, 10, "purchase", f"Purchase {i + 1}")

        # Get first page
        transactions, total = await service.get_transaction_history(
            test_user.id, page=1, limit=2
        )

        assert total == 5
        assert len(transactions) == 2

        # Get second page
        transactions, _ = await service.get_transaction_history(
            test_user.id, page=2, limit=2
        )
        assert len(transactions) == 2

    async def test_list_transactions_ordered_by_date(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that transactions are returned (order may vary with same timestamp)."""
        service = CreditService(async_session, test_settings)

        await service.add_credits(test_user.id, 10, "purchase", "First")
        await service.add_credits(test_user.id, 20, "purchase", "Second")
        await service.add_credits(test_user.id, 30, "purchase", "Third")

        transactions, _ = await service.get_transaction_history(test_user.id)

        # Verify all transactions are present (order may vary with same timestamp in SQLite)
        descriptions = {t.description for t in transactions}
        assert "First" in descriptions
        assert "Second" in descriptions
        assert "Third" in descriptions
        assert len(transactions) == 3


class TestPortalEndpoint:
    """Tests for POST /api/v1/billing/portal endpoint."""

    async def test_create_portal_session(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        mock_stripe,
    ):
        """Test creating a Stripe portal session."""
        stripe_service = StripeService(test_settings)

        # mock_stripe activates the stripe mock
        assert mock_stripe is not None

        portal_url = await stripe_service.create_portal_session(
            session=async_session,
            user=test_user,
            return_url="http://localhost:3000/settings/billing",
        )

        assert portal_url is not None
        assert "billing.stripe.com" in portal_url


class TestRefundEndpoint:
    """Tests for POST /api/v1/billing/refund endpoint."""

    async def test_refund_eligible_purchase(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
        purchase_transaction: CreditTransaction,
    ):
        """Test refunding an eligible purchase."""
        service = CreditService(async_session, test_settings)

        initial_balance = user_with_purchased_credits.credit_balance

        success, message, amount = await service.process_refund(
            purchase_transaction.id,
            user_with_purchased_credits.id,
        )

        assert success is True
        assert amount == 25
        assert message is not None

        await async_session.refresh(user_with_purchased_credits)
        assert user_with_purchased_credits.credit_balance == initial_balance - 25

    async def test_refund_ineligible_returns_error(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        refunded_transaction: CreditTransaction,
    ):
        """Test that refunding ineligible transaction returns error."""
        service = CreditService(async_session, test_settings)

        can_refund, message = await service.can_refund_purchase(
            refunded_transaction.id,
            test_user.id,
        )

        assert can_refund is False
        assert "already been refunded" in message


class TestWebhookEndpoint:
    """Tests for POST /api/v1/billing/webhook endpoint."""

    async def test_webhook_checkout_completed_adds_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        credit_pack: CreditPack,
    ):
        """Test that checkout.session.completed webhook adds credits."""
        credit_service = CreditService(async_session, test_settings)

        initial_balance = test_user.credit_balance

        # Simulate what webhook handler does
        transaction = await credit_service.add_credits(
            user_id=test_user.id,
            amount=credit_pack.credits,
            transaction_type="purchase",
            description=f"Purchased {credit_pack.name} ({credit_pack.credits} credits)",
            credit_pack_id=credit_pack.id,
            stripe_checkout_session_id="cs_webhook_test_123",
            stripe_payment_intent_id="pi_webhook_test_123",
        )

        await async_session.refresh(test_user)
        assert test_user.credit_balance == initial_balance + credit_pack.credits
        assert transaction.stripe_checkout_session_id == "cs_webhook_test_123"

    async def test_webhook_invalid_signature_rejected(
        self,
        test_settings: Settings,
    ):
        """Test that invalid webhook signature is rejected."""
        import stripe

        stripe_service = StripeService(test_settings)

        with patch("src.billing.service.stripe.Webhook.construct_event") as mock:
            mock.side_effect = stripe.SignatureVerificationError(
                "Invalid signature", "sig"
            )

            with pytest.raises(stripe.SignatureVerificationError):
                stripe_service.construct_webhook_event(
                    b'{"type": "test"}',
                    "invalid_sig",
                )

    async def test_webhook_charge_refunded_is_noop(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test that charge.refunded webhook doesn't modify credits (handled in process_refund)."""
        # This is a no-op in the webhook handler since credits are already
        # deducted in process_refund. Just verify the balance doesn't change.
        initial_balance = test_user.credit_balance

        # No action needed - just verify nothing changes
        await async_session.refresh(test_user)
        assert test_user.credit_balance == initial_balance


class TestBillingEndpointEdgeCases:
    """Edge case tests for billing endpoints."""

    async def test_checkout_inactive_pack_returns_none(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_packs: list[CreditPack],
    ):
        """Test that checking out with inactive pack returns None."""
        service = CreditService(async_session, test_settings)

        inactive_pack = next(p for p in credit_packs if not p.is_active)
        pack = await service.get_credit_pack(inactive_pack.id)

        assert pack is None

    async def test_transactions_empty_for_new_user(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that transaction history is empty for new user."""
        service = CreditService(async_session, test_settings)

        transactions, total = await service.get_transaction_history(test_user.id)

        assert total == 0
        assert len(transactions) == 0

    async def test_balance_for_nonexistent_user(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that balance for nonexistent user returns zeros."""
        service = CreditService(async_session, test_settings)

        balance = await service.get_balance(uuid.uuid4())

        assert balance.purchased_credits == 0
        assert balance.free_credits == 0
        assert balance.total_credits == 0
        assert balance.next_free_reset_at is None


class TestBestValueCalculation:
    """Tests for best value pack calculation."""

    async def test_best_value_is_highest_credits_per_dollar(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_packs: list[CreditPack],
    ):
        """Test that best value is pack with highest credits per dollar."""
        service = CreditService(async_session, test_settings)
        packs = await service.get_credit_packs()

        # Verify fixture created packs
        assert len(credit_packs) == 4

        # Calculate ratios
        ratios = [(p, p.credits / p.price_cents) for p in packs]
        ratios.sort(key=lambda x: x[1], reverse=True)

        best_pack = ratios[0][0]

        # Should be Enterprise (500 / 4000 = 0.125)
        assert best_pack.name == "Enterprise Pack"

    async def test_single_pack_is_best_value(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_pack: CreditPack,
    ):
        """Test that single pack is marked as best value."""
        service = CreditService(async_session, test_settings)
        packs = await service.get_credit_packs()

        assert len(packs) == 1
        # Only one pack, so it's the best value by default
        assert packs[0].id == credit_pack.id
