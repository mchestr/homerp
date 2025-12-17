"""Tests for notification repository."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.items.models import Item
from src.notifications.models import AlertHistory, NotificationPreferences
from src.notifications.repository import NotificationRepository
from src.notifications.schemas import NotificationPreferencesUpdate
from src.users.models import User


class TestNotificationPreferences:
    """Tests for notification preferences operations."""

    async def test_get_preferences_returns_none_when_not_exists(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test get_preferences returns None when preferences don't exist."""
        repo = NotificationRepository(async_session, test_user.id)
        prefs = await repo.get_preferences()
        assert prefs is None

    async def test_get_or_create_preferences_creates_defaults(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test get_or_create_preferences creates default preferences."""
        repo = NotificationRepository(async_session, test_user.id)
        prefs = await repo.get_or_create_preferences()

        assert prefs is not None
        assert prefs.user_id == test_user.id
        assert prefs.email_notifications_enabled is True
        assert prefs.low_stock_email_enabled is True

    async def test_get_or_create_preferences_returns_existing(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test get_or_create_preferences returns existing preferences."""
        # Create preferences with custom values
        existing = NotificationPreferences(
            user_id=test_user.id,
            email_notifications_enabled=False,
            low_stock_email_enabled=False,
        )
        async_session.add(existing)
        await async_session.commit()

        repo = NotificationRepository(async_session, test_user.id)
        prefs = await repo.get_or_create_preferences()

        assert prefs.id == existing.id
        assert prefs.email_notifications_enabled is False
        assert prefs.low_stock_email_enabled is False

    async def test_update_preferences(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test updating notification preferences."""
        repo = NotificationRepository(async_session, test_user.id)

        # First create defaults
        await repo.get_or_create_preferences()

        # Update preferences
        update = NotificationPreferencesUpdate(
            email_notifications_enabled=False,
            low_stock_email_enabled=False,
        )
        prefs = await repo.update_preferences(update)

        assert prefs.email_notifications_enabled is False
        assert prefs.low_stock_email_enabled is False

    async def test_update_preferences_partial(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test partial update of notification preferences."""
        repo = NotificationRepository(async_session, test_user.id)

        # First create defaults
        await repo.get_or_create_preferences()

        # Update only one field
        update = NotificationPreferencesUpdate(low_stock_email_enabled=False)
        prefs = await repo.update_preferences(update)

        # Original value preserved
        assert prefs.email_notifications_enabled is True
        # Updated value
        assert prefs.low_stock_email_enabled is False


class TestAlertHistory:
    """Tests for alert history operations."""

    async def test_create_alert_history(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test creating an alert history record."""
        repo = NotificationRepository(async_session, test_user.id)
        alert = await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock Alert: Test Item",
            item_quantity=2,
            item_min_quantity=5,
        )

        assert alert.id is not None
        assert alert.user_id == test_user.id
        assert alert.item_id == test_item.id
        assert alert.alert_type == "low_stock"
        assert alert.channel == "email"
        assert alert.status == "pending"
        assert alert.item_quantity_at_alert == 2
        assert alert.item_min_quantity == 5

    async def test_update_alert_status_to_sent(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test updating alert status to sent."""
        repo = NotificationRepository(async_session, test_user.id)
        alert = await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock Alert",
            item_quantity=2,
            item_min_quantity=5,
        )

        updated = await repo.update_alert_status(alert.id, "sent")

        assert updated is not None
        assert updated.status == "sent"
        assert updated.error_message is None

    async def test_update_alert_status_to_failed(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test updating alert status to failed with error message."""
        repo = NotificationRepository(async_session, test_user.id)
        alert = await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock Alert",
            item_quantity=2,
            item_min_quantity=5,
        )

        updated = await repo.update_alert_status(
            alert.id, "failed", "SMTP connection timeout"
        )

        assert updated is not None
        assert updated.status == "failed"
        assert updated.error_message == "SMTP connection timeout"

    async def test_update_alert_status_wrong_user(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test cannot update alert status for different user's alert."""
        repo = NotificationRepository(async_session, test_user.id)
        alert = await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock Alert",
            item_quantity=2,
            item_min_quantity=5,
        )

        # Try to update with different user
        other_user_id = uuid.uuid4()
        other_repo = NotificationRepository(async_session, other_user_id)
        updated = await other_repo.update_alert_status(alert.id, "sent")

        # Should return None since alert belongs to different user
        assert updated is None


class TestAlertDeduplication:
    """Tests for alert deduplication logic."""

    async def test_was_alerted_recently_no_alerts(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test was_alerted_recently returns False with no alerts."""
        repo = NotificationRepository(async_session, test_user.id)
        result = await repo.was_alerted_recently(test_item.id, "low_stock")
        assert result is False

    async def test_was_alerted_recently_recent_sent(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test was_alerted_recently returns True for recent sent alert."""
        repo = NotificationRepository(async_session, test_user.id)

        # Create a sent alert
        alert = await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock Alert",
            item_quantity=2,
            item_min_quantity=5,
        )
        await repo.update_alert_status(alert.id, "sent")

        result = await repo.was_alerted_recently(test_item.id, "low_stock")
        assert result is True

    async def test_was_alerted_recently_pending_not_counted(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test was_alerted_recently ignores pending alerts."""
        repo = NotificationRepository(async_session, test_user.id)

        # Create a pending alert (not sent)
        await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock Alert",
            item_quantity=2,
            item_min_quantity=5,
        )

        result = await repo.was_alerted_recently(test_item.id, "low_stock")
        assert result is False

    async def test_was_alerted_recently_failed_not_counted(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test was_alerted_recently ignores failed alerts."""
        repo = NotificationRepository(async_session, test_user.id)

        # Create a failed alert
        alert = await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock Alert",
            item_quantity=2,
            item_min_quantity=5,
        )
        await repo.update_alert_status(alert.id, "failed", "Error")

        result = await repo.was_alerted_recently(test_item.id, "low_stock")
        assert result is False

    async def test_was_alerted_recently_old_alert(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test was_alerted_recently returns False for alert older than 24h."""
        repo = NotificationRepository(async_session, test_user.id)

        # Create an old alert directly in the database
        old_alert = AlertHistory(
            user_id=test_user.id,
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Old Low Stock Alert",
            item_quantity_at_alert=2,
            item_min_quantity=5,
            status="sent",
            sent_at=datetime.now(UTC) - timedelta(hours=25),
        )
        async_session.add(old_alert)
        await async_session.commit()

        result = await repo.was_alerted_recently(test_item.id, "low_stock")
        assert result is False

    async def test_was_alerted_recently_different_alert_type(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test was_alerted_recently differentiates by alert type."""
        repo = NotificationRepository(async_session, test_user.id)

        # Create a sent alert of different type
        alert = await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="expiring_soon",  # Different type
            channel="email",
            recipient_email=test_user.email,
            subject="Expiring Soon Alert",
            item_quantity=2,
            item_min_quantity=5,
        )
        await repo.update_alert_status(alert.id, "sent")

        # Check for low_stock type
        result = await repo.was_alerted_recently(test_item.id, "low_stock")
        assert result is False


class TestAlertHistoryQuery:
    """Tests for alert history querying."""

    async def test_get_alert_history_empty(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test get_alert_history returns empty list."""
        repo = NotificationRepository(async_session, test_user.id)
        alerts, total = await repo.get_alert_history()

        assert alerts == []
        assert total == 0

    async def test_get_alert_history_with_items(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test get_alert_history returns alerts with item data."""
        repo = NotificationRepository(async_session, test_user.id)

        # Create some alerts
        await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Alert 1",
            item_quantity=2,
            item_min_quantity=5,
        )
        await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Alert 2",
            item_quantity=1,
            item_min_quantity=5,
        )

        alerts, total = await repo.get_alert_history()

        assert len(alerts) == 2
        assert total == 2
        # Should include item relationship
        assert alerts[0].item is not None
        assert alerts[0].item.name == test_item.name

    async def test_get_alert_history_filter_by_type(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test get_alert_history can filter by alert type."""
        repo = NotificationRepository(async_session, test_user.id)

        # Create alerts of different types
        await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock",
            item_quantity=2,
            item_min_quantity=5,
        )
        await repo.create_alert_history(
            item_id=test_item.id,
            alert_type="expiring_soon",
            channel="email",
            recipient_email=test_user.email,
            subject="Expiring",
            item_quantity=2,
            item_min_quantity=5,
        )

        alerts, total = await repo.get_alert_history(alert_type="low_stock")

        assert len(alerts) == 1
        assert total == 1
        assert alerts[0].alert_type == "low_stock"

    async def test_get_alert_history_pagination(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test get_alert_history pagination."""
        repo = NotificationRepository(async_session, test_user.id)

        # Create 5 alerts
        for i in range(5):
            await repo.create_alert_history(
                item_id=test_item.id,
                alert_type="low_stock",
                channel="email",
                recipient_email=test_user.email,
                subject=f"Alert {i}",
                item_quantity=i,
                item_min_quantity=10,
            )

        # Get first page
        alerts_p1, total = await repo.get_alert_history(page=1, limit=2)
        assert len(alerts_p1) == 2
        assert total == 5

        # Get second page
        alerts_p2, _ = await repo.get_alert_history(page=2, limit=2)
        assert len(alerts_p2) == 2

        # Get third page
        alerts_p3, _ = await repo.get_alert_history(page=3, limit=2)
        assert len(alerts_p3) == 1


class TestLowStockItems:
    """Tests for low stock item queries."""

    @pytest.fixture
    async def low_stock_item(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_category,
        test_location,
    ) -> Item:
        """Create a low stock item."""
        item = Item(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="Low Stock Item",
            quantity=2,
            min_quantity=5,
            category_id=test_category.id,
            location_id=test_location.id,
        )
        async_session.add(item)
        await async_session.commit()
        await async_session.refresh(item)
        return item

    @pytest.fixture
    async def normal_stock_item(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_category,
        test_location,
    ) -> Item:
        """Create a normal stock item."""
        item = Item(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="Normal Stock Item",
            quantity=10,
            min_quantity=5,
            category_id=test_category.id,
            location_id=test_location.id,
        )
        async_session.add(item)
        await async_session.commit()
        await async_session.refresh(item)
        return item

    async def test_get_low_stock_items_returns_low_stock(
        self,
        async_session: AsyncSession,
        test_user: User,
        low_stock_item: Item,
        normal_stock_item: Item,
    ):
        """Test get_low_stock_items returns only low stock items."""
        repo = NotificationRepository(async_session, test_user.id)
        items = await repo.get_low_stock_items()

        assert len(items) == 1
        assert items[0].id == low_stock_item.id

    async def test_get_low_stock_items_filter_by_ids(
        self,
        async_session: AsyncSession,
        test_user: User,
        low_stock_item: Item,
        test_category,
        test_location,
    ):
        """Test get_low_stock_items can filter by specific IDs."""
        # Create another low stock item
        another_low_stock = Item(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="Another Low Stock",
            quantity=1,
            min_quantity=5,
            category_id=test_category.id,
            location_id=test_location.id,
        )
        async_session.add(another_low_stock)
        await async_session.commit()

        repo = NotificationRepository(async_session, test_user.id)

        # Filter to just one item
        items = await repo.get_low_stock_items(item_ids=[low_stock_item.id])

        assert len(items) == 1
        assert items[0].id == low_stock_item.id

    async def test_get_low_stock_items_no_min_quantity(
        self,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test get_low_stock_items excludes items without min_quantity."""
        repo = NotificationRepository(async_session, test_user.id)

        # test_item has no min_quantity set
        items = await repo.get_low_stock_items()

        assert len(items) == 0
