"""Feedback schemas for request/response models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    """Schema for creating feedback."""

    subject: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=5000)
    feedback_type: str = Field("general", max_length=50)


class FeedbackResponse(BaseModel):
    """Schema for feedback response."""

    id: UUID
    subject: str
    message: str
    feedback_type: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackAdminResponse(BaseModel):
    """Admin response schema for feedback."""

    id: UUID
    user_id: UUID
    user_email: str
    user_name: str | None
    subject: str
    message: str
    feedback_type: str
    status: str
    admin_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FeedbackAdminUpdate(BaseModel):
    """Schema for admin updating feedback."""

    status: str | None = Field(None, max_length=50)
    admin_notes: str | None = Field(None, max_length=2000)


class PaginatedFeedbackResponse(BaseModel):
    """Paginated response for feedback."""

    items: list[FeedbackAdminResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[FeedbackAdminResponse],
        total: int,
        page: int,
        limit: int,
    ) -> "PaginatedFeedbackResponse":
        """Create paginated response."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )
