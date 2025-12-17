from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreditBalanceResponse(BaseModel):
    """Response schema for credit balance."""

    purchased_credits: int = Field(..., description="Purchased credits (never expire)")
    free_credits: int = Field(..., description="Free credits remaining this month")
    total_credits: int = Field(..., description="Total available credits")
    next_free_reset_at: datetime | None = Field(
        None, description="When free credits will reset"
    )


class CreditPackResponse(BaseModel):
    """Response schema for credit pack."""

    id: UUID
    name: str
    credits: int
    price_cents: int
    stripe_price_id: str
    is_best_value: bool = False

    model_config = {"from_attributes": True}


class CheckoutRequest(BaseModel):
    """Request schema for creating checkout session."""

    pack_id: UUID = Field(..., description="Credit pack ID to purchase")


class CheckoutResponse(BaseModel):
    """Response schema for checkout session."""

    checkout_url: str = Field(..., description="Stripe checkout URL")


class PortalResponse(BaseModel):
    """Response schema for customer portal session."""

    portal_url: str = Field(..., description="Stripe customer portal URL")


class RefundRequest(BaseModel):
    """Request schema for refunding a purchase."""

    transaction_id: UUID = Field(..., description="Transaction ID to refund")


class RefundResponse(BaseModel):
    """Response schema for refund."""

    success: bool
    message: str
    refunded_credits: int = 0


class TransactionResponse(BaseModel):
    """Response schema for credit transaction."""

    id: UUID
    amount: int
    transaction_type: str
    description: str
    is_refunded: bool = False
    created_at: datetime
    credit_pack: CreditPackResponse | None = None

    model_config = {"from_attributes": True}


class PaginatedTransactionResponse(BaseModel):
    """Paginated response for transactions."""

    items: list[TransactionResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[TransactionResponse],
        total: int,
        page: int,
        limit: int,
    ) -> "PaginatedTransactionResponse":
        """Create paginated response."""
        total_pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )


class CreditPricingResponse(BaseModel):
    """Response schema for credit pricing."""

    id: UUID
    operation_type: str
    credits_per_operation: int
    display_name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreditPricingUpdate(BaseModel):
    """Request schema for updating credit pricing."""

    credits_per_operation: int | None = Field(
        None, ge=1, description="Credits charged per operation (minimum 1)"
    )
    display_name: str | None = Field(
        None, min_length=1, max_length=100, description="Display name"
    )
    description: str | None = Field(
        None, max_length=500, description="Description of the operation"
    )
    is_active: bool | None = Field(None, description="Whether pricing is active")
