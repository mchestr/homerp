from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, computed_field

from src.gridfinity.models import GridfinityUnit


class GridfinityUnitBase(BaseModel):
    """Base schema for Gridfinity storage unit."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=500)
    location_id: UUID | None = Field(
        None, description="Optional parent location for this storage unit"
    )
    container_width_mm: int = Field(..., gt=0, description="Container width in mm")
    container_depth_mm: int = Field(..., gt=0, description="Container depth in mm")
    container_height_mm: int = Field(..., gt=0, description="Container height in mm")


class GridfinityUnitCreate(GridfinityUnitBase):
    """Schema for creating a Gridfinity unit."""

    pass


class GridfinityUnitUpdate(BaseModel):
    """Schema for updating a Gridfinity unit."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=500)
    location_id: UUID | None = None
    container_width_mm: int | None = Field(None, gt=0)
    container_depth_mm: int | None = Field(None, gt=0)
    container_height_mm: int | None = Field(None, gt=0)


class GridfinityUnitResponse(GridfinityUnitBase):
    """Schema for Gridfinity unit responses."""

    id: UUID
    grid_columns: int
    grid_rows: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GridfinityUnitWithPlacementsResponse(GridfinityUnitResponse):
    """Schema for Gridfinity unit with all placements."""

    placements: list["GridfinityPlacementResponse"] = Field(default_factory=list)


# Placement schemas


class GridfinityPlacementBase(BaseModel):
    """Base schema for item placement in a Gridfinity unit."""

    grid_x: int = Field(..., ge=0, description="Grid column position (0-indexed)")
    grid_y: int = Field(..., ge=0, description="Grid row position (0-indexed)")
    width_units: int = Field(1, gt=0, description="Width in grid units")
    depth_units: int = Field(1, gt=0, description="Depth in grid units")
    bin_height_units: int | None = Field(
        None, gt=0, description="Bin height in 7mm units"
    )
    notes: str | None = Field(None, max_length=500)


class GridfinityPlacementCreate(GridfinityPlacementBase):
    """Schema for creating a placement."""

    item_id: UUID


class GridfinityPlacementUpdate(BaseModel):
    """Schema for updating a placement."""

    grid_x: int | None = Field(None, ge=0)
    grid_y: int | None = Field(None, ge=0)
    width_units: int | None = Field(None, gt=0)
    depth_units: int | None = Field(None, gt=0)
    bin_height_units: int | None = Field(None, gt=0)
    notes: str | None = Field(None, max_length=500)


class GridfinityPlacementResponse(GridfinityPlacementBase):
    """Schema for placement responses."""

    id: UUID
    unit_id: UUID
    item_id: UUID
    created_at: datetime

    @computed_field
    @property
    def position_code(self) -> str:
        """Generate human-readable position code like 'A1'."""
        column_letter = chr(ord("A") + self.grid_x)
        row_number = self.grid_y + 1
        return f"{column_letter}{row_number}"

    model_config = {"from_attributes": True}


class GridfinityPlacementWithItemResponse(GridfinityPlacementResponse):
    """Placement response with item details."""

    item_name: str
    item_image_url: str | None = None


# Bin recommendation schemas


class BinRecommendation(BaseModel):
    """Recommended bin size for an item."""

    item_id: UUID
    item_name: str
    recommended_width_units: int
    recommended_depth_units: int
    recommended_height_units: int | None = None
    reasoning: str


class BinRecommendationRequest(BaseModel):
    """Request for bin size recommendations."""

    item_ids: list[UUID] = Field(..., min_length=1)


class BinRecommendationResponse(BaseModel):
    """Response with bin recommendations for items."""

    recommendations: list[BinRecommendation]


# Auto-layout schemas


class AutoLayoutRequest(BaseModel):
    """Request for automatic item layout."""

    item_ids: list[UUID] = Field(
        ..., min_length=1, description="Items to auto-layout in the unit"
    )


class AutoLayoutPlacement(BaseModel):
    """A placement result from auto-layout."""

    item_id: UUID
    grid_x: int
    grid_y: int
    width_units: int
    depth_units: int


class AutoLayoutResult(BaseModel):
    """Result of auto-layout operation."""

    placed: list[AutoLayoutPlacement]
    unplaced: list[UUID] = Field(
        default_factory=list, description="Items that couldn't fit"
    )
    utilization_percent: float = Field(
        ..., ge=0, le=100, description="Grid utilization percentage"
    )


# Grid calculation helper


class GridCalculation(BaseModel):
    """Result of grid size calculation."""

    columns: int
    rows: int
    total_cells: int
    wasted_width_mm: int
    wasted_depth_mm: int

    @classmethod
    def from_dimensions(cls, width_mm: int, depth_mm: int) -> "GridCalculation":
        """Calculate grid size from container dimensions."""
        unit_size = GridfinityUnit.GRID_UNIT_SIZE_MM
        columns = width_mm // unit_size
        rows = depth_mm // unit_size
        columns = max(1, columns)
        rows = max(1, rows)

        wasted_width = width_mm - (columns * unit_size)
        wasted_depth = depth_mm - (rows * unit_size)

        return cls(
            columns=columns,
            rows=rows,
            total_cells=columns * rows,
            wasted_width_mm=wasted_width,
            wasted_depth_mm=wasted_depth,
        )


# Update forward references
GridfinityUnitWithPlacementsResponse.model_rebuild()
