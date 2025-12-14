from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class LocationBase(BaseModel):
    """Base location schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=500)
    location_type: str | None = Field(
        None, max_length=50
    )  # room, shelf, bin, drawer, box


class LocationCreate(LocationBase):
    """Schema for creating a location."""

    parent_id: UUID | None = Field(None, description="Parent location ID for hierarchy")


class LocationUpdate(BaseModel):
    """Schema for updating a location."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=500)
    location_type: str | None = Field(None, max_length=50)
    parent_id: UUID | None = Field(
        None, description="Parent location ID (set to null to make root)"
    )


class LocationResponse(LocationBase):
    """Schema for location responses."""

    id: UUID
    parent_id: UUID | None = None
    path: str = ""
    created_at: datetime

    @field_validator("path", mode="before")
    @classmethod
    def convert_ltree_to_str(cls, v: Any) -> str:
        """Convert Ltree objects to strings."""
        if v is None:
            return ""
        return str(v)

    model_config = {"from_attributes": True}


class LocationTreeNode(BaseModel):
    """Schema for nested location tree representation."""

    id: UUID
    name: str
    description: str | None = None
    location_type: str | None = None
    path: str
    item_count: int = 0
    total_value: float = 0.0
    children: list["LocationTreeNode"] = Field(default_factory=list)

    @field_validator("path", mode="before")
    @classmethod
    def convert_ltree_to_str(cls, v: Any) -> str:
        """Convert Ltree objects to strings."""
        if v is None:
            return ""
        return str(v)

    model_config = {"from_attributes": True}


class LocationMoveRequest(BaseModel):
    """Schema for moving a location to a new parent."""

    new_parent_id: UUID | None = Field(
        None, description="New parent location ID, or null for root level"
    )


class LocationWithAncestors(LocationResponse):
    """Location response with full ancestor path."""

    ancestors: list["LocationResponse"] = Field(
        default_factory=list,
        description="List of ancestor locations from root to parent",
    )


# AI Location Analysis Schemas


class LocationSuggestion(BaseModel):
    """Schema for a suggested location from AI analysis."""

    name: str = Field(..., min_length=1, max_length=255)
    location_type: str = Field(
        ..., description="Type: room, shelf, bin, drawer, box, cabinet"
    )
    description: str | None = Field(None, max_length=500)


class LocationAnalysisResult(BaseModel):
    """Schema for AI location analysis result."""

    parent: LocationSuggestion
    children: list[LocationSuggestion] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str = Field(..., description="AI's reasoning for the suggestions")


class LocationAnalysisRequest(BaseModel):
    """Schema for location analysis request."""

    image_id: UUID


class LocationAnalysisResponse(BaseModel):
    """Schema for location analysis response."""

    success: bool
    result: LocationAnalysisResult | None = None
    error: str | None = None


class LocationBulkCreate(BaseModel):
    """Schema for bulk location creation with parent and children."""

    parent: LocationCreate
    children: list[LocationCreate] = Field(default_factory=list)


class LocationBulkCreateResponse(BaseModel):
    """Schema for bulk creation response."""

    parent: LocationResponse
    children: list[LocationResponse]


# Location Suggestion Schemas (for item storage recommendations)


class LocationSuggestionItem(BaseModel):
    """Schema for a single location suggestion."""

    location_id: UUID
    location_name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str = Field(..., description="Why this location is suitable")


class ItemLocationSuggestionResult(BaseModel):
    """Schema for AI location suggestion result for item storage."""

    suggestions: list[LocationSuggestionItem] = Field(default_factory=list)


class ItemLocationSuggestionRequest(BaseModel):
    """Schema for requesting location suggestions for an item."""

    item_name: str = Field(..., min_length=1, max_length=255)
    item_category: str | None = Field(None, max_length=255)
    item_description: str | None = Field(None, max_length=2000)
    item_specifications: dict[str, Any] | None = None


class ItemLocationSuggestionResponse(BaseModel):
    """Schema for location suggestion response."""

    success: bool
    suggestions: list[LocationSuggestionItem] = Field(default_factory=list)
    error: str | None = None
