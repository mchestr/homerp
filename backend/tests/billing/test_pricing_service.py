"""Tests for CreditPricingService - dynamic credit pricing logic."""

from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditPricing
from src.billing.pricing_service import DEFAULT_PRICING, CreditPricingService


class TestGetOperationCost:
    """Tests for CreditPricingService.get_operation_cost()."""

    async def test_get_operation_cost_returns_configured_cost(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that configured cost is returned from database."""
        service = CreditPricingService(async_session)
        cost = await service.get_operation_cost(credit_pricing.operation_type)

        assert cost == credit_pricing.credits_per_operation

    async def test_get_operation_cost_returns_default_when_not_configured(
        self,
        async_session: AsyncSession,
    ):
        """Test that default cost is returned when operation not in database."""
        service = CreditPricingService(async_session)

        # Test each default operation type
        for operation_type, default_cost in DEFAULT_PRICING.items():
            cost = await service.get_operation_cost(operation_type)
            assert cost == default_cost

    async def test_get_operation_cost_returns_1_for_unknown_operation(
        self,
        async_session: AsyncSession,
    ):
        """Test that unknown operations default to 1 credit."""
        service = CreditPricingService(async_session)
        cost = await service.get_operation_cost("unknown_operation_type")

        assert cost == 1

    async def test_get_operation_cost_ignores_inactive_pricing(
        self,
        async_session: AsyncSession,
        credit_pricing_list: list[CreditPricing],
    ):
        """Test that inactive pricing configurations are ignored."""
        service = CreditPricingService(async_session)

        # location_suggestion is inactive with 1 credit in the fixture
        # Should fall back to default (also 1)
        inactive_pricing = next(
            p for p in credit_pricing_list if p.operation_type == "location_suggestion"
        )
        assert inactive_pricing.is_active is False

        cost = await service.get_operation_cost("location_suggestion")
        assert cost == DEFAULT_PRICING["location_suggestion"]

    async def test_get_operation_cost_returns_non_default_value(
        self,
        async_session: AsyncSession,
        credit_pricing_list: list[CreditPricing],
    ):
        """Test that non-default pricing values are correctly returned."""
        service = CreditPricingService(async_session)

        # location_analysis has 2 credits in the fixture
        location_analysis = next(
            p for p in credit_pricing_list if p.operation_type == "location_analysis"
        )
        assert location_analysis.credits_per_operation == 2

        cost = await service.get_operation_cost("location_analysis")
        assert cost == 2


class TestGetPricingByOperation:
    """Tests for CreditPricingService.get_pricing_by_operation()."""

    async def test_get_pricing_by_operation_returns_pricing(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that pricing configuration is returned for existing operation."""
        service = CreditPricingService(async_session)
        pricing = await service.get_pricing_by_operation(credit_pricing.operation_type)

        assert pricing is not None
        assert pricing.id == credit_pricing.id
        assert pricing.operation_type == credit_pricing.operation_type

    async def test_get_pricing_by_operation_returns_none_for_unknown(
        self,
        async_session: AsyncSession,
    ):
        """Test that None is returned for unknown operation type."""
        service = CreditPricingService(async_session)
        pricing = await service.get_pricing_by_operation("unknown_operation")

        assert pricing is None


class TestGetAllPricing:
    """Tests for CreditPricingService.get_all_pricing()."""

    async def test_get_all_pricing_returns_all_configurations(
        self,
        async_session: AsyncSession,
        credit_pricing_list: list[CreditPricing],
    ):
        """Test that all pricing configurations are returned."""
        service = CreditPricingService(async_session)
        all_pricing = await service.get_all_pricing()

        assert len(all_pricing) == len(credit_pricing_list)
        operation_types = {p.operation_type for p in all_pricing}
        expected_types = {p.operation_type for p in credit_pricing_list}
        assert operation_types == expected_types

    async def test_get_all_pricing_returns_empty_list_when_none(
        self,
        async_session: AsyncSession,
    ):
        """Test that empty list is returned when no configurations exist."""
        service = CreditPricingService(async_session)
        all_pricing = await service.get_all_pricing()

        assert all_pricing == []


class TestGetPricingById:
    """Tests for CreditPricingService.get_pricing_by_id()."""

    async def test_get_pricing_by_id_returns_pricing(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that pricing configuration is returned by ID."""
        service = CreditPricingService(async_session)
        pricing = await service.get_pricing_by_id(credit_pricing.id)

        assert pricing is not None
        assert pricing.id == credit_pricing.id

    async def test_get_pricing_by_id_returns_none_for_unknown(
        self,
        async_session: AsyncSession,
    ):
        """Test that None is returned for unknown ID."""
        import uuid

        service = CreditPricingService(async_session)
        pricing = await service.get_pricing_by_id(uuid.uuid4())

        assert pricing is None


class TestUpdatePricing:
    """Tests for CreditPricingService.update_pricing()."""

    async def test_update_pricing_updates_credits(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that credits_per_operation can be updated."""
        service = CreditPricingService(async_session)

        updated = await service.update_pricing(
            credit_pricing.id, credits_per_operation=10
        )

        assert updated is not None
        assert updated.credits_per_operation == 10

    async def test_update_pricing_updates_display_name(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that display_name can be updated."""
        service = CreditPricingService(async_session)

        updated = await service.update_pricing(
            credit_pricing.id, display_name="New Display Name"
        )

        assert updated is not None
        assert updated.display_name == "New Display Name"

    async def test_update_pricing_updates_description(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that description can be updated."""
        service = CreditPricingService(async_session)

        updated = await service.update_pricing(
            credit_pricing.id, description="New description"
        )

        assert updated is not None
        assert updated.description == "New description"

    async def test_update_pricing_updates_is_active(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that is_active can be updated."""
        service = CreditPricingService(async_session)

        updated = await service.update_pricing(credit_pricing.id, is_active=False)

        assert updated is not None
        assert updated.is_active is False

    async def test_update_pricing_updates_multiple_fields(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that multiple fields can be updated at once."""
        service = CreditPricingService(async_session)

        updated = await service.update_pricing(
            credit_pricing.id,
            credits_per_operation=5,
            display_name="Updated Name",
            description="Updated description",
            is_active=False,
        )

        assert updated is not None
        assert updated.credits_per_operation == 5
        assert updated.display_name == "Updated Name"
        assert updated.description == "Updated description"
        assert updated.is_active is False

    async def test_update_pricing_returns_none_for_unknown_id(
        self,
        async_session: AsyncSession,
    ):
        """Test that None is returned when updating unknown ID."""
        import uuid

        service = CreditPricingService(async_session)

        updated = await service.update_pricing(uuid.uuid4(), credits_per_operation=5)

        assert updated is None

    async def test_update_pricing_preserves_unchanged_fields(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that unchanged fields are preserved during update."""
        service = CreditPricingService(async_session)
        original_display_name = credit_pricing.display_name
        original_is_active = credit_pricing.is_active

        updated = await service.update_pricing(
            credit_pricing.id, credits_per_operation=10
        )

        assert updated is not None
        assert updated.credits_per_operation == 10
        assert updated.display_name == original_display_name
        assert updated.is_active == original_is_active

    async def test_update_pricing_rejects_zero_credits(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that zero credits are rejected."""
        import pytest

        service = CreditPricingService(async_session)

        with pytest.raises(
            ValueError, match="credits_per_operation must be at least 1"
        ):
            await service.update_pricing(credit_pricing.id, credits_per_operation=0)

    async def test_update_pricing_rejects_negative_credits(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that negative credits are rejected."""
        import pytest

        service = CreditPricingService(async_session)

        with pytest.raises(
            ValueError, match="credits_per_operation must be at least 1"
        ):
            await service.update_pricing(credit_pricing.id, credits_per_operation=-5)

    async def test_update_pricing_rejects_credits_exceeding_maximum(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that credits exceeding maximum (100) are rejected."""
        import pytest

        service = CreditPricingService(async_session)

        with pytest.raises(
            ValueError, match="credits_per_operation must not exceed 100"
        ):
            await service.update_pricing(credit_pricing.id, credits_per_operation=101)

    async def test_update_pricing_accepts_boundary_values(
        self,
        async_session: AsyncSession,
        credit_pricing: CreditPricing,
    ):
        """Test that boundary values (1 and 100) are accepted."""
        service = CreditPricingService(async_session)

        # Test minimum value (1)
        updated = await service.update_pricing(
            credit_pricing.id, credits_per_operation=1
        )
        assert updated is not None
        assert updated.credits_per_operation == 1

        # Test maximum value (100)
        updated = await service.update_pricing(
            credit_pricing.id, credits_per_operation=100
        )
        assert updated is not None
        assert updated.credits_per_operation == 100
