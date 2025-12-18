"""Notification router for API endpoints."""

import logging

from fastapi import APIRouter, Query

from src.auth.dependencies import CurrentUserDep, CurrentUserIdDep
from src.common.schemas import PaginatedResponse
from src.database import AsyncSessionDep
from src.notifications.alert_service import AlertService
from src.notifications.repository import NotificationRepository
from src.notifications.schemas import (
    AlertHistoryResponse,
    LowStockAlertRequest,
    LowStockAlertResponse,
    NotificationPreferencesResponse,
    NotificationPreferencesUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/preferences")
async def get_notification_preferences(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> NotificationPreferencesResponse:
    """Get current user's notification preferences."""
    logger.info(f"GET /notifications/preferences called: user_id={user_id}")
    repo = NotificationRepository(session, user_id)
    prefs = await repo.get_or_create_preferences()
    logger.info(
        f"Returning preferences: user_id={user_id}, "
        f"email_enabled={prefs.email_notifications_enabled}, "
        f"low_stock_enabled={prefs.low_stock_email_enabled}"
    )
    return NotificationPreferencesResponse.model_validate(prefs)


@router.put("/preferences")
async def update_notification_preferences(
    data: NotificationPreferencesUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> NotificationPreferencesResponse:
    """Update notification preferences."""
    logger.info(
        f"PUT /notifications/preferences called: user_id={user_id}, data={data}"
    )
    repo = NotificationRepository(session, user_id)
    prefs = await repo.update_preferences(data)
    logger.info(
        f"Preferences updated: user_id={user_id}, "
        f"email_enabled={prefs.email_notifications_enabled}, "
        f"low_stock_enabled={prefs.low_stock_email_enabled}"
    )
    return NotificationPreferencesResponse.model_validate(prefs)


@router.post("/low-stock/trigger")
async def trigger_low_stock_alerts(
    session: AsyncSessionDep,
    user: CurrentUserDep,
    data: LowStockAlertRequest | None = None,
) -> LowStockAlertResponse:
    """Manually trigger low stock alerts for specified items or all low stock items.

    If item_ids is not provided, alerts will be sent for all items that are
    currently below their minimum quantity threshold and haven't been alerted
    in the last 24 hours.
    """
    item_ids = data.item_ids if data else None
    logger.info(
        f"POST /notifications/low-stock/trigger called: user_id={user.id}, "
        f"user_email={user.email}, item_ids={item_ids}"
    )
    alert_service = AlertService(session, user.id)
    result = await alert_service.trigger_low_stock_alerts(user, item_ids)
    logger.info(
        f"Low stock trigger complete: user_id={user.id}, "
        f"triggered={result.triggered_count}, skipped={result.skipped_count}, "
        f"failed={result.failed_count}"
    )
    return result


@router.get("/history")
async def get_alert_history(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    alert_type: str | None = Query(None, description="Filter by alert type"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[AlertHistoryResponse]:
    """Get alert history for the current user."""
    logger.info(
        f"GET /notifications/history called: user_id={user_id}, "
        f"alert_type={alert_type}, page={page}, limit={limit}"
    )
    repo = NotificationRepository(session, user_id)
    alerts, total = await repo.get_alert_history(
        alert_type=alert_type,
        page=page,
        limit=limit,
    )
    logger.info(
        f"Returning {len(alerts)} alerts (total: {total}) for user_id={user_id}"
    )

    # Build response with item names
    responses = []
    for alert in alerts:
        item_name = alert.item.name if alert.item else None
        response = AlertHistoryResponse(
            id=alert.id,
            item_id=alert.item_id,
            item_name=item_name,
            alert_type=alert.alert_type,
            channel=alert.channel,
            recipient_email=alert.recipient_email,
            subject=alert.subject,
            status=alert.status,
            error_message=alert.error_message,
            item_quantity_at_alert=alert.item_quantity_at_alert,
            item_min_quantity=alert.item_min_quantity,
            sent_at=alert.sent_at,
        )
        responses.append(response)

    return PaginatedResponse.create(responses, total, page, limit)
