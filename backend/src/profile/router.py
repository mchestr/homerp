from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.dependencies import CurrentUserIdDep
from src.billing.router import CreditServiceDep
from src.database import AsyncSessionDep
from src.items.repository import ItemRepository
from src.profile.repository import (
    PurgeRecommendationRepository,
    UserSystemProfileRepository,
)
from src.profile.schemas import (
    DeclutterCostResponse,
    GenerateRecommendationsRequest,
    GenerateRecommendationsResponse,
    HobbyTypesResponse,
    PurgeRecommendationResponse,
    PurgeRecommendationUpdate,
    PurgeRecommendationWithItem,
    UserSystemProfileCreate,
    UserSystemProfileResponse,
    UserSystemProfileUpdate,
)
from src.profile.service import PurgeRecommendationService

router = APIRouter()


# ============================================
# User System Profile Endpoints
# ============================================


@router.get("/hobby-types", response_model=HobbyTypesResponse)
async def get_hobby_types() -> HobbyTypesResponse:
    """Get list of available hobby types."""
    return HobbyTypesResponse()


@router.get("/me", response_model=UserSystemProfileResponse | None)
async def get_my_profile(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> UserSystemProfileResponse | None:
    """Get the current user's system profile."""
    repo = UserSystemProfileRepository(session)
    profile = await repo.get_by_user_id(user_id)
    if not profile:
        return None
    return UserSystemProfileResponse.model_validate(profile)


@router.post("/me", response_model=UserSystemProfileResponse)
async def create_my_profile(
    data: UserSystemProfileCreate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> UserSystemProfileResponse:
    """Create or update the current user's system profile."""
    repo = UserSystemProfileRepository(session)
    profile = await repo.upsert(user_id, data)
    return UserSystemProfileResponse.model_validate(profile)


@router.patch("/me", response_model=UserSystemProfileResponse)
async def update_my_profile(
    data: UserSystemProfileUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> UserSystemProfileResponse:
    """Update the current user's system profile."""
    repo = UserSystemProfileRepository(session)
    profile = await repo.update(user_id, data)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Create one first using POST /profile/me",
        )
    return UserSystemProfileResponse.model_validate(profile)


# ============================================
# Purge Recommendation Endpoints
# ============================================


@router.get("/recommendations", response_model=list[PurgeRecommendationWithItem])
async def get_recommendations(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    limit: int = 50,
) -> list[PurgeRecommendationWithItem]:
    """Get pending purge recommendations for the current user."""
    repo = PurgeRecommendationRepository(session)
    recommendations = await repo.get_pending_for_user(user_id, limit)

    # Enrich with item details
    service = PurgeRecommendationService(session)
    return await service.get_recommendations_with_items(user_id, recommendations)


# Cost calculation: 1 credit per 50 items, minimum 1 credit
ITEMS_PER_CREDIT = 50


def calculate_credits_required(items_to_analyze: int) -> int:
    """Calculate credits required based on items to analyze.

    Returns ceiling division of items/ITEMS_PER_CREDIT, minimum 1 credit.
    """
    if items_to_analyze <= 0:
        return 0
    return (items_to_analyze + ITEMS_PER_CREDIT - 1) // ITEMS_PER_CREDIT


@router.get("/recommendations/cost", response_model=DeclutterCostResponse)
async def get_recommendations_cost(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    credit_service: CreditServiceDep,
    items_to_analyze: int = Query(default=50, ge=10, le=200),
) -> DeclutterCostResponse:
    """
    Get the cost estimate for generating declutter suggestions.

    Returns the number of credits required based on items to analyze.
    Cost is 1 credit per 50 items, with a minimum of 1 credit.
    """

    # Get total item count
    item_repo = ItemRepository(session, user_id)
    total_items = await item_repo.count()

    # Calculate credits required
    credits_required = calculate_credits_required(items_to_analyze)

    # Get user's credit balance
    balance = await credit_service.get_balance(user_id)
    user_credits = balance.purchased_credits + balance.free_credits

    # Check if user has profile
    profile_repo = UserSystemProfileRepository(session)
    profile = await profile_repo.get_by_user_id(user_id)

    return DeclutterCostResponse(
        total_items=total_items,
        items_to_analyze=items_to_analyze,
        credits_required=credits_required,
        items_per_credit=ITEMS_PER_CREDIT,
        has_sufficient_credits=user_credits >= credits_required,
        user_credit_balance=user_credits,
        has_profile=profile is not None,
    )


@router.post(
    "/recommendations/generate", response_model=GenerateRecommendationsResponse
)
async def generate_recommendations(
    request: GenerateRecommendationsRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    credit_service: CreditServiceDep,
) -> GenerateRecommendationsResponse:
    """
    Generate new declutter suggestions using AI.

    Credit cost is based on items_to_analyze: 1 credit per 50 items (minimum 1).
    """
    # Calculate credits required
    credits_required = calculate_credits_required(request.items_to_analyze)

    # Check if user has sufficient credits
    balance = await credit_service.get_balance(user_id)
    user_credits = balance.purchased_credits + balance.free_credits

    if user_credits < credits_required:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. You need {credits_required} credits "
            f"but only have {user_credits}. Please purchase more credits.",
        )

    # Get user's profile
    profile_repo = UserSystemProfileRepository(session)
    profile = await profile_repo.get_by_user_id(user_id)

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please configure your profile first before generating recommendations.",
        )

    # Generate recommendations
    service = PurgeRecommendationService(session)
    recommendation_creates = await service.generate_recommendations(
        user_id, profile, request.max_recommendations, request.items_to_analyze
    )

    # Save recommendations to database
    rec_repo = PurgeRecommendationRepository(session)
    saved_recommendations = await rec_repo.create_many(user_id, recommendation_creates)

    # Deduct credits after successful generation
    credit_label = "credit" if credits_required == 1 else "credits"
    description = f"AI declutter suggestions ({credits_required} {credit_label})"
    for _ in range(credits_required):
        await credit_service.deduct_credit(user_id, description)

    # Enrich with item details
    enriched = await service.get_recommendations_with_items(
        user_id, saved_recommendations
    )

    return GenerateRecommendationsResponse(
        recommendations=enriched,
        total_generated=len(saved_recommendations),
        credits_used=credits_required,
    )


@router.patch(
    "/recommendations/{recommendation_id}", response_model=PurgeRecommendationResponse
)
async def update_recommendation(
    recommendation_id: UUID,
    data: PurgeRecommendationUpdate,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> PurgeRecommendationResponse:
    """Accept or dismiss a purge recommendation."""
    repo = PurgeRecommendationRepository(session)
    recommendation = await repo.update_status(recommendation_id, user_id, data)

    if not recommendation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found",
        )

    return PurgeRecommendationResponse.model_validate(recommendation)


@router.delete(
    "/recommendations/{recommendation_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def dismiss_recommendation(
    recommendation_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Dismiss a purge recommendation (shortcut for updating status to 'dismissed')."""
    repo = PurgeRecommendationRepository(session)
    data = PurgeRecommendationUpdate(status="dismissed")
    recommendation = await repo.update_status(recommendation_id, user_id, data)

    if not recommendation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found",
        )
