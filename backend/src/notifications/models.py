"""Notification models for preferences and alert history."""

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class AlertStatus(str, enum.Enum):
    """Valid status values for alert history."""

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class NotificationPreferences(Base):
    """Per-user notification preferences."""

    __tablename__ = "notification_preferences"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    # Master switch for email notifications
    email_notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )

    # Low stock email preferences
    low_stock_email_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="notification_preferences")


class AlertHistory(Base):
    """Track sent alerts for deduplication and audit."""

    __tablename__ = "alert_history"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Alert type (low_stock for now, extensible)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Channel (email for now, extensible)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)

    # Recipient details
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)

    # Status tracking (see AlertStatus enum for valid values)
    status: Mapped[str] = mapped_column(
        String(20), default=AlertStatus.PENDING.value, server_default="'pending'"
    )
    error_message: Mapped[str | None] = mapped_column(String(1000))

    # Snapshot of item state at alert time
    item_quantity_at_alert: Mapped[int] = mapped_column(Integer, nullable=False)
    item_min_quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    # Timestamps
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="alert_history")
    item: Mapped["Item"] = relationship(back_populates="alert_history")


# Import at bottom to avoid circular imports
from src.items.models import Item  # noqa: E402
from src.users.models import User  # noqa: E402
