from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class GridfinityUnit(Base):
    """Gridfinity storage unit model for planning physical storage layouts."""

    __tablename__ = "gridfinity_units"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))

    # Container dimensions in mm
    container_width_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    container_depth_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    container_height_mm: Mapped[int] = mapped_column(Integer, nullable=False)

    # Calculated grid size (standard Gridfinity unit = 42mm)
    grid_columns: Mapped[int] = mapped_column(Integer, nullable=False)
    grid_rows: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="gridfinity_units")
    location: Mapped["Location | None"] = relationship(
        back_populates="gridfinity_units"
    )
    placements: Mapped[list["GridfinityPlacement"]] = relationship(
        back_populates="unit", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_gridfinity_unit_user_name"),
    )

    # Standard Gridfinity unit size in mm
    GRID_UNIT_SIZE_MM = 42

    @classmethod
    def calculate_grid_size(cls, width_mm: int, depth_mm: int) -> tuple[int, int]:
        """Calculate grid columns and rows from container dimensions."""
        columns = width_mm // cls.GRID_UNIT_SIZE_MM
        rows = depth_mm // cls.GRID_UNIT_SIZE_MM
        return max(1, columns), max(1, rows)


class GridfinityPlacement(Base):
    """Placement of an item within a Gridfinity unit."""

    __tablename__ = "gridfinity_placements"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    unit_id: Mapped[UUID] = mapped_column(
        ForeignKey("gridfinity_units.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Grid position (0-indexed from top-left)
    grid_x: Mapped[int] = mapped_column(Integer, nullable=False)
    grid_y: Mapped[int] = mapped_column(Integer, nullable=False)

    # Size in grid units (1x1, 2x1, etc.)
    width_units: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    depth_units: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Optional bin info
    bin_height_units: Mapped[int | None] = mapped_column(Integer)  # Height in 7mm units
    notes: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship()
    unit: Mapped["GridfinityUnit"] = relationship(back_populates="placements")
    item: Mapped["Item"] = relationship(back_populates="gridfinity_placements")

    __table_args__ = (
        # Ensure item only placed once per unit
        UniqueConstraint("unit_id", "item_id", name="uq_placement_unit_item"),
        # Ensure position is valid
        CheckConstraint("grid_x >= 0", name="chk_position_x_positive"),
        CheckConstraint("grid_y >= 0", name="chk_position_y_positive"),
        CheckConstraint("width_units > 0", name="chk_width_positive"),
        CheckConstraint("depth_units > 0", name="chk_depth_positive"),
    )

    @property
    def position_code(self) -> str:
        """Generate a human-readable position code like 'A1' for grid position."""
        # Convert x to letter (0=A, 1=B, etc.)
        column_letter = chr(ord("A") + self.grid_x)
        # Row is 1-indexed
        row_number = self.grid_y + 1
        return f"{column_letter}{row_number}"


# Import at bottom to avoid circular imports
from src.items.models import Item  # noqa: E402, F811
from src.locations.models import Location  # noqa: E402, F811
from src.users.models import User  # noqa: E402, F811
