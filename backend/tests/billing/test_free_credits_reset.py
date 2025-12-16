"""Tests for free credit reset logic - anniversary-based reset system."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditTransaction
from src.billing.service import CreditService
from src.config import Settings
from src.users.models import User


class TestFreeCreditsReset:
    """Tests for the anniversary-based free credit reset system."""

    async def test_reset_initializes_for_new_user(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        new_user_without_reset_date: User,
    ):
        """Test that reset date is initialized for new users without one."""
        service = CreditService(async_session, test_settings)

        # Get balance triggers the reset check
        await service.get_balance(new_user_without_reset_date.id)

        await async_session.refresh(new_user_without_reset_date)

        # Reset date should be set to created_at + 30 days
        expected_reset = new_user_without_reset_date.created_at + timedelta(days=30)
        assert new_user_without_reset_date.free_credits_reset_at is not None
        # Allow 1 second tolerance for datetime comparison
        assert (
            abs(
                (
                    new_user_without_reset_date.free_credits_reset_at - expected_reset
                ).total_seconds()
            )
            < 1
        )

        # Free credits should be initialized
        assert (
            new_user_without_reset_date.free_credits_remaining
            == test_settings.free_monthly_credits
        )

    async def test_reset_occurs_when_date_passed(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_expired_free_credits: User,
    ):
        """Test that free credits reset when the reset date has passed."""
        service = CreditService(async_session, test_settings)

        # Verify initial state - reset date is in the past
        assert user_with_expired_free_credits.free_credits_reset_at is not None
        assert user_with_expired_free_credits.free_credits_reset_at < datetime.now(UTC)
        assert user_with_expired_free_credits.free_credits_remaining == 0

        # Get balance triggers the reset
        await service.get_balance(user_with_expired_free_credits.id)

        await async_session.refresh(user_with_expired_free_credits)

        # Free credits should be reset to the configured amount
        assert (
            user_with_expired_free_credits.free_credits_remaining
            == test_settings.free_monthly_credits
        )

        # New reset date should be ~30 days in the future
        assert user_with_expired_free_credits.free_credits_reset_at > datetime.now(UTC)
        days_until_reset = (
            user_with_expired_free_credits.free_credits_reset_at - datetime.now(UTC)
        ).days
        assert 29 <= days_until_reset <= 30

    async def test_reset_creates_transaction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_expired_free_credits: User,
    ):
        """Test that resetting credits creates a transaction record."""
        service = CreditService(async_session, test_settings)

        # Trigger reset
        await service.get_balance(user_with_expired_free_credits.id)

        # Check for free_monthly transaction
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_with_expired_free_credits.id,
                CreditTransaction.transaction_type == "free_monthly",
            )
        )
        transaction = result.scalar_one_or_none()

        assert transaction is not None
        assert transaction.amount == test_settings.free_monthly_credits
        assert transaction.description == "Monthly free credits reset"

    async def test_no_reset_when_date_not_passed(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that credits are not reset if reset date hasn't passed."""
        service = CreditService(async_session, test_settings)

        # Set user to have used some credits but reset date in future
        test_user.free_credits_remaining = 2
        test_user.free_credits_reset_at = datetime.now(UTC) + timedelta(days=15)
        await async_session.commit()

        # Get balance
        balance = await service.get_balance(test_user.id)

        await async_session.refresh(test_user)

        # Credits should NOT be reset
        assert test_user.free_credits_remaining == 2
        assert balance.free_credits == 2

    async def test_reset_during_deduct_credit(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_expired_free_credits: User,
    ):
        """Test that reset is triggered during deduct_credit as well."""
        service = CreditService(async_session, test_settings)

        # User has expired reset date and 0 free credits, but has purchased credits
        initial_purchased = user_with_expired_free_credits.credit_balance
        assert initial_purchased > 0

        # Deduct credit - this should trigger reset first
        transaction = await service.deduct_credit(
            user_with_expired_free_credits.id, "Test deduction"
        )

        assert transaction is not None  # Transaction created on success
        await async_session.refresh(user_with_expired_free_credits)

        # After reset (5 credits) and deduction (1 credit), should have 4 free credits
        assert (
            user_with_expired_free_credits.free_credits_remaining
            == test_settings.free_monthly_credits - 1
        )
        # Purchased credits should be unchanged (free credits used first)
        assert user_with_expired_free_credits.credit_balance == initial_purchased

    async def test_reset_respects_configured_amount(
        self,
        async_session: AsyncSession,
        user_with_expired_free_credits: User,
    ):
        """Test that reset uses the configured free_monthly_credits value."""
        # Create settings with custom free credits amount
        custom_settings = Settings(
            database_url="sqlite+aiosqlite:///:memory:",
            free_monthly_credits=10,  # Custom value
            stripe_secret_key="sk_test",
            stripe_publishable_key="pk_test",
            stripe_webhook_secret="whsec_test",
        )

        service = CreditService(async_session, custom_settings)

        # Trigger reset
        await service.get_balance(user_with_expired_free_credits.id)

        await async_session.refresh(user_with_expired_free_credits)

        # Should have custom amount
        assert user_with_expired_free_credits.free_credits_remaining == 10

    async def test_multiple_resets_only_happens_once(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_expired_free_credits: User,
    ):
        """Test that calling get_balance multiple times only resets once."""
        service = CreditService(async_session, test_settings)

        # Call get_balance multiple times
        await service.get_balance(user_with_expired_free_credits.id)
        await service.get_balance(user_with_expired_free_credits.id)
        await service.get_balance(user_with_expired_free_credits.id)

        # Check that only one reset transaction was created
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_with_expired_free_credits.id,
                CreditTransaction.transaction_type == "free_monthly",
            )
        )
        transactions = result.scalars().all()

        assert len(transactions) == 1

    async def test_balance_returned_after_reset(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_expired_free_credits: User,
    ):
        """Test that get_balance returns updated values after reset."""
        service = CreditService(async_session, test_settings)

        balance = await service.get_balance(user_with_expired_free_credits.id)

        # Balance should reflect the reset
        assert balance.free_credits == test_settings.free_monthly_credits
        assert balance.total_credits == (
            user_with_expired_free_credits.credit_balance
            + test_settings.free_monthly_credits
        )
        # Next reset should be in the future
        assert balance.next_free_reset_at is not None
        assert balance.next_free_reset_at > datetime.now(UTC)


