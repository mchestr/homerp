"""AI usage tracking models."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
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


class AIModelSettings(Base):
    """AI model settings - configurable parameters for each operation type."""

    __tablename__ = "ai_model_settings"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    operation_type: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    temperature: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False, default=Decimal("1.0"), server_default="1.0"
    )
    max_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AIConversationSession(Base):
    """AI conversation session for persistent chat history."""

    __tablename__ = "ai_conversation_sessions"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="ai_sessions")
    messages: Mapped[list["AIConversationMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AIConversationMessage.created_at",
    )


class AIConversationMessage(Base):
    """Individual message in an AI conversation."""

    __tablename__ = "ai_conversation_messages"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("ai_conversation_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'user', 'assistant', 'tool'
    content: Mapped[str | None] = mapped_column(
        String(50000)
    )  # Nullable for tool calls
    tool_calls: Mapped[dict | None] = mapped_column(
        JSONB
    )  # OpenAI tool_calls structure
    tool_call_id: Mapped[str | None] = mapped_column(String(100))  # For tool responses
    tool_name: Mapped[str | None] = mapped_column(String(100))  # Name of tool called
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationships
    session: Mapped["AIConversationSession"] = relationship(back_populates="messages")


# Import at bottom to avoid circular imports
from src.billing.models import CreditTransaction  # noqa: E402
from src.users.models import User  # noqa: E402
