import hashlib
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from src.ai.service import AIClassificationService, get_ai_service
from src.auth.dependencies import CurrentUserIdDep
from src.auth.service import AuthService, get_auth_service
from src.billing.router import CreditServiceDep
from src.config import Settings, get_settings
from src.database import AsyncSessionDep
from src.images.repository import ImageRepository
from src.images.schemas import (
    ClassificationRequest,
    ClassificationResponse,
    ImageResponse,
    ImageSignedUrlResponse,
    ImageUploadResponse,
    PaginatedImagesResponse,
)
from src.images.storage import LocalStorage, get_storage


def compute_content_hash(content: bytes) -> str:
    """Compute SHA-256 hash of content."""
    return hashlib.sha256(content).hexdigest()


router = APIRouter()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ImageUploadResponse:
    """Upload an image file.

    If the same image content was previously uploaded by this user,
    returns the existing image record instead of creating a duplicate.
    """
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

    # Compute content hash for duplicate detection
    content_hash = compute_content_hash(content)

    # Check if this image was previously uploaded by this user
    repo = ImageRepository(session, user_id)
    existing_image = await repo.get_by_content_hash(content_hash)
    if existing_image:
        # Return existing image - this preserves any AI classification results
        return ImageUploadResponse.model_validate(existing_image)

    # Save to storage
    storage_path = await storage.save(content, file.filename)

    # Generate thumbnail
    thumbnail_path = await storage.generate_thumbnail(content, file.filename)

    # Create database record
    image = await repo.create(
        storage_path=storage_path,
        storage_type="local",
        original_filename=file.filename,
        mime_type=file.content_type,
        size_bytes=len(content),
        content_hash=content_hash,
        thumbnail_path=thumbnail_path,
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


@router.get("/classified")
async def list_classified_images(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Search by identified item name"),
) -> PaginatedImagesResponse:
    """List all images that have been classified by AI.

    Supports optional search by the identified item name (case-insensitive partial match).
    """
    repo = ImageRepository(session, user_id)
    images, total = await repo.get_classified_images(page, limit, search)
    items = [ImageResponse.model_validate(img) for img in images]
    return PaginatedImagesResponse.create(items, total, page, limit)


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


@router.get("/{image_id}/signed-url")
async def get_image_signed_url(
    image_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    settings: Annotated[Settings, Depends(get_settings)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    thumbnail: Annotated[bool, Query()] = False,
) -> ImageSignedUrlResponse:
    """Get a signed URL for accessing an image file.

    This generates a short-lived token that can be used in browser <img> tags
    where Authorization headers cannot be sent.

    Set thumbnail=true to get a URL for the thumbnail version.
    """
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    token = auth_service.create_image_token(user_id, image_id)
    base_url = settings.api_base_url or ""

    if thumbnail and image.thumbnail_path:
        url = f"{base_url}/api/v1/images/{image_id}/thumbnail?token={token}"
    else:
        url = f"{base_url}/api/v1/images/{image_id}/file?token={token}"

    return ImageSignedUrlResponse(url=url)


@router.get("/{image_id}/file")
async def get_image_file(
    image_id: UUID,
    session: AsyncSessionDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    token: Annotated[str | None, Query()] = None,
) -> FileResponse:
    """Get the actual image file.

    Requires a valid signed token query parameter for authentication.
    Use GET /{image_id}/signed-url to obtain a token.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token required",
        )

    user_id = auth_service.verify_image_token(token, image_id)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

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


@router.get("/{image_id}/thumbnail")
async def get_image_thumbnail(
    image_id: UUID,
    session: AsyncSessionDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    token: Annotated[str | None, Query()] = None,
) -> FileResponse:
    """Get the thumbnail image file.

    Requires a valid signed token query parameter for authentication.
    Use GET /{image_id}/signed-url?thumbnail=true to obtain a token.
    Falls back to the original image if no thumbnail exists.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token required",
        )

    user_id = auth_service.verify_image_token(token, image_id)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    # Use thumbnail if available, otherwise fall back to original
    if image.thumbnail_path:
        file_path = storage.get_full_path(image.thumbnail_path)
        if file_path.exists():
            return FileResponse(
                path=file_path,
                media_type="image/jpeg",
                filename=f"thumb_{image.original_filename or 'image.jpg'}",
            )

    # Fall back to original image
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

    # Delete thumbnail if exists
    if image.thumbnail_path:
        await storage.delete(image.thumbnail_path)

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
