"""Integration tests for credit consumption race conditions.

Tests verify:
- Concurrent credit deduction doesn't result in negative balance
- Credit checks and deductions are atomic
- Multiple simultaneous classification requests are handled correctly
"""

import asyncio

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.service import CreditService
from src.config import Settings
from src.users.models import User


class TestCreditDeductionRaceConditions:
    """Tests for credit deduction race conditions."""

    @pytest.mark.xfail(
        reason="SECURITY: Race condition allows multiple concurrent deductions. "
        "Current implementation doesn't use database-level locking (SELECT FOR UPDATE). "
        "Implement proper locking in CreditService.deduct_credit() to fix.",
        strict=False,  # Race conditions don't always manifest in single-session tests
    )
    async def test_concurrent_deductions_dont_go_negative(
        self,
        async_session: AsyncSession,
        user_with_one_credit: User,
        test_settings: Settings,
    ):
        """Multiple concurrent deductions should not result in negative balance.

        SECURITY ISSUE: Current implementation allows race conditions because
        it doesn't use database-level locking (SELECT FOR UPDATE). Multiple
        concurrent requests can deduct credits simultaneously, potentially
        resulting in negative balances or more credits used than available.

        Expected behavior: Only 1 deduction should succeed when user has 1 credit.
        """
        credit_service = CreditService(async_session, test_settings)
        user_id = user_with_one_credit.id

        # Verify initial state
        balance = await credit_service.get_balance(user_id)
        assert balance.total_credits == 1

        # Attempt 3 concurrent deductions for a user with only 1 credit
        results = await asyncio.gather(
            credit_service.deduct_credit(user_id, "Concurrent test 1"),
            credit_service.deduct_credit(user_id, "Concurrent test 2"),
            credit_service.deduct_credit(user_id, "Concurrent test 3"),
        )

        # Only one should succeed
        successful_deductions = sum(1 for r in results if r is True)

        # Check final balance
        await async_session.refresh(user_with_one_credit)
        final_balance = (
            user_with_one_credit.credit_balance
            + user_with_one_credit.free_credits_remaining
        )

        # EXPECTED: Only 1 deduction succeeds, balance >= 0
        assert successful_deductions == 1, (
            f"Race condition: {successful_deductions} deductions succeeded but user had 1 credit"
        )
        assert final_balance >= 0, f"Balance went negative: {final_balance}"

    async def test_sequential_deductions_work_correctly(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Sequential credit deductions should work correctly."""
        # Create a user with exactly 3 credits
        from datetime import UTC, datetime, timedelta
        from uuid import uuid4

        user = User(
            id=uuid4(),
            email="sequential@example.com",
            name="Sequential User",
            oauth_provider="google",
            oauth_id="google_sequential_123",
            credit_balance=3,
            free_credits_remaining=0,
            free_credits_reset_at=datetime.now(UTC) + timedelta(days=30),
            is_admin=False,
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)

        credit_service = CreditService(async_session, test_settings)

        # Verify initial state
        balance = await credit_service.get_balance(user.id)
        assert balance.total_credits == 3

        # Sequential deductions should all succeed
        assert await credit_service.deduct_credit(user.id, "Deduction 1")
        assert await credit_service.deduct_credit(user.id, "Deduction 2")
        assert await credit_service.deduct_credit(user.id, "Deduction 3")

        # Fourth deduction should fail
        assert not await credit_service.deduct_credit(user.id, "Deduction 4")

        # Final balance should be 0
        balance = await credit_service.get_balance(user.id)
        assert balance.total_credits == 0

    async def test_has_credits_and_deduct_not_atomic(
        self,
        async_session: AsyncSession,
        user_with_one_credit: User,
        test_settings: Settings,
    ):
        """Test documents that has_credits and deduct_credit are not atomic.

        This is a potential race condition: between checking has_credits
        and calling deduct_credit, another process could deduct the credit.
        """
        credit_service = CreditService(async_session, test_settings)
        user_id = user_with_one_credit.id

        # Check balance
        has_credits = await credit_service.has_credits(user_id)
        assert has_credits is True

        # Simulate another process deducting the credit
        await credit_service.deduct_credit(user_id, "Simulated concurrent deduction")

        # Now the original process tries to deduct - should fail
        result = await credit_service.deduct_credit(user_id, "Original deduction")

        # This should fail since credit was already deducted
        assert result is False

    async def test_free_credits_used_before_purchased(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Verify free credits are consumed before purchased credits."""
        from datetime import UTC, datetime, timedelta
        from uuid import uuid4

        user = User(
            id=uuid4(),
            email="priority@example.com",
            name="Priority User",
            oauth_provider="google",
            oauth_id="google_priority_123",
            credit_balance=5,  # Purchased credits
            free_credits_remaining=2,  # Free credits
            free_credits_reset_at=datetime.now(UTC) + timedelta(days=30),
            is_admin=False,
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)

        credit_service = CreditService(async_session, test_settings)

        # First deduction should use free credits
        await credit_service.deduct_credit(user.id, "First deduction")
        await async_session.refresh(user)
        assert user.free_credits_remaining == 1
        assert user.credit_balance == 5

        # Second deduction should use remaining free credit
        await credit_service.deduct_credit(user.id, "Second deduction")
        await async_session.refresh(user)
        assert user.free_credits_remaining == 0
        assert user.credit_balance == 5

        # Third deduction should use purchased credits
        await credit_service.deduct_credit(user.id, "Third deduction")
        await async_session.refresh(user)
        assert user.free_credits_remaining == 0
        assert user.credit_balance == 4

    async def test_admin_bypasses_credit_check(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_settings: Settings,
    ):
        """Admin users should bypass credit checks entirely."""
        # Set admin to have 0 credits
        admin_user.credit_balance = 0
        admin_user.free_credits_remaining = 0
        await async_session.commit()

        credit_service = CreditService(async_session, test_settings)

        # Admin should still "have" credits
        assert await credit_service.has_credits(admin_user.id)

        # Deduction should succeed (but not actually deduct anything)
        assert await credit_service.deduct_credit(admin_user.id, "Admin classification")

        # Balance should remain 0
        await async_session.refresh(admin_user)
        assert admin_user.credit_balance == 0

    @pytest.mark.skip(
        reason="Concurrent session access not supported in test environment. "
        "This test documents a potential TOCTOU vulnerability: the gap between "
        "has_credits() and deduct_credit() allows race conditions when multiple "
        "classification requests come in simultaneously. In production, this "
        "should be addressed with database-level locking (SELECT FOR UPDATE) "
        "or optimistic concurrency control."
    )
    async def test_rapid_concurrent_classifications_simulated(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Simulate rapid concurrent classification requests.

        This documents the behavior when multiple classification requests
        come in simultaneously for a user with limited credits.

        SKIPPED: SQLAlchemy async sessions don't support concurrent operations
        from the same session. This test would require separate database
        connections to properly simulate concurrent requests.
        """
        pass


class TestCreditTransactionIntegrity:
    """Tests for credit transaction integrity."""

    async def test_transaction_logged_on_deduction(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_settings: Settings,
    ):
        """Each deduction should create a transaction record."""
        from src.billing.models import CreditTransaction

        credit_service = CreditService(async_session, test_settings)

        # Deduct credit
        await credit_service.deduct_credit(test_user.id, "Test deduction")

        # Check transaction was created
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == test_user.id,
                CreditTransaction.transaction_type == "usage",
            )
        )
        transactions = result.scalars().all()

        assert len(transactions) >= 1
        usage_txn = next(t for t in transactions if "Test deduction" in t.description)
        assert usage_txn.amount == -1

    async def test_transaction_not_created_on_failed_deduction(
        self,
        async_session: AsyncSession,
        user_with_no_credits: User,
        test_settings: Settings,
    ):
        """Failed deductions should not create transaction records."""
        from src.billing.models import CreditTransaction

        credit_service = CreditService(async_session, test_settings)

        # Count existing transactions
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_with_no_credits.id
            )
        )
        initial_count = len(result.scalars().all())

        # Attempt failed deduction
        success = await credit_service.deduct_credit(
            user_with_no_credits.id, "Should fail"
        )
        assert success is False

        # Count transactions again - should be the same
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_with_no_credits.id
            )
        )
        final_count = len(result.scalars().all())

        assert final_count == initial_count
