"""Tests for CreditService - core credit management logic."""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditTransaction
from src.billing.service import CreditService
from src.config import Settings
from src.users.models import User


class TestGetBalance:
    """Tests for CreditService.get_balance()."""

    async def test_get_balance_returns_correct_totals(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that balance correctly sums free and purchased credits."""
        # Update user with specific values
        test_user.credit_balance = 50
        test_user.free_credits_remaining = 3
        await async_session.commit()

        service = CreditService(async_session, test_settings)
        balance = await service.get_balance(test_user.id)

        assert balance.purchased_credits == 50
        assert balance.free_credits == 3
        assert balance.total_credits == 53

    async def test_get_balance_nonexistent_user_returns_zeros(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that nonexistent user returns zero balance."""
        service = CreditService(async_session, test_settings)
        balance = await service.get_balance(uuid.uuid4())

        assert balance.purchased_credits == 0
        assert balance.free_credits == 0
        assert balance.total_credits == 0
        assert balance.next_free_reset_at is None

    async def test_get_balance_includes_reset_date(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that balance includes the next reset date."""
        service = CreditService(async_session, test_settings)
        balance = await service.get_balance(test_user.id)

        assert balance.next_free_reset_at is not None
        assert balance.next_free_reset_at == test_user.free_credits_reset_at


class TestHasCredits:
    """Tests for CreditService.has_credits()."""

    async def test_has_credits_with_free_credits_returns_true(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that user with free credits has credits."""
        test_user.free_credits_remaining = 5
        test_user.credit_balance = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)
        result = await service.has_credits(test_user.id)

        assert result is True

    async def test_has_credits_with_purchased_credits_returns_true(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
    ):
        """Test that user with purchased credits has credits."""
        service = CreditService(async_session, test_settings)
        result = await service.has_credits(user_with_purchased_credits.id)

        assert result is True

    async def test_has_credits_without_credits_returns_false(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_no_credits: User,
    ):
        """Test that user without credits returns False."""
        service = CreditService(async_session, test_settings)
        result = await service.has_credits(user_with_no_credits.id)

        assert result is False

    async def test_has_credits_checks_specific_amount(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that has_credits checks for specific amount."""
        test_user.free_credits_remaining = 3
        test_user.credit_balance = 2
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # User has 5 total credits
        assert await service.has_credits(test_user.id, amount=5) is True
        assert await service.has_credits(test_user.id, amount=6) is False

    async def test_has_credits_admin_always_returns_true(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        admin_user: User,
    ):
        """Test that admins always have credits regardless of balance."""
        # Set admin to zero credits
        admin_user.credit_balance = 0
        admin_user.free_credits_remaining = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)
        result = await service.has_credits(admin_user.id, amount=1000)

        assert result is True

    async def test_has_credits_nonexistent_user_returns_false(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that nonexistent user returns False."""
        service = CreditService(async_session, test_settings)
        result = await service.has_credits(uuid.uuid4())

        assert result is False


class TestDeductCredit:
    """Tests for CreditService.deduct_credit()."""

    async def test_deduct_credit_uses_free_credits_first(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that deduction uses free credits before purchased."""
        test_user.free_credits_remaining = 3
        test_user.credit_balance = 10
        await async_session.commit()

        service = CreditService(async_session, test_settings)
        result = await service.deduct_credit(test_user.id, "Test deduction")

        assert result is True
        await async_session.refresh(test_user)
        assert test_user.free_credits_remaining == 2  # Reduced by 1
        assert test_user.credit_balance == 10  # Unchanged

    async def test_deduct_credit_uses_purchased_when_no_free(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_purchased_credits: User,
    ):
        """Test that deduction uses purchased credits when no free credits."""
        user_with_purchased_credits.free_credits_remaining = 0
        initial_balance = user_with_purchased_credits.credit_balance
        await async_session.commit()

        service = CreditService(async_session, test_settings)
        result = await service.deduct_credit(
            user_with_purchased_credits.id, "Test deduction"
        )

        assert result is True
        await async_session.refresh(user_with_purchased_credits)
        assert user_with_purchased_credits.free_credits_remaining == 0
        assert user_with_purchased_credits.credit_balance == initial_balance - 1

    async def test_deduct_credit_fails_when_no_credits(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        user_with_no_credits: User,
    ):
        """Test that deduction fails when user has no credits."""
        service = CreditService(async_session, test_settings)
        result = await service.deduct_credit(user_with_no_credits.id, "Test deduction")

        assert result is False

    async def test_deduct_credit_creates_transaction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that deduction creates a transaction record."""
        service = CreditService(async_session, test_settings)
        await service.deduct_credit(test_user.id, "AI classification: test.jpg")

        # Check transaction was created
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == test_user.id,
                CreditTransaction.transaction_type == "usage",
            )
        )
        transaction = result.scalar_one_or_none()

        assert transaction is not None
        assert transaction.amount == -1
        assert transaction.description == "AI classification: test.jpg"

    async def test_deduct_credit_admin_bypasses_deduction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        admin_user: User,
    ):
        """Test that admins bypass credit deduction entirely."""
        admin_user.free_credits_remaining = 0
        admin_user.credit_balance = 0
        await async_session.commit()

        service = CreditService(async_session, test_settings)
        result = await service.deduct_credit(admin_user.id, "Test deduction")

        assert result is True
        await async_session.refresh(admin_user)
        # Balance should remain unchanged
        assert admin_user.free_credits_remaining == 0
        assert admin_user.credit_balance == 0

        # No transaction should be created for admin
        result = await async_session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == admin_user.id,
                CreditTransaction.transaction_type == "usage",
            )
        )
        assert result.scalar_one_or_none() is None

    async def test_deduct_credit_nonexistent_user_returns_false(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that deducting from nonexistent user returns False."""
        service = CreditService(async_session, test_settings)
        result = await service.deduct_credit(uuid.uuid4(), "Test deduction")

        assert result is False

    async def test_deduct_credit_multiple_times(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test multiple sequential deductions."""
        test_user.free_credits_remaining = 2
        test_user.credit_balance = 3
        await async_session.commit()

        service = CreditService(async_session, test_settings)

        # Deduct 5 times (should use 2 free + 3 purchased)
        for i in range(5):
            result = await service.deduct_credit(test_user.id, f"Deduction {i + 1}")
            assert result is True

        await async_session.refresh(test_user)
        assert test_user.free_credits_remaining == 0
        assert test_user.credit_balance == 0

        # 6th deduction should fail
        result = await service.deduct_credit(test_user.id, "Deduction 6")
        assert result is False


class TestAddCredits:
    """Tests for CreditService.add_credits()."""

    async def test_add_credits_increases_balance(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that adding credits increases the balance."""
        initial_balance = test_user.credit_balance

        service = CreditService(async_session, test_settings)
        transaction = await service.add_credits(
            user_id=test_user.id,
            amount=50,
            transaction_type="purchase",
            description="Test purchase",
        )

        await async_session.refresh(test_user)
        assert test_user.credit_balance == initial_balance + 50
        assert transaction.amount == 50
        assert transaction.transaction_type == "purchase"

    async def test_add_credits_creates_transaction(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
        credit_pack,
    ):
        """Test that adding credits creates a transaction record."""
        service = CreditService(async_session, test_settings)
        transaction = await service.add_credits(
            user_id=test_user.id,
            amount=25,
            transaction_type="purchase",
            description="Purchased Starter Pack",
            credit_pack_id=credit_pack.id,
            stripe_checkout_session_id="cs_test_123",
            stripe_payment_intent_id="pi_test_123",
        )

        assert transaction.credit_pack_id == credit_pack.id
        assert transaction.stripe_checkout_session_id == "cs_test_123"
        assert transaction.stripe_payment_intent_id == "pi_test_123"

    async def test_add_credits_nonexistent_user_raises(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that adding credits to nonexistent user raises ValueError."""
        service = CreditService(async_session, test_settings)

        with pytest.raises(ValueError, match="User not found"):
            await service.add_credits(
                user_id=uuid.uuid4(),
                amount=50,
                transaction_type="purchase",
                description="Test purchase",
            )


class TestGetTransactionHistory:
    """Tests for CreditService.get_transaction_history()."""

    async def test_get_transaction_history_returns_transactions(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test that transaction history returns all transactions."""
        service = CreditService(async_session, test_settings)

        # Create some transactions
        await service.add_credits(test_user.id, 10, "purchase", "Purchase 1")
        await service.deduct_credit(test_user.id, "Usage 1")
        await service.add_credits(test_user.id, 20, "purchase", "Purchase 2")

        transactions, total = await service.get_transaction_history(test_user.id)

        assert total == 3
        assert len(transactions) == 3
        # Verify all expected descriptions are present (order may vary due to same timestamp)
        descriptions = {t.description for t in transactions}
        assert "Purchase 1" in descriptions
        assert "Usage 1" in descriptions
        assert "Purchase 2" in descriptions

    async def test_get_transaction_history_pagination(
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
        page1, total = await service.get_transaction_history(
            test_user.id, page=1, limit=2
        )
        assert total == 5
        assert len(page1) == 2

        # Get second page
        page2, _ = await service.get_transaction_history(test_user.id, page=2, limit=2)
        assert len(page2) == 2

        # Get third page
        page3, _ = await service.get_transaction_history(test_user.id, page=3, limit=2)
        assert len(page3) == 1

    async def test_get_transaction_history_empty(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        test_user: User,
    ):
        """Test transaction history when empty."""
        service = CreditService(async_session, test_settings)
        transactions, total = await service.get_transaction_history(test_user.id)

        assert total == 0
        assert len(transactions) == 0


class TestGetCreditPacks:
    """Tests for CreditService.get_credit_packs()."""

    async def test_get_credit_packs_returns_active_only(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_packs: list,
    ):
        """Test that only active packs are returned."""
        service = CreditService(async_session, test_settings)
        packs = await service.get_credit_packs()

        # Verify fixture created all packs
        assert len(credit_packs) == 4

        # Should return 3 active packs (not the inactive one)
        assert len(packs) == 3
        for pack in packs:
            assert pack.is_active is True

    async def test_get_credit_packs_ordered_by_sort_order(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_packs: list,
    ):
        """Test that packs are ordered by sort_order."""
        service = CreditService(async_session, test_settings)
        packs = await service.get_credit_packs()

        # Verify fixture created packs
        assert len(credit_packs) == 4

        sort_orders = [pack.sort_order for pack in packs]
        assert sort_orders == sorted(sort_orders)

    async def test_get_credit_packs_empty_when_none_active(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that empty list is returned when no active packs."""
        service = CreditService(async_session, test_settings)
        packs = await service.get_credit_packs()

        assert len(packs) == 0


class TestGetCreditPack:
    """Tests for CreditService.get_credit_pack()."""

    async def test_get_credit_pack_returns_pack(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_pack,
    ):
        """Test that existing pack is returned."""
        service = CreditService(async_session, test_settings)
        pack = await service.get_credit_pack(credit_pack.id)

        assert pack is not None
        assert pack.id == credit_pack.id
        assert pack.name == credit_pack.name

    async def test_get_credit_pack_nonexistent_returns_none(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
    ):
        """Test that nonexistent pack returns None."""
        service = CreditService(async_session, test_settings)
        pack = await service.get_credit_pack(uuid.uuid4())

        assert pack is None

    async def test_get_credit_pack_inactive_returns_none(
        self,
        async_session: AsyncSession,
        test_settings: Settings,
        credit_packs,
    ):
        """Test that inactive pack returns None."""
        service = CreditService(async_session, test_settings)
        # Get the inactive pack from fixtures
        inactive_pack = next(p for p in credit_packs if not p.is_active)
        pack = await service.get_credit_pack(inactive_pack.id)

        assert pack is None
