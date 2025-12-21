import logging
from uuid import UUID

import stripe
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.billing.models import CreditPack, CreditTransaction
from src.billing.schemas import CreditBalanceResponse, TransactionResponse
from src.common.logging_utils import mask_email
from src.config import Settings
from src.users.models import User

logger = logging.getLogger(__name__)


class CreditService:
    """Service for credit management operations."""

    def __init__(self, session: AsyncSession, settings: Settings):
        self.session = session
        self.settings = settings

    async def get_user(self, user_id: UUID) -> User | None:
        """Get user by ID."""
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_for_update(self, user_id: UUID) -> User | None:
        """Get user by ID with row-level lock (SELECT FOR UPDATE).

        This prevents race conditions when multiple concurrent requests
        try to modify the user's credit balance simultaneously.
        """
        result = await self.session.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_balance(self, user_id: UUID) -> CreditBalanceResponse:
        """Get credit balance for a user.

        Note: Monthly credit resets have been removed. Free credits now represent
        a one-time signup bonus that doesn't reset.
        """
        user = await self.get_user(user_id)
        if not user:
            return CreditBalanceResponse(
                purchased_credits=0,
                free_credits=0,
                total_credits=0,
                next_free_reset_at=None,
            )

        return CreditBalanceResponse(
            purchased_credits=user.credit_balance,
            free_credits=user.free_credits_remaining,
            total_credits=user.credit_balance + user.free_credits_remaining,
            next_free_reset_at=None,  # No more monthly resets
        )

    async def has_credits(self, user_id: UUID, amount: int = 1) -> bool:
        """Check if user has enough credits. Admins always have credits."""
        user = await self.get_user(user_id)
        if user and user.is_admin:
            return True
        balance = await self.get_balance(user_id)
        return balance.total_credits >= amount

    async def deduct_credit(
        self, user_id: UUID, description: str, amount: int = 1, *, commit: bool = True
    ) -> CreditTransaction | None:
        """
        Deduct credits from user's balance.

        Uses free credits first, then purchased credits.
        Admins bypass credit deduction entirely.
        Returns the CreditTransaction if successful, None if admin bypass or
        insufficient credits.

        Uses SELECT FOR UPDATE to prevent race conditions when multiple
        concurrent requests try to deduct credits simultaneously.

        Args:
            user_id: The user's ID
            description: Description of what the credits were used for
            amount: Number of credits to deduct (default: 1)
            commit: Whether to commit the transaction (default: True).
                Set to False when you need to perform additional operations
                atomically with the credit deduction.
        """
        if amount < 1:
            return None  # Nothing to deduct

        # Use row-level locking to prevent race conditions
        user = await self.get_user_for_update(user_id)
        if not user:
            logger.warning(
                f"Credit deduction failed: user not found, user_id={user_id}"
            )
            return None

        # Admins bypass credit system
        if user.is_admin:
            logger.debug(f"Admin bypass for credit deduction: user_id={user_id}")
            return None

        total_available = user.free_credits_remaining + user.credit_balance
        if total_available < amount:
            logger.info(
                f"Insufficient credits: user_id={user_id}, "
                f"requested={amount}, available={total_available}"
            )
            return None

        # Deduct from free credits first, then purchased credits
        remaining_to_deduct = amount
        free_used = 0
        purchased_used = 0
        if user.free_credits_remaining > 0:
            free_to_use = min(user.free_credits_remaining, remaining_to_deduct)
            user.free_credits_remaining -= free_to_use
            remaining_to_deduct -= free_to_use
            free_used = free_to_use

        if remaining_to_deduct > 0:
            user.credit_balance -= remaining_to_deduct
            purchased_used = remaining_to_deduct

        # Log the usage transaction
        transaction = CreditTransaction(
            user_id=user.id,
            amount=-amount,
            transaction_type="usage",
            description=description,
        )
        self.session.add(transaction)
        if commit:
            await self.session.commit()
        else:
            await self.session.flush()

        logger.info(
            f"Credits deducted: user_id={user_id}, amount={amount}, "
            f"free_used={free_used}, purchased_used={purchased_used}, "
            f"transaction_id={transaction.id}, description={description}"
        )
        return transaction

    async def add_credits(
        self,
        user_id: UUID,
        amount: int,
        transaction_type: str,
        description: str,
        credit_pack_id: UUID | None = None,
        stripe_payment_intent_id: str | None = None,
        stripe_checkout_session_id: str | None = None,
    ) -> CreditTransaction:
        """Add credits to user's balance."""
        user = await self.get_user(user_id)
        if not user:
            logger.error(f"Failed to add credits: user not found, user_id={user_id}")
            raise ValueError("User not found")

        user.credit_balance += amount

        transaction = CreditTransaction(
            user_id=user_id,
            amount=amount,
            transaction_type=transaction_type,
            description=description,
            credit_pack_id=credit_pack_id,
            stripe_payment_intent_id=stripe_payment_intent_id,
            stripe_checkout_session_id=stripe_checkout_session_id,
        )
        self.session.add(transaction)
        await self.session.commit()
        await self.session.refresh(transaction)

        logger.info(
            f"Credits added: user_id={user_id}, amount={amount}, "
            f"type={transaction_type}, transaction_id={transaction.id}, "
            f"credit_pack_id={credit_pack_id}, "
            f"stripe_checkout_session_id={stripe_checkout_session_id}"
        )
        return transaction

    async def get_transaction_history(
        self,
        user_id: UUID,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[TransactionResponse], int]:
        """Get transaction history for a user."""
        offset = (page - 1) * limit

        # Get total count
        count_result = await self.session.execute(
            select(func.count(CreditTransaction.id)).where(
                CreditTransaction.user_id == user_id
            )
        )
        total = count_result.scalar_one()

        # Get transactions
        result = await self.session.execute(
            select(CreditTransaction)
            .options(selectinload(CreditTransaction.credit_pack))
            .where(CreditTransaction.user_id == user_id)
            .order_by(CreditTransaction.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        transactions = result.scalars().all()

        return [TransactionResponse.model_validate(t) for t in transactions], total

    async def get_credit_packs(self) -> list[CreditPack]:
        """Get all active credit packs."""
        result = await self.session.execute(
            select(CreditPack)
            .where(CreditPack.is_active.is_(True))
            .order_by(CreditPack.sort_order)
        )
        return list(result.scalars().all())

    async def get_credit_pack(self, pack_id: UUID) -> CreditPack | None:
        """Get a credit pack by ID."""
        result = await self.session.execute(
            select(CreditPack).where(
                CreditPack.id == pack_id, CreditPack.is_active.is_(True)
            )
        )
        return result.scalar_one_or_none()

    async def can_refund_purchase(
        self, transaction_id: UUID, user_id: UUID
    ) -> tuple[bool, str]:
        """
        Check if a purchase can be refunded.

        A purchase can be refunded if:
        1. It's a 'purchase' type transaction
        2. It hasn't been refunded already
        3. The credits from that purchase haven't been used
        """
        result = await self.session.execute(
            select(CreditTransaction)
            .options(selectinload(CreditTransaction.credit_pack))
            .where(
                CreditTransaction.id == transaction_id,
                CreditTransaction.user_id == user_id,
            )
        )
        transaction = result.scalar_one_or_none()

        if not transaction:
            return False, "Transaction not found"

        if transaction.transaction_type != "purchase":
            return False, "Only purchases can be refunded"

        if transaction.is_refunded:
            return False, "Transaction has already been refunded"

        # Check if user still has enough credits to refund
        user = await self.get_user(user_id)
        if not user or user.credit_balance < transaction.amount:
            return False, "Purchased credits have been used and cannot be refunded"

        return True, "Refund eligible"

    async def process_refund(
        self, transaction_id: UUID, user_id: UUID
    ) -> tuple[bool, str, int]:
        """
        Process a refund for a purchase.

        Returns (success, message, refunded_credits).
        """
        can_refund, message = await self.can_refund_purchase(transaction_id, user_id)
        if not can_refund:
            logger.info(
                f"Refund not eligible: user_id={user_id}, "
                f"transaction_id={transaction_id}, reason={message}"
            )
            return False, message, 0

        # Get the original transaction
        result = await self.session.execute(
            select(CreditTransaction).where(CreditTransaction.id == transaction_id)
        )
        transaction = result.scalar_one()

        # Deduct credits from user
        user = await self.get_user(user_id)
        if user:
            user.credit_balance -= transaction.amount

        # Mark original transaction as refunded
        transaction.is_refunded = True

        # Create refund transaction
        refund_transaction = CreditTransaction(
            user_id=user_id,
            amount=-transaction.amount,
            transaction_type="refund",
            description=f"Refund for {transaction.description}",
            credit_pack_id=transaction.credit_pack_id,
            stripe_payment_intent_id=transaction.stripe_payment_intent_id,
        )
        self.session.add(refund_transaction)

        await self.session.commit()

        logger.info(
            f"Refund processed: user_id={user_id}, "
            f"original_transaction_id={transaction_id}, "
            f"refund_transaction_id={refund_transaction.id}, "
            f"amount={transaction.amount}"
        )
        return True, "Refund processed successfully", transaction.amount


class StripeService:
    """Service for Stripe integration."""

    def __init__(self, settings: Settings):
        self.settings = settings
        stripe.api_key = settings.stripe_secret_key

    async def get_or_create_customer(self, session: AsyncSession, user: User) -> str:
        """Get or create a Stripe customer for a user."""
        if user.stripe_customer_id:
            logger.debug(
                f"Using existing Stripe customer: user_id={user.id}, "
                f"customer_id={user.stripe_customer_id}"
            )
            return user.stripe_customer_id

        # Create new Stripe customer
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": str(user.id)},
        )

        user.stripe_customer_id = customer.id
        await session.commit()

        logger.info(
            f"Created Stripe customer: user_id={user.id}, "
            f"customer_id={customer.id}, email={mask_email(user.email)}"
        )
        return customer.id

    async def create_checkout_session(
        self,
        session: AsyncSession,
        user: User,
        pack: CreditPack,
        success_url: str,
        cancel_url: str,
    ) -> str:
        """Create a Stripe checkout session for purchasing credits."""
        customer_id = await self.get_or_create_customer(session, user)

        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="payment",
            line_items=[
                {
                    "price": pack.stripe_price_id,
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": str(user.id),
                "credit_pack_id": str(pack.id),
                "credits": str(pack.credits),
            },
        )

        logger.info(
            f"Created Stripe checkout session: user_id={user.id}, "
            f"pack_id={pack.id}, pack_name={pack.name}, credits={pack.credits}, "
            f"session_id={checkout_session.id}"
        )
        return checkout_session.url

    async def create_portal_session(
        self, session: AsyncSession, user: User, return_url: str
    ) -> str:
        """Create a Stripe customer portal session."""
        customer_id = await self.get_or_create_customer(session, user)

        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )

        return portal_session.url

    async def create_refund(self, payment_intent_id: str) -> stripe.Refund:
        """Create a Stripe refund for a payment."""
        logger.info(f"Creating Stripe refund: payment_intent_id={payment_intent_id}")
        refund = stripe.Refund.create(payment_intent=payment_intent_id)
        logger.info(
            f"Stripe refund created: refund_id={refund.id}, "
            f"payment_intent_id={payment_intent_id}, status={refund.status}"
        )
        return refund

    def construct_webhook_event(self, payload: bytes, signature: str) -> stripe.Event:
        """Construct and verify a Stripe webhook event."""
        return stripe.Webhook.construct_event(
            payload,
            signature,
            self.settings.stripe_webhook_secret,
        )
