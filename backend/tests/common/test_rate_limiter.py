"""Tests for rate limiting configuration."""

from unittest.mock import patch

import pytest
from fastapi import FastAPI

from src.common.rate_limiter import configure_rate_limiting
from src.config import Settings


class TestRateLimitingConfiguration:
    """Test rate limiting configuration under different scenarios."""

    def test_production_without_redis_raises_error(self):
        """Production environment without Redis should fail fast."""
        app = FastAPI()
        settings = Settings(
            environment="production",
            redis_url=None,
            frontend_url="https://production.example.com",
            jwt_secret="a" * 32,  # Valid length for production
        )

        with (
            patch("src.config.get_settings", return_value=settings),
            pytest.raises(RuntimeError, match="REDIS_URL is required in production"),
        ):
            configure_rate_limiting(app)

    def test_production_with_redis_connection_failure_raises_error(self):
        """Production with Redis connection failure should fail fast."""
        app = FastAPI()
        settings = Settings(
            environment="production",
            redis_url="redis://localhost:6379",
            frontend_url="https://production.example.com",
            jwt_secret="a" * 32,
        )

        # Mock storage_from_string to simulate connection failure
        with (
            patch("src.config.get_settings", return_value=settings),
            patch(
                "limits.storage.storage_from_string",
                side_effect=Exception("Connection refused"),
            ),
            pytest.raises(
                RuntimeError,
                match="Redis rate limiting required but failed to connect",
            ),
        ):
            configure_rate_limiting(app)

    def test_development_without_redis_uses_memory_storage(self):
        """Development without Redis should use in-memory storage."""
        app = FastAPI()
        settings = Settings(
            environment="development",
            redis_url=None,
            debug=True,
        )

        with patch("src.config.get_settings", return_value=settings):
            configure_rate_limiting(app)  # Should not raise
            assert app.state.limiter is not None

    def test_staging_without_redis_uses_memory_storage(self):
        """Staging environment should not trigger production Redis requirement."""
        app = FastAPI()
        settings = Settings(
            environment="staging",
            redis_url=None,
            frontend_url="https://staging.example.com",  # Non-localhost URL
            jwt_secret="a" * 32,
        )

        with patch("src.config.get_settings", return_value=settings):
            configure_rate_limiting(app)  # Should not raise despite non-localhost URL
            assert app.state.limiter is not None

    def test_test_environment_without_redis_uses_memory_storage(self):
        """Test environment should not trigger production Redis requirement."""
        app = FastAPI()
        settings = Settings(
            environment="test",
            redis_url=None,
            debug=True,
        )

        with patch("src.config.get_settings", return_value=settings):
            configure_rate_limiting(app)
            assert app.state.limiter is not None
