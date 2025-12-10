from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AttributeFieldOption(BaseModel):
    """Option for select-type attribute fields."""

    value: str
    label: str | None = None  # If not provided, use value as label


class AttributeField(BaseModel):
    """Schema for a single attribute field in a category template."""

    name: str = Field(..., min_length=1, max_length=50, description="Field identifier (snake_case)")
    label: str = Field(..., min_length=1, max_length=100, description="Display label")
    type: Literal["text", "number", "select", "boolean"] = Field(
        ..., description="Field input type"
    )
    options: list[str] | None = Field(
        None, description="Options for select type fields"
    )
    required: bool = Field(False, description="Whether field is required")
    default: str | int | float | bool | None = Field(None, description="Default value")
    unit: str | None = Field(None, max_length=20, description="Unit suffix (e.g., 'mm', 'ohms')")


class AttributeTemplate(BaseModel):
    """Schema for category attribute template."""

    fields: list[AttributeField] = Field(default_factory=list)


class CategoryBase(BaseModel):
    """Base category schema."""

    name: str = Field(..., min_length=1, max_length=255)
    icon: str | None = Field(None, max_length=50)
    description: str | None = Field(None, max_length=500)


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""

    parent_id: UUID | None = Field(None, description="Parent category ID for hierarchy")
    attribute_template: AttributeTemplate | None = Field(
        None, description="Template for item attributes in this category"
    )


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""

    name: str | None = Field(None, min_length=1, max_length=255)
    icon: str | None = Field(None, max_length=50)
    description: str | None = Field(None, max_length=500)
    parent_id: UUID | None = Field(None, description="Parent category ID (set to null to make root)")
    attribute_template: AttributeTemplate | None = Field(
        None, description="Template for item attributes"
    )


class CategoryResponse(CategoryBase):
    """Schema for category responses."""

    id: UUID
    parent_id: UUID | None = None
    path: str = ""
    attribute_template: dict = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryTreeNode(BaseModel):
    """Schema for nested category tree representation."""

    id: UUID
    name: str
    icon: str | None = None
    description: str | None = None
    path: str
    attribute_template: dict = Field(default_factory=dict)
    item_count: int = 0
    children: list["CategoryTreeNode"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class CategoryMoveRequest(BaseModel):
    """Schema for moving a category to a new parent."""

    new_parent_id: UUID | None = Field(
        None, description="New parent category ID, or null for root level"
    )


class MergedAttributeTemplate(BaseModel):
    """Schema for merged attribute template from category hierarchy."""

    fields: list[AttributeField] = Field(default_factory=list)
    inherited_from: list[UUID] = Field(
        default_factory=list, description="Category IDs from which fields were inherited"
    )
