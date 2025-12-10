"""Tests for AI classification credit consumption - the main credit-consuming feature."""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditTransaction
from src.billing.service import CreditService
from src.config import Settings
from src.users.models import User


class TestAIClassificationCredits:
    """Tests for credit check before AI classification."""

    async def test_classification_allowed_with_free_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that classification is allowed when user has free credits."""
        test_user.free_credits_remaining = 5
        test_user.credit_balance = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        has_credits = await service.has_credits(test_user.id)
        assert has_credits is True

    async def test_classification_allowed_with_purchased_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
    ):
        """Test that classification is allowed when user has purchased credits."""
        user_with_purchased_credits.free_credits_remaining = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        has_credits = await service.has_credits(user_with_purchased_credits.id)
        assert has_credits is True

    async def test_classification_denied_without_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_no_credits: User,
    ):
        """Test that classification is denied when user has no credits."""
        service = CreditService(async_session, test_settings)

        has_credits = await service.has_credits(user_with_no_credits.id)
        assert has_credits is False

    async def test_admin_bypass_classification_check(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        admin_user: User,
    ):
        """Test that admin users bypass credit check for classification."""
        admin_user.free_credits_remaining = 0
        admin_user.credit_balance = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        has_credits = await service.has_credits(admin_user.id)
        assert has_credits is True


class TestAIClassificationDeduction:
    """Tests for credit deduction after AI classification."""

    async def test_deduction_after_successful_classification(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that one credit is deducted after successful classification."""
        test_user.free_credits_remaining = 5
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # Simulate successful classification
        success = await service.deduct_credit(
            test_user.id,
            "AI classification: test_image.jpg",
        )

        assert success is True
        await async_session.refresh(test_user)
        assert test_user.free_credits_remaining == 4

    async def test_deduction_creates_usage_transaction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that deduction creates a transaction with correct description."""
        service = CreditService(async_session, test_settings)

        await service.deduct_credit(
            test_user.id,
            "AI classification: my_cool_image.png",
        )

        # Check transaction
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == test_user.id,
                CreditTransaction.transaction_type == "usage",
            )
        )
        transaction = result.scalar_one()

        assert transaction.amount == -1
        assert "AI classification: my_cool_image.png" in transaction.description

    async def test_admin_no_deduction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        admin_user: User,
    ):
        """Test that admin users don't have credits deducted."""
        admin_user.free_credits_remaining = 5
        admin_user.credit_balance = 10
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # Perform "classification" multiple times
        for i in range(10):
            success = await service.deduct_credit(
                admin_user.id,
                f"AI classification: image_{i}.jpg",
            )
            assert success is True

        await async_session.refresh(admin_user)
        # Credits should be unchanged
        assert admin_user.free_credits_remaining == 5
        assert admin_user.credit_balance == 10


