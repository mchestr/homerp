"""Alert service for managing and sending low stock alerts."""

import logging
from pathlib import Path
from uuid import UUID

from fastapi import BackgroundTasks
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import Settings, get_settings
from src.items.models import Item
from src.notifications.email_service import EmailService
from src.notifications.models import AlertStatus
from src.notifications.repository import NotificationRepository
from src.notifications.schemas import AlertedItemSummary, LowStockAlertResponse
from src.users.models import User

logger = logging.getLogger(__name__)

# Template directory
TEMPLATE_DIR = Path(__file__).parent / "templates"


class AlertService:
    """Service for managing and sending alerts."""

    def __init__(
        self,
        session: AsyncSession,
        user_id: UUID,
        settings: Settings | None = None,
    ):
        self.session = session
        self.user_id = user_id
        self.settings = settings or get_settings()
        self.repository = NotificationRepository(session, user_id)
        self.email_service = EmailService(self.settings)

        # Initialize Jinja2 template environment
        self.template_env = Environment(
            loader=FileSystemLoader(TEMPLATE_DIR),
            autoescape=True,
        )

    def _render_template(
        self,
        template_name: str,
        **context,
    ) -> str:
        """Render a Jinja2 template with the given context."""
        template = self.template_env.get_template(template_name)
        return template.render(**context)

    def _build_item_url(self, item_id: UUID) -> str:
        """Build URL to view an item in the frontend."""
        return f"{self.settings.frontend_url}/items/{item_id}"

    def _build_preferences_url(self) -> str:
        """Build URL to notification preferences page."""
        return f"{self.settings.frontend_url}/settings/notifications"

    async def check_and_send_low_stock_alert(
        self,
        item: Item,
        user: User,
        background_tasks: BackgroundTasks,
    ) -> None:
        """Check if item is low stock and queue alert if needed.

        This method is called after a check-out to trigger automatic alerts.
        It queues the alert in the background to not block the API response.
        """
        if not item.is_low_stock:
            return

        # Check user preferences
        prefs = await self.repository.get_or_create_preferences()
        if not prefs.email_notifications_enabled or not prefs.low_stock_email_enabled:
            logger.debug(f"Skipping alert for item {item.id}: notifications disabled")
            return

        # Check deduplication (24-hour window)
        if await self.repository.was_alerted_recently(item.id, "low_stock"):
            logger.debug(
                f"Skipping alert for item {item.id}: already alerted within 24 hours"
            )
            return

        # Queue the email send in background
        background_tasks.add_task(
            self._send_low_stock_email,
            item_id=item.id,
            item_name=item.name,
            item_quantity=item.quantity,
            item_quantity_unit=item.quantity_unit,
            item_min_quantity=item.min_quantity,
            user_email=user.email,
            user_name=user.name or user.email.split("@")[0],
        )
        logger.info(f"Queued low stock alert for item {item.id}")

    async def _send_low_stock_email(
        self,
        item_id: UUID,
        item_name: str,
        item_quantity: int,
        item_quantity_unit: str,
        item_min_quantity: int,
        user_email: str,
        user_name: str,
    ) -> None:
        """Background task to send low stock email.

        Creates a new session for the background task.
        """
        from src.database import get_session

        async for session in get_session():
            try:
                repo = NotificationRepository(session, self.user_id)

                # Create template context
                context = {
                    "user_name": user_name,
                    "item_name": item_name,
                    "item_quantity": item_quantity,
                    "item_quantity_unit": item_quantity_unit,
                    "item_min_quantity": item_min_quantity,
                    "item_url": self._build_item_url(item_id),
                    "preferences_url": self._build_preferences_url(),
                }

                # Render templates
                html_body = self._render_template("low_stock_alert.html", **context)
                text_body = self._render_template("low_stock_alert.txt", **context)

                subject = f"Low Stock Alert: {item_name}"

                # Create alert history record (pending)
                alert = await repo.create_alert_history(
                    item_id=item_id,
                    alert_type="low_stock",
                    channel="email",
                    recipient_email=user_email,
                    subject=subject,
                    item_quantity=item_quantity,
                    item_min_quantity=item_min_quantity,
                    status=AlertStatus.PENDING.value,
                )

                # Send email
                success = await self.email_service.send_email(
                    to_email=user_email,
                    subject=subject,
                    html_body=html_body,
                    text_body=text_body,
                )

                # Update alert status
                if success:
                    await repo.update_alert_status(alert.id, AlertStatus.SENT.value)
                    logger.info(f"Low stock alert sent for item {item_id}")
                else:
                    await repo.update_alert_status(
                        alert.id, AlertStatus.FAILED.value, "Email send failed"
                    )
                    logger.error(f"Failed to send low stock alert for item {item_id}")

            except Exception as e:
                # Provide specific logging for common failure scenarios
                error_type = type(e).__name__
                if "user" in str(e).lower() or "User" in str(e):
                    logger.error(
                        f"Background alert failed for item {item_id}: "
                        f"user {self.user_id} may have been deleted. {error_type}: {e}"
                    )
                elif "item" in str(e).lower() or "Item" in str(e):
                    logger.error(
                        f"Background alert failed: item {item_id} may have been deleted. "
                        f"{error_type}: {e}"
                    )
                else:
                    logger.error(
                        f"Background low stock alert failed for item {item_id}: "
                        f"{error_type}: {e}",
                        exc_info=True,
                    )

    async def trigger_low_stock_alerts(
        self,
        user: User,
        item_ids: list[UUID] | None = None,
    ) -> LowStockAlertResponse:
        """Manually trigger low stock alerts for specified items or all low stock items.

        Args:
            user: The user to send alerts to
            item_ids: Specific item IDs, or None for all low stock items

        Returns:
            Summary of triggered alerts
        """
        # Check user preferences
        prefs = await self.repository.get_or_create_preferences()
        if not prefs.email_notifications_enabled:
            return LowStockAlertResponse(
                triggered_count=0,
                skipped_count=0,
                failed_count=0,
                items=[
                    AlertedItemSummary(
                        item_id=None,
                        item_name="N/A",
                        status="skipped_disabled",
                        message="Email notifications are disabled",
                    )
                ],
            )

        # Get low stock items
        items = await self.repository.get_low_stock_items(item_ids)

        if not items:
            return LowStockAlertResponse(
                triggered_count=0,
                skipped_count=0,
                failed_count=0,
                items=[],
            )

        triggered_count = 0
        skipped_count = 0
        failed_count = 0
        item_summaries: list[AlertedItemSummary] = []

        for item in items:
            # Check deduplication
            if await self.repository.was_alerted_recently(item.id, "low_stock"):
                skipped_count += 1
                item_summaries.append(
                    AlertedItemSummary(
                        item_id=item.id,
                        item_name=item.name,
                        status="skipped_recent",
                        message="Alert sent within last 24 hours",
                    )
                )
                continue

            # Send alert immediately (not in background for manual trigger)
            try:
                await self._send_low_stock_alert_sync(item, user)
                triggered_count += 1
                item_summaries.append(
                    AlertedItemSummary(
                        item_id=item.id,
                        item_name=item.name,
                        status="sent",
                    )
                )
            except Exception as e:
                failed_count += 1
                item_summaries.append(
                    AlertedItemSummary(
                        item_id=item.id,
                        item_name=item.name,
                        status="failed",
                        message=str(e),
                    )
                )

        return LowStockAlertResponse(
            triggered_count=triggered_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
            items=item_summaries,
        )

    async def _send_low_stock_alert_sync(self, item: Item, user: User) -> None:
        """Send a low stock alert synchronously (for manual triggers)."""
        context = {
            "user_name": user.name or user.email.split("@")[0],
            "item_name": item.name,
            "item_quantity": item.quantity,
            "item_quantity_unit": item.quantity_unit,
            "item_min_quantity": item.min_quantity,
            "item_url": self._build_item_url(item.id),
            "preferences_url": self._build_preferences_url(),
        }

        html_body = self._render_template("low_stock_alert.html", **context)
        text_body = self._render_template("low_stock_alert.txt", **context)

        subject = f"Low Stock Alert: {item.name}"

        # Create alert history record
        alert = await self.repository.create_alert_history(
            item_id=item.id,
            alert_type="low_stock",
            channel="email",
            recipient_email=user.email,
            subject=subject,
            item_quantity=item.quantity,
            item_min_quantity=item.min_quantity,
            status=AlertStatus.PENDING.value,
        )

        # Send email
        success = await self.email_service.send_email(
            to_email=user.email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

        if success:
            await self.repository.update_alert_status(alert.id, AlertStatus.SENT.value)
        else:
            await self.repository.update_alert_status(
                alert.id, AlertStatus.FAILED.value, "Email send failed"
            )
            raise RuntimeError("Failed to send email")


def get_alert_service(
    session: AsyncSession,
    user_id: UUID,
    settings: Settings | None = None,
) -> AlertService:
    """Factory for AlertService."""
    return AlertService(session, user_id, settings)
