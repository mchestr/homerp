import json
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import Settings, get_settings
from src.items.models import Item, ItemCheckInOut
from src.profile.models import UserSystemProfile
from src.profile.schemas import (
    PurgeRecommendationCreate,
    PurgeRecommendationWithItem,
)

PURGE_SYSTEM_PROMPT = """You are an inventory management assistant helping users identify items that could potentially be purged or decluttered from their inventory.

Your role is to analyze items based on:
1. Usage patterns (when was it last used/checked out)
2. Quantity (excessive quantities of low-value items)
3. User's hobby profile and interests
4. Item value relative to user's threshold
5. Item age and relevance to user's current interests

You should provide thoughtful, personalized recommendations that respect the user's preferences and hobby needs. Be conservative unless the user has indicated they want aggressive decluttering.

IMPORTANT: Only recommend items that truly seem like candidates for purging. Don't recommend items that are clearly valuable, frequently used, or core to the user's hobbies."""

PURGE_USER_PROMPT = """Analyze the following user profile and inventory items to identify items that could be purged.

USER PROFILE:
- Hobby types: {hobby_types}
- Primary interests: {interests}
- Profile description: {profile_description}
- Retention preference: Keep items unused for up to {retention_months} months
- Quantity threshold: Consider items with quantity > {quantity_threshold}
- Minimum value to keep: {min_value_keep}
- Purge aggressiveness: {aggressiveness}

ITEMS TO ANALYZE (format: name | quantity | unit | price | category | location | last_used | days_since_use):
{items_list}

Based on this information, identify items that are good candidates for purging.

Respond with a JSON array of recommendations. Each recommendation should have:
- item_id: UUID of the item
- confidence: 0.0 to 1.0 (how confident you are this should be purged)
- reason: A clear, user-friendly explanation of why this item could be purged
- factors: Object with keys like "unused_duration", "high_quantity", "low_value", "not_matching_interests" set to true/false

Return at most {max_recommendations} recommendations, ordered by confidence (highest first).
Only include items where confidence >= 0.6.

Example response:
[
  {{
    "item_id": "uuid-here",
    "confidence": 0.85,
    "reason": "This item hasn't been used in over 18 months and you have 25 of them, which exceeds your typical needs as an electronics hobbyist.",
    "factors": {{
      "unused_duration": true,
      "high_quantity": true,
      "low_value": false,
      "not_matching_interests": false
    }}
  }}
]

If no items are good candidates for purging, return an empty array: []

Respond ONLY with the JSON array, no additional text."""