class TestClassificationCreditFlow:
    """Integration-style tests for the full classification credit flow."""

    async def test_full_classification_flow_with_free_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test complete flow: check credits -> classify -> deduct."""
        test_user.free_credits_remaining = 3
        test_user.credit_balance = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # Step 1: Check credits (what /classify endpoint does first)
        has_credits = await service.has_credits(test_user.id)
        assert has_credits is True

        # Step 2: AI classification happens (simulated)
        # ... OpenAI API call ...

        # Step 3: Deduct credit on success
        success = await service.deduct_credit(
            test_user.id,
            "AI classification: widget.jpg",
        )
        assert success is True

        # Verify final state
        await async_session.refresh(test_user)
        assert test_user.free_credits_remaining == 2
        assert test_user.credit_balance == 0

    async def test_full_classification_flow_exhausts_free_uses_purchased(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that after exhausting free credits, purchased are used."""
        test_user.free_credits_remaining = 1
        test_user.credit_balance = 5
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # First classification uses last free credit
        await service.deduct_credit(test_user.id, "Classification 1")
        await async_session.refresh(test_user)
        assert test_user.free_credits_remaining == 0
        assert test_user.credit_balance == 5

        # Second classification uses purchased credit
        await service.deduct_credit(test_user.id, "Classification 2")
        await async_session.refresh(test_user)
        assert test_user.free_credits_remaining == 0
        assert test_user.credit_balance == 4

    async def test_classification_fails_at_zero_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_no_credits: User,
    ):
        """Test that classification fails when user has no credits."""
        service = CreditService(async_session, test_settings)

        # Check should fail
        has_credits = await service.has_credits(user_with_no_credits.id)
        assert has_credits is False

        # Deduction should also fail
        success = await service.deduct_credit(
            user_with_no_credits.id,
            "Should not work",
        )
        assert success is False

    async def test_concurrent_classifications_deduct_correctly(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that multiple sequential classifications deduct correctly."""
        test_user.free_credits_remaining = 5
        test_user.credit_balance = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # Perform 5 classifications
        for i in range(5):
            success = await service.deduct_credit(
                test_user.id,
                f"Classification {i + 1}",
            )
            assert success is True

        await async_session.refresh(test_user)
        assert test_user.free_credits_remaining == 0

        # 6th classification should fail
        success = await service.deduct_credit(test_user.id, "Classification 6")
        assert success is False


class TestClassificationCreditEdgeCases:
    """Edge case tests for classification credit handling."""

    async def test_free_credits_reset_before_classification(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_expired_free_credits: User,
    ):
        """Test that expired free credits are reset before classification check."""
        service = CreditService(async_session, test_settings)

        # User has expired reset date and 0 free credits
        assert user_with_expired_free_credits.free_credits_remaining == 0
        assert user_with_expired_free_credits.free_credits_reset_at < datetime.utcnow()

        # has_credits should trigger reset
        has_credits = await service.has_credits(user_with_expired_free_credits.id)
        assert has_credits is True

        await async_session.refresh(user_with_expired_free_credits)
        assert (
            user_with_expired_free_credits.free_credits_remaining
            == test_settings.free_monthly_credits
        )

    async def test_classification_with_mixed_credit_types(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test classification using a mix of free and purchased credits."""
        user = User(
            id=uuid.uuid4(),
            email="mixed@example.com",
            name="Mixed User",
            oauth_provider="google",
            oauth_id="google_mixed_ai",
            credit_balance=3,
            free_credits_remaining=2,
            free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        )
        async_session.add(user)
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # Use 5 credits total: 2 free + 3 purchased
        for i in range(5):
            success = await service.deduct_credit(user.id, f"Classification {i + 1}")
            assert success is True

        await async_session.refresh(user)
        assert user.free_credits_remaining == 0
        assert user.credit_balance == 0

        # 6th should fail
        success = await service.deduct_credit(user.id, "Classification 6")
        assert success is False

    async def test_check_credits_exact_amount(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test has_credits with exact amount needed."""
        test_user.free_credits_remaining = 1
        test_user.credit_balance = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # Exactly 1 credit available, checking for 1
        assert await service.has_credits(test_user.id, amount=1) is True
        # Checking for 2 should fail
        assert await service.has_credits(test_user.id, amount=2) is False


class TestTransactionAuditTrail:
    """Tests for the transaction audit trail during AI classification."""

    async def test_classification_transaction_includes_image_info(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that classification transaction includes image filename."""
        service = CreditService(async_session, test_settings)

        filename = "my_item_photo_2024.jpg"
        await service.deduct_credit(
            test_user.id,
            f"AI classification: {filename}",
        )

        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == test_user.id,
            )
        )
        transaction = result.scalar_one()

        assert filename in transaction.description

    async def test_multiple_classifications_create_separate_transactions(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that each classification creates its own transaction."""
        service = CreditService(async_session, test_settings)

        filenames = ["image1.jpg", "image2.png", "image3.webp"]
        for filename in filenames:
            await service.deduct_credit(
                test_user.id,
                f"AI classification: {filename}",
            )

        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == test_user.id,
                CreditTransaction.transaction_type == "usage",
            )
        )
        transactions = result.scalars().all()

        assert len(transactions) == 3
        descriptions = [t.description for t in transactions]
        for filename in filenames:
            assert any(filename in desc for desc in descriptions)
