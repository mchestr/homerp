from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from src.common.ai_input_validator import ValidatedCustomPrompt


class Specification(BaseModel):
    """Schema for a single specification with key and value.

    Note: We use `float` instead of `int | float` because:
    1. JSON doesn't distinguish between integers and floats
    2. Python's `int` is automatically compatible with `float`
    3. This avoids TypeScript generating `number | number` in the client
    """

    key: str
    value: str | float | bool


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
    location_id: UUID | None
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
    """Schema for image classification request.

    Accepts multiple image IDs to classify together (e.g., multiple angles of same item).
    Charges 1 credit per image.
    """

    image_ids: list[UUID]
    custom_prompt: ValidatedCustomPrompt = None


class ClassificationResult(BaseModel):
    """Schema for AI classification result."""

    identified_name: str
    confidence: float
    category_path: str
    description: str
    specifications: list[Specification]
    alternative_suggestions: list[dict[str, Any]] | None = None
    quantity_estimate: str | None = None


class ClassificationResponse(BaseModel):
    """Schema for classification response."""

    success: bool
    classification: ClassificationResult | None = None
    error: str | None = None
    create_item_prefill: dict[str, Any] | None = None
    credits_charged: int = 0


class ImageSignedUrlResponse(BaseModel):
    """Schema for signed URL response."""

    url: str
