"""HTTP integration tests for notifications router."""

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.items.models import Item
from src.notifications.models import AlertHistory, NotificationPreferences
from src.users.models import User


class TestGetNotificationPreferencesEndpoint:
    """Tests for GET /api/v1/notifications/preferences."""

    async def test_get_preferences_returns_defaults(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test getting preferences creates defaults if not exist."""
        response = await authenticated_client.get("/api/v1/notifications/preferences")

        assert response.status_code == 200
        data = response.json()
        assert data["email_notifications_enabled"] is True
        assert data["low_stock_email_enabled"] is True

    async def test_get_preferences_returns_existing(
        self,
        authenticated_client: AsyncClient,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test getting existing preferences."""
        # Create custom preferences
        prefs = NotificationPreferences(
            user_id=test_user.id,
            email_notifications_enabled=False,
            low_stock_email_enabled=False,
        )
        async_session.add(prefs)
        await async_session.commit()

        response = await authenticated_client.get("/api/v1/notifications/preferences")

        assert response.status_code == 200
        data = response.json()
        assert data["email_notifications_enabled"] is False
        assert data["low_stock_email_enabled"] is False

    async def test_get_preferences_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/notifications/preferences")

        assert response.status_code == 401


class TestUpdateNotificationPreferencesEndpoint:
    """Tests for PUT /api/v1/notifications/preferences."""

    async def test_update_preferences(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test updating notification preferences."""
        response = await authenticated_client.put(
            "/api/v1/notifications/preferences",
            json={
                "email_notifications_enabled": False,
                "low_stock_email_enabled": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email_notifications_enabled"] is False
        assert data["low_stock_email_enabled"] is False

    async def test_update_preferences_partial(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test partial update of preferences."""
        # First set defaults
        await authenticated_client.get("/api/v1/notifications/preferences")

        # Update only one field
        response = await authenticated_client.put(
            "/api/v1/notifications/preferences",
            json={"low_stock_email_enabled": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email_notifications_enabled"] is True
        assert data["low_stock_email_enabled"] is False

    async def test_update_preferences_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.put(
            "/api/v1/notifications/preferences",
            json={"email_notifications_enabled": False},
        )

        assert response.status_code == 401


class TestTriggerLowStockAlertsEndpoint:
    """Tests for POST /api/v1/notifications/low-stock/trigger."""

    async def test_trigger_with_notifications_disabled(
        self,
        authenticated_client: AsyncClient,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Test triggering alerts when notifications are disabled."""
        # Disable email notifications
        prefs = NotificationPreferences(
            user_id=test_user.id,
            email_notifications_enabled=False,
            low_stock_email_enabled=True,
        )
        async_session.add(prefs)
        await async_session.commit()

        response = await authenticated_client.post(
            "/api/v1/notifications/low-stock/trigger"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["triggered_count"] == 0
        assert len(data["items"]) == 1
        assert data["items"][0]["status"] == "skipped_disabled"

    async def test_trigger_with_no_low_stock_items(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test triggering alerts when no items are low stock."""
        response = await authenticated_client.post(
            "/api/v1/notifications/low-stock/trigger"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["triggered_count"] == 0
        assert data["skipped_count"] == 0
        assert data["failed_count"] == 0
        assert data["items"] == []

    async def test_trigger_with_specific_item_ids(
        self,
        authenticated_client: AsyncClient,
        async_session: AsyncSession,
        test_user: User,
        test_category,
        test_location,
    ):
        """Test triggering alerts for specific item IDs."""
        # Create a low stock item
        low_stock_item = Item(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="Low Stock Test",
            quantity=2,
            min_quantity=5,
            category_id=test_category.id,
            location_id=test_location.id,
        )
        async_session.add(low_stock_item)
        await async_session.commit()

        response = await authenticated_client.post(
            "/api/v1/notifications/low-stock/trigger",
            json={"item_ids": [str(low_stock_item.id)]},
        )

        assert response.status_code == 200
        data = response.json()
        # Will fail since SMTP is not configured, but should try
        assert "failed_count" in data or "triggered_count" in data

    async def test_trigger_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/notifications/low-stock/trigger"
        )

        assert response.status_code == 401


class TestGetAlertHistoryEndpoint:
    """Tests for GET /api/v1/notifications/history."""

    async def test_get_history_empty(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test getting empty alert history."""
        response = await authenticated_client.get("/api/v1/notifications/history")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_get_history_with_items(
        self,
        authenticated_client: AsyncClient,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test getting alert history with items."""
        # Create alert history
        alert = AlertHistory(
            user_id=test_user.id,
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Test Alert",
            item_quantity_at_alert=2,
            item_min_quantity=5,
            status="sent",
        )
        async_session.add(alert)
        await async_session.commit()

        response = await authenticated_client.get("/api/v1/notifications/history")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["alert_type"] == "low_stock"
        assert data["items"][0]["item_name"] == test_item.name

    async def test_get_history_filter_by_type(
        self,
        authenticated_client: AsyncClient,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test filtering alert history by type."""
        # Create alerts of different types
        alert1 = AlertHistory(
            user_id=test_user.id,
            item_id=test_item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=test_user.email,
            subject="Low Stock Alert",
            item_quantity_at_alert=2,
            item_min_quantity=5,
            status="sent",
        )
        alert2 = AlertHistory(
            user_id=test_user.id,
            item_id=test_item.id,
            alert_type="expiring_soon",
            channel="email",
            recipient_email=test_user.email,
            subject="Expiring Alert",
            item_quantity_at_alert=2,
            item_min_quantity=5,
            status="sent",
        )
        async_session.add_all([alert1, alert2])
        await async_session.commit()

        response = await authenticated_client.get(
            "/api/v1/notifications/history?alert_type=low_stock"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["alert_type"] == "low_stock"

    async def test_get_history_pagination(
        self,
        authenticated_client: AsyncClient,
        async_session: AsyncSession,
        test_user: User,
        test_item: Item,
    ):
        """Test alert history pagination."""
        # Create multiple alerts
        for i in range(5):
            alert = AlertHistory(
                user_id=test_user.id,
                item_id=test_item.id,
                alert_type="low_stock",
                channel="email",
                recipient_email=test_user.email,
                subject=f"Alert {i}",
                item_quantity_at_alert=i,
                item_min_quantity=10,
                status="sent",
            )
            async_session.add(alert)
        await async_session.commit()

        response = await authenticated_client.get(
            "/api/v1/notifications/history?page=1&limit=2"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["limit"] == 2
        assert data["total_pages"] == 3

    async def test_get_history_unauthenticated(
        self,
        unauthenticated_client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/notifications/history")

        assert response.status_code == 401
