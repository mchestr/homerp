from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from src.ai.service import AIClassificationService, get_ai_service
from src.auth.dependencies import CurrentUserIdDep
from src.billing.router import CreditServiceDep
from src.config import Settings, get_settings
from src.database import AsyncSessionDep
from src.images.repository import ImageRepository
from src.images.schemas import (
    ClassificationRequest,
    ClassificationResponse,
    ImageResponse,
    ImageUploadResponse,
)
from src.images.storage import LocalStorage, get_storage

router = APIRouter()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ImageUploadResponse:
    """Upload an image file."""
    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Allowed: {allowed_types}",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB",
        )

    # Save to storage
    storage_path = await storage.save(content, file.filename)

    # Create database record
    repo = ImageRepository(session, user_id)
    image = await repo.create(
        storage_path=storage_path,
        storage_type="local",
        original_filename=file.filename,
        mime_type=file.content_type,
        size_bytes=len(content),
    )

    return ImageUploadResponse.model_validate(image)


@router.post("/classify")
async def classify_image(
    data: ClassificationRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
    ai_service: Annotated[AIClassificationService, Depends(get_ai_service)],
    credit_service: CreditServiceDep,
) -> ClassificationResponse:
    """Classify an uploaded image using AI."""
    # Check if user has credits
    if not await credit_service.has_credits(user_id):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please purchase more credits to use AI classification.",
        )

    # Get image record
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(data.image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    try:
        # Read image data
        image_data = await storage.read(image.storage_path)

        # Classify with AI
        classification = await ai_service.classify_image(
            image_data,
            mime_type=image.mime_type or "image/jpeg",
        )

        # Deduct credit after successful classification
        await credit_service.deduct_credit(
            user_id,
            f"AI classification: {image.original_filename or 'image'}",
        )

        # Update image record with AI result
        await repo.update_ai_result(image, classification.model_dump())

        # Create prefill data
        prefill = ai_service.create_item_prefill(classification)

        return ClassificationResponse(
            success=True,
            classification=classification,
            create_item_prefill=prefill,
        )

    except Exception as e:
        return ClassificationResponse(
            success=False,
            error=str(e),
        )


@router.get("/{image_id}")
async def get_image(
    image_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ImageResponse:
    """Get image metadata."""
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )
    return ImageResponse.model_validate(image)


@router.get("/{image_id}/file")
async def get_image_file(
    image_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
) -> FileResponse:
    """Get the actual image file."""
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    file_path = storage.get_full_path(image.storage_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image file not found",
        )

    return FileResponse(
        path=file_path,
        media_type=image.mime_type or "application/octet-stream",
        filename=image.original_filename,
    )


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    image_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
) -> None:
    """Delete an image."""
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    # Delete from storage
    await storage.delete(image.storage_path)

    # Delete from database
    await repo.delete(image)


@router.post("/{image_id}/attach/{item_id}")
async def attach_image_to_item(
    image_id: UUID,
    item_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    is_primary: bool = False,
) -> ImageResponse:
    """Attach an image to an item."""
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    image = await repo.attach_to_item(image, item_id, is_primary)
    return ImageResponse.model_validate(image)
