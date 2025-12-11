"""Admin API router."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from src.admin.schemas import (
    AdminStatsResponse,
    CreditAdjustmentRequest,
    CreditAdjustmentResponse,
    CreditPackAdminResponse,
    CreditPackCreate,
    CreditPackUpdate,
    PaginatedUsersResponse,
    UserAdminResponse,
    UserAdminUpdate,
)
from src.auth.dependencies import AdminUserDep
from src.billing.models import CreditPack, CreditTransaction
from src.config import Settings, get_settings
from src.database import AsyncSessionDep
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

    return AdminStatsResponse(
        total_users=total_users,
        total_items=total_items,
        total_revenue_cents=total_revenue_cents,
        active_credit_packs=active_credit_packs,
        total_credits_purchased=total_credits_purchased,
        total_credits_used=total_credits_used,
    )