class TestFreeCreditsEdgeCases:
    """Edge case tests for free credit reset."""

    async def test_reset_with_timezone_aware_datetime(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test reset handles timezone-aware datetimes correctly."""
        # Create user with timezone-aware created_at (if database returns such)
        user = User(
            id=uuid.uuid4(),
            email="tzaware@example.com",
            name="TZ Aware User",
            oauth_provider="google",
            oauth_id="google_tz_123",
            credit_balance=0,
            free_credits_remaining=0,
            free_credits_reset_at=None,
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)

        service = CreditService(async_session, test_settings)

        # Should not raise any errors
        balance = await service.get_balance(user.id)

        assert balance.free_credits == test_settings.free_monthly_credits

    async def test_reset_exactly_at_reset_time(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test reset behavior when current time equals reset time."""
        user = User(
            id=uuid.uuid4(),
            email="exact@example.com",
            name="Exact Time User",
            oauth_provider="google",
            oauth_id="google_exact_123",
            credit_balance=0,
            free_credits_remaining=0,
            # Set reset time to now (should trigger reset)
            free_credits_reset_at=datetime.now(UTC),
        )
        async_session.add(user)
        await async_session.commit()

        service = CreditService(async_session, test_settings)
        balance = await service.get_balance(user.id)

        # Should have reset (>= comparison in service)
        assert balance.free_credits == test_settings.free_monthly_credits

    async def test_purchased_credits_unaffected_by_reset(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_expired_free_credits: User,
    ):
        """Test that purchased credits are not modified during reset."""
        service = CreditService(async_session, test_settings)

        initial_purchased = user_with_expired_free_credits.credit_balance

        # Trigger reset
        await service.get_balance(user_with_expired_free_credits.id)

        await async_session.refresh(user_with_expired_free_credits)

        # Purchased credits should be unchanged
        assert user_with_expired_free_credits.credit_balance == initial_purchased
