from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.dependencies import CurrentUserIdDep
from src.common.schemas import PaginatedResponse
from src.database import AsyncSessionDep
from src.items.repository import ItemRepository
from src.items.schemas import (
    CheckInOutCreate,
    CheckInOutResponse,
    DashboardStatsResponse,
    FacetedSearchResponse,
    FacetValue,
    ItemCreate,
    ItemDetailResponse,
    ItemListResponse,
    ItemUpdate,
    ItemUsageStatsResponse,
    MostUsedItemResponse,
    QuantityUpdate,
    RecentlyUsedItemResponse,
)

router = APIRouter()


def _get_primary_image_url(item) -> str | None:
    """Get the primary image URL for an item."""
    for image in item.images:
        if image.is_primary:
            return f"/api/v1/images/{image.id}/file"
    if item.images:
        return f"/api/v1/images/{item.images[0].id}/file"
    return None


@router.get("")
async def list_items(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    category_id: UUID | None = Query(None),
    include_subcategories: bool = Query(
        True, description="Include items from subcategories"
    ),
    location_id: UUID | None = Query(None),
    include_sublocations: bool = Query(
        True, description="Include items from sublocations"
    ),
    search: str | None = Query(None),
    tags: Annotated[
        list[str] | None, Query(description="Filter by tags (AND logic)")
    ] = None,
    attr: Annotated[
        list[str] | None, Query(description="Filter by attributes as key:value pairs")
    ] = None,
    low_stock: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[ItemListResponse]:
    """List items with filtering and pagination.

    When filtering by category or location, child categories/locations are included by default.
    Set include_subcategories=false or include_sublocations=false to filter by exact match only.

    Filter by tags using ?tags=tag1&tags=tag2 (items must have ALL specified tags).
    Filter by attributes using ?attr=key1:value1&attr=key2:value2.
    """
    repo = ItemRepository(session, user_id)
    offset = (page - 1) * limit

    # Parse attribute filters from key:value format
    attribute_filters: dict[str, str] | None = None
    if attr:
        attribute_filters = {}
        for a in attr:
            if ":" in a:
                key, value = a.split(":", 1)
                attribute_filters[key] = value

    items = await repo.get_all(
        category_id=category_id,
        include_subcategories=include_subcategories,
        location_id=location_id,
        include_sublocations=include_sublocations,
        search=search,
        tags=tags,
        attribute_filters=attribute_filters,
        low_stock_only=low_stock,
        offset=offset,
        limit=limit,
    )

    total = await repo.count(
        category_id=category_id,
        include_subcategories=include_subcategories,
        location_id=location_id,
        include_sublocations=include_sublocations,
        search=search,
        tags=tags,
        attribute_filters=attribute_filters,
        low_stock_only=low_stock,
    )

    item_responses = []
    for item in items:
        response = ItemListResponse(
            id=item.id,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            quantity_unit=item.quantity_unit,
            price=item.price,
            is_low_stock=item.is_low_stock,
            tags=item.tags or [],
            category=item.category,
            location=item.location,
            primary_image_url=_get_primary_image_url(item),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        item_responses.append(response)

    return PaginatedResponse.create(item_responses, total, page, limit)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_item(
    data: ItemCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ItemDetailResponse:
    """Create a new item."""
    repo = ItemRepository(session, user_id)
    item = await repo.create(data)

    return ItemDetailResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        category_id=item.category_id,
        location_id=item.location_id,
        quantity=item.quantity,
        quantity_unit=item.quantity_unit,
        min_quantity=item.min_quantity,
        price=item.price,
        attributes=item.attributes,
        tags=item.tags or [],
        ai_classification=item.ai_classification,
        is_low_stock=item.is_low_stock,
        category=item.category,
        location=item.location,
        primary_image_url=_get_primary_image_url(item),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/stats/dashboard")
async def get_dashboard_stats(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    days: int = Query(30, ge=7, le=90),
) -> DashboardStatsResponse:
    """Get dashboard statistics including time series data."""
    repo = ItemRepository(session, user_id)
    stats = await repo.get_dashboard_stats(days=days)
    return DashboardStatsResponse(**stats)


@router.get("/stats/most-used")
async def get_most_used_items(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    limit: int = Query(5, ge=1, le=20),
) -> list[MostUsedItemResponse]:
    """Get items with most check-outs for dashboard."""
    repo = ItemRepository(session, user_id)
    return await repo.get_most_used_items(limit=limit)


@router.get("/stats/recently-used")
async def get_recently_used_items(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    limit: int = Query(5, ge=1, le=20),
) -> list[RecentlyUsedItemResponse]:
    """Get items with most recent check-in/out activity."""
    repo = ItemRepository(session, user_id)
    return await repo.get_recently_used_items(limit=limit)


@router.get("/search")
async def search_items(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
) -> list[ItemListResponse]:
    """Search items by name, description, or tags."""
    repo = ItemRepository(session, user_id)
    items = await repo.search(q, limit)

    return [
        ItemListResponse(
            id=item.id,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            quantity_unit=item.quantity_unit,
            price=item.price,
            is_low_stock=item.is_low_stock,
            tags=item.tags or [],
            category=item.category,
            location=item.location,
            primary_image_url=_get_primary_image_url(item),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@router.get("/low-stock")
async def list_low_stock_items(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[ItemListResponse]:
    """List items that are below their minimum quantity threshold."""
    repo = ItemRepository(session, user_id)
    items = await repo.get_all(low_stock_only=True, limit=100)

    return [
        ItemListResponse(
            id=item.id,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            quantity_unit=item.quantity_unit,
            price=item.price,
            is_low_stock=item.is_low_stock,
            tags=item.tags or [],
            category=item.category,
            location=item.location,
            primary_image_url=_get_primary_image_url(item),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@router.get("/facets")
async def get_item_facets(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    category_id: UUID | None = Query(None, description="Filter facets by category"),
    include_subcategories: bool = Query(
        True, description="Include items from subcategories"
    ),
    location_id: UUID | None = Query(None, description="Filter facets by location"),
    include_sublocations: bool = Query(
        True, description="Include items from sublocations"
    ),
) -> FacetedSearchResponse:
    """Get available facets (attribute values with counts) for filtering.

    Facets are based on the category's attribute template if a category is specified,
    or all unique attribute keys found in matching items.
    """
    repo = ItemRepository(session, user_id)
    facets, total_items = await repo.get_facets(
        category_id=category_id,
        include_subcategories=include_subcategories,
        location_id=location_id,
        include_sublocations=include_sublocations,
    )

    return FacetedSearchResponse(facets=facets, total_items=total_items)


@router.get("/tags")
async def get_all_tags(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    limit: int = Query(100, ge=1, le=500),
) -> list[FacetValue]:
    """Get all unique tags with their counts."""
    repo = ItemRepository(session, user_id)
    tag_counts = await repo.get_all_tags(limit=limit)

    return [FacetValue(value=tag, count=count) for tag, count in tag_counts]


@router.get("/{item_id}")
async def get_item(
    item_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ItemDetailResponse:
    """Get an item by ID."""
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    return ItemDetailResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        category_id=item.category_id,
        location_id=item.location_id,
        quantity=item.quantity,
        quantity_unit=item.quantity_unit,
        min_quantity=item.min_quantity,
        price=item.price,
        attributes=item.attributes,
        tags=item.tags or [],
        ai_classification=item.ai_classification,
        is_low_stock=item.is_low_stock,
        category=item.category,
        location=item.location,
        primary_image_url=_get_primary_image_url(item),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.put("/{item_id}")
async def update_item(
    item_id: UUID,
    data: ItemUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ItemDetailResponse:
    """Update an item."""
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    item = await repo.update(item, data)

    return ItemDetailResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        category_id=item.category_id,
        location_id=item.location_id,
        quantity=item.quantity,
        quantity_unit=item.quantity_unit,
        min_quantity=item.min_quantity,
        price=item.price,
        attributes=item.attributes,
        tags=item.tags or [],
        ai_classification=item.ai_classification,
        is_low_stock=item.is_low_stock,
        category=item.category,
        location=item.location,
        primary_image_url=_get_primary_image_url(item),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.patch("/{item_id}/quantity")
async def update_item_quantity(
    item_id: UUID,
    data: QuantityUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ItemDetailResponse:
    """Quick update for item quantity."""
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    item = await repo.update_quantity(item, data.quantity)

    return ItemDetailResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        category_id=item.category_id,
        location_id=item.location_id,
        quantity=item.quantity,
        quantity_unit=item.quantity_unit,
        min_quantity=item.min_quantity,
        price=item.price,
        attributes=item.attributes,
        tags=item.tags or [],
        ai_classification=item.ai_classification,
        is_low_stock=item.is_low_stock,
        category=item.category,
        location=item.location,
        primary_image_url=_get_primary_image_url(item),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.post("/{item_id}/check-out", status_code=status.HTTP_201_CREATED)
async def check_out_item(
    item_id: UUID,
    data: CheckInOutCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> CheckInOutResponse:
    """Record a check-out event for an item."""
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    record = await repo.create_check_in_out(item_id, "check_out", data)
    return CheckInOutResponse.model_validate(record)


@router.post("/{item_id}/check-in", status_code=status.HTTP_201_CREATED)
async def check_in_item(
    item_id: UUID,
    data: CheckInOutCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> CheckInOutResponse:
    """Record a check-in event for an item."""
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    # Validate that item has been checked out first
    usage_stats = await repo.get_usage_stats(item_id)
    if usage_stats.currently_checked_out <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot check in item that has not been checked out",
        )

    # Validate that check-in quantity doesn't exceed what's currently checked out
    if data.quantity > usage_stats.currently_checked_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot check in {data.quantity} items. Only {usage_stats.currently_checked_out} currently checked out",
        )

    record = await repo.create_check_in_out(item_id, "check_in", data)
    return CheckInOutResponse.model_validate(record)


@router.get("/{item_id}/history")
async def get_item_history(
    item_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[CheckInOutResponse]:
    """Get check-in/out history for an item."""
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    records, total = await repo.get_check_in_out_history(item_id, page, limit)
    responses = [CheckInOutResponse.model_validate(r) for r in records]
    return PaginatedResponse.create(responses, total, page, limit)


@router.get("/{item_id}/usage-stats")
async def get_item_usage_stats(
    item_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ItemUsageStatsResponse:
    """Get usage statistics for an item."""
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return await repo.get_usage_stats(item_id)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Delete an item."""
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    await repo.delete(item)
