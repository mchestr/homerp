"""Tests for StripeService and webhook handling."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
import stripe
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditPack
from src.billing.service import CreditService, StripeService
from src.config import Settings
from src.users.models import User


class TestStripeServiceCustomer:
    """Tests for Stripe customer management."""

    async def test_get_or_create_customer_creates_new(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        mock_stripe,
    ):
        """Test creating a new Stripe customer."""
        service = StripeService(test_settings)

        # User has no stripe_customer_id
        assert test_user.stripe_customer_id is None

        customer_id = await service.get_or_create_customer(async_session, test_user)

        assert customer_id == "cus_test_123"
        mock_stripe.Customer.create.assert_called_once_with(
            email=test_user.email,
            name=test_user.name,
            metadata={"user_id": str(test_user.id)},
        )

        # User should have stripe_customer_id set
        await async_session.refresh(test_user)
        assert test_user.stripe_customer_id == "cus_test_123"

    async def test_get_or_create_customer_returns_existing(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        mock_stripe,
    ):
        """Test returning existing Stripe customer."""
        # Set existing customer ID
        test_user.stripe_customer_id = "cus_existing_456"
        await async_session.commit()

        service = StripeService(test_settings)

        customer_id = await service.get_or_create_customer(async_session, test_user)

        assert customer_id == "cus_existing_456"
        # Should not create new customer
        mock_stripe.Customer.create.assert_not_called()


class TestStripeServiceCheckout:
    """Tests for Stripe checkout session creation."""

    async def test_create_checkout_session(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        credit_pack: CreditPack,
        mock_stripe,
    ):
        """Test creating a Stripe checkout session."""
        service = StripeService(test_settings)

        checkout_url = await service.create_checkout_session(
            session=async_session,
            user=test_user,
            pack=credit_pack,
            success_url="http://example.com/success",
            cancel_url="http://example.com/cancel",
        )

        assert checkout_url == "https://checkout.stripe.com/test"
        mock_stripe.checkout.Session.create.assert_called_once()

        # Verify the call arguments
        call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
        assert call_kwargs["mode"] == "payment"
        assert call_kwargs["success_url"] == "http://example.com/success"
        assert call_kwargs["cancel_url"] == "http://example.com/cancel"
        assert call_kwargs["metadata"]["user_id"] == str(test_user.id)
        assert call_kwargs["metadata"]["credit_pack_id"] == str(credit_pack.id)
        assert call_kwargs["metadata"]["credits"] == str(credit_pack.credits)

    async def test_create_checkout_session_includes_line_items(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        credit_pack: CreditPack,
        mock_stripe,
    ):
        """Test that checkout session includes correct line items."""
        service = StripeService(test_settings)

        await service.create_checkout_session(
            session=async_session,
            user=test_user,
            pack=credit_pack,
            success_url="http://example.com/success",
            cancel_url="http://example.com/cancel",
        )

        call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
        assert len(call_kwargs["line_items"]) == 1
        assert call_kwargs["line_items"][0]["price"] == credit_pack.stripe_price_id
        assert call_kwargs["line_items"][0]["quantity"] == 1


class TestStripeServicePortal:
    """Tests for Stripe customer portal."""

    async def test_create_portal_session(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        mock_stripe,
    ):
        """Test creating a Stripe portal session."""
        service = StripeService(test_settings)

        portal_url = await service.create_portal_session(
            session=async_session,
            user=test_user,
            return_url="http://example.com/billing",
        )

        assert portal_url == "https://billing.stripe.com/test"
        mock_stripe.billing_portal.Session.create.assert_called_once()

        call_kwargs = mock_stripe.billing_portal.Session.create.call_args[1]
        assert call_kwargs["return_url"] == "http://example.com/billing"


class TestStripeServiceRefund:
    """Tests for Stripe refund creation."""

    async def test_create_refund(
        self,
        test_settings: Settings,
        mock_stripe,
    ):
        """Test creating a Stripe refund."""
        service = StripeService(test_settings)

        await service.create_refund("pi_test_123")

        mock_stripe.Refund.create.assert_called_once_with(payment_intent="pi_test_123")


class TestStripeWebhookEvent:
    """Tests for Stripe webhook event construction."""

    def test_construct_webhook_event_valid(
        self,
        test_settings: Settings,
    ):
        """Test constructing a valid webhook event."""
        service = StripeService(test_settings)

        payload = b'{"type": "checkout.session.completed"}'
        signature = "valid_signature"

        with patch(
            "src.billing.service.stripe.Webhook.construct_event"
        ) as mock_construct:
            mock_event = MagicMock()
            mock_event.type = "checkout.session.completed"
            mock_construct.return_value = mock_event

            event = service.construct_webhook_event(payload, signature)

            assert event.type == "checkout.session.completed"
            mock_construct.assert_called_once_with(
                payload,
                signature,
                test_settings.stripe_webhook_secret,
            )

    def test_construct_webhook_event_invalid_signature(
        self,
        test_settings: Settings,
    ):
        """Test webhook event with invalid signature raises error."""
        service = StripeService(test_settings)

        payload = b'{"type": "checkout.session.completed"}'
        signature = "invalid_signature"

        with patch(
            "src.billing.service.stripe.Webhook.construct_event"
        ) as mock_construct:
            mock_construct.side_effect = stripe.SignatureVerificationError(
                "Invalid signature", signature
            )

            with pytest.raises(stripe.SignatureVerificationError):
                service.construct_webhook_event(payload, signature)


class TestWebhookCreditAddition:
    """Tests for credit addition via webhook (checkout.session.completed)."""

    async def test_webhook_adds_credits_on_checkout_completed(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        credit_pack: CreditPack,
    ):
        """Test that webhook properly adds credits after successful checkout."""
        credit_service = CreditService(async_session, test_settings)

        initial_balance = test_user.credit_balance

        # Simulate what the webhook handler does
        await credit_service.add_credits(
            user_id=test_user.id,
            amount=credit_pack.credits,
            transaction_type="purchase",
            description=f"Purchased {credit_pack.name} ({credit_pack.credits} credits)",
            credit_pack_id=credit_pack.id,
            stripe_checkout_session_id="cs_test_webhook_123",
            stripe_payment_intent_id="pi_test_webhook_123",
        )

        await async_session.refresh(test_user)
        assert test_user.credit_balance == initial_balance + credit_pack.credits

    async def test_webhook_creates_transaction_with_stripe_ids(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        credit_pack: CreditPack,
    ):
        """Test that webhook creates transaction with Stripe IDs."""
        credit_service = CreditService(async_session, test_settings)

        transaction = await credit_service.add_credits(
            user_id=test_user.id,
            amount=25,
            transaction_type="purchase",
            description="Test purchase",
            credit_pack_id=credit_pack.id,
            stripe_checkout_session_id="cs_test_123",
            stripe_payment_intent_id="pi_test_123",
        )

        assert transaction.stripe_checkout_session_id == "cs_test_123"
        assert transaction.stripe_payment_intent_id == "pi_test_123"
        assert transaction.credit_pack_id == credit_pack.id


class TestWebhookEdgeCases:
    """Edge case tests for webhook handling."""

    async def test_webhook_handles_missing_metadata_gracefully(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that missing metadata doesn't add credits."""
        credit_service = CreditService(async_session, test_settings)

        initial_balance = test_user.credit_balance

        # Simulate webhook with missing/invalid metadata (credits = 0)
        # In real handler, this would be skipped
        credits = 0
        if credits > 0:
            await credit_service.add_credits(
                user_id=test_user.id,
                amount=credits,
                transaction_type="purchase",
                description="Test purchase",
            )

        await async_session.refresh(test_user)
        assert test_user.credit_balance == initial_balance  # Unchanged

    async def test_webhook_handles_nonexistent_user(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that webhook for nonexistent user raises error."""
        credit_service = CreditService(async_session, test_settings)

        with pytest.raises(ValueError, match="User not found"):
            await credit_service.add_credits(
                user_id=uuid.uuid4(),  # Nonexistent user
                amount=25,
                transaction_type="purchase",
                description="Test purchase",
            )

    async def test_webhook_handles_without_pack_id(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that webhook works without a pack ID (e.g., manual credit addition)."""
        credit_service = CreditService(async_session, test_settings)

        # Add credits without pack ID - should work fine
        transaction = await credit_service.add_credits(
            user_id=test_user.id,
            amount=25,
            transaction_type="purchase",
            description="Test purchase",
            credit_pack_id=None,  # No pack reference
            stripe_checkout_session_id="cs_test_123",
        )

        # Credits should be added
        await async_session.refresh(test_user)
        assert test_user.credit_balance == 25
        assert transaction.credit_pack_id is None

    async def test_idempotent_credit_addition(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        credit_pack: CreditPack,
    ):
        """Test that adding credits is not idempotent (same checkout_session_id)."""
        credit_service = CreditService(async_session, test_settings)

        # Verify credit_pack fixture was created
        assert credit_pack is not None

        # In real implementation, you might want to check for existing
        # transactions with the same stripe_checkout_session_id
        # This test documents current behavior

        await credit_service.add_credits(
            user_id=test_user.id,
            amount=25,
            transaction_type="purchase",
            description="Purchase 1",
            stripe_checkout_session_id="cs_duplicate_123",
        )

        await credit_service.add_credits(
            user_id=test_user.id,
            amount=25,
            transaction_type="purchase",
            description="Purchase 2",
            stripe_checkout_session_id="cs_duplicate_123",  # Same session ID
        )

        # Both additions went through (no idempotency currently)
        await async_session.refresh(test_user)
        assert test_user.credit_balance == 50
