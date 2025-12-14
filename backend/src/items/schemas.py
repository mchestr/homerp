from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from src.categories.schemas import CategoryResponse
from src.locations.schemas import LocationResponse


class ItemBase(BaseModel):
    """Base item schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    category_id: UUID | None = None
    location_id: UUID | None = None
    quantity: int = Field(1, ge=0)
    quantity_unit: str = Field("pcs", max_length=50)
    min_quantity: int | None = Field(None, ge=0)
    price: Decimal | None = Field(None, ge=0, decimal_places=2)
    attributes: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class ItemCreate(ItemBase):
    """Schema for creating an item."""

    image_ids: list[UUID] | None = None


class ItemUpdate(BaseModel):
    """Schema for updating an item."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    category_id: UUID | None = None
    location_id: UUID | None = None
    quantity: int | None = Field(None, ge=0)
    quantity_unit: str | None = Field(None, max_length=50)
    min_quantity: int | None = Field(None, ge=0)
    price: Decimal | None = Field(None, ge=0, decimal_places=2)
    attributes: dict[str, Any] | None = None
    tags: list[str] | None = None


class QuantityUpdate(BaseModel):
    """Schema for updating item quantity."""

    quantity: int = Field(..., ge=0)


class ItemResponse(ItemBase):
    """Schema for item responses."""

    id: UUID
    ai_classification: dict[str, Any]
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ItemDetailResponse(ItemResponse):
    """Schema for detailed item response with related entities."""

    category: CategoryResponse | None = None
    location: LocationResponse | None = None
    primary_image_url: str | None = None


class ItemListResponse(BaseModel):
    """Schema for item list item."""

    id: UUID
    name: str
    description: str | None
    quantity: int
    quantity_unit: str
    price: Decimal | None = None
    is_low_stock: bool
    tags: list[str] = []
    category: CategoryResponse | None = None
    location: LocationResponse | None = None
    primary_image_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FacetValue(BaseModel):
    """A single value in a facet with count."""

    value: str
    count: int


class Facet(BaseModel):
    """A facet (attribute) with its available values."""

    name: str
    label: str
    values: list[FacetValue]


class FacetedSearchResponse(BaseModel):
    """Response containing available facets for filtering."""

    facets: list[Facet]
    total_items: int


class TimeSeriesDataPoint(BaseModel):
    """A single data point in a time series."""

    date: str
    count: int


class CategoryDistribution(BaseModel):
    """Distribution of items by category."""

    name: str
    count: int


class LocationDistribution(BaseModel):
    """Distribution of items by location."""

    name: str
    count: int


class DashboardStatsResponse(BaseModel):
    """Dashboard statistics response."""

    items_over_time: list[TimeSeriesDataPoint]
    items_by_category: list[CategoryDistribution]
    items_by_location: list[LocationDistribution]
    total_items: int
    total_quantity: int
    categories_used: int
    locations_used: int


# Check-in/out schemas


class CheckInOutCreate(BaseModel):
    """Schema for creating a check-in/out event."""

    quantity: int = Field(default=1, ge=1)
    notes: str | None = Field(default=None, max_length=500)
    occurred_at: datetime | None = None


class CheckInOutResponse(BaseModel):
    """Schema for check-in/out event response."""

    id: UUID
    item_id: UUID
    action_type: str
    quantity: int
    notes: str | None
    occurred_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ItemUsageStatsResponse(BaseModel):
    """Aggregated usage statistics for an item."""

    total_check_outs: int
    total_check_ins: int
    total_quantity_out: int
    total_quantity_in: int
    last_check_out: datetime | None
    last_check_in: datetime | None
    currently_checked_out: int


class MostUsedItemResponse(BaseModel):
    """Item with usage count for most-used list."""

    id: UUID
    name: str
    total_check_outs: int
    primary_image_url: str | None = None


class RecentlyUsedItemResponse(BaseModel):
    """Item with last used date for recently-used list."""

    id: UUID
    name: str
    last_used: datetime
    action_type: str
    primary_image_url: str | None = None


class FindSimilarRequest(BaseModel):
    """Request schema for finding similar items based on classification."""

    identified_name: str = Field(..., min_length=1, max_length=500)
    category_path: str | None = Field(None, max_length=500)
    specifications: dict[str, Any] | None = None
    limit: int = Field(5, ge=1, le=20)


class SimilarItemMatch(BaseModel):
    """A potential duplicate/similar item match."""

    id: UUID
    name: str
    description: str | None
    quantity: int
    quantity_unit: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    match_reasons: list[str]
    category: CategoryResponse | None = None
    location: LocationResponse | None = None
    primary_image_url: str | None = None

    model_config = {"from_attributes": True}


class FindSimilarResponse(BaseModel):
    """Response containing similar items found."""

    similar_items: list[SimilarItemMatch]
    total_searched: int


class BatchUpdateRequest(BaseModel):
    """Schema for batch updating multiple items."""

    item_ids: list[UUID] = Field(..., min_length=1, max_length=100)
    category_id: UUID | None = None
    location_id: UUID | None = None
    clear_category: bool = Field(
        default=False, description="Set to true to remove category from items"
    )
    clear_location: bool = Field(
        default=False, description="Set to true to remove location from items"
    )


class BatchUpdateResponse(BaseModel):
    """Response for batch update operation."""

    updated_count: int
    item_ids: list[UUID]
