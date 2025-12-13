from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from src.ai.service import AIClassificationService, get_ai_service
from src.auth.dependencies import CurrentUserIdDep
from src.billing.router import CreditServiceDep
from src.database import AsyncSessionDep
from src.images.repository import ImageRepository
from src.images.storage import LocalStorage, get_storage
from src.locations.qr import QRCodeService, get_qr_service
from src.locations.schemas import (
    LocationAnalysisRequest,
    LocationAnalysisResponse,
    LocationBulkCreate,
    LocationBulkCreateResponse,
    LocationCreate,
    LocationMoveRequest,
    LocationResponse,
    LocationTreeNode,
    LocationUpdate,
    LocationWithAncestors,
)
from src.locations.service import LocationService

router = APIRouter()


@router.get("")
async def list_locations(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[LocationResponse]:
    """List all locations for the current user, ordered by hierarchy path."""
    service = LocationService(session, user_id)
    locations = await service.get_all()
    return [LocationResponse.model_validate(loc) for loc in locations]


@router.get("/tree")
async def get_location_tree(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[LocationTreeNode]:
    """Get locations as a nested tree structure with item counts."""
    service = LocationService(session, user_id)
    return await service.get_tree()


@router.post("/analyze-image")
async def analyze_location_image(
    data: LocationAnalysisRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    storage: Annotated[LocalStorage, Depends(get_storage)],
    ai_service: Annotated[AIClassificationService, Depends(get_ai_service)],
    credit_service: CreditServiceDep,
) -> LocationAnalysisResponse:
    """Analyze an image to suggest location structure using AI.

    Consumes 1 credit on successful analysis.
    """
    # Check if user has credits
    if not await credit_service.has_credits(user_id):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please purchase more credits to use AI analysis.",
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

        # Analyze with AI
        result = await ai_service.analyze_location_image(
            image_data,
            mime_type=image.mime_type or "image/jpeg",
        )

        # Deduct credit after successful analysis
        await credit_service.deduct_credit(
            user_id,
            f"Location analysis: {image.original_filename or 'image'}",
        )

        return LocationAnalysisResponse(
            success=True,
            result=result,
        )

    except Exception as e:
        return LocationAnalysisResponse(
            success=False,
            error=str(e),
        )


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def create_locations_bulk(
    data: LocationBulkCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> LocationBulkCreateResponse:
    """Create a parent location with multiple children in a single operation."""
    service = LocationService(session, user_id)

    # Check for duplicate parent name
    existing = await service.get_by_name(data.parent.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Location with name '{data.parent.name}' already exists",
        )

    # Validate parent's parent exists if provided
    if data.parent.parent_id:
        parent_parent = await service.get_by_id(data.parent.parent_id)
        if not parent_parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent location not found",
            )

    # Check for duplicate names among children
    child_names = [child.name for child in data.children]
    if len(child_names) != len(set(child_names)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate child location names are not allowed",
        )

    # Check children names don't conflict with parent
    if data.parent.name in child_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Child location cannot have the same name as parent",
        )

    # Check for existing locations with child names
    for child_name in child_names:
        existing_child = await service.get_by_name(child_name)
        if existing_child:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Location with name '{child_name}' already exists",
            )

    # Create parent and children
    parent, children = await service.create_bulk(data)

    return LocationBulkCreateResponse(
        parent=LocationResponse.model_validate(parent),
        children=[LocationResponse.model_validate(child) for child in children],
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_location(
    data: LocationCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> LocationResponse:
    """Create a new location."""
    service = LocationService(session, user_id)

    # Check for duplicate name
    existing = await service.get_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Location with name '{data.name}' already exists",
        )

    # Validate parent exists if provided
    if data.parent_id:
        parent = await service.get_by_id(data.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent location not found",
            )

    location = await service.create(data)
    return LocationResponse.model_validate(location)


@router.get("/{location_id}")
async def get_location(
    location_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> LocationResponse:
    """Get a location by ID."""
    service = LocationService(session, user_id)
    location = await service.get_by_id(location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )
    return LocationResponse.model_validate(location)


@router.get("/{location_id}/descendants")
async def get_location_descendants(
    location_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[LocationResponse]:
    """Get all descendant locations of a location."""
    service = LocationService(session, user_id)
    location = await service.get_by_id(location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )
    descendants = await service.get_descendants(location)
    return [LocationResponse.model_validate(loc) for loc in descendants]


@router.put("/{location_id}")
async def update_location(
    location_id: UUID,
    data: LocationUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> LocationResponse:
    """Update a location."""
    service = LocationService(session, user_id)
    location = await service.get_by_id(location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    # Check for duplicate name if updating name
    if data.name and data.name != location.name:
        existing = await service.get_by_name(data.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Location with name '{data.name}' already exists",
            )

    # Validate parent exists if provided
    if data.parent_id:
        parent = await service.get_by_id(data.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent location not found",
            )
        # Prevent setting parent to self or descendant
        descendant_ids = await service.get_descendant_ids(location_id)
        if data.parent_id in descendant_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set parent to self or a descendant location",
            )

    location = await service.update(location, data)
    return LocationResponse.model_validate(location)


@router.patch("/{location_id}/move")
async def move_location(
    location_id: UUID,
    data: LocationMoveRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> LocationResponse:
    """Move a location to a new parent (or to root level if new_parent_id is null)."""
    service = LocationService(session, user_id)
    location = await service.get_by_id(location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    # Validate new parent exists if provided
    if data.new_parent_id:
        parent = await service.get_by_id(data.new_parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="New parent location not found",
            )

    try:
        location = await service.move(location, data.new_parent_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from None

    return LocationResponse.model_validate(location)


@router.get("/{location_id}/with-ancestors")
async def get_location_with_ancestors(
    location_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> LocationWithAncestors:
    """Get a location with its full ancestor path for breadcrumb navigation."""
    service = LocationService(session, user_id)
    location = await service.get_by_id(location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    ancestors = await service.get_ancestors(location)

    return LocationWithAncestors(
        id=location.id,
        name=location.name,
        description=location.description,
        location_type=location.location_type,
        parent_id=location.parent_id,
        path=str(location.path) if location.path else "",
        created_at=location.created_at,
        ancestors=[LocationResponse.model_validate(a) for a in ancestors],
    )


@router.get("/{location_id}/qr")
async def get_location_qr_code(
    location_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    qr_service: Annotated[QRCodeService, Depends(get_qr_service)],
    size: int = Query(10, ge=1, le=40, description="Scale factor (1-40)"),
) -> Response:
    """Generate a QR code PNG for a location.

    The QR code contains the location's URL for scanning.
    """
    service = LocationService(session, user_id)
    location = await service.get_by_id(location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    qr_bytes = qr_service.generate_location_qr(location_id, size=size)

    return Response(
        content=qr_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="location-{location_id}-qr.png"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Delete a location. Child locations will become root-level locations."""
    service = LocationService(session, user_id)
    location = await service.get_by_id(location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )
    await service.delete(location)
