from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class User(Base):
    """User model - tenant root for multi-tenancy."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    oauth_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    oauth_id: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Billing fields
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255))
    credit_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    free_credits_remaining: Mapped[int] = mapped_column(
        Integer, default=5, server_default="5"
    )
    free_credits_reset_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    # Admin
    is_admin: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )

    # User preferences
    currency: Mapped[str] = mapped_column(
        String(3), default="USD", server_default="USD"
    )
    language: Mapped[str] = mapped_column(String(5), default="en", server_default="en")

    # Relationships
    items: Mapped[list["Item"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    categories: Mapped[list["Category"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    locations: Mapped[list["Location"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    images: Mapped[list["Image"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    feedback: Mapped[list["Feedback"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    check_in_outs: Mapped[list["ItemCheckInOut"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    system_profile: Mapped["UserSystemProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    purge_recommendations: Mapped[list["PurgeRecommendation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    api_keys: Mapped[list["ApiKey"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    gridfinity_units: Mapped[list["GridfinityUnit"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    ai_usage_logs: Mapped[list["AIUsageLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    notification_preferences: Mapped["NotificationPreferences | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    alert_history: Mapped[list["AlertHistory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    # Collaboration relationships
    owned_collaborations: Mapped[list["InventoryCollaborator"]] = relationship(
        "InventoryCollaborator",
        foreign_keys="InventoryCollaborator.owner_id",
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    shared_inventories: Mapped[list["InventoryCollaborator"]] = relationship(
        "InventoryCollaborator",
        foreign_keys="InventoryCollaborator.collaborator_id",
        back_populates="collaborator",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        # Unique constraint on oauth_provider + oauth_id
        {"sqlite_autoincrement": True},
    )


# Import at bottom to avoid circular imports
from src.ai.models import AIUsageLog  # noqa: E402
from src.apikeys.models import ApiKey  # noqa: E402
from src.billing.models import CreditTransaction  # noqa: E402
from src.categories.models import Category  # noqa: E402
from src.collaboration.models import InventoryCollaborator  # noqa: E402
from src.feedback.models import Feedback  # noqa: E402
from src.gridfinity.models import GridfinityUnit  # noqa: E402
from src.images.models import Image  # noqa: E402
from src.items.models import Item, ItemCheckInOut  # noqa: E402
from src.locations.models import Location  # noqa: E402
from src.notifications.models import AlertHistory, NotificationPreferences  # noqa: E402
from src.profile.models import PurgeRecommendation, UserSystemProfile  # noqa: E402
