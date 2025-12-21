from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.schemas import (
    AssistantQueryRequest,
    AssistantQueryResponse,
    InventoryContext,
    InventoryContextItem,
    SessionCreate,
    SessionDetailResponse,
    SessionListResponse,
    SessionMessageResponse,
    SessionQueryRequest,
    SessionQueryResponse,
    SessionResponse,
    SessionUpdate,
)
from src.ai.service import AIClassificationService, get_ai_service
from src.ai.session_repository import AISessionRepository
from src.ai.tool_executor import ToolExecutor
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


async def _set_rls_context(session: AsyncSession, user_id: UUID) -> None:
    """Set the PostgreSQL session variable for Row Level Security.

    This enables RLS policies on ai_conversation_sessions and ai_conversation_messages
    tables to filter data by user_id.
    """
    await session.execute(
        text("SET LOCAL app.current_user_id = :user_id"),
        {"user_id": str(user_id)},
    )


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


# ============================================================================
# Session Management Endpoints
# ============================================================================


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    data: SessionCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> SessionResponse:
    """Create a new conversation session.

    Sessions store conversation history for persistent chat with the AI assistant.
    """
    await _set_rls_context(session, user_id)
    repo = AISessionRepository(session, user_id)
    title = data.title or "New Conversation"
    session_obj = await repo.create_session(title)

    return SessionResponse(
        id=session_obj.id,
        title=session_obj.title,
        is_active=session_obj.is_active,
        created_at=session_obj.created_at,
        updated_at=session_obj.updated_at,
        message_count=0,
    )


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    active_only: bool = Query(True, description="Only return active sessions"),
) -> SessionListResponse:
    """List the user's conversation sessions.

    Returns sessions ordered by most recently updated first.
    """
    await _set_rls_context(session, user_id)
    repo = AISessionRepository(session, user_id)
    offset = (page - 1) * limit

    # Use optimized query that fetches sessions with message counts in one query
    sessions_with_counts = await repo.list_sessions_with_counts(
        active_only=active_only,
        limit=limit,
        offset=offset,
    )
    total = await repo.count_sessions(active_only=active_only)

    session_responses = [
        SessionResponse(
            id=sess.id,
            title=sess.title,
            is_active=sess.is_active,
            created_at=sess.created_at,
            updated_at=sess.updated_at,
            message_count=msg_count,
        )
        for sess, msg_count in sessions_with_counts
    ]

    return SessionListResponse(
        sessions=session_responses,
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> SessionDetailResponse:
    """Get a session with its full message history."""
    await _set_rls_context(session, user_id)
    repo = AISessionRepository(session, user_id)
    session_obj = await repo.get_session(session_id)

    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Convert messages to response format
    messages = [
        SessionMessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            tool_calls=msg.tool_calls,
            tool_name=msg.tool_name,
            created_at=msg.created_at,
        )
        for msg in session_obj.messages
    ]

    return SessionDetailResponse(
        id=session_obj.id,
        title=session_obj.title,
        is_active=session_obj.is_active,
        created_at=session_obj.created_at,
        updated_at=session_obj.updated_at,
        message_count=len(messages),
        messages=messages,
    )


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    data: SessionUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> SessionResponse:
    """Update a session's title."""
    await _set_rls_context(session, user_id)
    repo = AISessionRepository(session, user_id)
    session_obj = await repo.update_session_title(session_id, data.title)

    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    msg_count = await repo.get_message_count(session_id)

    return SessionResponse(
        id=session_obj.id,
        title=session_obj.title,
        is_active=session_obj.is_active,
        created_at=session_obj.created_at,
        updated_at=session_obj.updated_at,
        message_count=msg_count,
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    permanent: bool = Query(False, description="Permanently delete instead of archive"),
) -> None:
    """Delete or archive a session.

    By default, sessions are archived (soft delete). Set permanent=true to permanently delete.
    """
    await _set_rls_context(session, user_id)
    repo = AISessionRepository(session, user_id)

    if permanent:
        deleted = await repo.delete_session(session_id)
    else:
        deleted = await repo.archive_session(session_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )


