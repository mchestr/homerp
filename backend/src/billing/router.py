from typing import Annotated
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status

from src.auth.dependencies import CurrentUserDep, CurrentUserIdDep
from src.billing.pricing_service import CreditPricingService, get_pricing_service
from src.billing.schemas import (
    CheckoutRequest,
    CheckoutResponse,
    CreditBalanceResponse,
    CreditPackResponse,
    OperationCostResponse,
    OperationCostsResponse,
    PaginatedTransactionResponse,
    PortalResponse,
    RefundRequest,
    RefundResponse,
)
from src.billing.service import CreditService, StripeService
from src.common.rate_limiter import RATE_LIMIT_BILLING, limiter
from src.config import Settings, get_settings
from src.database import AsyncSessionDep

router = APIRouter()


def get_credit_service(
    session: AsyncSessionDep,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CreditService:
    """Dependency for credit service."""
    return CreditService(session, settings)


def get_stripe_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> StripeService:
    """Dependency for Stripe service."""
    return StripeService(settings)


CreditServiceDep = Annotated[CreditService, Depends(get_credit_service)]
StripeServiceDep = Annotated[StripeService, Depends(get_stripe_service)]
CreditPricingServiceDep = Annotated[CreditPricingService, Depends(get_pricing_service)]


@router.get("/costs")
async def get_operation_costs(
    pricing_service: CreditPricingServiceDep,
) -> OperationCostsResponse:
    """Get credit costs for all AI operations.

    This is a public endpoint that returns the credit cost for each operation type.
    Used by the frontend to display accurate costs in the UI.
    """
    pricing_list = await pricing_service.get_all_pricing()

    # Build the response with active pricing
    costs: dict[str, int] = {}
    items: list[OperationCostResponse] = []

    for pricing in pricing_list:
        if pricing.is_active:
            costs[pricing.operation_type] = pricing.credits_per_operation
            items.append(
                OperationCostResponse(
                    operation_type=pricing.operation_type,
                    credits=pricing.credits_per_operation,
                    display_name=pricing.display_name,
                )
            )

    return OperationCostsResponse(costs=costs, items=items)


@router.get("/balance")
async def get_balance(
    user_id: CurrentUserIdDep,
    credit_service: CreditServiceDep,
) -> CreditBalanceResponse:
    """Get current credit balance for the authenticated user."""
    return await credit_service.get_balance(user_id)


@router.get("/packs")
async def list_packs(
    credit_service: CreditServiceDep,
) -> list[CreditPackResponse]:
    """List all available credit packs."""
    packs = await credit_service.get_credit_packs()

    # Find the pack with best value (highest credits per dollar)
    best_value_id = None
    best_ratio = 0
    for pack in packs:
        ratio = pack.credits / pack.price_cents
        if ratio > best_ratio:
            best_ratio = ratio
            best_value_id = pack.id

    return [
        CreditPackResponse(
            id=pack.id,
            name=pack.name,
            credits=pack.credits,
            price_cents=pack.price_cents,
            stripe_price_id=pack.stripe_price_id,
            is_best_value=(pack.id == best_value_id),
        )
        for pack in packs
    ]


@router.post("/checkout")
@limiter.limit(RATE_LIMIT_BILLING)
async def create_checkout(
    request: Request,  # noqa: ARG001 - Required for rate limiting
    data: CheckoutRequest,
    user: CurrentUserDep,
    session: AsyncSessionDep,
    credit_service: CreditServiceDep,
    stripe_service: StripeServiceDep,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CheckoutResponse:
    """Create a Stripe checkout session for purchasing credits."""
    pack = await credit_service.get_credit_pack(data.pack_id)
    if not pack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit pack not found",
        )

    success_url = (
        f"{settings.frontend_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    )
    cancel_url = f"{settings.frontend_url}/billing/cancel"

    checkout_url = await stripe_service.create_checkout_session(
        session=session,
        user=user,
        pack=pack,
        success_url=success_url,
        cancel_url=cancel_url,
    )

    return CheckoutResponse(checkout_url=checkout_url)


@router.get("/transactions")
async def list_transactions(
    user_id: CurrentUserIdDep,
    credit_service: CreditServiceDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedTransactionResponse:
    """Get transaction history for the authenticated user."""
    transactions, total = await credit_service.get_transaction_history(
        user_id, page, limit
    )
    return PaginatedTransactionResponse.create(transactions, total, page, limit)


@router.post("/portal")
@limiter.limit(RATE_LIMIT_BILLING)
async def create_portal_session(
    request: Request,  # noqa: ARG001 - Required for rate limiting
    user: CurrentUserDep,
    session: AsyncSessionDep,
    stripe_service: StripeServiceDep,
    settings: Annotated[Settings, Depends(get_settings)],
) -> PortalResponse:
    """Create a Stripe customer portal session."""
    return_url = f"{settings.frontend_url}/settings/billing"

    portal_url = await stripe_service.create_portal_session(
        session=session,
        user=user,
        return_url=return_url,
    )

    return PortalResponse(portal_url=portal_url)


@router.post("/refund")
@limiter.limit(RATE_LIMIT_BILLING)
async def request_refund(
    request: Request,  # noqa: ARG001 - Required for rate limiting
    data: RefundRequest,
    user_id: CurrentUserIdDep,
    _session: AsyncSessionDep,
    credit_service: CreditServiceDep,
    _stripe_service: StripeServiceDep,
) -> RefundResponse:
    """Request a refund for an unused credit purchase."""
    # Check if refund is eligible
    can_refund, message = await credit_service.can_refund_purchase(
        data.transaction_id, user_id
    )
    if not can_refund:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    # Get the transaction for Stripe refund
    transactions, _ = await credit_service.get_transaction_history(user_id, 1, 1000)
    transaction = next((t for t in transactions if t.id == data.transaction_id), None)

    if not transaction or not transaction.credit_pack:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction not found or invalid",
        )

    # Process Stripe refund if there's a payment intent
    # Note: In a real implementation, you'd get the payment_intent_id from the transaction
    # For now, we'll process the credit refund only

    # Process the credit refund
    success, message, refunded_credits = await credit_service.process_refund(
        data.transaction_id, user_id
    )

    return RefundResponse(
        success=success,
        message=message,
        refunded_credits=refunded_credits,
    )


@router.post("/webhook")
async def handle_webhook(
    request: Request,
    _session: AsyncSessionDep,
    stripe_service: StripeServiceDep,
    credit_service: CreditServiceDep,
    stripe_signature: str = Header(alias="Stripe-Signature"),
) -> dict:
    """Handle Stripe webhook events."""
    payload = await request.body()

    try:
        event = stripe_service.construct_webhook_event(payload, stripe_signature)
    except stripe.SignatureVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid signature: {e}",
        ) from None

    # Handle checkout.session.completed
    if event.type == "checkout.session.completed":
        checkout_session = event.data.object

        user_id = checkout_session.metadata.get("user_id")
        credit_pack_id = checkout_session.metadata.get("credit_pack_id")
        credits = int(checkout_session.metadata.get("credits", 0))

        if user_id and credit_pack_id and credits > 0:
            pack = await credit_service.get_credit_pack(UUID(credit_pack_id))
            await credit_service.add_credits(
                user_id=UUID(user_id),
                amount=credits,
                transaction_type="purchase",
                description=f"Purchased {pack.name if pack else 'credit'} pack ({credits} credits)",
                credit_pack_id=UUID(credit_pack_id),
                stripe_checkout_session_id=checkout_session.id,
                stripe_payment_intent_id=checkout_session.payment_intent,
            )

    # Handle charge.refunded
    elif event.type == "charge.refunded":
        # This is triggered after we initiate a refund
        # The credit deduction is already handled in process_refund
        pass

    return {"status": "success"}
