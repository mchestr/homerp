import hashlib
import logging
import os
import re
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse

from src.ai.service import AIClassificationService, get_ai_service
from src.ai.usage_service import AIUsageService, get_ai_usage_service
from src.auth.dependencies import CurrentUserIdDep, InventoryContextDep
from src.auth.service import AuthService, get_auth_service
from src.billing.pricing_service import CreditPricingService, get_pricing_service
from src.billing.router import CreditServiceDep
from src.common.rate_limiter import RATE_LIMIT_AI, RATE_LIMIT_UPLOAD, limiter
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
from src.items.repository import ItemRepository

logger = logging.getLogger(__name__)


def compute_content_hash(content: bytes) -> str:
    """Compute SHA-256 hash of content."""
    return hashlib.sha256(content).hexdigest()


# Magic byte signatures for image formats
IMAGE_MAGIC_BYTES = {
    "image/jpeg": [
        b"\xff\xd8\xff",  # JPEG
    ],
    "image/png": [
        b"\x89PNG\r\n\x1a\n",  # PNG
    ],
    "image/gif": [
        b"GIF87a",  # GIF87a
        b"GIF89a",  # GIF89a
    ],
    "image/webp": [
        b"RIFF",  # WebP starts with RIFF, then has WEBP at offset 8
    ],
}


def validate_image_magic_bytes(content: bytes, declared_mime_type: str) -> bool:
    """Validate that file content matches the declared MIME type using magic bytes.

    Returns True if the file content matches the declared type, False otherwise.
    """
    if declared_mime_type not in IMAGE_MAGIC_BYTES:
        return False

    signatures = IMAGE_MAGIC_BYTES[declared_mime_type]

    for signature in signatures:
        if content.startswith(signature):
            # Special check for WebP: must have WEBP at offset 8
            if declared_mime_type == "image/webp":
                if len(content) >= 12 and content[8:12] == b"WEBP":
                    return True
            else:
                return True

    return False


def sanitize_filename(filename: str | None) -> str:
    """Sanitize filename to prevent path traversal attacks.

    - Extracts only the basename (removes directory paths)
    - Removes null bytes
    - Removes path traversal sequences
    - Handles both Unix and Windows path separators
    """
    if not filename:
        return "unnamed"

    # Remove null bytes
    filename = filename.replace("\x00", "")

    # Handle both Unix and Windows path separators - extract basename
    # First normalize backslashes to forward slashes
    filename = filename.replace("\\", "/")

    # Extract just the filename part (last component after any slash)
    filename = os.path.basename(filename)

    # Remove any remaining path traversal sequences (shouldn't exist after basename, but be safe)
    filename = re.sub(r"\.\.+", "", filename)

    # Remove any remaining slashes
    filename = filename.replace("/", "").replace("\\", "")

    # If filename is empty after sanitization, use a default
    if not filename or filename == ".":
        return "unnamed"

    return filename


