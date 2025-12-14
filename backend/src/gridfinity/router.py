from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from src.auth.dependencies import CurrentUserIdDep
from src.database import AsyncSessionDep
from src.gridfinity.schemas import (
    AutoLayoutRequest,
    AutoLayoutResult,
    BinRecommendationRequest,
    BinRecommendationResponse,
    GridCalculation,
    GridfinityPlacementCreate,
    GridfinityPlacementResponse,
    GridfinityPlacementUpdate,
    GridfinityUnitCreate,
    GridfinityUnitResponse,
    GridfinityUnitUpdate,
    GridfinityUnitWithPlacementsResponse,
)
from src.gridfinity.service import GridfinityService
from src.locations.service import LocationService

router = APIRouter()


# Unit endpoints


@router.get("/units")
async def list_units(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[GridfinityUnitResponse]:
    """List all Gridfinity storage units for the current user."""
    service = GridfinityService(session, user_id)
    units = await service.get_all_units()
    return [GridfinityUnitResponse.model_validate(unit) for unit in units]


@router.get("/units/{unit_id}")
async def get_unit(
    unit_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> GridfinityUnitResponse:
    """Get a Gridfinity unit by ID."""
    service = GridfinityService(session, user_id)
    unit = await service.get_unit_by_id(unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gridfinity unit not found",
        )
    return GridfinityUnitResponse.model_validate(unit)


@router.get("/units/{unit_id}/layout")
async def get_unit_layout(
    unit_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> GridfinityUnitWithPlacementsResponse:
    """Get a Gridfinity unit with all placements for rendering the layout."""
    service = GridfinityService(session, user_id)
    unit = await service.get_unit_with_placements(unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gridfinity unit not found",
        )

    # Build response with placements
    placements = [
        GridfinityPlacementResponse.model_validate(p) for p in unit.placements
    ]

    return GridfinityUnitWithPlacementsResponse(
        id=unit.id,
        name=unit.name,
        description=unit.description,
        location_id=unit.location_id,
        container_width_mm=unit.container_width_mm,
        container_depth_mm=unit.container_depth_mm,
        container_height_mm=unit.container_height_mm,
        grid_columns=unit.grid_columns,
        grid_rows=unit.grid_rows,
        created_at=unit.created_at,
        updated_at=unit.updated_at,
        placements=placements,
    )


@router.post("/units", status_code=status.HTTP_201_CREATED)
async def create_unit(
    data: GridfinityUnitCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> GridfinityUnitResponse:
    """Create a new Gridfinity storage unit."""
    service = GridfinityService(session, user_id)

    # Check for duplicate name
    existing = await service.get_unit_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Gridfinity unit with name '{data.name}' already exists",
        )

    # Validate location exists if provided
    if data.location_id:
        location_service = LocationService(session, user_id)
        location = await location_service.get_by_id(data.location_id)
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found",
            )

    unit = await service.create_unit(data)
    return GridfinityUnitResponse.model_validate(unit)


@router.put("/units/{unit_id}")
async def update_unit(
    unit_id: UUID,
    data: GridfinityUnitUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> GridfinityUnitResponse:
    """Update a Gridfinity unit."""
    service = GridfinityService(session, user_id)
    unit = await service.get_unit_by_id(unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gridfinity unit not found",
        )

    # Check for duplicate name if updating name
    if data.name and data.name != unit.name:
        existing = await service.get_unit_by_name(data.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Gridfinity unit with name '{data.name}' already exists",
            )

    # Validate location exists if provided
    if data.location_id:
        location_service = LocationService(session, user_id)
        location = await location_service.get_by_id(data.location_id)
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found",
            )

    unit = await service.update_unit(unit, data)
    return GridfinityUnitResponse.model_validate(unit)


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit(
    unit_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Delete a Gridfinity unit and all its placements."""
    service = GridfinityService(session, user_id)
    unit = await service.get_unit_by_id(unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gridfinity unit not found",
        )
    await service.delete_unit(unit)


# Placement endpoints


@router.post("/units/{unit_id}/placements", status_code=status.HTTP_201_CREATED)
async def create_placement(
    unit_id: UUID,
    data: GridfinityPlacementCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> GridfinityPlacementResponse:
    """Add an item placement to a Gridfinity unit."""
    service = GridfinityService(session, user_id)

    # Verify unit exists
    unit = await service.get_unit_by_id(unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gridfinity unit not found",
        )

    # Verify item exists
    from src.items.repository import ItemRepository

    item_repo = ItemRepository(session, user_id)
    item = await item_repo.get_by_id(data.item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    # Check if item is already placed in this unit
    existing_placements = await service.get_placements_for_unit(unit_id)
    for p in existing_placements:
        if p.item_id == data.item_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Item is already placed in this unit",
            )

    # Validate bounds
    if not service.validate_placement_bounds(
        unit, data.grid_x, data.grid_y, data.width_units, data.depth_units
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Placement exceeds unit bounds. Grid is {unit.grid_columns}x{unit.grid_rows}"
            ),
        )

    # Check for overlaps
    overlap = service.check_placement_overlap(
        existing_placements,
        data.grid_x,
        data.grid_y,
        data.width_units,
        data.depth_units,
    )
    if overlap:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Placement overlaps with existing item at {overlap.position_code}",
        )

    placement = await service.create_placement(unit_id, data)
    return GridfinityPlacementResponse.model_validate(placement)


@router.put("/placements/{placement_id}")
async def update_placement(
    placement_id: UUID,
    data: GridfinityPlacementUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> GridfinityPlacementResponse:
    """Update a placement (move or resize)."""
    service = GridfinityService(session, user_id)

    placement = await service.get_placement_by_id(placement_id)
    if not placement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Placement not found",
        )

    # Get unit for validation
    unit = await service.get_unit_by_id(placement.unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gridfinity unit not found",
        )

    # Determine new position/size
    new_x = data.grid_x if data.grid_x is not None else placement.grid_x
    new_y = data.grid_y if data.grid_y is not None else placement.grid_y
    new_width = (
        data.width_units if data.width_units is not None else placement.width_units
    )
    new_depth = (
        data.depth_units if data.depth_units is not None else placement.depth_units
    )

    # Validate bounds
    if not service.validate_placement_bounds(unit, new_x, new_y, new_width, new_depth):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Placement exceeds unit bounds. Grid is {unit.grid_columns}x{unit.grid_rows}"
            ),
        )

    # Check for overlaps (excluding this placement)
    existing_placements = await service.get_placements_for_unit(unit.id)
    overlap = service.check_placement_overlap(
        existing_placements,
        new_x,
        new_y,
        new_width,
        new_depth,
        exclude_id=placement_id,
    )
    if overlap:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Placement would overlap with item at {overlap.position_code}",
        )

    placement = await service.update_placement(placement, data)
    return GridfinityPlacementResponse.model_validate(placement)


@router.delete("/placements/{placement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_placement(
    placement_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Remove an item placement from a unit."""
    service = GridfinityService(session, user_id)

    placement = await service.get_placement_by_id(placement_id)
    if not placement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Placement not found",
        )

    await service.delete_placement(placement)


# Auto-layout endpoint


@router.post("/units/{unit_id}/auto-layout")
async def auto_layout_items(
    unit_id: UUID,
    data: AutoLayoutRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> AutoLayoutResult:
    """Automatically arrange items in a unit using bin-packing algorithm."""
    service = GridfinityService(session, user_id)

    unit = await service.get_unit_by_id(unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gridfinity unit not found",
        )

    result = await service.auto_layout(unit, data.item_ids)
    return result


# Bin recommendations endpoint


@router.post("/recommend-bins")
async def recommend_bin_sizes(
    data: BinRecommendationRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> BinRecommendationResponse:
    """Get bin size recommendations for items based on their dimensions."""
    service = GridfinityService(session, user_id)
    recommendations = await service.recommend_bin_sizes(data.item_ids)
    return BinRecommendationResponse(recommendations=recommendations)


# Grid calculation helper endpoint


@router.get("/calculate-grid")
async def calculate_grid(
    width_mm: int,
    depth_mm: int,
) -> GridCalculation:
    """Calculate grid size from container dimensions.

    Returns the number of columns and rows that fit, plus wasted space.
    """
    if width_mm <= 0 or depth_mm <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dimensions must be positive",
        )

    return GridCalculation.from_dimensions(width_mm, depth_mm)
