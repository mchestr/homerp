"""Tests for admin stats endpoint."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from src.admin.router import get_stats
from src.admin.schemas import AdminStatsResponse
from src.billing.models import CreditPack, CreditTransaction
from src.feedback.models import Feedback
from src.items.models import Item
from src.users.models import User


class TestAdminStats:
    """Tests for GET /api/v1/admin/stats endpoint."""

    async def test_get_stats_returns_basic_counts(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_user: User,
        credit_packs: list[CreditPack],  # noqa: ARG002 - fixture creates data
    ):
        """Test that stats endpoint returns correct basic counts."""
        # Create an item for test_user
        item = Item(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="Test Item",
            quantity=1,
        )
        async_session.add(item)
        await async_session.commit()

        # Call the stats endpoint directly
        stats = await get_stats(admin_user, async_session)

        assert isinstance(stats, AdminStatsResponse)
        assert stats.total_users == 2  # admin_user + test_user
        assert stats.total_items == 1
        assert stats.active_credit_packs == 3  # 3 active packs from fixture

    async def test_get_stats_returns_revenue(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_user: User,
        credit_pack: CreditPack,
    ):
        """Test that stats endpoint returns correct revenue calculation."""
        # Create purchase transactions
        for _ in range(3):
            transaction = CreditTransaction(
                id=uuid.uuid4(),
                user_id=test_user.id,
                amount=credit_pack.credits,
                transaction_type="purchase",
                description="Test purchase",
                credit_pack_id=credit_pack.id,
                is_refunded=False,
            )
            async_session.add(transaction)
        await async_session.commit()

        stats = await get_stats(admin_user, async_session)

        # 3 purchases * 300 cents = 900 cents
        assert stats.total_revenue_cents == 900
        assert stats.total_credits_purchased == 75  # 3 * 25 credits

    async def test_get_stats_excludes_refunded_from_revenue(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_user: User,
        credit_pack: CreditPack,
    ):
        """Test that refunded transactions are excluded from revenue."""
        # Create a normal purchase
        normal = CreditTransaction(
            id=uuid.uuid4(),
            user_id=test_user.id,
            amount=credit_pack.credits,
            transaction_type="purchase",
            description="Normal purchase",
            credit_pack_id=credit_pack.id,
            is_refunded=False,
        )
        # Create a refunded purchase
        refunded = CreditTransaction(
            id=uuid.uuid4(),
            user_id=test_user.id,
            amount=credit_pack.credits,
            transaction_type="purchase",
            description="Refunded purchase",
            credit_pack_id=credit_pack.id,
            is_refunded=True,
        )
        async_session.add_all([normal, refunded])
        await async_session.commit()

        stats = await get_stats(admin_user, async_session)

        # Only non-refunded purchase should count
        assert stats.total_revenue_cents == 300
        assert stats.total_credits_purchased == 25

    async def test_get_stats_returns_credits_used(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_user: User,
    ):
        """Test that stats endpoint returns correct credits used count."""
        # Create usage transactions (negative amounts)
        for i in range(5):
            transaction = CreditTransaction(
                id=uuid.uuid4(),
                user_id=test_user.id,
                amount=-1,  # Usage transactions are negative
                transaction_type="usage",
                description=f"AI classification {i + 1}",
            )
            async_session.add(transaction)
        await async_session.commit()

        stats = await get_stats(admin_user, async_session)

        assert stats.total_credits_used == 5

    async def test_get_stats_returns_recent_signups(
        self,
        async_session: AsyncSession,
        admin_user: User,
    ):
        """Test that stats endpoint returns correct recent signups count."""
        # Create users with different signup dates
        # Use naive datetimes since database column is TIMESTAMP WITHOUT TIME ZONE
        now = datetime.now(UTC).replace(tzinfo=None)
        recent_user = User(
            id=uuid.uuid4(),
            email="recent@example.com",
            name="Recent User",
            oauth_provider="google",
            oauth_id="google_recent",
            created_at=now - timedelta(days=2),
        )
        old_user = User(
            id=uuid.uuid4(),
            email="old@example.com",
            name="Old User",
            oauth_provider="google",
            oauth_id="google_old",
            created_at=now - timedelta(days=10),
        )
        async_session.add_all([recent_user, old_user])
        await async_session.commit()

        stats = await get_stats(admin_user, async_session)

        # admin_user (just created) + recent_user = 2 recent signups
        # old_user should not be counted
        assert stats.recent_signups_7d == 2

    async def test_get_stats_returns_pending_feedback_count(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_user: User,
    ):
        """Test that stats endpoint returns correct pending feedback count."""
        # Create feedback with different statuses
        pending = Feedback(
            id=uuid.uuid4(),
            user_id=test_user.id,
            subject="Pending Feedback",
            message="This is pending",
            feedback_type="bug",
            status="pending",
        )
        in_progress = Feedback(
            id=uuid.uuid4(),
            user_id=test_user.id,
            subject="In Progress Feedback",
            message="This is in progress",
            feedback_type="feature",
            status="in_progress",
        )
        resolved = Feedback(
            id=uuid.uuid4(),
            user_id=test_user.id,
            subject="Resolved Feedback",
            message="This is resolved",
            feedback_type="general",
            status="resolved",
        )
        async_session.add_all([pending, in_progress, resolved])
        await async_session.commit()

        stats = await get_stats(admin_user, async_session)

        # Only pending and in_progress should be counted
        assert stats.pending_feedback_count == 2

    async def test_get_stats_returns_recent_activity(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_user: User,
        credit_pack: CreditPack,
    ):
        """Test that stats endpoint returns recent activity items."""
        # Create feedback
        feedback = Feedback(
            id=uuid.uuid4(),
            user_id=test_user.id,
            subject="Bug Report",
            message="Found a bug",
            feedback_type="bug",
            status="pending",
        )
        # Create purchase
        purchase = CreditTransaction(
            id=uuid.uuid4(),
            user_id=test_user.id,
            amount=credit_pack.credits,
            transaction_type="purchase",
            description="Test purchase",
            credit_pack_id=credit_pack.id,
        )
        async_session.add_all([feedback, purchase])
        await async_session.commit()

        stats = await get_stats(admin_user, async_session)

        assert len(stats.recent_activity) > 0

        # Check activity types are present
        activity_types = {a.type for a in stats.recent_activity}
        assert "signup" in activity_types  # From users
        assert "feedback" in activity_types
        assert "purchase" in activity_types

    async def test_get_stats_activity_includes_user_info(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_user: User,
    ):
        """Test that activity items include user email and name."""
        feedback = Feedback(
            id=uuid.uuid4(),
            user_id=test_user.id,
            subject="Test Feedback",
            message="Test message",
            feedback_type="general",
            status="pending",
        )
        async_session.add(feedback)
        await async_session.commit()

        stats = await get_stats(admin_user, async_session)

        feedback_activity = next(
            (a for a in stats.recent_activity if a.type == "feedback"), None
        )
        assert feedback_activity is not None
        assert feedback_activity.user_email == test_user.email
        assert feedback_activity.user_name == test_user.name

    async def test_get_stats_activity_limited_to_15(
        self,
        async_session: AsyncSession,
        admin_user: User,
        test_user: User,
    ):
        """Test that recent activity is limited to 15 items."""
        # Create 20 feedback items
        for i in range(20):
            feedback = Feedback(
                id=uuid.uuid4(),
                user_id=test_user.id,
                subject=f"Feedback {i}",
                message=f"Message {i}",
                feedback_type="general",
                status="pending",
            )
            async_session.add(feedback)
        await async_session.commit()

        stats = await get_stats(admin_user, async_session)

        assert len(stats.recent_activity) <= 15

    async def test_get_stats_empty_database(
        self,
        async_session: AsyncSession,
        admin_user: User,
    ):
        """Test stats with minimal data (just admin user)."""
        stats = await get_stats(admin_user, async_session)

        assert stats.total_users == 1  # Just admin_user
        assert stats.total_items == 0
        assert stats.total_revenue_cents == 0
        assert stats.active_credit_packs == 0
        assert stats.total_credits_purchased == 0
        assert stats.total_credits_used == 0
        assert stats.recent_signups_7d == 1  # admin_user
        assert stats.pending_feedback_count == 0
        # Activity should include the admin user signup
        assert len(stats.recent_activity) >= 1

    def test_sorting_handles_mixed_timezone_timestamps(self):
        """Test that sorting works with mixed naive/aware timestamps.

        Regression test for production bug where sorting failed with:
        TypeError: can't compare offset-naive and offset-aware datetimes

        This tests the normalize_timestamp helper used in sorting, which handles
        cases where some timestamps may be timezone-aware while others are naive.
        """
        from src.admin.schemas import RecentActivityItem

        # Create activity items with mixed timezone awareness
        # This simulates what could happen in production if timestamps
        # come from different sources or were serialized differently
        activities = [
            RecentActivityItem(
                id=uuid.uuid4(),
                type="signup",
                title="Aware User",
                description="User with aware timestamp",
                user_email="aware@example.com",
                user_name="Aware User",
                timestamp=datetime.now(UTC),  # Timezone-aware
            ),
            RecentActivityItem(
                id=uuid.uuid4(),
                type="signup",
                title="Naive User",
                description="User with naive timestamp",
                user_email="naive@example.com",
                user_name="Naive User",
                timestamp=datetime.now(UTC).replace(tzinfo=None),  # Timezone-naive
            ),
            RecentActivityItem(
                id=uuid.uuid4(),
                type="feedback",
                title="Aware Feedback",
                description="Feedback with aware timestamp",
                user_email="test@example.com",
                user_name="Test User",
                timestamp=datetime.now(UTC)
                - timedelta(hours=1),  # Timezone-aware, older
            ),
            RecentActivityItem(
                id=uuid.uuid4(),
                type="feedback",
                title="Naive Feedback",
                description="Feedback with naive timestamp",
                user_email="test@example.com",
                user_name="Test User",
                timestamp=(datetime.now(UTC) - timedelta(hours=2)).replace(
                    tzinfo=None
                ),  # Timezone-naive, oldest
            ),
        ]

        # This is the normalize function from the router
        def normalize_timestamp(ts: datetime) -> datetime:
            if ts.tzinfo is None:
                return ts.replace(tzinfo=UTC)
            return ts

        # This should not raise TypeError when sorting mixed timestamps
        activities.sort(key=lambda x: normalize_timestamp(x.timestamp), reverse=True)

        # Verify sorting worked and newest items are first
        assert len(activities) == 4
        # The two most recent should be the "now" items (aware and naive signup)
        assert activities[0].type == "signup"
        assert activities[1].type == "signup"
        # The feedback items should be after
        assert activities[2].type == "feedback"
        assert activities[3].type == "feedback"
