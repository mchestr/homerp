from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class WebhookConfig(Base):
    """Webhook configuration for system events."""

    __tablename__ = "webhook_configs"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    event_type: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    http_method: Mapped[str] = mapped_column(
        String(10), nullable=False, default="POST"
    )
    headers: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    body_template: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    retry_count: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    timeout_seconds: Mapped[int] = mapped_column(
        Integer, default=30, server_default="30"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    executions: Mapped[list["WebhookExecution"]] = relationship(
        back_populates="webhook_config", cascade="all, delete-orphan"
    )


class WebhookExecution(Base):
    """Webhook execution log entry."""

    __tablename__ = "webhook_executions"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    webhook_config_id: Mapped[UUID] = mapped_column(
        ForeignKey("webhook_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    event_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    request_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    request_headers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    request_body: Mapped[str] = mapped_column(Text, nullable=False)
    response_status: Mapped[int | None] = mapped_column(Integer)
    response_body: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True, default="pending"
    )
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    error_message: Mapped[str | None] = mapped_column(Text)
    executed_at: Mapped[datetime] = mapped_column(server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column()

    # Relationships
    webhook_config: Mapped[WebhookConfig] = relationship(back_populates="executions")
