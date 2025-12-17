"""Repository for notification database operations."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.items.models import Item
from src.notifications.models import AlertHistory, AlertStatus, NotificationPreferences
from src.notifications.schemas import NotificationPreferencesUpdate


class NotificationRepository:
    """Repository for notification database operations."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def get_preferences(self) -> NotificationPreferences | None:
        """Get notification preferences for the current user."""
        result = await self.session.execute(
            select(NotificationPreferences).where(
                NotificationPreferences.user_id == self.user_id
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create_preferences(self) -> NotificationPreferences:
        """Get notification preferences, creating defaults if not exists."""
        prefs = await self.get_preferences()
        if prefs is None:
            prefs = NotificationPreferences(
                user_id=self.user_id,
                email_notifications_enabled=True,
                low_stock_email_enabled=True,
            )
            self.session.add(prefs)
            await self.session.commit()
            await self.session.refresh(prefs)
        return prefs

    async def update_preferences(
        self, data: NotificationPreferencesUpdate
    ) -> NotificationPreferences:
        """Update notification preferences, creating if not exists."""
        prefs = await self.get_or_create_preferences()

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(prefs, field, value)

        await self.session.commit()
        await self.session.refresh(prefs)
        return prefs

    async def was_alerted_recently(
        self,
        item_id: UUID,
        alert_type: str,
        within_hours: int = 24,
    ) -> bool:
        """Check if an alert was sent for this item within the time window."""
        cutoff = datetime.now(UTC) - timedelta(hours=within_hours)
        result = await self.session.execute(
            select(func.count(AlertHistory.id)).where(
                AlertHistory.user_id == self.user_id,
                AlertHistory.item_id == item_id,
                AlertHistory.alert_type == alert_type,
                AlertHistory.status == AlertStatus.SENT.value,
                AlertHistory.sent_at >= cutoff,
            )
        )
        count = result.scalar_one()
        return count > 0

    async def create_alert_history(
        self,
        item_id: UUID,
        alert_type: str,
        channel: str,
        recipient_email: str,
        subject: str,
        item_quantity: int,
        item_min_quantity: int,
        status: str = AlertStatus.PENDING.value,
        error_message: str | None = None,
    ) -> AlertHistory:
        """Create an alert history record."""
        alert = AlertHistory(
            user_id=self.user_id,
            item_id=item_id,
            alert_type=alert_type,
            channel=channel,
            recipient_email=recipient_email,
            subject=subject,
            item_quantity_at_alert=item_quantity,
            item_min_quantity=item_min_quantity,
            status=status,
            error_message=error_message,
            sent_at=datetime.now(UTC),
        )
        self.session.add(alert)
        await self.session.commit()
        await self.session.refresh(alert)
        return alert

    async def update_alert_status(
        self,
        alert_id: UUID,
        status: str,
        error_message: str | None = None,
    ) -> AlertHistory | None:
        """Update the status of an alert history record."""
        result = await self.session.execute(
            select(AlertHistory).where(
                AlertHistory.id == alert_id,
                AlertHistory.user_id == self.user_id,
            )
        )
        alert = result.scalar_one_or_none()
        if alert:
            alert.status = status
            if error_message:
                alert.error_message = error_message
            await self.session.commit()
            await self.session.refresh(alert)
        return alert

    async def get_alert_history(
        self,
        alert_type: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[AlertHistory], int]:
        """Get paginated alert history for the current user."""
        offset = (page - 1) * limit

        # Base query
        base_query = select(AlertHistory).where(AlertHistory.user_id == self.user_id)
        count_query = select(func.count(AlertHistory.id)).where(
            AlertHistory.user_id == self.user_id
        )

        if alert_type:
            base_query = base_query.where(AlertHistory.alert_type == alert_type)
            count_query = count_query.where(AlertHistory.alert_type == alert_type)

        # Get total count
        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()

        # Get paginated results with item relationship
        result = await self.session.execute(
            base_query.options(selectinload(AlertHistory.item))
            .order_by(AlertHistory.sent_at.desc())
            .offset(offset)
            .limit(limit)
        )
        alerts = list(result.scalars().all())

        return alerts, total

    async def get_low_stock_items(
        self,
        item_ids: list[UUID] | None = None,
    ) -> list[Item]:
        """Get low stock items for the current user, optionally filtered by IDs."""
        query = select(Item).where(
            Item.user_id == self.user_id,
            Item.min_quantity.isnot(None),
            Item.quantity < Item.min_quantity,
        )

        if item_ids:
            query = query.where(Item.id.in_(item_ids))

        result = await self.session.execute(query)
        return list(result.scalars().all())
