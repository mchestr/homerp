from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from src.auth.dependencies import CurrentUserDep
from src.auth.oauth import GoogleOAuth, get_google_oauth
from src.auth.schemas import AuthResponse, TokenResponse
from src.auth.service import AuthService, get_auth_service
from src.database import AsyncSessionDep
from src.users.repository import UserRepository
from src.users.schemas import UserResponse

router = APIRouter()


@router.get("/google")
async def google_auth(
    _request: Request,
    oauth: Annotated[GoogleOAuth, Depends(get_google_oauth)],
    redirect_uri: str = Query(..., description="The redirect URI for OAuth callback"),
) -> dict[str, str]:
    """
    Get Google OAuth authorization URL.

    The client should redirect to this URL to initiate OAuth flow.
    """
    auth_url = oauth.get_authorization_url(redirect_uri)
    return {"authorization_url": auth_url}


@router.get("/callback/google")
async def google_callback(
    code: str,
    redirect_uri: str,
    session: AsyncSessionDep,
    oauth: Annotated[GoogleOAuth, Depends(get_google_oauth)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthResponse:
    """
    Handle Google OAuth callback.

    Exchange the authorization code for tokens and create/get user.
    """
    try:
        # Exchange code for access token
        access_token = await oauth.exchange_code(code, redirect_uri)

        # Get user info from Google
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
