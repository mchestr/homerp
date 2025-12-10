"""Tests for refund eligibility and processing logic."""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditPack, CreditTransaction
from src.billing.service import CreditService
from src.config import Settings
from src.users.models import User


class TestCanRefundPurchase:
    """Tests for CreditService.can_refund_purchase()."""

    async def test_can_refund_valid_purchase(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
        purchase_transaction: CreditTransaction,
    ):
        """Test that a valid purchase can be refunded."""
        service = CreditService(async_session, test_settings)

        can_refund, message = await service.can_refund_purchase(
            purchase_transaction.id,
            user_with_purchased_credits.id,
        )

        assert can_refund is True
        assert message == "Refund eligible"

    async def test_cannot_refund_nonexistent_transaction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that nonexistent transaction cannot be refunded."""
        service = CreditService(async_session, test_settings)

        can_refund, message = await service.can_refund_purchase(
            uuid.uuid4(),
            test_user.id,
        )

        assert can_refund is False
        assert message == "Transaction not found"

    async def test_cannot_refund_wrong_user(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        purchase_transaction: CreditTransaction,
    ):
        """Test that a user cannot refund another user's purchase."""
        service = CreditService(async_session, test_settings)

        # test_user trying to refund purchase_transaction which belongs to user_with_purchased_credits
        can_refund, message = await service.can_refund_purchase(
            purchase_transaction.id,
            test_user.id,  # Wrong user
        )

        assert can_refund is False
        assert message == "Transaction not found"

    async def test_cannot_refund_non_purchase_transaction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that non-purchase transactions cannot be refunded."""
        # Create a usage transaction
        usage_transaction = CreditTransaction(
            id=uuid.uuid4(),
            user_id=test_user.id,
            amount=-1,
            transaction_type="usage",
            description="AI classification",
        )
        async_session.add(usage_transaction)
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        can_refund, message = await service.can_refund_purchase(
            usage_transaction.id,
            test_user.id,
        )

        assert can_refund is False
        assert message == "Only purchases can be refunded"

    async def test_cannot_refund_already_refunded(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        refunded_transaction: CreditTransaction,
    ):
        """Test that already refunded transactions cannot be refunded again."""
        service = CreditService(async_session, test_settings)

        can_refund, message = await service.can_refund_purchase(
            refunded_transaction.id,
            test_user.id,
        )

        assert can_refund is False
        assert message == "Transaction has already been refunded"

    async def test_cannot_refund_if_credits_used(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_pack: CreditPack,
    ):
        """Test that purchase cannot be refunded if credits have been used."""
        # Create a user with less credits than the purchase amount
        user = User(
            id=uuid.uuid4(),
            email="lowbalance@example.com",
            name="Low Balance User",
            oauth_provider="google",
            oauth_id="google_low_123",
            credit_balance=10,  # Less than 25 from purchase
            free_credits_remaining=0,
            free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        )
        async_session.add(user)
        await async_session.commit()

        # Create purchase transaction for 25 credits
        transaction = CreditTransaction(
            id=uuid.uuid4(),
            user_id=user.id,
            amount=25,
            transaction_type="purchase",
            description="Purchased Starter Pack (25 credits)",
            credit_pack_id=credit_pack.id,
            stripe_payment_intent_id="pi_test_used",
        )
        async_session.add(transaction)
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        can_refund, message = await service.can_refund_purchase(
            transaction.id,
            user.id,
        )

        assert can_refund is False
        assert message == "Purchased credits have been used and cannot be refunded"


class TestProcessRefund:
    """Tests for CreditService.process_refund()."""

    async def test_process_refund_success(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
        purchase_transaction: CreditTransaction,
    ):
        """Test successful refund processing."""
        service = CreditService(async_session, test_settings)

        initial_balance = user_with_purchased_credits.credit_balance

        success, message, refunded_amount = await service.process_refund(
            purchase_transaction.id,
            user_with_purchased_credits.id,
        )

        assert success is True
        assert message == "Refund processed successfully"
        assert refunded_amount == 25  # From purchase_transaction fixture

        # Check user balance was deducted
        await async_session.refresh(user_with_purchased_credits)
        assert user_with_purchased_credits.credit_balance == initial_balance - 25

    async def test_process_refund_marks_transaction_refunded(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
        purchase_transaction: CreditTransaction,
    ):
        """Test that refund marks original transaction as refunded."""
        service = CreditService(async_session, test_settings)

        await service.process_refund(
            purchase_transaction.id,
            user_with_purchased_credits.id,
        )

        # Check transaction is marked as refunded
        await async_session.refresh(purchase_transaction)
        assert purchase_transaction.is_refunded is True

    async def test_process_refund_creates_refund_transaction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
        purchase_transaction: CreditTransaction,
    ):
        """Test that refund creates a refund transaction record."""
        service = CreditService(async_session, test_settings)

        await service.process_refund(
            purchase_transaction.id,
            user_with_purchased_credits.id,
        )

        # Check refund transaction was created
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_with_purchased_credits.id,
                CreditTransaction.transaction_type == "refund",
            )
        )
        refund_transaction = result.scalar_one_or_none()

        assert refund_transaction is not None
        assert refund_transaction.amount == -25  # Negative for refund
        assert "Refund for" in refund_transaction.description
        assert refund_transaction.credit_pack_id == purchase_transaction.credit_pack_id

    async def test_process_refund_fails_for_ineligible(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        refunded_transaction: CreditTransaction,
    ):
        """Test that refund fails for ineligible transactions."""
        service = CreditService(async_session, test_settings)

        success, message, refunded_amount = await service.process_refund(
            refunded_transaction.id,
            test_user.id,
        )

        assert success is False
        assert message == "Transaction has already been refunded"
        assert refunded_amount == 0

    async def test_process_refund_nonexistent_transaction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test refund of nonexistent transaction."""
        service = CreditService(async_session, test_settings)

        success, message, refunded_amount = await service.process_refund(
            uuid.uuid4(),
            test_user.id,
        )

        assert success is False
        assert message == "Transaction not found"
        assert refunded_amount == 0


