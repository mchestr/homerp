from datetime import datetime
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
