from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from src.auth.dependencies import CurrentUserIdDep
from src.database import AsyncSessionDep
from src.locations.qr import QRCodeService, get_qr_service
from src.locations.schemas import (
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