class TestRefundEdgeCases:
    """Edge case tests for refund logic."""

    async def test_refund_full_balance(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_pack: CreditPack,
    ):
        """Test refunding when user has exactly the purchase amount."""
        # Create user with exactly 25 credits
        user = User(
            id=uuid.uuid4(),
            email="exact@example.com",
            name="Exact Balance User",
            oauth_provider="google",
            oauth_id="google_exact_456",
            credit_balance=25,
            free_credits_remaining=0,
            free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        )
        async_session.add(user)
        await async_session.commit()

        # Create purchase transaction
        transaction = CreditTransaction(
            id=uuid.uuid4(),
            user_id=user.id,
            amount=25,
            transaction_type="purchase",
            description="Purchased Starter Pack (25 credits)",
            credit_pack_id=credit_pack.id,
            stripe_payment_intent_id="pi_test_exact",
        )
        async_session.add(transaction)
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        success, message, refunded_amount = await service.process_refund(
            transaction.id,
            user.id,
        )

        assert success is True
        await async_session.refresh(user)
        assert user.credit_balance == 0

    async def test_multiple_purchases_refund_one(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_pack: CreditPack,
    ):
        """Test refunding one of multiple purchases."""
        # Create user with multiple purchases
        user = User(
            id=uuid.uuid4(),
            email="multipurchase@example.com",
            name="Multi Purchase User",
            oauth_provider="google",
            oauth_id="google_multi_789",
            credit_balance=75,  # 3 x 25 credits
            free_credits_remaining=0,
            free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        )
        async_session.add(user)
        await async_session.commit()

        # Create 3 purchase transactions
        transactions = []
        for i in range(3):
            t = CreditTransaction(
                id=uuid.uuid4(),
                user_id=user.id,
                amount=25,
                transaction_type="purchase",
                description=f"Purchase {i + 1}",
                credit_pack_id=credit_pack.id,
                stripe_payment_intent_id=f"pi_test_multi_{i}",
            )
            async_session.add(t)
            transactions.append(t)
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # Refund one purchase
        success, message, refunded_amount = await service.process_refund(
            transactions[0].id,
            user.id,
        )

        assert success is True
        await async_session.refresh(user)
        assert user.credit_balance == 50  # 75 - 25

        # Other transactions should still be refundable
        can_refund, _ = await service.can_refund_purchase(transactions[1].id, user.id)
        assert can_refund is True

    async def test_refund_preserves_free_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_pack: CreditPack,
    ):
        """Test that refund only affects purchased credits, not free credits."""
        # Create user with both free and purchased credits
        user = User(
            id=uuid.uuid4(),
            email="mixed@example.com",
            name="Mixed Credits User",
            oauth_provider="google",
            oauth_id="google_mixed_123",
            credit_balance=25,
            free_credits_remaining=5,
            free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        )
        async_session.add(user)
        await async_session.commit()

        transaction = CreditTransaction(
            id=uuid.uuid4(),
            user_id=user.id,
            amount=25,
            transaction_type="purchase",
            description="Purchase",
            credit_pack_id=credit_pack.id,
            stripe_payment_intent_id="pi_test_mixed",
        )
        async_session.add(transaction)
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        success, _, _ = await service.process_refund(transaction.id, user.id)

        assert success is True
        await async_session.refresh(user)
        assert user.credit_balance == 0
        assert user.free_credits_remaining == 5  # Unchanged

    async def test_cannot_refund_same_transaction_twice(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
        purchase_transaction: CreditTransaction,
    ):
        """Test that the same transaction cannot be refunded twice."""
        service = CreditService(async_session, test_settings)

        # First refund
        success1, _, _ = await service.process_refund(
            purchase_transaction.id,
            user_with_purchased_credits.id,
        )
        assert success1 is True

        # Second refund attempt
        success2, message, amount = await service.process_refund(
            purchase_transaction.id,
            user_with_purchased_credits.id,
        )
        assert success2 is False
        assert message == "Transaction has already been refunded"
        assert amount == 0
