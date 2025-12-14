from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.profile.models import PurgeRecommendation, UserSystemProfile
from src.profile.schemas import (
    PurgeRecommendationCreate,
    PurgeRecommendationUpdate,
    UserSystemProfileCreate,
    UserSystemProfileUpdate,
)


class UserSystemProfileRepository:
    """Repository for user system profile operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_user_id(self, user_id: UUID) -> UserSystemProfile | None:
        """Get user system profile by user ID."""
        result = await self.session.execute(
            select(UserSystemProfile).where(UserSystemProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self, user_id: UUID, data: UserSystemProfileCreate
    ) -> UserSystemProfile:
        """Create a new user system profile."""
        profile = UserSystemProfile(
            user_id=user_id,
            hobby_types=data.hobby_types,
            interest_category_ids=data.interest_category_ids,
            retention_months=data.retention_months,
            min_quantity_threshold=data.min_quantity_threshold,
            min_value_keep=data.min_value_keep,
            profile_description=data.profile_description,
            purge_aggressiveness=data.purge_aggressiveness,
        )
        self.session.add(profile)
        await self.session.commit()
        await self.session.refresh(profile)
        return profile

    async def update(
        self, user_id: UUID, data: UserSystemProfileUpdate
    ) -> UserSystemProfile | None:
        """Update user system profile."""
        profile = await self.get_by_user_id(user_id)
        if not profile:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(profile, key, value)

        await self.session.commit()
        await self.session.refresh(profile)
        return profile

    async def upsert(
        self, user_id: UUID, data: UserSystemProfileCreate | UserSystemProfileUpdate
    ) -> UserSystemProfile:
        """Create or update user system profile."""
        existing = await self.get_by_user_id(user_id)
        if existing:
            if isinstance(data, UserSystemProfileCreate):
                # Convert to update schema
                update_data = UserSystemProfileUpdate(**data.model_dump())
            else:
                update_data = data
            updated = await self.update(user_id, update_data)
            # update should never return None since we just checked existing
            return updated  # type: ignore[return-value]
        return await self.create(
            user_id,
            data
            if isinstance(data, UserSystemProfileCreate)
            else UserSystemProfileCreate(**data.model_dump(exclude_unset=True)),
        )


class PurgeRecommendationRepository:
    """Repository for purge recommendation operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(
        self, recommendation_id: UUID, user_id: UUID
    ) -> PurgeRecommendation | None:
        """Get purge recommendation by ID."""
        result = await self.session.execute(
            select(PurgeRecommendation).where(
                PurgeRecommendation.id == recommendation_id,
                PurgeRecommendation.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_pending_for_user(
        self, user_id: UUID, limit: int = 50
    ) -> list[PurgeRecommendation]:
        """Get pending purge recommendations for a user."""
        result = await self.session.execute(
            select(PurgeRecommendation)
            .where(
                PurgeRecommendation.user_id == user_id,
                PurgeRecommendation.status == "pending",
            )
            .order_by(PurgeRecommendation.confidence.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_pending_for_item(
        self, item_id: UUID, user_id: UUID
    ) -> PurgeRecommendation | None:
        """Get pending recommendation for a specific item."""
        result = await self.session.execute(
            select(PurgeRecommendation).where(
                PurgeRecommendation.item_id == item_id,
                PurgeRecommendation.user_id == user_id,
                PurgeRecommendation.status == "pending",
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self, user_id: UUID, data: PurgeRecommendationCreate
    ) -> PurgeRecommendation:
        """Create a new purge recommendation."""
        recommendation = PurgeRecommendation(
            user_id=user_id,
            item_id=data.item_id,
            reason=data.reason,
            confidence=data.confidence,
            factors=data.factors,
            status="pending",
        )
        self.session.add(recommendation)
        await self.session.commit()
        await self.session.refresh(recommendation)
        return recommendation

    async def create_many(
        self, user_id: UUID, recommendations: list[PurgeRecommendationCreate]
    ) -> list[PurgeRecommendation]:
        """Create multiple purge recommendations."""
        created = []
        for data in recommendations:
            # Skip if there's already a pending recommendation for this item
            existing = await self.get_pending_for_item(data.item_id, user_id)
            if existing:
                continue

            recommendation = PurgeRecommendation(
                user_id=user_id,
                item_id=data.item_id,
                reason=data.reason,
                confidence=Decimal(str(data.confidence)),
                factors=data.factors,
                status="pending",
            )
            self.session.add(recommendation)
            created.append(recommendation)

        if created:
            await self.session.commit()
            for rec in created:
                await self.session.refresh(rec)

        return created

    async def update_status(
        self,
        recommendation_id: UUID,
        user_id: UUID,
        data: PurgeRecommendationUpdate,
    ) -> PurgeRecommendation | None:
        """Update purge recommendation status."""
        recommendation = await self.get_by_id(recommendation_id, user_id)
        if not recommendation:
            return None

        recommendation.status = data.status
        if data.user_feedback:
            recommendation.user_feedback = data.user_feedback
        recommendation.resolved_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(recommendation)
        return recommendation

    async def expire_old_recommendations(
        self, user_id: UUID, days_old: int = 30
    ) -> int:
        """Expire old pending recommendations."""
        cutoff = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        # Calculate cutoff date
        from datetime import timedelta

        cutoff = cutoff - timedelta(days=days_old)

        result = await self.session.execute(
            update(PurgeRecommendation)
            .where(
                PurgeRecommendation.user_id == user_id,
                PurgeRecommendation.status == "pending",
                PurgeRecommendation.created_at < cutoff,
            )
            .values(status="expired", resolved_at=datetime.now(UTC))
        )
        await self.session.commit()
        return result.rowcount  # type: ignore[return-value]
