import logging
from functools import lru_cache

from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_name: str = "HomERP"
    debug: bool = False
    environment: str = "development"  # development, staging, production
    log_level: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL

    # Database
    database_url: str = "postgresql+asyncpg://homerp:homerp@localhost:5432/homerp"

    # Authentication - Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # Authentication - GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""

    # JWT configuration
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # AI Templates (optional custom directory for prompt templates)
    ai_templates_dir: str | None = None

    # Storage
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 10
    max_images_per_item: int = 10

    # Frontend URL (for redirects and CORS)
    frontend_url: str = "http://localhost:3000"

    # API base URL (for generating external links like signed image URLs)
    # When empty, relative URLs are used (works for same-origin requests)
    api_base_url: str = ""

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        """CORS origins derived from frontend_url."""
        return [self.frontend_url]

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Credits
    # DEPRECATED: Use admin billing settings (app_settings table) instead.
    # This is kept only as fallback when no database setting exists.
    free_monthly_credits: int = 5

    # Admin
    admin_email: str = ""  # Email that auto-becomes admin on login

    # Redis (for distributed rate limiting)
    redis_url: str | None = None  # e.g., "redis://localhost:6379"

    # Email/SMTP settings
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_email: str = ""
    smtp_from_name: str = "HomERP"

    # SSRF allowlist - comma-separated CIDR ranges to exempt from blocked networks
    # WARNING: This bypasses SSRF protection. Only use for trusted internal services.
    # Networks must use proper CIDR notation (e.g., 10.0.1.0/24, not 10.0.1.5/24).
    # Examples:
    #   Single subnet: "10.0.1.0/24"
    #   Multiple subnets: "10.0.1.0/24,192.168.50.0/24"
    #   Single IP: "10.0.0.5/32"
    # SECURITY: Ensure this is properly restricted in production environments.
    allowed_networks: str = ""

    @property
    def is_production(self) -> bool:
        """
        Determine if this is a production environment.

        Priority:
        1. Explicit prod environment ("production", "prod") -> True
        2. Explicit non-prod environment ("development", "staging", "test", "local") -> False
        3. Fallback heuristic: non-localhost frontend URL -> True

        This ensures staging/test environments are never treated as production,
        even if they use non-localhost URLs.
        """
        env_lower = self.environment.lower()

        # Explicit production environment
        if env_lower in ("production", "prod"):
            return True

        # Explicit non-production environment - trust it
        if env_lower in ("development", "dev", "staging", "test", "local"):
            return False

        # Fallback heuristic: non-localhost frontend URL suggests production
        return bool(
            self.frontend_url
            and not any(
                local in self.frontend_url.lower()
                for local in ("localhost", "127.0.0.1", "0.0.0.0")
            )
        )

    @model_validator(mode="after")
    def validate_jwt_secret(self) -> "Settings":
        """Validate that JWT secret is secure enough for production."""
        # Known weak/default secrets
        weak_secrets = {
            "dev-secret-change-in-production",
            "secret",
            "changeme",
            "your-secret-key",
            "jwt-secret",
            "supersecret",
        }

        # Use production detection instead of just debug flag
        # This prevents accidentally deploying with DEBUG=true and weak secrets
        is_prod = self.is_production
        is_development = not is_prod and self.debug

        if self.jwt_secret.lower() in weak_secrets:
            if is_prod:
                # In production, raise an error for weak secrets
                raise ValueError(
                    "JWT_SECRET is set to a known weak value. "
                    "Please set a secure, random JWT_SECRET environment variable. "
                    'You can generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
                )
            elif is_development:
                # In debug mode with development environment, warn but allow
                logger.warning(
                    "WARNING: Using a weak JWT_SECRET. "
                    "This is acceptable for development but MUST be changed in production."
                )
            else:
                # Not explicitly production but also not development - be cautious
                raise ValueError(
                    "JWT_SECRET is set to a known weak value. "
                    "Set DEBUG=true for development or use a secure secret for production. "
                    'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
                )

        # Check minimum length (32 characters recommended)
        if len(self.jwt_secret) < 32:
            if is_prod:
                raise ValueError(
                    f"JWT_SECRET is too short ({len(self.jwt_secret)} chars). "
                    "Please use at least 32 characters for security. "
                    'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
                )
            elif is_development:
                logger.warning(
                    f"WARNING: JWT_SECRET is short ({len(self.jwt_secret)} chars). "
                    "Consider using at least 32 characters."
                )
            else:
                raise ValueError(
                    f"JWT_SECRET is too short ({len(self.jwt_secret)} chars). "
                    "Set DEBUG=true for development or use at least 32 characters for production."
                )

        return self


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
