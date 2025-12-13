from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from src.auth.dependencies import CurrentUserIdDep
from src.billing.router import CreditServiceDep
from src.database import AsyncSessionDep
from src.profile.repository import (
    PurgeRecommendationRepository,
    UserSystemProfileRepository,
)
from src.profile.schemas import (
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
    Generate new purge recommendations using AI.

    This endpoint requires 1 credit to generate recommendations.
    """
    # Check if user has credits
    has_credits = await credit_service.has_credits(user_id)
    if not has_credits:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please purchase more credits to use this feature.",
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
        user_id, profile, request.max_recommendations
    )

    # Save recommendations to database
    rec_repo = PurgeRecommendationRepository(session)
    saved_recommendations = await rec_repo.create_many(user_id, recommendation_creates)

    # Deduct credit after successful generation
    await credit_service.deduct_credit(user_id, "AI purge recommendations generation")

    # Enrich with item details
    enriched = await service.get_recommendations_with_items(
        user_id, saved_recommendations
    )

    return GenerateRecommendationsResponse(
        recommendations=enriched,
        total_generated=len(saved_recommendations),
        credits_used=1,
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
