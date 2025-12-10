from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class CreditPack(Base):
    """Credit pack - purchasable credit bundles."""

    __tablename__ = "credit_packs"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    stripe_price_id: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    transactions: Mapped[list["CreditTransaction"]] = relationship(
        back_populates="credit_pack"
    )


class CreditTransaction(Base):
    """Credit transaction - audit log for all credit changes."""

    __tablename__ = "credit_transactions"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # positive = credit, negative = debit
    transaction_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'purchase', 'usage', 'free_monthly', 'refund'
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255))
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(255))
    credit_pack_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("credit_packs.id", ondelete="SET NULL"), index=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    is_refunded: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship(back_populates="credit_transactions")
    credit_pack: Mapped[CreditPack | None] = relationship(back_populates="transactions")


# Import at bottom to avoid circular imports
from src.users.models import User  # noqa: E402