# ============================================================================
# Tool-Enabled Chat Endpoint
# ============================================================================


@router.post("/chat", response_model=SessionQueryResponse)
@limiter.limit(RATE_LIMIT_AI)
async def chat_with_tools(
    request: Request,  # noqa: ARG001 - Required for rate limiting
    data: SessionQueryRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    ai_service: Annotated[AIClassificationService, Depends(get_ai_service)],
    ai_usage_service: Annotated[AIUsageService, Depends(get_ai_usage_service)],
    credit_service: CreditServiceDep,
    pricing_service: Annotated[CreditPricingService, Depends(get_pricing_service)],
) -> SessionQueryResponse:
    """Chat with the AI assistant using tool-calling.

    The assistant can use tools to query your inventory dynamically:
    - search_items: Search for items by name or description
    - get_item_details: Get full details about a specific item
    - filter_items: Filter items by category, location, or tags
    - find_similar_items: Find items similar to a given name
    - get_low_stock_items: Find items below minimum quantity
    - get_inventory_summary: Get overview of your inventory

    If session_id is provided, continues an existing conversation.
    If not provided, creates a new session automatically.

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

    # Set RLS context for session and message access
    await _set_rls_context(session, user_id)
    session_repo = AISessionRepository(session, user_id)
    tool_executor = ToolExecutor(session, user_id)

    # Get or create session
    session_id = data.session_id
    if session_id:
        session_obj = await session_repo.get_session(session_id)
        if not session_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
    else:
        # Create new session with generic title for privacy
        # Use commit=False for atomicity - will commit at the end with other changes
        # Note: Users can edit the title later if they want a more descriptive name
        session_obj = await session_repo.create_session(
            "New Conversation", commit=False
        )
        session_id = session_obj.id

    try:
        # Get conversation history for context
        history = await session_repo.get_messages_for_openai(session_id)

        # Query AI with tools
        (
            response_text,
            new_messages,
            token_usage,
        ) = await ai_service.query_assistant_with_tools(
            user_prompt=data.prompt,
            conversation_history=history,
            tool_executor=tool_executor,
        )

        # Persist new messages to session (commit=False for atomicity)
        saved_messages = []
        if new_messages:
            saved_messages = await session_repo.add_messages_batch(
                session_id, new_messages, commit=False
            )

        # Extract tools used from new messages
        tools_used = []
        for msg in new_messages:
            if msg.get("role") == "tool":
                tool_name = msg.get("name")
                if tool_name and tool_name not in tools_used:
                    tools_used.append(tool_name)

        # Convert saved messages to response format
        message_responses = [
            SessionMessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                tool_calls=msg.tool_calls,
                tool_name=msg.tool_name,
                created_at=msg.created_at,
            )
            for msg in saved_messages
        ]

        # Deduct credit after successful query
        credit_transaction = await credit_service.deduct_credit(
            user_id,
            f"AI Chat: {data.prompt[:50]}...",
            amount=operation_cost,
            commit=False,
        )

        # Log token usage
        await ai_usage_service.log_usage(
            session=session,
            user_id=user_id,
            operation_type="assistant_chat",
            token_usage=token_usage,
            credit_transaction_id=credit_transaction.id if credit_transaction else None,
            metadata={
                "session_id": str(session_id),
                "prompt_length": len(data.prompt),
                "tools_used": tools_used,
                "message_count": len(new_messages),
                "credits_charged": operation_cost,
            },
        )

        # Commit everything together
        await session.commit()

        return SessionQueryResponse(
            success=True,
            session_id=session_id,
            response=response_text,
            tools_used=tools_used,
            credits_used=operation_cost,
            new_messages=message_responses,
        )

    except Exception as e:
        return SessionQueryResponse(
            success=False,
            session_id=session_id,
            error=str(e),
        )
