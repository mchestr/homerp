from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.ai.schemas import (
    AssistantQueryRequest,
    AssistantQueryResponse,
    InventoryContext,
    InventoryContextItem,
)
from src.ai.service import AIClassificationService, get_ai_service
from src.ai.usage_service import AIUsageService, get_ai_usage_service
from src.auth.dependencies import CurrentUserIdDep
from src.billing.pricing_service import CreditPricingService, get_pricing_service
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
                id=str(item.id),
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
    ai_usage_service: Annotated[AIUsageService, Depends(get_ai_usage_service)],
    credit_service: CreditServiceDep,
    pricing_service: Annotated[CreditPricingService, Depends(get_pricing_service)],
) -> AssistantQueryResponse:
    """Query the AI assistant with a prompt.

    The assistant can provide personalized suggestions based on your inventory,
    such as planting schedules, craft project ideas, organization tips, and more.

    Consumes credits based on configured pricing.
    """
    # Get the cost for assistant query
    operation_cost = await pricing_service.get_operation_cost("assistant_query")

    # Check if user has credits
    if not await credit_service.has_credits(user_id, amount=operation_cost):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. You need {operation_cost} credits for AI assistant queries.",
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
        # Query the AI assistant (with token usage tracking)
        response_text, token_usage = await ai_service.query_assistant_with_usage(
            user_prompt=data.prompt,
            inventory_context=inventory_context,
        )

        # Deduct credit after successful query
        # Use commit=False to ensure atomicity with usage logging
        credit_transaction = await credit_service.deduct_credit(
            user_id,
            f"AI Assistant query: {data.prompt[:50]}...",
            amount=operation_cost,
            commit=False,
        )

        # Log token usage
        await ai_usage_service.log_usage(
            session=session,
            user_id=user_id,
            operation_type="assistant_query",
            token_usage=token_usage,
            credit_transaction_id=credit_transaction.id if credit_transaction else None,
            metadata={
                "prompt_length": len(data.prompt),
                "include_inventory_context": data.include_inventory_context,
                "items_in_context": items_in_context,
                "credits_charged": operation_cost,
            },
        )

        # Commit both credit deduction and usage logging together
        await session.commit()

        return AssistantQueryResponse(
            success=True,
            response=response_text,
            context_used=data.include_inventory_context,
            items_in_context=items_in_context,
            credits_used=operation_cost,
        )

    except Exception as e:
        return AssistantQueryResponse(
            success=False,
            error=str(e),
            context_used=data.include_inventory_context,
            items_in_context=items_in_context,
        )
