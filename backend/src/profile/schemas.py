from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

# ============================================
# User System Profile Schemas
# ============================================


class UserSystemProfileBase(BaseModel):
    """Base schema for user system profile."""

    hobby_types: list[str] = Field(
        default_factory=list,
        description="Types of hobbies/interests (e.g., electronics, woodworking)",
    )
    interest_category_ids: list[UUID] = Field(
        default_factory=list,
        description="Category IDs the user is most interested in",
    )
    retention_months: int = Field(
        default=12,
        ge=1,
        le=120,
        description="Months of non-use before considering item for purge",
    )
    min_quantity_threshold: int = Field(
        default=5,
        ge=1,
        le=1000,
        description="Quantity threshold above which to consider purging",
    )
    min_value_keep: Decimal | None = Field(
        default=None,
        ge=0,
        description="Minimum value to keep items regardless of usage",
    )
    profile_description: str | None = Field(
        default=None,
        max_length=1000,
        description="Free text description to help AI understand user context",
    )
    purge_aggressiveness: str = Field(
        default="moderate",
        pattern="^(conservative|moderate|aggressive)$",
        description="How aggressively to suggest purging items",
    )


class UserSystemProfileCreate(UserSystemProfileBase):
    """Schema for creating a user system profile."""

    pass


class UserSystemProfileUpdate(BaseModel):
    """Schema for updating a user system profile."""

    hobby_types: list[str] | None = None
    interest_category_ids: list[UUID] | None = None
    retention_months: int | None = Field(default=None, ge=1, le=120)
    min_quantity_threshold: int | None = Field(default=None, ge=1, le=1000)
    min_value_keep: Decimal | None = None
    profile_description: str | None = Field(default=None, max_length=1000)
    purge_aggressiveness: str | None = Field(
        default=None, pattern="^(conservative|moderate|aggressive)$"
    )


class UserSystemProfileResponse(UserSystemProfileBase):
    """Schema for user system profile responses."""

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# Purge Recommendation Schemas
# ============================================


class PurgeRecommendationFactor(BaseModel):
    """Individual factor contributing to a purge recommendation."""

    name: str
    description: str
    weight: float = Field(ge=0, le=1)


class PurgeRecommendationBase(BaseModel):
    """Base schema for purge recommendations."""

    reason: str = Field(
        max_length=500, description="Explanation for the recommendation"
    )
    confidence: Decimal = Field(
        ge=0, le=1, description="AI confidence score (0.0 to 1.0)"
    )
    factors: dict = Field(
        default_factory=dict, description="Factors that influenced the recommendation"
    )


class PurgeRecommendationCreate(PurgeRecommendationBase):
    """Schema for creating a purge recommendation (internal use)."""

    item_id: UUID


class PurgeRecommendationUpdate(BaseModel):
    """Schema for updating a purge recommendation status."""

    status: str = Field(pattern="^(accepted|dismissed)$")
    user_feedback: str | None = Field(default=None, max_length=500)


class PurgeRecommendationResponse(PurgeRecommendationBase):
    """Schema for purge recommendation responses."""

    id: UUID
    user_id: UUID
    item_id: UUID
    status: str
    user_feedback: str | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class PurgeRecommendationWithItem(PurgeRecommendationResponse):
    """Schema for purge recommendation with item details."""

    item_name: str
    item_quantity: int
    item_quantity_unit: str
    item_price: Decimal | None
    item_category_name: str | None
    item_location_name: str | None
    last_used_at: datetime | None


# ============================================
# Generate Recommendations Request/Response
# ============================================


class GenerateRecommendationsRequest(BaseModel):
    """Request to generate purge recommendations."""

    max_recommendations: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of recommendations to return",
    )


class GenerateRecommendationsResponse(BaseModel):
    """Response containing generated purge recommendations."""

    recommendations: list[PurgeRecommendationWithItem]
    total_generated: int
    credits_used: int


# ============================================
# Predefined Hobby Types
# ============================================

HOBBY_TYPES = [
    "electronics",
    "woodworking",
    "3d_printing",
    "metalworking",
    "sewing",
    "knitting",
    "jewelry_making",
    "painting",
    "miniatures",
    "model_building",
    "rc_vehicles",
    "drones",
    "photography",
    "gaming",
    "music",
    "home_improvement",
    "gardening",
    "cooking",
    "brewing",
    "leatherworking",
    "automotive",
    "cycling",
    "camping",
    "fishing",
    "collecting",
    "other",
]


class HobbyTypesResponse(BaseModel):
    """Response containing available hobby types."""

    hobby_types: list[str] = HOBBY_TYPES


# ============================================
# Spring Cleaning Audit Schemas
# ============================================


class SpringCleaningCostResponse(BaseModel):
    """Response with the cost estimate for a spring cleaning audit."""

    total_items: int = Field(description="Total number of items in inventory")
    credits_required: int = Field(
        description="Number of credits required for the audit"
    )
    items_per_credit: int = Field(
        default=50, description="Number of items analyzed per credit"
    )
    has_sufficient_credits: bool = Field(description="Whether user has enough credits")
    user_credit_balance: int = Field(description="User's current credit balance")
    has_profile: bool = Field(
        description="Whether user has configured their system profile"
    )


class SpringCleaningAuditRequest(BaseModel):
    """Request to run a spring cleaning audit."""

    max_recommendations: int = Field(
        default=50,
        ge=1,
        le=100,
        description="Maximum number of recommendations to return",
    )
