"""Credit pricing service for managing operation costs."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditPricing
from src.database import get_session

# Default pricing for operations if not found in database
DEFAULT_PRICING = {
    "image_classification": 1,
    "location_analysis": 1,
    "assistant_query": 1,
    "location_suggestion": 1,
}


class CreditPricingService:
    """Service for managing credit pricing."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all_pricing(self) -> list[CreditPricing]:
        """Get all pricing records."""
        result = await self.session.execute(
            select(CreditPricing).order_by(CreditPricing.display_name)
        )
        return list(result.scalars().all())

    async def get_pricing_by_id(self, pricing_id: UUID) -> CreditPricing | None:
        """Get pricing by ID."""
        result = await self.session.execute(
            select(CreditPricing).where(CreditPricing.id == pricing_id)
        )
        return result.scalar_one_or_none()

    async def get_pricing_by_operation(
        self, operation_type: str
    ) -> CreditPricing | None:
        """Get pricing for a specific operation type."""
        result = await self.session.execute(
            select(CreditPricing).where(CreditPricing.operation_type == operation_type)
        )
        return result.scalar_one_or_none()

    async def get_operation_cost(self, operation_type: str) -> int:
        """Get the credit cost for an operation.

        Returns the configured cost if active, or falls back to default pricing.
        """
        pricing = await self.get_pricing_by_operation(operation_type)
        if pricing and pricing.is_active:
            return pricing.credits_per_operation
        return DEFAULT_PRICING.get(operation_type, 1)

    async def update_pricing(
        self,
        pricing_id: UUID,
        credits_per_operation: int | None = None,
        display_name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
    ) -> CreditPricing | None:
        """Update pricing configuration."""
        pricing = await self.get_pricing_by_id(pricing_id)
        if not pricing:
            return None

        if credits_per_operation is not None:
            if credits_per_operation < 1:
                raise ValueError("credits_per_operation must be at least 1")
            if credits_per_operation > 100:
                raise ValueError("credits_per_operation must not exceed 100")
            pricing.credits_per_operation = credits_per_operation
        if display_name is not None:
            pricing.display_name = display_name
        if description is not None:
            pricing.description = description
        if is_active is not None:
            pricing.is_active = is_active

        await self.session.commit()
        await self.session.refresh(pricing)
        return pricing


async def get_pricing_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CreditPricingService:
    """Dependency to get pricing service."""
    return CreditPricingService(session)
