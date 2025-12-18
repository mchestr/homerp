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
        logger.info(
            f"Checking low stock alert: item_id={item.id}, item_name={item.name}, "
            f"quantity={item.quantity}, min_quantity={item.min_quantity}, "
            f"is_low_stock={item.is_low_stock}, user_id={self.user_id}"
        )

        if not item.is_low_stock:
            logger.info(
                f"Item not low stock, skipping alert: item_id={item.id}, "
                f"quantity={item.quantity}, min_quantity={item.min_quantity}"
            )
            return

        # Check user preferences
        prefs = await self.repository.get_or_create_preferences()
        logger.info(
            f"User notification preferences: user_id={self.user_id}, "
            f"email_enabled={prefs.email_notifications_enabled}, "
            f"low_stock_enabled={prefs.low_stock_email_enabled}"
        )

        if not prefs.email_notifications_enabled or not prefs.low_stock_email_enabled:
            logger.info(
                f"Skipping alert - notifications disabled: item_id={item.id}, "
                f"user_id={self.user_id}, email_enabled={prefs.email_notifications_enabled}, "
                f"low_stock_enabled={prefs.low_stock_email_enabled}"
            )
            return

        # Check deduplication (24-hour window)
        if await self.repository.was_alerted_recently(item.id, "low_stock"):
            logger.info(
                f"Skipping alert - already alerted within 24 hours: "
                f"item_id={item.id}, user_id={self.user_id}"
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
        logger.info(
            f"Queued low stock alert background task: item_id={item.id}, "
            f"item_name={item.name}, user_email={user.email}, user_id={self.user_id}"
        )

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

        logger.info(
            f"Background task started: sending low stock email for item_id={item_id}, "
            f"item_name={item_name}, user_email={user_email}, user_id={self.user_id}"
        )

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
                logger.info(f"Rendering email templates for item_id={item_id}")
                html_body = self._render_template("low_stock_alert.html", **context)
                text_body = self._render_template("low_stock_alert.txt", **context)

                subject = f"Low Stock Alert: {item_name}"

                # Create alert history record (pending)
                logger.info(
                    f"Creating alert history record: item_id={item_id}, "
                    f"recipient={user_email}, status=PENDING"
                )
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
                logger.info(f"Alert history record created: alert_id={alert.id}")

                # Send email
                logger.info(
                    f"Sending email via EmailService: to={user_email}, "
                    f"subject={subject}, item_id={item_id}"
                )
                success = await self.email_service.send_email(
                    to_email=user_email,
                    subject=subject,
                    html_body=html_body,
                    text_body=text_body,
                )

                # Update alert status
                if success:
                    await repo.update_alert_status(alert.id, AlertStatus.SENT.value)
                    logger.info(
                        f"Low stock alert sent successfully: item_id={item_id}, "
                        f"alert_id={alert.id}, recipient={user_email}"
                    )
                else:
                    await repo.update_alert_status(
                        alert.id, AlertStatus.FAILED.value, "Email send failed"
                    )
                    logger.error(
                        f"Failed to send low stock alert: item_id={item_id}, "
                        f"alert_id={alert.id}, recipient={user_email} - "
                        f"EmailService.send_email returned False"
                    )

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
        logger.info(
            f"Manual trigger_low_stock_alerts called: user_id={self.user_id}, "
            f"item_ids={item_ids}"
        )

        # Check user preferences
        prefs = await self.repository.get_or_create_preferences()
        logger.info(
            f"User preferences for manual trigger: user_id={self.user_id}, "
            f"email_enabled={prefs.email_notifications_enabled}"
        )

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
        logger.info(
            f"Found {len(items)} low stock items for manual trigger: user_id={self.user_id}"
        )

        if not items:
            logger.info(f"No low stock items to alert: user_id={self.user_id}")
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
            logger.info(
                f"Processing manual alert for item: item_id={item.id}, "
                f"item_name={item.name}, quantity={item.quantity}, "
                f"min_quantity={item.min_quantity}"
            )

            # Check deduplication
            if await self.repository.was_alerted_recently(item.id, "low_stock"):
                logger.info(
                    f"Skipping - recently alerted: item_id={item.id}, user_id={self.user_id}"
                )
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
                logger.info(f"Sending sync alert for item: item_id={item.id}")
                await self._send_low_stock_alert_sync(item, user)
                triggered_count += 1
                logger.info(f"Successfully sent alert for item: item_id={item.id}")
                item_summaries.append(
                    AlertedItemSummary(
                        item_id=item.id,
                        item_name=item.name,
                        status="sent",
                    )
                )
            except Exception as e:
                failed_count += 1
                logger.error(
                    f"Failed to send manual alert: item_id={item.id}, error={e}",
                    exc_info=True,
                )
                item_summaries.append(
                    AlertedItemSummary(
                        item_id=item.id,
                        item_name=item.name,
                        status="failed",
                        message=str(e),
                    )
                )

        logger.info(
            f"Manual trigger complete: user_id={self.user_id}, "
            f"triggered={triggered_count}, skipped={skipped_count}, failed={failed_count}"
        )
        return LowStockAlertResponse(
            triggered_count=triggered_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
            items=item_summaries,
        )

    async def _send_low_stock_alert_sync(self, item: Item, user: User) -> None:
        """Send a low stock alert synchronously (for manual triggers)."""
        logger.info(
            f"Sending sync low stock alert: item_id={item.id}, "
            f"item_name={item.name}, user_email={user.email}"
        )

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
        logger.info(
            f"Creating alert history (sync): item_id={item.id}, recipient={user.email}"
        )
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
        logger.info(f"Alert history created (sync): alert_id={alert.id}")

        # Send email
        logger.info(
            f"Calling EmailService.send_email (sync): to={user.email}, item_id={item.id}"
        )
        success = await self.email_service.send_email(
            to_email=user.email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

        if success:
            await self.repository.update_alert_status(alert.id, AlertStatus.SENT.value)
            logger.info(
                f"Sync alert sent successfully: item_id={item.id}, alert_id={alert.id}"
            )
        else:
            await self.repository.update_alert_status(
                alert.id, AlertStatus.FAILED.value, "Email send failed"
            )
            logger.error(
                f"Sync alert failed - EmailService returned False: "
                f"item_id={item.id}, alert_id={alert.id}"
            )
            raise RuntimeError("Failed to send email")


def get_alert_service(
    session: AsyncSession,
    user_id: UUID,
    settings: Settings | None = None,
) -> AlertService:
    """Factory for AlertService."""
    return AlertService(session, user_id, settings)
