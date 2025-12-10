"""Admin schemas for request/response models."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# Credit Pack Schemas
class CreditPackCreate(BaseModel):
    """Schema for creating a credit pack."""

    name: str = Field(..., min_length=1, max_length=100)
    credits: int = Field(..., gt=0)
    price_cents: int = Field(..., ge=0)
    stripe_price_id: str = Field(..., min_length=1, max_length=255)
    is_active: bool = True
    sort_order: int = 0


class CreditPackUpdate(BaseModel):
    """Schema for updating a credit pack."""

    name: str | None = Field(None, min_length=1, max_length=100)
    credits: int | None = Field(None, gt=0)
    price_cents: int | None = Field(None, ge=0)
    stripe_price_id: str | None = Field(None, min_length=1, max_length=255)
    is_active: bool | None = None
    sort_order: int | None = None


class CreditPackAdminResponse(BaseModel):
    """Admin response schema for credit pack (includes inactive packs)."""

    id: UUID
    name: str
    credits: int
    price_cents: int
    stripe_price_id: str
    is_active: bool
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# User Schemas
class UserAdminResponse(BaseModel):
    """Admin response schema for user."""

    id: UUID
    email: str
    name: str | None
    avatar_url: str | None
    is_admin: bool
    credit_balance: int
    free_credits_remaining: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserAdminUpdate(BaseModel):
    """Schema for admin updating a user."""

    is_admin: bool


class PaginatedUsersResponse(BaseModel):
    """Paginated response for users."""

    items: list[UserAdminResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[UserAdminResponse],
        total: int,
        page: int,
        limit: int,
    ) -> "PaginatedUsersResponse":
        """Create paginated response."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )


# Stats Schemas
class AdminStatsResponse(BaseModel):
    """Admin dashboard statistics."""

    total_users: int
    total_items: int
    total_revenue_cents: int
    active_credit_packs: int
    total_credits_purchased: int
    total_credits_used: int
