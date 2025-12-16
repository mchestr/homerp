from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.ai.schemas import (
    AssistantQueryRequest,
    AssistantQueryResponse,
    InventoryContext,
    InventoryContextItem,
)
from src.ai.service import AIClassificationService, get_ai_service
from src.auth.dependencies import CurrentUserIdDep
from src.billing.router import CreditServiceDep
from src.common.rate_limiter import RATE_LIMIT_AI, limiter
from src.database import AsyncSessionDep
from src.items.repository import ItemRepository

router = APIRouter()

# Maximum number of items to include in context
MAX_ITEMS_IN_CONTEXT = 100


async def _build_inventory_context(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    limit: int = MAX_ITEMS_IN_CONTEXT,
) -> InventoryContext:
    """Build inventory context for the AI assistant."""
    repo = ItemRepository(session, user_id)

    # Get items with their categories and locations
    items = await repo.get_all(limit=limit)
    total_count = await repo.count()

    # Build items summary
    items_summary = []
    categories_seen = set()
    locations_seen = set()

    for item in items:
        category_name = None
        if item.category:
            category_name = (
                str(item.category.path) if item.category.path else item.category.name
            )
            categories_seen.add(category_name)

        location_name = None
        if item.location:
            location_name = (
                str(item.location.path) if item.location.path else item.location.name
            )
            locations_seen.add(location_name)

        items_summary.append(
            InventoryContextItem(
                name=item.name,
                quantity=item.quantity,
                quantity_unit=item.quantity_unit,
                category=category_name,
                location=location_name,
            )
        )

    return InventoryContext(
        total_items=total_count,
        total_categories=len(categories_seen),
        total_locations=len(locations_seen),
        items_summary=items_summary,
    )


@router.post("/query")
@limiter.limit(RATE_LIMIT_AI)
async def query_assistant(
    request: Request,  # noqa: ARG001 - Required for rate limiting
    data: AssistantQueryRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    ai_service: Annotated[AIClassificationService, Depends(get_ai_service)],
    credit_service: CreditServiceDep,
) -> AssistantQueryResponse:
    """Query the AI assistant with a prompt.

    The assistant can provide personalized suggestions based on your inventory,
    such as planting schedules, craft project ideas, organization tips, and more.

    Consumes 1 credit per query.
    """
    # Check if user has credits
    if not await credit_service.has_credits(user_id):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please purchase more credits to use AI assistant.",
        )

    # Build inventory context if requested
    inventory_context = None
    items_in_context = 0

    if data.include_inventory_context:
        context = await _build_inventory_context(session, user_id)
        items_in_context = len(context.items_summary)
        inventory_context = {
            "total_items": context.total_items,
            "total_categories": context.total_categories,
            "total_locations": context.total_locations,
            "items_summary": [item.model_dump() for item in context.items_summary],
        }

    try:
        # Query the AI assistant
        response_text = await ai_service.query_assistant(
            user_prompt=data.prompt,
            inventory_context=inventory_context,
        )

        # Deduct credit after successful query
        await credit_service.deduct_credit(
            user_id,
            f"AI Assistant query: {data.prompt[:50]}...",
        )

        return AssistantQueryResponse(
            success=True,
            response=response_text,
            context_used=data.include_inventory_context,
            items_in_context=items_in_context,
            credits_used=1,
        )

    except Exception as e:
        return AssistantQueryResponse(
            success=False,
            error=str(e),
            context_used=data.include_inventory_context,
            items_in_context=items_in_context,
        )
