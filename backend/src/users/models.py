from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class User(Base):
    """User model - tenant root for multi-tenancy."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    oauth_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    oauth_id: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    # Billing fields
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255))
    credit_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    free_credits_remaining: Mapped[int] = mapped_column(Integer, default=5, server_default="5")
    free_credits_reset_at: Mapped[datetime | None] = mapped_column()

    # Admin
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Relationships
    items: Mapped[list["Item"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    categories: Mapped[list["Category"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    locations: Mapped[list["Location"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    images: Mapped[list["Image"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        # Unique constraint on oauth_provider + oauth_id
        {"sqlite_autoincrement": True},
    )


# Import at bottom to avoid circular imports
from src.billing.models import CreditTransaction  # noqa: E402
from src.categories.models import Category  # noqa: E402
from src.images.models import Image  # noqa: E402
from src.items.models import Item  # noqa: E402
from src.locations.models import Location  # noqa: E402
