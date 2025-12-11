from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class Item(Base):
    """Item model - core inventory entity."""

    __tablename__ = "items"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    location_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    quantity_unit: Mapped[str] = mapped_column(String(50), default="pcs")
    min_quantity: Mapped[int | None] = mapped_column(Integer)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    attributes: Mapped[dict] = mapped_column(JSONB, default=dict)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(100)), default=list)
    ai_classification: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="items")
    category: Mapped["Category | None"] = relationship(back_populates="items")
    location: Mapped["Location | None"] = relationship(back_populates="items")
    images: Mapped[list["Image"]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )

    @property
    def is_low_stock(self) -> bool:
        """Check if item is below minimum quantity threshold."""
        if self.min_quantity is None:
            return False
        return self.quantity < self.min_quantity


# Import at bottom to avoid circular imports
from src.categories.models import Category  # noqa: E402, F811
from src.images.models import Image  # noqa: E402, F811
from src.locations.models import Location  # noqa: E402, F811
from src.users.models import User  # noqa: E402, F811
