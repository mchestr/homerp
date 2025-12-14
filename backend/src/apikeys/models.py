"""API Key database models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class ApiKey(Base):
    """API Key model for external system authentication."""

    __tablename__ = "api_keys"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    key_prefix: Mapped[str] = mapped_column(String(8), nullable=False)
    scopes: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="api_keys")


# Import at bottom to avoid circular imports
from src.users.models import User  # noqa: E402, F811
