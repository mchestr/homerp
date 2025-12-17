"""Notification schemas for request/response models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# Notification Preferences Schemas
class NotificationPreferencesResponse(BaseModel):
    """Response schema for notification preferences."""

    email_notifications_enabled: bool
    low_stock_email_enabled: bool

    model_config = {"from_attributes": True}


class NotificationPreferencesUpdate(BaseModel):
    """Schema for updating notification preferences."""

    email_notifications_enabled: bool | None = None
    low_stock_email_enabled: bool | None = None


# Alert Trigger Schemas
class LowStockAlertRequest(BaseModel):
    """Request to trigger low stock alerts."""

    item_ids: list[UUID] | None = Field(
        None,
        description="Specific item IDs to trigger alerts for. None = all low stock items",
    )


class AlertedItemSummary(BaseModel):
    """Summary of an item that was alerted."""

    item_id: UUID
    item_name: str
    status: str  # 'sent', 'skipped_recent', 'skipped_disabled', 'failed'
    message: str | None = None


class LowStockAlertResponse(BaseModel):
    """Response from triggering low stock alerts."""

    triggered_count: int
    skipped_count: int
    failed_count: int
    items: list[AlertedItemSummary]


# Alert History Schemas
class AlertHistoryResponse(BaseModel):
    """Response schema for alert history entry."""

    id: UUID
    item_id: UUID
    item_name: str | None = None
    alert_type: str
    channel: str
    recipient_email: str
    subject: str
    status: str
    error_message: str | None
    item_quantity_at_alert: int
    item_min_quantity: int
    sent_at: datetime

    model_config = {"from_attributes": True}
