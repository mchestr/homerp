from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy_utils import LtreeType

from src.database import Base


class Location(Base):
    """Location model for tracking where items are stored with hierarchical support."""

    __tablename__ = "locations"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    location_type: Mapped[str | None] = mapped_column(
        String(50)
    )  # room, shelf, bin, drawer, box

    # Hierarchy support
    parent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    path: Mapped[str] = mapped_column(LtreeType, nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship(back_populates="locations")
    items: Mapped[list["Item"]] = relationship(back_populates="location")
    parent: Mapped["Location | None"] = relationship(
        "Location",
        remote_side=[id],
        back_populates="children",
        foreign_keys=[parent_id],
    )
    children: Mapped[list["Location"]] = relationship(
        "Location",
        back_populates="parent",
        foreign_keys=[parent_id],
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_location_user_name"),
    )


# Import at bottom to avoid circular imports
from src.items.models import Item  # noqa: E402, F811
from src.users.models import User  # noqa: E402, F811
