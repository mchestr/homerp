"""Tests for item check-in/out functionality."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.items.models import Item
from src.items.repository import ItemRepository
from src.items.schemas import CheckInOutCreate
from src.users.models import User


@pytest.fixture
async def test_item(async_session: AsyncSession, test_user: User) -> Item:
    """Create a test item."""
    item = Item(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Test Item",
        description="A test item for check-in/out",
        quantity=10,
        quantity_unit="pcs",
    )
    async_session.add(item)
    await async_session.commit()
    await async_session.refresh(item)
    return item


@pytest.fixture
async def second_test_item(async_session: AsyncSession, test_user: User) -> Item:
    """Create a second test item."""
    item = Item(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Second Test Item",
        description="Another test item",
        quantity=5,
        quantity_unit="pcs",
    )
    async_session.add(item)
    await async_session.commit()
    await async_session.refresh(item)
    return item


@pytest.fixture
async def third_test_item(async_session: AsyncSession, test_user: User) -> Item:
    """Create a third test item."""
    item = Item(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Third Test Item",
        description="Yet another test item",
        quantity=3,
        quantity_unit="pcs",
    )
    async_session.add(item)
    await async_session.commit()
    await async_session.refresh(item)
    return item


class TestCheckInOutCreate:
    """Tests for creating check-in/out records."""

    async def test_create_check_out(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test creating a check-out record."""
        repo = ItemRepository(async_session, test_user.id)
        data = CheckInOutCreate(quantity=2, notes="Taking for project")

        record = await repo.create_check_in_out(test_item.id, "check_out", data)

        assert record.id is not None
        assert record.item_id == test_item.id
        assert record.user_id == test_user.id
        assert record.action_type == "check_out"
        assert record.quantity == 2
        assert record.notes == "Taking for project"
        assert record.occurred_at is not None
        assert record.created_at is not None

    async def test_create_check_in(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test creating a check-in record."""
        repo = ItemRepository(async_session, test_user.id)
        data = CheckInOutCreate(quantity=3, notes="Returning from project")

        record = await repo.create_check_in_out(test_item.id, "check_in", data)

        assert record.id is not None
        assert record.item_id == test_item.id
        assert record.action_type == "check_in"
        assert record.quantity == 3
        assert record.notes == "Returning from project"

    async def test_create_check_out_with_custom_date(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test creating a check-out with a custom occurred_at date."""
        repo = ItemRepository(async_session, test_user.id)
        custom_date = datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC)
        data = CheckInOutCreate(quantity=1, occurred_at=custom_date)

        record = await repo.create_check_in_out(test_item.id, "check_out", data)

        assert record.occurred_at == custom_date

    async def test_create_check_out_without_notes(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test creating a check-out without notes."""
        repo = ItemRepository(async_session, test_user.id)
        data = CheckInOutCreate(quantity=1)

        record = await repo.create_check_in_out(test_item.id, "check_out", data)

        assert record.notes is None

    async def test_create_check_out_default_quantity(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test creating a check-out with default quantity of 1."""
        repo = ItemRepository(async_session, test_user.id)
        data = CheckInOutCreate()

        record = await repo.create_check_in_out(test_item.id, "check_out", data)

        assert record.quantity == 1


class TestCheckInOutHistory:
    """Tests for retrieving check-in/out history."""

    async def test_get_history_empty(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test getting history for item with no records."""
        repo = ItemRepository(async_session, test_user.id)

        records, total = await repo.get_check_in_out_history(test_item.id)

        assert total == 0
        assert len(records) == 0

    async def test_get_history_with_records(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test getting history with records."""
        repo = ItemRepository(async_session, test_user.id)

        # Create some records
        await repo.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=2)
        )
        await repo.create_check_in_out(
            test_item.id, "check_in", CheckInOutCreate(quantity=1)
        )
        await repo.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=3)
        )

        records, total = await repo.get_check_in_out_history(test_item.id)

        assert total == 3
        assert len(records) == 3

    async def test_get_history_pagination(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test history pagination."""
        repo = ItemRepository(async_session, test_user.id)

        # Create 5 records
        for i in range(5):
            await repo.create_check_in_out(
                test_item.id, "check_out", CheckInOutCreate(quantity=i + 1)
            )

        # Get first page
        records, total = await repo.get_check_in_out_history(
            test_item.id, page=1, limit=2
        )
        assert total == 5
        assert len(records) == 2

        # Get second page
        records, total = await repo.get_check_in_out_history(
            test_item.id, page=2, limit=2
        )
        assert total == 5
        assert len(records) == 2

        # Get third page (partial)
        records, total = await repo.get_check_in_out_history(
            test_item.id, page=3, limit=2
        )
        assert total == 5
        assert len(records) == 1

    async def test_get_history_ordered_by_date_desc(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test that history is ordered by occurred_at descending."""
        repo = ItemRepository(async_session, test_user.id)

        # Create records with specific dates
        old_date = datetime(2024, 1, 1, tzinfo=UTC)
        new_date = datetime(2024, 6, 1, tzinfo=UTC)

        await repo.create_check_in_out(
            test_item.id,
            "check_out",
            CheckInOutCreate(quantity=1, notes="old", occurred_at=old_date),
        )
        await repo.create_check_in_out(
            test_item.id,
            "check_out",
            CheckInOutCreate(quantity=2, notes="new", occurred_at=new_date),
        )

        records, _ = await repo.get_check_in_out_history(test_item.id)

        assert records[0].notes == "new"  # Newer record first
        assert records[1].notes == "old"


class TestUsageStats:
    """Tests for usage statistics."""

    async def test_usage_stats_empty(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test usage stats for item with no history."""
        repo = ItemRepository(async_session, test_user.id)

        stats = await repo.get_usage_stats(test_item.id)

        assert stats.total_check_outs == 0
        assert stats.total_check_ins == 0
        assert stats.total_quantity_out == 0
        assert stats.total_quantity_in == 0
        assert stats.last_check_out is None
        assert stats.last_check_in is None
        assert stats.currently_checked_out == 0

    async def test_usage_stats_with_check_outs(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test usage stats with check-outs only."""
        repo = ItemRepository(async_session, test_user.id)

        await repo.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=2)
        )
        await repo.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=3)
        )

        stats = await repo.get_usage_stats(test_item.id)

        assert stats.total_check_outs == 2
        assert stats.total_check_ins == 0
        assert stats.total_quantity_out == 5
        assert stats.total_quantity_in == 0
        assert stats.currently_checked_out == 5
        assert stats.last_check_out is not None
        assert stats.last_check_in is None

    async def test_usage_stats_with_check_ins_and_outs(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test usage stats with both check-ins and check-outs."""
        repo = ItemRepository(async_session, test_user.id)

        await repo.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=5)
        )
        await repo.create_check_in_out(
            test_item.id, "check_in", CheckInOutCreate(quantity=2)
        )
        await repo.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )
        await repo.create_check_in_out(
            test_item.id, "check_in", CheckInOutCreate(quantity=1)
        )

        stats = await repo.get_usage_stats(test_item.id)

        assert stats.total_check_outs == 2
        assert stats.total_check_ins == 2
        assert stats.total_quantity_out == 6  # 5 + 1
        assert stats.total_quantity_in == 3  # 2 + 1
        assert stats.currently_checked_out == 3  # 6 - 3
        assert stats.last_check_out is not None
        assert stats.last_check_in is not None

    async def test_usage_stats_currently_checked_out_can_be_negative(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test that currently_checked_out can be negative (more check-ins than check-outs)."""
        repo = ItemRepository(async_session, test_user.id)

        await repo.create_check_in_out(
            test_item.id, "check_in", CheckInOutCreate(quantity=5)
        )

        stats = await repo.get_usage_stats(test_item.id)

        assert stats.currently_checked_out == -5


class TestMostUsedItems:
    """Tests for most used items dashboard widget."""

    async def test_most_used_empty(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test most used items when no check-outs exist."""
        repo = ItemRepository(async_session, test_user.id)

        items = await repo.get_most_used_items()

        assert len(items) == 0

    async def test_most_used_with_check_outs(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
        second_test_item: Item,
        third_test_item: Item,
    ):
        """Test most used items returns items sorted by check-out count."""
        repo = ItemRepository(async_session, test_user.id)

        # Create check-outs: second_test_item has most, test_item has second most
        for _ in range(5):
            await repo.create_check_in_out(
                second_test_item.id, "check_out", CheckInOutCreate(quantity=1)
            )
        for _ in range(3):
            await repo.create_check_in_out(
                test_item.id, "check_out", CheckInOutCreate(quantity=1)
            )
        await repo.create_check_in_out(
            third_test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )

        items = await repo.get_most_used_items()

        assert len(items) == 3
        assert items[0].id == second_test_item.id
        assert items[0].total_check_outs == 5
        assert items[1].id == test_item.id
        assert items[1].total_check_outs == 3
        assert items[2].id == third_test_item.id
        assert items[2].total_check_outs == 1

    async def test_most_used_limit(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
        second_test_item: Item,
        third_test_item: Item,
    ):
        """Test most used items respects limit parameter."""
        repo = ItemRepository(async_session, test_user.id)

        # Create check-outs for all items
        await repo.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )
        await repo.create_check_in_out(
            second_test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )
        await repo.create_check_in_out(
            third_test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )

        items = await repo.get_most_used_items(limit=2)

        assert len(items) == 2

    async def test_most_used_excludes_check_ins(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test that most used items only counts check-outs, not check-ins."""
        repo = ItemRepository(async_session, test_user.id)

        # Create only check-ins
        await repo.create_check_in_out(
            test_item.id, "check_in", CheckInOutCreate(quantity=5)
        )

        items = await repo.get_most_used_items()

        assert len(items) == 0


class TestRecentlyUsedItems:
    """Tests for recently used items dashboard widget."""

    async def test_recently_used_empty(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test recently used items when no activity exists."""
        repo = ItemRepository(async_session, test_user.id)

        items = await repo.get_recently_used_items()

        assert len(items) == 0

    async def test_recently_used_with_activity(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
        second_test_item: Item,
    ):
        """Test recently used items returns items sorted by last activity."""
        repo = ItemRepository(async_session, test_user.id)

        old_date = datetime(2024, 1, 1, tzinfo=UTC)
        new_date = datetime(2024, 6, 1, tzinfo=UTC)

        # Create activity with specific dates
        await repo.create_check_in_out(
            test_item.id,
            "check_out",
            CheckInOutCreate(quantity=1, occurred_at=old_date),
        )
        await repo.create_check_in_out(
            second_test_item.id,
            "check_in",
            CheckInOutCreate(quantity=1, occurred_at=new_date),
        )

        items = await repo.get_recently_used_items()

        assert len(items) == 2
        assert items[0].id == second_test_item.id  # More recent
        assert items[0].action_type == "check_in"
        assert items[1].id == test_item.id
        assert items[1].action_type == "check_out"

    async def test_recently_used_limit(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
        second_test_item: Item,
        third_test_item: Item,
    ):
        """Test recently used items respects limit parameter."""
        repo = ItemRepository(async_session, test_user.id)

        await repo.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )
        await repo.create_check_in_out(
            second_test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )
        await repo.create_check_in_out(
            third_test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )

        items = await repo.get_recently_used_items(limit=2)

        assert len(items) == 2

    async def test_recently_used_shows_latest_action(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test that recently used shows the latest action type for each item."""
        repo = ItemRepository(async_session, test_user.id)

        old_date = datetime(2024, 1, 1, tzinfo=UTC)
        new_date = datetime(2024, 6, 1, tzinfo=UTC)

        # First check out, then check in
        await repo.create_check_in_out(
            test_item.id,
            "check_out",
            CheckInOutCreate(quantity=1, occurred_at=old_date),
        )
        await repo.create_check_in_out(
            test_item.id,
            "check_in",
            CheckInOutCreate(quantity=1, occurred_at=new_date),
        )

        items = await repo.get_recently_used_items()

        assert len(items) == 1
        assert items[0].action_type == "check_in"  # Latest action
        assert items[0].last_used == new_date


class TestUserIsolation:
    """Tests for user data isolation."""

    async def test_check_in_out_isolated_by_user(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test that check-in/out records are isolated by user."""
        # Create another user
        other_user = User(
            id=uuid.uuid4(),
            email="other@example.com",
            name="Other User",
            oauth_provider="google",
            oauth_id="google_other_123",
            credit_balance=0,
            free_credits_remaining=5,
        )
        async_session.add(other_user)
        await async_session.commit()

        # Create item for other user
        other_item = Item(
            id=uuid.uuid4(),
            user_id=other_user.id,
            name="Other Item",
            quantity=5,
            quantity_unit="pcs",
        )
        async_session.add(other_item)
        await async_session.commit()

        # Create records for both users
        repo1 = ItemRepository(async_session, test_user.id)
        repo2 = ItemRepository(async_session, other_user.id)

        await repo1.create_check_in_out(
            test_item.id, "check_out", CheckInOutCreate(quantity=1)
        )
        await repo2.create_check_in_out(
            other_item.id, "check_out", CheckInOutCreate(quantity=2)
        )

        # Verify isolation
        records1, total1 = await repo1.get_check_in_out_history(test_item.id)
        records2, total2 = await repo2.get_check_in_out_history(other_item.id)

        assert total1 == 1
        assert records1[0].quantity == 1
        assert total2 == 1
        assert records2[0].quantity == 2

    async def test_most_used_isolated_by_user(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test that most used items are isolated by user."""
        # Create another user
        other_user = User(
            id=uuid.uuid4(),
            email="other2@example.com",
            name="Other User 2",
            oauth_provider="google",
            oauth_id="google_other2_123",
            credit_balance=0,
            free_credits_remaining=5,
        )
        async_session.add(other_user)
        await async_session.commit()

        # Create item for other user
        other_item = Item(
            id=uuid.uuid4(),
            user_id=other_user.id,
            name="Other Item 2",
            quantity=5,
            quantity_unit="pcs",
        )
        async_session.add(other_item)
        await async_session.commit()

        # Create check-outs for other user
        repo2 = ItemRepository(async_session, other_user.id)
        for _ in range(10):
            await repo2.create_check_in_out(
                other_item.id, "check_out", CheckInOutCreate(quantity=1)
            )

        # Verify test_user sees no most used items
        repo1 = ItemRepository(async_session, test_user.id)
        items = await repo1.get_most_used_items()

        assert len(items) == 0
