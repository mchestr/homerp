from functools import lru_cache

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Database
    database_url: str = "postgresql+asyncpg://homerp:homerp@localhost:5432/homerp"

    # Authentication
    google_client_id: str = ""
    google_client_secret: str = ""
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Storage
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 10

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
    free_monthly_credits: int = 5

    # Admin
    admin_email: str = ""  # Email that auto-becomes admin on login


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