router = APIRouter()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_UPLOAD)
async def upload_image(
    request: Request,  # noqa: ARG001 - Required for rate limiting
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
    # Validate declared file type
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        logger.warning(
            f"Image upload rejected - invalid type: user_id={user_id}, "
            f"content_type={file.content_type}, filename={file.filename}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Allowed: {allowed_types}",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_size:
        logger.warning(
            f"Image upload rejected - too large: user_id={user_id}, "
            f"size_bytes={len(content)}, max_bytes={max_size}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB",
        )

    # Validate file content matches declared MIME type (prevent content-type spoofing)
    if not validate_image_magic_bytes(content, file.content_type):
        logger.warning(
            f"Image upload rejected - MIME type mismatch: user_id={user_id}, "
            f"declared_type={file.content_type}, filename={file.filename}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match declared content type. "
            "The file may be corrupted or the wrong type.",
        )

    # Sanitize filename to prevent path traversal attacks
    safe_filename = sanitize_filename(file.filename)

    # Compute content hash for duplicate detection
    content_hash = compute_content_hash(content)

    # Check if this image was previously uploaded by this user
    repo = ImageRepository(session, user_id)
    existing_image = await repo.get_by_content_hash(content_hash)
    if existing_image:
        # Return existing image - this preserves any AI classification results
        logger.info(
            f"Image upload - duplicate detected: user_id={user_id}, "
            f"existing_image_id={existing_image.id}, content_hash={content_hash[:16]}..."
        )
        return ImageUploadResponse.model_validate(existing_image)

    # Save to storage
    storage_path = await storage.save(content, safe_filename)

    # Generate thumbnail
    thumbnail_path = await storage.generate_thumbnail(content, safe_filename)

    # Create database record with sanitized filename
    image = await repo.create(
        storage_path=storage_path,
        storage_type="local",
        original_filename=safe_filename,
        mime_type=file.content_type,
        size_bytes=len(content),
        content_hash=content_hash,
        thumbnail_path=thumbnail_path,
    )

    logger.info(
        f"Image uploaded: user_id={user_id}, image_id={image.id}, "
        f"size_bytes={len(content)}, mime_type={file.content_type}"
    )

    return ImageUploadResponse.model_validate(image)


@router.post("/classify")
@limiter.limit(RATE_LIMIT_AI)
async def classify_images(
    request: Request,  # noqa: ARG001 - Required for rate limiting
    data: ClassificationRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
    ai_service: Annotated[AIClassificationService, Depends(get_ai_service)],
    ai_usage_service: Annotated[AIUsageService, Depends(get_ai_usage_service)],
    credit_service: CreditServiceDep,
    pricing_service: Annotated[CreditPricingService, Depends(get_pricing_service)],
) -> ClassificationResponse:
    """Classify one or more uploaded images using AI.

    Multiple images are sent together in a single request, allowing the AI
    to see different angles/views of the same item for better identification.

    Charges credits per image based on configured pricing.
    """
    num_images = len(data.image_ids)
    if num_images == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one image ID is required",
        )

    # Limit logged image IDs to first 5 for performance
    image_ids_preview = [str(id) for id in data.image_ids[:5]]
    if num_images > 5:
        image_ids_preview.append(f"...and {num_images - 5} more")
    logger.info(
        f"Classification request: user_id={user_id}, image_count={num_images}, "
        f"image_ids={image_ids_preview}"
    )

    # Get the cost per image from pricing
    cost_per_image = await pricing_service.get_operation_cost("image_classification")
    total_credits = cost_per_image * num_images

    # Check if user has enough credits for all images
    if not await credit_service.has_credits(user_id, amount=total_credits):
        logger.info(
            f"Classification rejected - insufficient credits: user_id={user_id}, "
            f"required={total_credits}"
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. You need {total_credits} credits to classify {num_images} image(s).",
        )

    # Get all image records
    repo = ImageRepository(session, user_id)
    images = []
    for image_id in data.image_ids:
        image = await repo.get_by_id(image_id)
        if not image:
            logger.warning(
                f"Classification failed - image not found: user_id={user_id}, "
                f"image_id={image_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Image {image_id} not found",
            )
        images.append(image)

    try:
        # Read all image data
        image_data_list: list[tuple[bytes, str]] = []
        for image in images:
            image_data = await storage.read(image.storage_path)
            image_data_list.append((image_data, image.mime_type or "image/jpeg"))

        # Get common specification keys from user's inventory to help AI
        # identify relevant specifications
        item_repo = ItemRepository(session, user_id)
        spec_hints = await item_repo.get_common_specification_keys(
            min_frequency=2, limit=15
        )

        logger.info(
            f"Using {len(spec_hints)} specification hints for classification: "
            f"{spec_hints[:5]}"
            + (f"...and {len(spec_hints) - 5} more" if len(spec_hints) > 5 else "")
        )

        # Classify all images together with AI (with token usage tracking)
        classification, token_usage = await ai_service.classify_images_with_usage(
            image_data_list,
            custom_prompt=data.custom_prompt,
            spec_hints=spec_hints if spec_hints else None,
        )

        # Deduct credits after successful classification
        # Use commit=False to ensure atomicity with usage logging
        filenames = [img.original_filename or "image" for img in images]
        credit_transaction = await credit_service.deduct_credit(
            user_id,
            f"AI classification ({num_images} images): {', '.join(filenames[:3])}{'...' if len(filenames) > 3 else ''}",
            amount=total_credits,
            commit=False,
        )

        # Log token usage
        await ai_usage_service.log_usage(
            session=session,
            user_id=user_id,
            operation_type="image_classification",
            token_usage=token_usage,
            credit_transaction_id=credit_transaction.id if credit_transaction else None,
            metadata={
                "image_count": num_images,
                "image_ids": [str(img.id) for img in images],
                "has_custom_prompt": data.custom_prompt is not None,
                "credits_per_image": cost_per_image,
            },
        )

        # Commit both credit deduction and usage logging together
        await session.commit()

        # Update all image records with AI result
        for image in images:
            await repo.update_ai_result(image, classification.model_dump())

        # Create prefill data
        prefill = ai_service.create_item_prefill(classification)

        logger.info(
            f"Classification complete: user_id={user_id}, "
            f"identified_name={classification.identified_name}, "
            f"confidence={classification.confidence}, "
            f"credits_charged={total_credits}"
        )

        return ClassificationResponse(
            success=True,
            classification=classification,
            create_item_prefill=prefill,
            credits_charged=total_credits,
        )

    except Exception as e:
        logger.error(
            f"Classification failed: user_id={user_id}, "
            f"image_ids={image_ids_preview}, "
            f"error={type(e).__name__}: {e}",
            exc_info=True,
        )
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
    inventory_owner_id: InventoryContextDep,
    settings: Annotated[Settings, Depends(get_settings)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    thumbnail: Annotated[bool, Query()] = False,
) -> ImageSignedUrlResponse:
    """Get a signed URL for accessing an image file.

    This generates a short-lived token that can be used in browser <img> tags
    where Authorization headers cannot be sent.

    Set thumbnail=true to get a URL for the thumbnail version.

    Supports collaboration: when viewing a shared inventory, the signed URL
    will be generated for the inventory owner's images.
    """
    repo = ImageRepository(session, inventory_owner_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    token = auth_service.create_image_token(inventory_owner_id, image_id)
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


@router.get("/location/{location_id}")
async def get_images_by_location(
    location_id: UUID,
    session: AsyncSessionDep,
    inventory_owner_id: InventoryContextDep,
) -> list[ImageResponse]:
    """Get all images for a location.

    Supports collaboration: when viewing a shared inventory, returns
    images for the inventory owner's location.
    """
    repo = ImageRepository(session, inventory_owner_id)
    images = await repo.get_by_location(location_id)
    return [ImageResponse.model_validate(img) for img in images]


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


@router.post("/{image_id}/set-primary")
async def set_image_as_primary(
    image_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ImageResponse:
    """Set an image as the primary image for its item.

    The image must already be attached to an item.
    Other images for the same item will be marked as non-primary.
    """
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    if not image.item_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image is not attached to any item",
        )

    image = await repo.set_primary(image)
    return ImageResponse.model_validate(image)


@router.post("/{image_id}/detach")
async def detach_image_from_item(
    image_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ImageResponse:
    """Detach an image from its item.

    The image is not deleted, just unassociated from the item.
    """
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    image = await repo.detach_from_item(image)
    return ImageResponse.model_validate(image)


@router.post("/{image_id}/attach-location/{location_id}")
async def attach_image_to_location(
    image_id: UUID,
    location_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    is_primary: bool = False,
) -> ImageResponse:
    """Attach an image to a location."""
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    image = await repo.attach_to_location(image, location_id, is_primary)
    return ImageResponse.model_validate(image)


@router.post("/{image_id}/set-primary-location")
async def set_image_as_primary_for_location(
    image_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ImageResponse:
    """Set an image as the primary image for its location.

    The image must already be attached to a location.
    Other images for the same location will be marked as non-primary.
    """
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    if not image.location_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image is not attached to any location",
        )

    image = await repo.set_primary_for_location(image)
    return ImageResponse.model_validate(image)


@router.post("/{image_id}/detach-location")
async def detach_image_from_location(
    image_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ImageResponse:
    """Detach an image from its location.

    The image is not deleted, just unassociated from the location.
    """
    repo = ImageRepository(session, user_id)
    image = await repo.get_by_id(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    image = await repo.detach_from_location(image)
    return ImageResponse.model_validate(image)
