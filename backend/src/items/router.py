from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from src.ai.service import AIClassificationService, get_ai_service
from src.auth.dependencies import CurrentUserIdDep
from src.billing.router import CreditServiceDep
from src.common.schemas import PaginatedResponse
from src.database import AsyncSessionDep
from src.items.repository import ItemRepository
from src.items.schemas import (
    BatchUpdateRequest,
    BatchUpdateResponse,
    CheckInOutCreate,
    CheckInOutResponse,
    DashboardStatsResponse,
    FacetedSearchResponse,
    FacetValue,
    FindSimilarRequest,
    FindSimilarResponse,
    ItemCreate,
    ItemDetailResponse,
    ItemListResponse,
    ItemUpdate,
    ItemUsageStatsResponse,
    MostUsedItemResponse,
    QuantityUpdate,
    RecentlyUsedItemResponse,
    SimilarItemMatch,
)
from src.locations.qr import QRCodeService, get_qr_service
from src.locations.schemas import (
    ItemLocationSuggestionRequest,
    ItemLocationSuggestionResponse,
)
from src.locations.service import LocationService

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
    no_category: bool = Query(False, description="Filter items without a category"),
    no_location: bool = Query(False, description="Filter items without a location"),
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

    Use no_category=true to filter items without any category assigned.
    Use no_location=true to filter items without any location assigned.

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
        no_category=no_category,
        no_location=no_location,
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
        no_category=no_category,
        no_location=no_location,
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
    try:
        item = await repo.create(data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from None

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


@router.patch("/batch")
async def batch_update_items(
    data: BatchUpdateRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> BatchUpdateResponse:
    """Batch update multiple items with the same category and/or location.

    Use this endpoint to assign a category or location to multiple items at once.
    You can also use clear_category=true or clear_location=true to remove
    the category or location from the selected items.
    """
    repo = ItemRepository(session, user_id)
    try:
        updated_ids = await repo.batch_update(
            data.item_ids,
            category_id=data.category_id,
            location_id=data.location_id,
            clear_category=data.clear_category,
            clear_location=data.clear_location,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from None

    return BatchUpdateResponse(
        updated_count=len(updated_ids),
        item_ids=updated_ids,
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


@router.post("/find-similar")
async def find_similar_items(
    data: FindSimilarRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> FindSimilarResponse:
    """Find items similar to a classification result.

    Use this endpoint after AI classification to check for potential duplicates
    before creating a new item. Returns items sorted by similarity score.
    """
    repo = ItemRepository(session, user_id)
    matches, total_searched = await repo.find_similar(
        identified_name=data.identified_name,
        category_path=data.category_path,
        specifications=data.specifications,
        limit=data.limit,
    )

    similar_items = [
        SimilarItemMatch(
            id=item.id,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            quantity_unit=item.quantity_unit,
            similarity_score=score,
            match_reasons=reasons,
            category=item.category,
            location=item.location,
            primary_image_url=_get_primary_image_url(item),
        )
        for item, score, reasons in matches
    ]

    return FindSimilarResponse(
        similar_items=similar_items,
        total_searched=total_searched,
    )


@router.post("/suggest-location")
async def suggest_item_location(
    data: ItemLocationSuggestionRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    ai_service: Annotated[AIClassificationService, Depends(get_ai_service)],
    credit_service: CreditServiceDep,
) -> ItemLocationSuggestionResponse:
    """Suggest optimal storage locations for an item using AI.

    Analyzes the item's characteristics and the user's existing locations
    with their stored items to recommend suitable storage places.

    Consumes 1 credit on successful suggestion.
    """
    # Check if user has credits
    if not await credit_service.has_credits(user_id):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please purchase more credits to use AI suggestions.",
        )

    # Get user's locations with sample items
    location_service = LocationService(session, user_id)
    locations = await location_service.get_locations_with_sample_items()

    if not locations:
        return ItemLocationSuggestionResponse(
            success=True,
            suggestions=[],
            error="No locations found. Create some locations first.",
        )

    # Find similar items to help with suggestion
    repo = ItemRepository(session, user_id)
    similar_items_data = None

    try:
        matches, _ = await repo.find_similar(
            identified_name=data.item_name,
            category_path=data.item_category,
            specifications=data.item_specifications,
            limit=5,
        )

        if matches:
            similar_items_data = []
            for item, _, _ in matches:
                location_name = None
                if item.location:
                    location_name = await location_service.get_path_display(
                        item.location
                    )
                similar_items_data.append(
                    {
                        "name": item.name,
                        "location": location_name,
                    }
                )
    except Exception:
        # If finding similar items fails, continue without them
        pass

    try:
        # Get AI suggestions
        result = await ai_service.suggest_item_location(
            item_name=data.item_name,
            item_category=data.item_category,
            item_description=data.item_description,
            item_specifications=data.item_specifications,
            locations=locations,
            similar_items=similar_items_data,
        )

        # Deduct credit after successful suggestion
        await credit_service.deduct_credit(
            user_id,
            f"Location suggestion: {data.item_name}",
        )

        return ItemLocationSuggestionResponse(
            success=True,
            suggestions=result.suggestions,
        )

    except Exception as e:
        return ItemLocationSuggestionResponse(
            success=False,
            error=str(e),
        )


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


@router.get("/{item_id}/qr")
async def get_item_qr_code(
    item_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    qr_service: Annotated[QRCodeService, Depends(get_qr_service)],
    size: int = Query(10, ge=1, le=40, description="Scale factor (1-40)"),
) -> Response:
    """Generate a QR code PNG for an item.

    The QR code contains the item's URL for scanning.
    """
    repo = ItemRepository(session, user_id)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    qr_bytes = qr_service.generate_item_qr(item_id, size=size)

    return Response(
        content=qr_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="item-{item_id}-qr.png"',
            "Cache-Control": "public, max-age=86400",
        },
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

    try:
        item = await repo.update(item, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from None

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
    """Record a check-in event for an item.

    Uses row-level locking to prevent race conditions where concurrent
    check-ins could result in negative 'currently out' counts.
    """
    repo = ItemRepository(session, user_id)

    # Acquire a row-level lock on the item to prevent race conditions
    # This ensures no concurrent check-ins can bypass the validation
    item = await repo.get_by_id_for_update(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    # Validate that item has been checked out first
    # The lock ensures these stats remain accurate until we commit
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
