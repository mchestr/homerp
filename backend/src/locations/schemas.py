from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


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

    model_config = {"from_attributes": True}


class LocationTreeNode(BaseModel):
    """Schema for nested location tree representation."""

    id: UUID
    name: str
    description: str | None = None
    location_type: str | None = None
    path: str
    item_count: int = 0
    children: list["LocationTreeNode"] = Field(default_factory=list)

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
