"""Admin API router."""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from src.admin.schemas import (
    AdminStatsResponse,
    CreditActivityDataPoint,
    CreditActivityResponse,
    CreditAdjustmentRequest,
    CreditAdjustmentResponse,
    CreditPackAdminResponse,
    CreditPackCreate,
    CreditPackUpdate,
    PackBreakdownItem,
    PackBreakdownResponse,
    PaginatedActivityResponse,
    PaginatedUsersResponse,
    RecentActivityItem,
    RevenueTimeSeriesResponse,
    SignupsTimeSeriesResponse,
    TimeSeriesDataPoint,
    UserAdminResponse,
    UserAdminUpdate,
)
from src.auth.dependencies import AdminUserDep
from src.billing.models import CreditPack, CreditTransaction
from src.config import Settings, get_settings
from src.database import AsyncSessionDep
from src.feedback.models import Feedback
from src.items.models import Item
from src.users.models import User

router = APIRouter()


# ============================================================================
# Credit Pack Management
# ============================================================================


@router.get("/packs")
async def list_packs(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> list[CreditPackAdminResponse]:
    """List all credit packs (including inactive) for admin."""
    result = await session.execute(
        select(CreditPack).order_by(CreditPack.sort_order, CreditPack.created_at)
    )
    packs = result.scalars().all()
    return [CreditPackAdminResponse.model_validate(pack) for pack in packs]


@router.post("/packs", status_code=status.HTTP_201_CREATED)
async def create_pack(
    data: CreditPackCreate,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> CreditPackAdminResponse:
    """Create a new credit pack."""
    pack = CreditPack(
        name=data.name,
        credits=data.credits,
        price_cents=data.price_cents,
        stripe_price_id=data.stripe_price_id,
        is_active=data.is_active,
        sort_order=data.sort_order,
    )
    session.add(pack)
    await session.commit()
    await session.refresh(pack)
    return CreditPackAdminResponse.model_validate(pack)


@router.get("/packs/{pack_id}")
async def get_pack(
    pack_id: UUID,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> CreditPackAdminResponse:
    """Get a specific credit pack."""
    result = await session.execute(select(CreditPack).where(CreditPack.id == pack_id))
    pack = result.scalar_one_or_none()
    if not pack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit pack not found",
        )
    return CreditPackAdminResponse.model_validate(pack)


@router.put("/packs/{pack_id}")
async def update_pack(
    pack_id: UUID,
    data: CreditPackUpdate,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> CreditPackAdminResponse:
    """Update a credit pack."""
    result = await session.execute(select(CreditPack).where(CreditPack.id == pack_id))
    pack = result.scalar_one_or_none()
    if not pack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit pack not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pack, key, value)

    await session.commit()
    await session.refresh(pack)
    return CreditPackAdminResponse.model_validate(pack)


@router.delete("/packs/{pack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pack(
    pack_id: UUID,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> None:
    """Delete a credit pack (soft delete by setting inactive)."""
    result = await session.execute(select(CreditPack).where(CreditPack.id == pack_id))
    pack = result.scalar_one_or_none()
    if not pack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit pack not found",
        )

    # Soft delete - just mark as inactive
    pack.is_active = False
    await session.commit()


# ============================================================================
# User Management
# ============================================================================


@router.get("/users")
async def list_users(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Search by email"),
) -> PaginatedUsersResponse:
    """List all users with pagination."""
    query = select(User)

    if search:
        query = query.where(User.email.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    offset = (page - 1) * limit
    query = query.order_by(User.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    users = result.scalars().all()

    items = [UserAdminResponse.model_validate(user) for user in users]
    return PaginatedUsersResponse.create(items, total, page, limit)


@router.get("/users/{user_id}")
async def get_user(
    user_id: UUID,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> UserAdminResponse:
    """Get a specific user."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserAdminResponse.model_validate(user)


@router.put("/users/{user_id}")
async def update_user(
    user_id: UUID,
    data: UserAdminUpdate,
    admin: AdminUserDep,
    session: AsyncSessionDep,
    settings: Annotated[Settings, Depends(get_settings)],
) -> UserAdminResponse:
    """Update a user (admin status)."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from removing their own admin status
    if user.id == admin.id and not data.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin status",
        )

    # Prevent demoting the admin_email user
    if (
        settings.admin_email
        and user.email == settings.admin_email
        and not data.is_admin
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote the primary admin user",
        )

    user.is_admin = data.is_admin
    await session.commit()
    await session.refresh(user)
    return UserAdminResponse.model_validate(user)


@router.post("/users/{user_id}/credits")
async def adjust_user_credits(
    user_id: UUID,
    data: CreditAdjustmentRequest,
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> CreditAdjustmentResponse:
    """Grant or remove credits from a user."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if data.amount == 0 and data.free_credits_amount == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of amount or free_credits_amount must be non-zero",
        )

    # For negative adjustments, check if user has enough purchased credits
    if data.amount < 0 and user.credit_balance < abs(data.amount):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User only has {user.credit_balance} purchased credits, cannot remove {abs(data.amount)}",
        )

    # For negative free credits adjustments, check if user has enough free credits
    if data.free_credits_amount < 0 and user.free_credits_remaining < abs(
        data.free_credits_amount
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User only has {user.free_credits_remaining} free credits, cannot remove {abs(data.free_credits_amount)}",
        )

    # Adjust the credit balances
    user.credit_balance += data.amount
    user.free_credits_remaining += data.free_credits_amount

    # Build description with both amounts if applicable
    desc_parts = []
    if data.amount != 0:
        desc_parts.append(f"purchased: {data.amount:+d}")
    if data.free_credits_amount != 0:
        desc_parts.append(f"free: {data.free_credits_amount:+d}")
    description = f"{data.reason} ({', '.join(desc_parts)})"

    # Create transaction record
    transaction = CreditTransaction(
        user_id=user_id,
        amount=data.amount + data.free_credits_amount,
        transaction_type="admin_adjustment",
        description=description,
    )
    session.add(transaction)

    await session.commit()
    await session.refresh(user)

    return CreditAdjustmentResponse(
        user_id=user.id,
        amount=data.amount,
        free_credits_amount=data.free_credits_amount,
        new_balance=user.credit_balance,
        new_free_credits=user.free_credits_remaining,
        reason=data.reason,
    )


# ============================================================================
# Statistics
# ============================================================================


@router.get("/stats")
async def get_stats(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
) -> AdminStatsResponse:
    """Get admin dashboard statistics."""
    # Total users
    users_result = await session.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0

    # Total items
    items_result = await session.execute(select(func.count(Item.id)))
    total_items = items_result.scalar() or 0

    # Total revenue (sum of purchase transactions * price)
    # We need to sum the amount field for purchase transactions and correlate with pack prices
    revenue_query = (
        select(func.sum(CreditPack.price_cents))
        .select_from(CreditTransaction)
        .join(CreditPack, CreditTransaction.credit_pack_id == CreditPack.id)
        .where(
            CreditTransaction.transaction_type == "purchase",
            CreditTransaction.is_refunded == False,  # noqa: E712
        )
    )
    revenue_result = await session.execute(revenue_query)
    total_revenue_cents = revenue_result.scalar() or 0

    # Active credit packs
    packs_result = await session.execute(
        select(func.count(CreditPack.id)).where(CreditPack.is_active == True)  # noqa: E712
    )
    active_credit_packs = packs_result.scalar() or 0

    # Total credits purchased
    purchased_result = await session.execute(
        select(func.sum(CreditTransaction.amount)).where(
            CreditTransaction.transaction_type == "purchase",
            CreditTransaction.is_refunded == False,  # noqa: E712
        )
    )
    total_credits_purchased = purchased_result.scalar() or 0

    # Total credits used (usage transactions have negative amounts)
    used_result = await session.execute(
        select(func.sum(CreditTransaction.amount)).where(
            CreditTransaction.transaction_type == "usage"
        )
    )
    total_credits_used = abs(used_result.scalar() or 0)

    # Recent signups (last 7 days)
    seven_days_ago = datetime.now(UTC) - timedelta(days=7)
    recent_signups_result = await session.execute(
        select(func.count(User.id)).where(User.created_at >= seven_days_ago)
    )
    recent_signups_7d = recent_signups_result.scalar() or 0

    # Pending feedback count
    pending_feedback_result = await session.execute(
        select(func.count(Feedback.id)).where(
            or_(Feedback.status == "pending", Feedback.status == "in_progress")
        )
    )
    pending_feedback_count = pending_feedback_result.scalar() or 0

    # Recent activity - gather from multiple sources
    recent_activity: list[RecentActivityItem] = []

    # Recent signups (last 10)
    recent_users_result = await session.execute(
        select(User).order_by(User.created_at.desc()).limit(5)
    )
    for user in recent_users_result.scalars():
        recent_activity.append(
            RecentActivityItem(
                id=user.id,
                type="signup",
                title="New user signup",
                description=user.name or user.email,
                user_email=user.email,
                user_name=user.name,
                timestamp=user.created_at,
            )
        )

    # Recent feedback (last 5)
    recent_feedback_result = await session.execute(
        select(Feedback, User)
        .join(User, Feedback.user_id == User.id)
        .order_by(Feedback.created_at.desc())
        .limit(5)
    )
    for feedback, user in recent_feedback_result:
        recent_activity.append(
            RecentActivityItem(
                id=feedback.id,
                type="feedback",
                title=f"{feedback.feedback_type.replace('_', ' ').title()}: {feedback.subject}",
                description=feedback.message[:100] + "..."
                if len(feedback.message) > 100
                else feedback.message,
                user_email=user.email,
                user_name=user.name,
                timestamp=feedback.created_at,
                metadata={
                    "status": feedback.status,
                    "feedback_type": feedback.feedback_type,
                },
            )
        )

    # Recent credit purchases (last 5)
    recent_purchases_result = await session.execute(
        select(CreditTransaction, User, CreditPack)
        .join(User, CreditTransaction.user_id == User.id)
        .outerjoin(CreditPack, CreditTransaction.credit_pack_id == CreditPack.id)
        .where(CreditTransaction.transaction_type == "purchase")
        .order_by(CreditTransaction.created_at.desc())
        .limit(5)
    )
    for transaction, user, pack in recent_purchases_result:
        pack_name = pack.name if pack else "Credit Pack"
        recent_activity.append(
            RecentActivityItem(
                id=transaction.id,
                type="purchase",
                title=f"Credit purchase: {pack_name}",
                description=f"{transaction.amount} credits",
                user_email=user.email,
                user_name=user.name,
                timestamp=transaction.created_at,
                metadata={
                    "amount": transaction.amount,
                    "pack_name": pack_name,
                },
            )
        )

    # Sort all activity by timestamp and take most recent 15
    recent_activity.sort(key=lambda x: x.timestamp, reverse=True)
    recent_activity = recent_activity[:15]

    return AdminStatsResponse(
        total_users=total_users,
        total_items=total_items,
        total_revenue_cents=total_revenue_cents,
        active_credit_packs=active_credit_packs,
        total_credits_purchased=total_credits_purchased,
        total_credits_used=total_credits_used,
        recent_signups_7d=recent_signups_7d,
        pending_feedback_count=pending_feedback_count,
        recent_activity=recent_activity,
    )


def _get_time_range_days(time_range: str) -> tuple[int, str]:
    """Convert time range string to days and label."""
    if time_range == "30d":
        return 30, "30 days"
    elif time_range == "90d":
        return 90, "90 days"
    return 7, "7 days"


def _generate_date_range(days: int) -> list[str]:
    """Generate list of date strings for the past N days."""
    today = datetime.now(UTC).date()
    return [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]


@router.get("/stats/revenue")
async def get_revenue_over_time(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
    time_range: str = Query("7d", pattern="^(7d|30d|90d)$"),
) -> RevenueTimeSeriesResponse:
    """Get revenue aggregated by day for the specified time range."""
    days, period_label = _get_time_range_days(time_range)
    start_date = datetime.now(UTC) - timedelta(days=days)

    # Get total revenue (all time)
    total_query = (
        select(func.sum(CreditPack.price_cents))
        .select_from(CreditTransaction)
        .join(CreditPack, CreditTransaction.credit_pack_id == CreditPack.id)
        .where(
            CreditTransaction.transaction_type == "purchase",
            CreditTransaction.is_refunded == False,  # noqa: E712
        )
    )
    total_result = await session.execute(total_query)
    total_revenue_cents = total_result.scalar() or 0

    # Get revenue by day for the period
    date_trunc_expr = func.date_trunc("day", CreditTransaction.created_at)
    revenue_by_day = await session.execute(
        select(
            date_trunc_expr.label("date"),
            func.sum(CreditPack.price_cents).label("revenue"),
        )
        .select_from(CreditTransaction)
        .join(CreditPack, CreditTransaction.credit_pack_id == CreditPack.id)
        .where(
            CreditTransaction.transaction_type == "purchase",
            CreditTransaction.is_refunded == False,  # noqa: E712
            CreditTransaction.created_at >= start_date,
        )
        .group_by(date_trunc_expr)
        .order_by(date_trunc_expr)
    )

    # Convert to dict for easy lookup
    revenue_dict = {
        row.date.date().isoformat(): int(row.revenue) for row in revenue_by_day
    }

    # Generate complete date range with zeros for missing days
    date_range = _generate_date_range(days)
    data = [
        TimeSeriesDataPoint(date=date, value=revenue_dict.get(date, 0))
        for date in date_range
    ]

    period_revenue = sum(d.value for d in data)

    return RevenueTimeSeriesResponse(
        data=data,
        total_revenue_cents=total_revenue_cents,
        period_revenue_cents=int(period_revenue),
        period_label=period_label,
    )


@router.get("/stats/signups")
async def get_signups_over_time(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
    time_range: str = Query("7d", pattern="^(7d|30d|90d)$"),
) -> SignupsTimeSeriesResponse:
    """Get user signups aggregated by day for the specified time range."""
    days, period_label = _get_time_range_days(time_range)
    start_date = datetime.now(UTC) - timedelta(days=days)

    # Get total users (all time)
    total_result = await session.execute(select(func.count(User.id)))
    total_users = total_result.scalar() or 0

    # Get signups by day
    date_trunc_expr = func.date_trunc("day", User.created_at)
    signups_by_day = await session.execute(
        select(
            date_trunc_expr.label("date"),
            func.count(User.id).label("count"),
        )
        .where(User.created_at >= start_date)
        .group_by(date_trunc_expr)
        .order_by(date_trunc_expr)
    )

    # Convert to dict
    signups_dict = {row.date.date().isoformat(): row.count for row in signups_by_day}

    # Generate complete date range
    date_range = _generate_date_range(days)
    data = [
        TimeSeriesDataPoint(date=date, value=signups_dict.get(date, 0))
        for date in date_range
    ]

    period_signups = sum(int(d.value) for d in data)

    return SignupsTimeSeriesResponse(
        data=data,
        total_users=total_users,
        period_signups=period_signups,
        period_label=period_label,
    )


@router.get("/stats/credits")
async def get_credit_activity(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
    time_range: str = Query("7d", pattern="^(7d|30d|90d)$"),
) -> CreditActivityResponse:
    """Get credit purchases vs usage over time."""
    days, period_label = _get_time_range_days(time_range)
    start_date = datetime.now(UTC) - timedelta(days=days)

    # Get all-time totals
    purchased_result = await session.execute(
        select(func.sum(CreditTransaction.amount)).where(
            CreditTransaction.transaction_type == "purchase",
            CreditTransaction.is_refunded == False,  # noqa: E712
        )
    )
    total_purchased = purchased_result.scalar() or 0

    used_result = await session.execute(
        select(func.sum(CreditTransaction.amount)).where(
            CreditTransaction.transaction_type == "usage"
        )
    )
    total_used = abs(used_result.scalar() or 0)

    # Get purchases by day
    date_trunc_expr = func.date_trunc("day", CreditTransaction.created_at)
    purchases_by_day = await session.execute(
        select(
            date_trunc_expr.label("date"),
            func.sum(CreditTransaction.amount).label("amount"),
        )
        .where(
            CreditTransaction.transaction_type == "purchase",
            CreditTransaction.is_refunded == False,  # noqa: E712
            CreditTransaction.created_at >= start_date,
        )
        .group_by(date_trunc_expr)
        .order_by(date_trunc_expr)
    )
    purchases_dict = {
        row.date.date().isoformat(): int(row.amount) for row in purchases_by_day
    }

    # Get usage by day
    usage_by_day = await session.execute(
        select(
            date_trunc_expr.label("date"),
            func.sum(CreditTransaction.amount).label("amount"),
        )
        .where(
            CreditTransaction.transaction_type == "usage",
            CreditTransaction.created_at >= start_date,
        )
        .group_by(date_trunc_expr)
        .order_by(date_trunc_expr)
    )
    usage_dict = {
        row.date.date().isoformat(): abs(int(row.amount)) for row in usage_by_day
    }

    # Generate complete date range
    date_range = _generate_date_range(days)
    data = [
        CreditActivityDataPoint(
            date=date,
            purchases=purchases_dict.get(date, 0),
            usage=usage_dict.get(date, 0),
        )
        for date in date_range
    ]

    period_purchased = sum(d.purchases for d in data)
    period_used = sum(d.usage for d in data)

    return CreditActivityResponse(
        data=data,
        total_purchased=total_purchased,
        total_used=total_used,
        period_purchased=period_purchased,
        period_used=period_used,
        period_label=period_label,
    )


@router.get("/stats/packs")
async def get_pack_breakdown(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
    time_range: str = Query("7d", pattern="^(7d|30d|90d)$"),
) -> PackBreakdownResponse:
    """Get breakdown of credit pack sales."""
    days, period_label = _get_time_range_days(time_range)
    start_date = datetime.now(UTC) - timedelta(days=days)

    # Get pack sales in the period
    pack_sales = await session.execute(
        select(
            CreditPack.id,
            CreditPack.name,
            CreditPack.credits,
            CreditPack.price_cents,
            func.count(CreditTransaction.id).label("purchase_count"),
            func.sum(CreditPack.price_cents).label("total_revenue"),
        )
        .select_from(CreditTransaction)
        .join(CreditPack, CreditTransaction.credit_pack_id == CreditPack.id)
        .where(
            CreditTransaction.transaction_type == "purchase",
            CreditTransaction.is_refunded == False,  # noqa: E712
            CreditTransaction.created_at >= start_date,
        )
        .group_by(
            CreditPack.id, CreditPack.name, CreditPack.credits, CreditPack.price_cents
        )
        .order_by(func.sum(CreditPack.price_cents).desc())
    )

    rows = pack_sales.all()
    total_purchases = sum(row.purchase_count for row in rows)
    total_revenue = sum(row.total_revenue or 0 for row in rows)

    packs = [
        PackBreakdownItem(
            pack_id=row.id,
            pack_name=row.name,
            credits=row.credits,
            price_cents=row.price_cents,
            purchase_count=row.purchase_count,
            total_revenue_cents=int(row.total_revenue or 0),
            percentage=round((row.total_revenue or 0) / total_revenue * 100, 1)
            if total_revenue > 0
            else 0.0,
        )
        for row in rows
    ]

    return PackBreakdownResponse(
        packs=packs,
        total_purchases=total_purchases,
        total_revenue_cents=total_revenue,
        period_label=period_label,
    )


@router.get("/activity")
async def get_activity_feed(
    _admin: AdminUserDep,
    session: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    activity_type: str | None = Query(None, pattern="^(signup|feedback|purchase)$"),
) -> PaginatedActivityResponse:
    """Get paginated, filterable activity feed."""
    activities: list[RecentActivityItem] = []
    total = 0

    if activity_type is None or activity_type == "signup":
        # Get signups
        signups_query = select(User).order_by(User.created_at.desc())
        if activity_type == "signup":
            count_result = await session.execute(select(func.count(User.id)))
            total = count_result.scalar() or 0
            offset = (page - 1) * limit
            signups_query = signups_query.offset(offset).limit(limit)
        else:
            signups_query = signups_query.limit(50)  # Limit for mixed feed

        signups_result = await session.execute(signups_query)
        for user in signups_result.scalars():
            activities.append(
                RecentActivityItem(
                    id=user.id,
                    type="signup",
                    title="New user signup",
                    description=user.name or user.email,
                    user_email=user.email,
                    user_name=user.name,
                    timestamp=user.created_at,
                )
            )

    if activity_type is None or activity_type == "feedback":
        # Get feedback
        feedback_query = (
            select(Feedback, User)
            .join(User, Feedback.user_id == User.id)
            .order_by(Feedback.created_at.desc())
        )
        if activity_type == "feedback":
            count_result = await session.execute(select(func.count(Feedback.id)))
            total = count_result.scalar() or 0
            offset = (page - 1) * limit
            feedback_query = feedback_query.offset(offset).limit(limit)
        else:
            feedback_query = feedback_query.limit(50)

        feedback_result = await session.execute(feedback_query)
        for feedback, user in feedback_result:
            activities.append(
                RecentActivityItem(
                    id=feedback.id,
                    type="feedback",
                    title=f"{feedback.feedback_type.replace('_', ' ').title()}: {feedback.subject}",
                    description=feedback.message[:100] + "..."
                    if len(feedback.message) > 100
                    else feedback.message,
                    user_email=user.email,
                    user_name=user.name,
                    timestamp=feedback.created_at,
                    metadata={
                        "status": feedback.status,
                        "feedback_type": feedback.feedback_type,
                    },
                )
            )

    if activity_type is None or activity_type == "purchase":
        # Get purchases
        purchases_query = (
            select(CreditTransaction, User, CreditPack)
            .join(User, CreditTransaction.user_id == User.id)
            .outerjoin(CreditPack, CreditTransaction.credit_pack_id == CreditPack.id)
            .where(CreditTransaction.transaction_type == "purchase")
            .order_by(CreditTransaction.created_at.desc())
        )
        if activity_type == "purchase":
            count_result = await session.execute(
                select(func.count(CreditTransaction.id)).where(
                    CreditTransaction.transaction_type == "purchase"
                )
            )
            total = count_result.scalar() or 0
            offset = (page - 1) * limit
            purchases_query = purchases_query.offset(offset).limit(limit)
        else:
            purchases_query = purchases_query.limit(50)

        purchases_result = await session.execute(purchases_query)
        for transaction, user, pack in purchases_result:
            pack_name = pack.name if pack else "Credit Pack"
            activities.append(
                RecentActivityItem(
                    id=transaction.id,
                    type="purchase",
                    title=f"Credit purchase: {pack_name}",
                    description=f"{transaction.amount} credits",
                    user_email=user.email,
                    user_name=user.name,
                    timestamp=transaction.created_at,
                    metadata={
                        "amount": transaction.amount,
                        "pack_name": pack_name,
                    },
                )
            )

    # Sort by timestamp and paginate for mixed feed
    activities.sort(key=lambda x: x.timestamp, reverse=True)

    if activity_type is None:
        # For mixed feed, count total and paginate
        total = len(activities)
        offset = (page - 1) * limit
        activities = activities[offset : offset + limit]

    return PaginatedActivityResponse.create(activities, total, page, limit)
