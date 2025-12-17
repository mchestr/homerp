"""Notification router for API endpoints."""

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

router = APIRouter()


@router.get("/preferences")
async def get_notification_preferences(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> NotificationPreferencesResponse:
    """Get current user's notification preferences."""
    repo = NotificationRepository(session, user_id)
    prefs = await repo.get_or_create_preferences()
    return NotificationPreferencesResponse.model_validate(prefs)


@router.put("/preferences")
async def update_notification_preferences(
    data: NotificationPreferencesUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> NotificationPreferencesResponse:
    """Update notification preferences."""
    repo = NotificationRepository(session, user_id)
    prefs = await repo.update_preferences(data)
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
    alert_service = AlertService(session, user.id)
    item_ids = data.item_ids if data else None
    return await alert_service.trigger_low_stock_alerts(user, item_ids)


@router.get("/history")
async def get_alert_history(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    alert_type: str | None = Query(None, description="Filter by alert type"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[AlertHistoryResponse]:
    """Get alert history for the current user."""
    repo = NotificationRepository(session, user_id)
    alerts, total = await repo.get_alert_history(
        alert_type=alert_type,
        page=page,
        limit=limit,
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
