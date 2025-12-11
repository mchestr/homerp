from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.feedback.models import Feedback
from src.feedback.schemas import FeedbackAdminUpdate, FeedbackCreate


class FeedbackRepository:
    """Repository for feedback database operations."""

    def __init__(self, session: AsyncSession, user_id: UUID | None = None):
        self.session = session
        self.user_id = user_id

    async def create(self, data: FeedbackCreate) -> Feedback:
        """Create new feedback."""
        if self.user_id is None:
            raise ValueError("user_id is required to create feedback")

        feedback = Feedback(
            user_id=self.user_id,
            subject=data.subject,
            message=data.message,
            feedback_type=data.feedback_type,
        )
        self.session.add(feedback)
        await self.session.commit()
        await self.session.refresh(feedback)
        return feedback

    async def get_user_feedback(
        self, offset: int = 0, limit: int = 20
    ) -> list[Feedback]:
        """Get feedback submitted by the current user."""
        if self.user_id is None:
            raise ValueError("user_id is required")

        result = await self.session.execute(
            select(Feedback)
            .where(Feedback.user_id == self.user_id)
            .order_by(Feedback.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_user_feedback(self) -> int:
        """Count feedback submitted by the current user."""
        if self.user_id is None:
            raise ValueError("user_id is required")

        result = await self.session.execute(
            select(func.count(Feedback.id)).where(Feedback.user_id == self.user_id)
        )
        return result.scalar_one()

    async def get_all(
        self,
        *,
        status: str | None = None,
        feedback_type: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Feedback]:
        """Get all feedback (admin only)."""
        query = (
            select(Feedback)
            .options(selectinload(Feedback.user))
            .order_by(Feedback.created_at.desc())
        )

        if status:
            query = query.where(Feedback.status == status)
        if feedback_type:
            query = query.where(Feedback.feedback_type == feedback_type)

        query = query.offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def count_all(
        self, *, status: str | None = None, feedback_type: str | None = None
    ) -> int:
        """Count all feedback (admin only)."""
        query = select(func.count(Feedback.id))

        if status:
            query = query.where(Feedback.status == status)
        if feedback_type:
            query = query.where(Feedback.feedback_type == feedback_type)

        result = await self.session.execute(query)
        return result.scalar_one()

    async def get_by_id(self, feedback_id: UUID) -> Feedback | None:
        """Get feedback by ID."""
        result = await self.session.execute(
            select(Feedback)
            .options(selectinload(Feedback.user))
            .where(Feedback.id == feedback_id)
        )
        return result.scalar_one_or_none()

    async def update(self, feedback: Feedback, data: FeedbackAdminUpdate) -> Feedback:
        """Update feedback (admin only)."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(feedback, field, value)
        await self.session.commit()
        await self.session.refresh(feedback)
        return feedback

    async def delete(self, feedback: Feedback) -> None:
        """Delete feedback."""
        await self.session.delete(feedback)
        await self.session.commit()
