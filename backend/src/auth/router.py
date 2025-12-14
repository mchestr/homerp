from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from src.auth.dependencies import CurrentUserDep
from src.auth.oauth import (
    get_configured_providers,
    get_oauth_provider,
)
from src.auth.schemas import AuthResponse, OAuthProviderInfo, TokenResponse
from src.auth.service import AuthService, get_auth_service
from src.database import AsyncSessionDep
from src.users.repository import UserRepository
from src.users.schemas import UserResponse, UserSettingsUpdate

router = APIRouter()


# Provider metadata for frontend display
PROVIDER_DISPLAY_INFO: dict[str, dict[str, str]] = {
    "google": {
        "name": "Google",
        "icon": "google",
    },
    "github": {
        "name": "GitHub",
        "icon": "github",
    },
}


@router.get("/providers")
async def list_providers() -> list[OAuthProviderInfo]:
    """
    List all configured OAuth providers.

    Returns providers that have valid credentials configured.
    The frontend uses this to dynamically show login buttons.
    """
    configured = get_configured_providers()
    return [
        OAuthProviderInfo(
            id=provider_id,
            name=PROVIDER_DISPLAY_INFO.get(provider_id, {}).get("name", provider_id),
            icon=PROVIDER_DISPLAY_INFO.get(provider_id, {}).get("icon", provider_id),
        )
        for provider_id in configured
    ]


# Static routes must be defined before dynamic routes in FastAPI
@router.get("/me")
async def get_current_user_info(
    current_user: CurrentUserDep,
) -> UserResponse:
    """Get the current authenticated user's information."""
    return UserResponse.model_validate(current_user)


@router.post("/refresh")
async def refresh_token(
    current_user: CurrentUserDep,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    """Refresh the access token."""
    token, expires_in = auth_service.create_access_token(current_user.id)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
    )


@router.patch("/settings")
async def update_user_settings(
    settings: UserSettingsUpdate,
    current_user: CurrentUserDep,
    session: AsyncSessionDep,
) -> UserResponse:
    """Update the current user's settings."""
    repo = UserRepository(session)
    user = await repo.update_settings(current_user, settings)
    return UserResponse.model_validate(user)


# Dynamic OAuth provider routes - must be after static routes


@router.get("/callback/{provider}")
async def oauth_callback(
    provider: Annotated[str, Path(description="OAuth provider name (google, github)")],
    code: str,
    redirect_uri: str,
    session: AsyncSessionDep,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthResponse:
    """
    Handle OAuth callback for any configured provider.

    Exchange the authorization code for tokens and create/get user.
    """
    try:
        oauth = get_oauth_provider(provider)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    if not oauth.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth provider '{provider}' is not configured",
        )

    try:
        # Exchange code for access token
        access_token = await oauth.exchange_code(code, redirect_uri)

        # Get user info from provider
        user_info = await oauth.get_user_info(access_token)

        # Get or create user
        repo = UserRepository(session)
        user, _ = await repo.get_or_create_from_oauth(
            provider=user_info.provider,
            oauth_id=user_info.oauth_id,
            email=user_info.email,
            name=user_info.name,
            avatar_url=user_info.avatar_url,
        )

        # Create JWT token
        token, expires_in = auth_service.create_access_token(user.id)

        return AuthResponse(
            token=TokenResponse(
                access_token=token,
                expires_in=expires_in,
            ),
            user=UserResponse.model_validate(user),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth authentication failed: {e!s}",
        ) from e


@router.get("/{provider}")
async def get_auth_url(
    provider: Annotated[str, Path(description="OAuth provider name (google, github)")],
    redirect_uri: str = Query(..., description="The redirect URI for OAuth callback"),
) -> dict[str, str]:
    """
    Get OAuth authorization URL for any configured provider.

    The client should redirect to this URL to initiate OAuth flow.
    """
    try:
        oauth = get_oauth_provider(provider)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    if not oauth.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth provider '{provider}' is not configured",
        )

    auth_url = oauth.get_authorization_url(redirect_uri)
    return {"authorization_url": auth_url}
