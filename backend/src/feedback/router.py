"""Feedback API router."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.dependencies import AdminUserDep, CurrentUserIdDep
from src.database import AsyncSessionDep
from src.feedback.repository import FeedbackRepository
from src.feedback.schemas import (
    FeedbackAdminResponse,
    FeedbackAdminUpdate,
    FeedbackCreate,
    FeedbackResponse,
    PaginatedFeedbackResponse,
)

router = APIRouter()


# ============================================================================
# User Endpoints
# ============================================================================


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_feedback(
    data: FeedbackCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> FeedbackResponse:
    """Submit feedback."""
    repo = FeedbackRepository(session, user_id)
    feedback = await repo.create(data)
    return FeedbackResponse.model_validate(feedback)


@router.get("")
async def list_my_feedback(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> list[FeedbackResponse]:
    """List feedback submitted by the current user."""
    repo = FeedbackRepository(session, user_id)
    offset = (page - 1) * limit
    feedback_list = await repo.get_user_feedback(offset=offset, limit=limit)
    return [FeedbackResponse.model_validate(f) for f in feedback_list]


# ============================================================================
# Admin Endpoints
# ============================================================================


@router.get("/admin")
async def list_all_feedback(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    feedback_type: str | None = Query(None),
) -> PaginatedFeedbackResponse:
    """List all feedback (admin only)."""
    repo = FeedbackRepository(session)
    offset = (page - 1) * limit

    feedback_list = await repo.get_all(
        status=status_filter,
        feedback_type=feedback_type,
        offset=offset,
        limit=limit,
    )
    total = await repo.count_all(status=status_filter, feedback_type=feedback_type)

    items = [
        FeedbackAdminResponse(
            id=f.id,
            user_id=f.user_id,
            user_email=f.user.email,
            user_name=f.user.name,
            subject=f.subject,
            message=f.message,
            feedback_type=f.feedback_type,
            status=f.status,
            admin_notes=f.admin_notes,
            created_at=f.created_at,
            updated_at=f.updated_at,
        )
        for f in feedback_list
    ]

    return PaginatedFeedbackResponse.create(items, total, page, limit)


@router.get("/admin/{feedback_id}")
async def get_feedback(
    feedback_id: UUID,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> FeedbackAdminResponse:
    """Get specific feedback (admin only)."""
    repo = FeedbackRepository(session)
    feedback = await repo.get_by_id(feedback_id)
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )

    return FeedbackAdminResponse(
        id=feedback.id,
        user_id=feedback.user_id,
        user_email=feedback.user.email,
        user_name=feedback.user.name,
        subject=feedback.subject,
        message=feedback.message,
        feedback_type=feedback.feedback_type,
        status=feedback.status,
        admin_notes=feedback.admin_notes,
        created_at=feedback.created_at,
        updated_at=feedback.updated_at,
    )


@router.put("/admin/{feedback_id}")
async def update_feedback(
    feedback_id: UUID,
    data: FeedbackAdminUpdate,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> FeedbackAdminResponse:
    """Update feedback status/notes (admin only)."""
    repo = FeedbackRepository(session)
    feedback = await repo.get_by_id(feedback_id)
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )

    feedback = await repo.update(feedback, data)

    return FeedbackAdminResponse(
        id=feedback.id,
        user_id=feedback.user_id,
        user_email=feedback.user.email,
        user_name=feedback.user.name,
        subject=feedback.subject,
        message=feedback.message,
        feedback_type=feedback.feedback_type,
        status=feedback.status,
        admin_notes=feedback.admin_notes,
        created_at=feedback.created_at,
        updated_at=feedback.updated_at,
    )


@router.delete("/admin/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(
    feedback_id: UUID,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> None:
    """Delete feedback (admin only)."""
    repo = FeedbackRepository(session)
    feedback = await repo.get_by_id(feedback_id)
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )
    await repo.delete(feedback)