class PurgeRecommendationService:
    """Service for generating AI-powered purge recommendations."""

    def __init__(self, session: AsyncSession, settings: Settings | None = None):
        self.session = session
        self.settings = settings or get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)

    async def _get_items_with_usage(
        self, user_id: UUID, _profile: UserSystemProfile, limit: int = 200
    ) -> list[dict]:
        """Get items with their usage data for analysis."""
        # Get items for the user, limited to prevent token overflow
        result = await self.session.execute(
            select(Item)
            .where(Item.user_id == user_id)
            .order_by(Item.updated_at.desc())
            .limit(limit)
        )
        items = result.scalars().all()

        # Get last check-out for each item
        items_data = []
        for item in items:
            # Get the last check-out event
            checkout_result = await self.session.execute(
                select(ItemCheckInOut)
                .where(
                    ItemCheckInOut.item_id == item.id,
                    ItemCheckInOut.action_type == "check_out",
                )
                .order_by(ItemCheckInOut.occurred_at.desc())
                .limit(1)
            )
            last_checkout = checkout_result.scalar_one_or_none()

            last_used = last_checkout.occurred_at if last_checkout else None
            days_since_use = (datetime.now(UTC) - last_used).days if last_used else None

            # Get category name
            category_name = None
            if item.category_id:
                await self.session.refresh(item, ["category"])
                if item.category:
                    category_name = item.category.name

            # Get location name
            location_name = None
            if item.location_id:
                await self.session.refresh(item, ["location"])
                if item.location:
                    location_name = item.location.name

            items_data.append(
                {
                    "id": str(item.id),
                    "name": item.name,
                    "quantity": item.quantity,
                    "quantity_unit": item.quantity_unit,
                    "price": float(item.price) if item.price else None,
                    "category_name": category_name,
                    "location_name": location_name,
                    "last_used": last_used,
                    "days_since_use": days_since_use,
                }
            )

        return items_data

    async def _get_category_names(self, category_ids: list[UUID]) -> list[str]:
        """Get category names from IDs."""
        if not category_ids:
            return []

        from src.categories.models import Category

        result = await self.session.execute(
            select(Category.name).where(Category.id.in_(category_ids))
        )
        return [row[0] for row in result.all()]

    async def generate_recommendations(
        self,
        user_id: UUID,
        profile: UserSystemProfile,
        max_recommendations: int = 10,
        items_to_analyze: int = 50,
    ) -> list[PurgeRecommendationCreate]:
        """Generate purge recommendations using AI."""
        # Get items with usage data, limited to items_to_analyze
        items_data = await self._get_items_with_usage(
            user_id, profile, items_to_analyze
        )

        if not items_data:
            return []

        # Get interest category names
        interest_names = await self._get_category_names(
            profile.interest_category_ids or []
        )

        # Format items list for the prompt
        items_list = []
        for item in items_data:
            last_used_str = (
                item["last_used"].strftime("%Y-%m-%d") if item["last_used"] else "never"
            )
            days_str = str(item["days_since_use"]) if item["days_since_use"] else "N/A"
            items_list.append(
                f"{item['id']} | {item['name']} | {item['quantity']} | "
                f"{item['quantity_unit']} | ${item['price'] or 0:.2f} | "
                f"{item['category_name'] or 'uncategorized'} | "
                f"{item['location_name'] or 'no location'} | "
                f"{last_used_str} | {days_str} days"
            )

        # Build the prompt
        user_prompt = PURGE_USER_PROMPT.format(
            hobby_types=", ".join(profile.hobby_types) or "not specified",
            interests=", ".join(interest_names) or "not specified",
            profile_description=profile.profile_description or "not provided",
            retention_months=profile.retention_months,
            quantity_threshold=profile.min_quantity_threshold,
            min_value_keep=(
                f"${profile.min_value_keep:.2f}"
                if profile.min_value_keep
                else "not set"
            ),
            aggressiveness=profile.purge_aggressiveness,
            items_list="\n".join(items_list),
            max_recommendations=max_recommendations,
        )

        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=[
                {"role": "system", "content": PURGE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=2000,
        )

        # Parse response
        content = response.choices[0].message.content or "[]"

        try:
            # Handle markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            recommendations_data = json.loads(content)
        except json.JSONDecodeError:
            return []

        # Convert to PurgeRecommendationCreate objects
        recommendations = []
        items_map = {item["id"]: item for item in items_data}

        for rec_data in recommendations_data:
            item_id = rec_data.get("item_id")
            if item_id not in items_map:
                continue

            recommendations.append(
                PurgeRecommendationCreate(
                    item_id=UUID(item_id),
                    reason=rec_data.get("reason", "Recommended for purge review"),
                    confidence=Decimal(str(rec_data.get("confidence", 0.6))),
                    factors=rec_data.get("factors", {}),
                )
            )

        return recommendations

    async def get_recommendations_with_items(
        self,
        _user_id: UUID,
        recommendations: list,  # List of PurgeRecommendation models
    ) -> list[PurgeRecommendationWithItem]:
        """Enrich recommendations with item details."""
        result = []

        for rec in recommendations:
            # Get the item with relationships
            item_result = await self.session.execute(
                select(Item).where(Item.id == rec.item_id)
            )
            item = item_result.scalar_one_or_none()

            if not item:
                continue

            # Get category name
            category_name = None
            if item.category_id:
                await self.session.refresh(item, ["category"])
                if item.category:
                    category_name = item.category.name

            # Get location name
            location_name = None
            if item.location_id:
                await self.session.refresh(item, ["location"])
                if item.location:
                    location_name = item.location.name

            # Get last usage
            checkout_result = await self.session.execute(
                select(ItemCheckInOut)
                .where(
                    ItemCheckInOut.item_id == item.id,
                    ItemCheckInOut.action_type == "check_out",
                )
                .order_by(ItemCheckInOut.occurred_at.desc())
                .limit(1)
            )
            last_checkout = checkout_result.scalar_one_or_none()

            result.append(
                PurgeRecommendationWithItem(
                    id=rec.id,
                    user_id=rec.user_id,
                    item_id=rec.item_id,
                    reason=rec.reason,
                    confidence=rec.confidence,
                    factors=rec.factors,
                    status=rec.status,
                    user_feedback=rec.user_feedback,
                    created_at=rec.created_at,
                    resolved_at=rec.resolved_at,
                    item_name=item.name,
                    item_quantity=item.quantity,
                    item_quantity_unit=item.quantity_unit,
                    item_price=item.price,
                    item_category_name=category_name,
                    item_location_name=location_name,
                    last_used_at=(last_checkout.occurred_at if last_checkout else None),
                )
            )

        return result
