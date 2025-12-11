from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class ImageUploadResponse(BaseModel):
    """Schema for image upload response."""

    id: UUID
    storage_path: str
    original_filename: str | None
    mime_type: str | None
    size_bytes: int | None
    content_hash: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ImageResponse(ImageUploadResponse):
    """Schema for image response."""

    item_id: UUID | None
    is_primary: bool
    ai_processed: bool
    ai_result: dict[str, Any] | None


class PaginatedImagesResponse(BaseModel):
    """Schema for paginated images response."""

    items: list[ImageResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[ImageResponse],
        total: int,
        page: int,
        limit: int,
    ) -> "PaginatedImagesResponse":
        """Create paginated response."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )


class ClassificationRequest(BaseModel):
    """Schema for image classification request."""

    image_id: UUID


class ClassificationResult(BaseModel):
    """Schema for AI classification result."""

    identified_name: str
    confidence: float
    category_path: str
    description: str
    specifications: dict[str, Any]
    alternative_suggestions: list[dict[str, Any]] | None = None
    quantity_estimate: str | None = None


class ClassificationResponse(BaseModel):
    """Schema for classification response."""

    success: bool
    classification: ClassificationResult | None = None
    error: str | None = None
    create_item_prefill: dict[str, Any] | None = None


class ImageSignedUrlResponse(BaseModel):
    """Schema for signed URL response."""

    url: str
