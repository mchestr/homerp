from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class UserSystemProfile(Base):
    """User system profile for AI-powered recommendations."""

    __tablename__ = "user_system_profiles"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    # Hobby/interest types - what kind of hobbyist are they?
    # e.g., ["electronics", "woodworking", "3d_printing"]
    hobby_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)), default=list, server_default="{}"
    )

    # Interest categories - category IDs user cares about most
    interest_category_ids: Mapped[list[UUID]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)), default=list, server_default="{}"
    )

    # Retention preferences
    retention_months: Mapped[int] = mapped_column(
        Integer, default=12, server_default="12"
    )  # Default: consider purging items unused for 12 months

    min_quantity_threshold: Mapped[int] = mapped_column(
        Integer, default=5, server_default="5"
    )  # Consider purging if quantity exceeds this

    min_value_keep: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )  # Keep items worth more than this regardless of usage

    # Additional preferences
    profile_description: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )  # Free text to help AI understand user context

    purge_aggressiveness: Mapped[str] = mapped_column(
        String(20), default="moderate", server_default="'moderate'"
    )  # 'conservative', 'moderate', 'aggressive'

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="system_profile")


class PurgeRecommendation(Base):
    """AI-generated purge recommendations for items."""

    __tablename__ = "purge_recommendations"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # AI-generated recommendation
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False
    )  # 0.00 to 1.00

    # Additional context from AI
    factors: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="'pending'"
    )  # 'pending', 'accepted', 'dismissed', 'expired'

    # User feedback (for ML improvement)
    user_feedback: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="purge_recommendations")
    item: Mapped["Item"] = relationship(back_populates="purge_recommendations")


# Import at bottom to avoid circular imports
from src.items.models import Item  # noqa: E402, F811
from src.users.models import User  # noqa: E402, F811
