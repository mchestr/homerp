"""Webhook admin API router."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from src.auth.dependencies import AdminUserDep
from src.common.rate_limiter import RATE_LIMIT_WEBHOOKS, limiter
from src.database import AsyncSessionDep
from src.webhooks.executor import WebhookExecutor
from src.webhooks.repository import WebhookRepository
from src.webhooks.schemas import (
    AVAILABLE_EVENT_TYPES,
    EventTypeInfo,
    PaginatedExecutionsResponse,
    WebhookConfigCreate,
    WebhookConfigResponse,
    WebhookConfigUpdate,
    WebhookExecutionResponse,
    WebhookTestRequest,
    WebhookTestResponse,
)

router = APIRouter()


# ============================================================================
# Event Types
# ============================================================================


@router.get("/event-types")
async def list_event_types(_admin: AdminUserDep) -> list[EventTypeInfo]:
    """List available event types for webhooks."""
    return [EventTypeInfo(**et) for et in AVAILABLE_EVENT_TYPES]


# ============================================================================
# Webhook Configs
# ============================================================================


@router.get("/configs")
async def list_configs(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> list[WebhookConfigResponse]:
    """List all webhook configurations."""
    repo = WebhookRepository(session)
    configs = await repo.get_all_configs()
    return [WebhookConfigResponse.model_validate(c) for c in configs]


@router.post("/configs", status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_WEBHOOKS)
async def create_config(
    request: Request,  # noqa: ARG001 - Required for rate limiting
    data: WebhookConfigCreate,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> WebhookConfigResponse:
    """Create a new webhook configuration."""
    repo = WebhookRepository(session)

    # Check for duplicate event_type
    existing = await repo.get_by_event_type(data.event_type)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Webhook for event type '{data.event_type}' already exists",
        )

    config = await repo.create(data)
    return WebhookConfigResponse.model_validate(config)


@router.get("/configs/{config_id}")
async def get_config(
    config_id: UUID,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> WebhookConfigResponse:
    """Get a specific webhook configuration."""
    repo = WebhookRepository(session)
    config = await repo.get_by_id(config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook configuration not found",
        )
    return WebhookConfigResponse.model_validate(config)


@router.put("/configs/{config_id}")
async def update_config(
    config_id: UUID,
    data: WebhookConfigUpdate,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> WebhookConfigResponse:
    """Update a webhook configuration."""
    repo = WebhookRepository(session)
    config = await repo.get_by_id(config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook configuration not found",
        )

    config = await repo.update(config, data)
    return WebhookConfigResponse.model_validate(config)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(
    config_id: UUID,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> None:
    """Delete a webhook configuration."""
    repo = WebhookRepository(session)
    config = await repo.get_by_id(config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook configuration not found",
        )
    await repo.delete(config)


@router.post("/configs/{config_id}/test")
@limiter.limit(RATE_LIMIT_WEBHOOKS)
async def test_config(
    request: Request,  # noqa: ARG001 - Required for rate limiting
    config_id: UUID,
    data: WebhookTestRequest,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> WebhookTestResponse:
    """Test a webhook configuration with sample data."""
    repo = WebhookRepository(session)
    config = await repo.get_by_id(config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook configuration not found",
        )

    # Build test payload
    test_payload = {
        "feedback": {
            "id": "00000000-0000-0000-0000-000000000000",
            "subject": "Test Feedback",
            "message": "This is a test message",
            "feedback_type": "general",
            "status": "pending",
        },
        "user": {
            "id": "00000000-0000-0000-0000-000000000001",
            "email": "test@example.com",
            "name": "Test User",
        },
        **data.test_payload,
    }

    executor = WebhookExecutor(session)
    try:
        execution = await executor.execute(config, test_payload)
        return WebhookTestResponse(
            success=execution.status == "success",
            status_code=execution.response_status,
            response_body=execution.response_body,
            error=execution.error_message,
        )
    except Exception as e:
        return WebhookTestResponse(
            success=False,
            status_code=None,
            response_body=None,
            error=str(e),
        )


# ============================================================================
# Execution Logs
# ============================================================================


@router.get("/executions")
async def list_executions(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    config_id: UUID | None = Query(None),
    event_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> PaginatedExecutionsResponse:
    """List webhook execution logs."""
    repo = WebhookRepository(session)
    offset = (page - 1) * limit

    executions = await repo.get_executions(
        config_id=config_id,
        event_type=event_type,
        status=status_filter,
        offset=offset,
        limit=limit,
    )
    total = await repo.count_executions(
        config_id=config_id,
        event_type=event_type,
        status=status_filter,
    )

    items = [WebhookExecutionResponse.model_validate(e) for e in executions]
    return PaginatedExecutionsResponse.create(items, total, page, limit)
