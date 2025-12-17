"""AI usage tracking service for logging and analyzing token usage."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.ai.models import AIUsageLog
from src.ai.schemas import TokenUsage
from src.users.models import User


class AIUsageService:
    """Service for logging and analyzing AI token usage."""

    async def log_usage(
        self,
        session: AsyncSession,
        user_id: UUID,
        operation_type: str,
        token_usage: TokenUsage,
        credit_transaction_id: UUID | None = None,
        metadata: dict | None = None,
    ) -> AIUsageLog:
        """
        Log AI token usage to the database.

        Args:
            session: Database session
            user_id: User who made the AI request
            operation_type: Type of operation ('image_classification',
                'location_analysis', 'assistant_query', 'location_suggestion')
            token_usage: Token usage information from AI response
            credit_transaction_id: Optional linked credit transaction
            metadata: Optional additional metadata (image count, context size, etc.)

        Returns:
            Created AIUsageLog record
        """
        usage_log = AIUsageLog(
            user_id=user_id,
            credit_transaction_id=credit_transaction_id,
            operation_type=operation_type,
            model=token_usage.model,
            prompt_tokens=token_usage.prompt_tokens,
            completion_tokens=token_usage.completion_tokens,
            total_tokens=token_usage.total_tokens,
            estimated_cost_usd=token_usage.estimated_cost_usd,
            request_metadata=metadata,
        )
        session.add(usage_log)
        await session.flush()
        return usage_log

    async def get_usage_summary(
        self,
        session: AsyncSession,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict:
        """
        Get aggregated usage summary for all users (admin view).

        Args:
            session: Database session
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dictionary with usage summary including totals and breakdowns
        """
        # Build base query
        query = select(
            func.count(AIUsageLog.id).label("total_calls"),
            func.sum(AIUsageLog.prompt_tokens).label("total_prompt_tokens"),
            func.sum(AIUsageLog.completion_tokens).label("total_completion_tokens"),
            func.sum(AIUsageLog.total_tokens).label("total_tokens"),
            func.sum(AIUsageLog.estimated_cost_usd).label("total_cost_usd"),
        )

        if start_date:
            query = query.where(AIUsageLog.created_at >= start_date)
        if end_date:
            query = query.where(AIUsageLog.created_at <= end_date)

        result = await session.execute(query)
        row = result.one()

        # Get breakdown by operation type
        operation_query = select(
            AIUsageLog.operation_type,
            func.count(AIUsageLog.id).label("calls"),
            func.sum(AIUsageLog.total_tokens).label("tokens"),
            func.sum(AIUsageLog.estimated_cost_usd).label("cost_usd"),
        ).group_by(AIUsageLog.operation_type)

        if start_date:
            operation_query = operation_query.where(AIUsageLog.created_at >= start_date)
        if end_date:
            operation_query = operation_query.where(AIUsageLog.created_at <= end_date)

        op_result = await session.execute(operation_query)
        operations = [
            {
                "operation_type": r.operation_type,
                "total_calls": r.calls,
                "total_tokens": r.tokens or 0,
                "total_cost_usd": float(r.cost_usd or 0),
            }
            for r in op_result.all()
        ]

        # Get breakdown by model
        model_query = select(
            AIUsageLog.model,
            func.count(AIUsageLog.id).label("calls"),
            func.sum(AIUsageLog.total_tokens).label("tokens"),
            func.sum(AIUsageLog.estimated_cost_usd).label("cost_usd"),
        ).group_by(AIUsageLog.model)

        if start_date:
            model_query = model_query.where(AIUsageLog.created_at >= start_date)
        if end_date:
            model_query = model_query.where(AIUsageLog.created_at <= end_date)

        model_result = await session.execute(model_query)
        models = [
            {
                "model": r.model,
                "total_calls": r.calls,
                "total_tokens": r.tokens or 0,
                "total_cost_usd": float(r.cost_usd or 0),
            }
            for r in model_result.all()
        ]

        total_tokens = row.total_tokens or 0
        total_cost = float(row.total_cost_usd or Decimal("0"))

        return {
            "total_calls": row.total_calls or 0,
            "total_prompt_tokens": row.total_prompt_tokens or 0,
            "total_completion_tokens": row.total_completion_tokens or 0,
            "total_tokens": total_tokens,
            "total_cost_usd": total_cost,
            "by_operation": operations,
            "by_model": models,
        }

    async def get_usage_by_user(
        self,
        session: AsyncSession,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """
        Get usage aggregated by user (admin view).

        Args:
            session: Database session
            start_date: Optional start date filter
            end_date: Optional end date filter
            limit: Maximum number of users to return

        Returns:
            List of user usage summaries ordered by total tokens descending
        """
        query = (
            select(
                AIUsageLog.user_id,
                User.email.label("user_email"),
                User.name.label("user_name"),
                func.count(AIUsageLog.id).label("total_calls"),
                func.sum(AIUsageLog.total_tokens).label("total_tokens"),
                func.sum(AIUsageLog.estimated_cost_usd).label("total_cost_usd"),
            )
            .join(User, AIUsageLog.user_id == User.id)
            .group_by(AIUsageLog.user_id, User.email, User.name)
            .order_by(func.sum(AIUsageLog.total_tokens).desc())
            .limit(limit)
        )

        if start_date:
            query = query.where(AIUsageLog.created_at >= start_date)
        if end_date:
            query = query.where(AIUsageLog.created_at <= end_date)

        result = await session.execute(query)
        return [
            {
                "user_id": str(r.user_id),
                "user_email": r.user_email,
                "user_name": r.user_name,
                "total_calls": r.total_calls,
                "total_tokens": r.total_tokens or 0,
                "total_cost_usd": float(r.total_cost_usd or Decimal("0")),
            }
            for r in result.all()
        ]

    async def get_usage_history(
        self,
        session: AsyncSession,
        page: int = 1,
        limit: int = 50,
        operation_type: str | None = None,
        user_id: UUID | None = None,
    ) -> tuple[list[dict], int]:
        """
        Get paginated usage history (admin view).

        Args:
            session: Database session
            page: Page number (1-indexed)
            limit: Items per page
            operation_type: Optional filter by operation type
            user_id: Optional filter by user

        Returns:
            Tuple of (list of usage log dicts with user info, total count)
        """
        # Build count query
        count_query = select(func.count(AIUsageLog.id))
        if operation_type:
            count_query = count_query.where(AIUsageLog.operation_type == operation_type)
        if user_id:
            count_query = count_query.where(AIUsageLog.user_id == user_id)

        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0

        # Build main query with user join
        query = (
            select(AIUsageLog)
            .options(selectinload(AIUsageLog.user))
            .order_by(AIUsageLog.created_at.desc())
        )
        if operation_type:
            query = query.where(AIUsageLog.operation_type == operation_type)
        if user_id:
            query = query.where(AIUsageLog.user_id == user_id)

        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)

        result = await session.execute(query)
        logs = list(result.scalars().all())

        # Convert to dicts with user info
        return [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_email": log.user.email if log.user else None,
                "user_name": log.user.name if log.user else None,
                "credit_transaction_id": log.credit_transaction_id,
                "operation_type": log.operation_type,
                "model": log.model,
                "prompt_tokens": log.prompt_tokens,
                "completion_tokens": log.completion_tokens,
                "total_tokens": log.total_tokens,
                "estimated_cost_usd": float(log.estimated_cost_usd),
                "request_metadata": log.request_metadata,
                "created_at": log.created_at,
            }
            for log in logs
        ], total

    async def get_daily_usage(
        self,
        session: AsyncSession,
        days: int = 30,
    ) -> list[dict]:
        """
        Get daily usage aggregation for charts.

        Args:
            session: Database session
            days: Number of days to include

        Returns:
            List of daily usage summaries
        """
        query = (
            select(
                func.date(AIUsageLog.created_at).label("date"),
                func.count(AIUsageLog.id).label("calls"),
                func.sum(AIUsageLog.total_tokens).label("tokens"),
                func.sum(AIUsageLog.estimated_cost_usd).label("cost_usd"),
            )
            .group_by(func.date(AIUsageLog.created_at))
            .order_by(func.date(AIUsageLog.created_at).desc())
            .limit(days)
        )

        result = await session.execute(query)
        return [
            {
                "date": str(r.date),
                "total_calls": r.calls,
                "total_tokens": r.tokens or 0,
                "total_cost_usd": float(r.cost_usd or Decimal("0")),
            }
            for r in result.all()
        ]


def get_ai_usage_service() -> AIUsageService:
    """Get AI usage service instance."""
    return AIUsageService()
