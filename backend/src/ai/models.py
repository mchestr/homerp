"""AI usage tracking models."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class AIUsageLog(Base):
    """AI usage log - tracks token usage for all AI operations."""

    __tablename__ = "ai_usage_logs"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credit_transaction_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("credit_transactions.id", ondelete="SET NULL"), index=True
    )
    operation_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 'image_classification', 'location_analysis', 'assistant_query', 'location_suggestion'
    model: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # 'gpt-4o', 'gpt-4-vision-preview', etc.
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 6), nullable=False
    )  # Cost in USD with 6 decimal precision
    request_metadata: Mapped[dict | None] = mapped_column(
        JSONB
    )  # Operation-specific data (image count, context size, etc.)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="ai_usage_logs")
    credit_transaction: Mapped["CreditTransaction | None"] = relationship(
        back_populates="ai_usage_log"
    )


# Import at bottom to avoid circular imports
from src.billing.models import CreditTransaction  # noqa: E402
from src.users.models import User  # noqa: E402
