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
class RecentActivityItem(BaseModel):
    """A single activity item for the activity feed."""

    id: UUID
    type: str  # "signup", "feedback", "purchase", "credit_usage"
    title: str
    description: str | None
    user_email: str | None
    user_name: str | None
    timestamp: datetime
    metadata: dict | None = None


class AdminStatsResponse(BaseModel):
    """Admin dashboard statistics."""

    total_users: int
    total_items: int
    total_revenue_cents: int
    active_credit_packs: int
    total_credits_purchased: int
    total_credits_used: int
    # New fields for enhanced dashboard
    recent_signups_7d: int
    pending_feedback_count: int
    recent_activity: list[RecentActivityItem]


class CreditAdjustmentRequest(BaseModel):
    """Schema for admin credit adjustment."""

    amount: int = Field(
        0, description="Purchased credits to add (positive) or remove (negative)"
    )
    free_credits_amount: int = Field(
        0, description="Free credits to add (positive) or remove (negative)"
    )
    reason: str = Field(
        ..., min_length=1, max_length=500, description="Reason for adjustment"
    )


class CreditAdjustmentResponse(BaseModel):
    """Response for credit adjustment."""

    user_id: UUID
    amount: int
    free_credits_amount: int
    new_balance: int
    new_free_credits: int
    reason: str


# Time Series Schemas for Dashboard Charts
class TimeSeriesDataPoint(BaseModel):
    """A single data point in a time series."""

    date: str  # ISO date string (YYYY-MM-DD)
    value: int | float


class RevenueTimeSeriesResponse(BaseModel):
    """Revenue over time response."""

    data: list[TimeSeriesDataPoint]
    total_revenue_cents: int  # All-time total
    period_revenue_cents: int  # Total for selected period
    period_label: str  # e.g., "7 days", "30 days"


class SignupsTimeSeriesResponse(BaseModel):
    """User signups over time response."""

    data: list[TimeSeriesDataPoint]
    total_users: int  # All-time total
    period_signups: int  # Signups in selected period
    period_label: str


class CreditActivityDataPoint(BaseModel):
    """Credit activity data point with purchases and usage."""

    date: str
    purchases: int
    usage: int


class CreditActivityResponse(BaseModel):
    """Credit purchases vs usage over time."""

    data: list[CreditActivityDataPoint]
    total_purchased: int
    total_used: int
    period_purchased: int
    period_used: int
    period_label: str


class PackBreakdownItem(BaseModel):
    """Credit pack sales breakdown item."""

    pack_id: UUID
    pack_name: str
    credits: int
    price_cents: int
    purchase_count: int
    total_revenue_cents: int
    percentage: float  # Percentage of total sales


class PackBreakdownResponse(BaseModel):
    """Credit pack breakdown response."""

    packs: list[PackBreakdownItem]
    total_purchases: int
    total_revenue_cents: int
    period_label: str


class PaginatedActivityResponse(BaseModel):
    """Paginated activity feed response."""

    items: list[RecentActivityItem]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[RecentActivityItem],
        total: int,
        page: int,
        limit: int,
    ) -> "PaginatedActivityResponse":
        """Create paginated response."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )
