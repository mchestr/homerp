from abc import ABC, abstractmethod
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from src.config import Settings, get_settings


@dataclass
class OAuthUserInfo:
    """User info from OAuth provider."""

    provider: str
    oauth_id: str
    email: str
    name: str | None
    avatar_url: str | None


class OAuthProvider(ABC):
    """Base class for OAuth providers."""

    # Subclasses must define these
    PROVIDER_NAME: str
    AUTHORIZE_URL: str
    TOKEN_URL: str
    USERINFO_URL: str
    DEFAULT_SCOPES: list[str]

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    @property
    @abstractmethod
    def client_id(self) -> str:
        """Get the OAuth client ID."""
        ...

    @property
    @abstractmethod
    def client_secret(self) -> str:
        """Get the OAuth client secret."""
        ...

    @property
    def is_configured(self) -> bool:
        """Check if the provider has required credentials configured."""
        return bool(self.client_id and self.client_secret)

    def get_authorization_url(self, redirect_uri: str, state: str | None = None) -> str:
        """Get the OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.DEFAULT_SCOPES),
        }
        if state:
            params["state"] = state
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> str:
        """Exchange authorization code for access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = response.json()
            return data["access_token"]

    @abstractmethod
    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        """Get user info from the OAuth provider."""
        ...


class GoogleOAuth(OAuthProvider):
    """Google OAuth provider."""

    PROVIDER_NAME = "google"
    AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    DEFAULT_SCOPES = ["openid", "email", "profile"]

    @property
    def client_id(self) -> str:
        return self.settings.google_client_id

    @property
    def client_secret(self) -> str:
        return self.settings.google_client_secret

    def get_authorization_url(self, redirect_uri: str, state: str | None = None) -> str:
        """Get the Google OAuth authorization URL with access_type=offline."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.DEFAULT_SCOPES),
            "access_type": "offline",
        }
        if state:
            params["state"] = state
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        """Get user info from Google."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

            return OAuthUserInfo(
                provider=self.PROVIDER_NAME,
                oauth_id=data["id"],
                email=data["email"],
                name=data.get("name"),
                avatar_url=data.get("picture"),
            )


class GitHubOAuth(OAuthProvider):
    """GitHub OAuth provider."""

    PROVIDER_NAME = "github"
    AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USERINFO_URL = "https://api.github.com/user"
    DEFAULT_SCOPES = ["read:user", "user:email"]

    @property
    def client_id(self) -> str:
        return self.settings.github_client_id

    @property
    def client_secret(self) -> str:
        return self.settings.github_client_secret

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        """Get user info from GitHub."""
        async with httpx.AsyncClient() as client:
            # Get user profile
            response = await client.get(
                self.USERINFO_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()

            # GitHub may not include email in profile if it's private
            # Need to fetch from /user/emails endpoint
            email = data.get("email")
            if not email:
                email_response = await client.get(
                    "https://api.github.com/user/emails",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/json",
                    },
                )
                email_response.raise_for_status()
                emails = email_response.json()
                # Find primary email
                for email_obj in emails:
                    if email_obj.get("primary"):
                        email = email_obj["email"]
                        break
                # Fallback to first verified email
                if not email:
                    for email_obj in emails:
                        if email_obj.get("verified"):
                            email = email_obj["email"]
                            break

            if not email:
                raise ValueError("No email found for GitHub user")

            return OAuthUserInfo(
                provider=self.PROVIDER_NAME,
                oauth_id=str(data["id"]),
                email=email,
                name=data.get("name") or data.get("login"),
                avatar_url=data.get("avatar_url"),
            )


# Provider registry
_PROVIDER_CLASSES: dict[str, type[OAuthProvider]] = {
    "google": GoogleOAuth,
    "github": GitHubOAuth,
}


def get_oauth_provider(provider_name: str) -> OAuthProvider:
    """Get an OAuth provider instance by name."""
    provider_class = _PROVIDER_CLASSES.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown OAuth provider: {provider_name}")
    return provider_class()


def get_configured_providers() -> list[str]:
    """Get list of providers that have credentials configured."""
    return [name for name, cls in _PROVIDER_CLASSES.items() if cls().is_configured]


# Convenience functions for dependency injection
def get_google_oauth() -> GoogleOAuth:
    """Get Google OAuth client instance."""
    return GoogleOAuth()


def get_github_oauth() -> GitHubOAuth:
    """Get GitHub OAuth client instance."""
    return GitHubOAuth()
