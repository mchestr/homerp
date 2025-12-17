"""Rate limiting configuration and utilities."""

import logging

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)


def get_client_identifier(request: Request) -> str:
    """
    Get a unique identifier for the client.

    Uses authenticated user ID if available, otherwise falls back to IP address.
    This prevents a single user from bypassing rate limits across multiple IPs,
    while still protecting against unauthenticated abuse.
    """
    # Try to get user from request state (set by auth middleware)
    if hasattr(request.state, "user") and request.state.user:
        return f"user:{request.state.user.id}"

    # Fall back to IP address
    # Log when using IP-based limiting on authenticated endpoints for monitoring
    # This can indicate auth middleware issues or proxy/NAT collisions
    ip_address = get_remote_address(request)
    path = str(request.url.path)
    if path.startswith("/api/v1/") and not path.startswith("/api/v1/auth"):
        logger.debug(f"Rate limiting by IP on API endpoint: {path} from {ip_address}")

    return ip_address


# Module-level limiter - starts with in-memory storage
# Storage is reconfigured in configure_rate_limiting() if Redis is available
limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=["1000/hour"],
)


# Rate limit configurations for different endpoint types
RATE_LIMIT_AUTH = "10/minute"  # Auth endpoints - strict to prevent brute force
RATE_LIMIT_AI = "20/minute"  # AI/expensive operations - limited due to cost
RATE_LIMIT_UPLOAD = "30/minute"  # File uploads - limited to prevent abuse
RATE_LIMIT_BILLING = "10/minute"  # Billing/checkout - limited to prevent fraud
RATE_LIMIT_WEBHOOKS = "60/minute"  # Webhooks - limited to prevent abuse
RATE_LIMIT_STANDARD = "100/minute"  # Standard API operations
RATE_LIMIT_READONLY = "200/minute"  # Read-only operations - higher limits


def configure_rate_limiting(app) -> None:
    """
    Configure rate limiting for the FastAPI application.

    If REDIS_URL is set, reconfigures the limiter to use Redis storage
    for distributed rate limiting across multiple instances.
    """
    global limiter

    from limits.storage import MemoryStorage, storage_from_string
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded

    from src.config import get_settings

    settings = get_settings()

    is_production = settings.is_production

    # Configure storage backend
    if settings.redis_url:
        try:
            # Create Redis storage
            storage = storage_from_string(settings.redis_url)
            limiter._storage = storage
            # Mask password in logs
            safe_url = (
                settings.redis_url.split("@")[-1]
                if "@" in settings.redis_url
                else settings.redis_url
            )
            logger.info(f"Rate limiting configured with Redis storage: {safe_url}")
        except Exception as e:
            logger.error(f"Failed to configure Redis for rate limiting: {e}")
            # In production, fail fast rather than silently degrading
            if is_production:
                raise RuntimeError(
                    "Redis rate limiting required but failed to connect. "
                    "Set REDIS_URL to a valid Redis instance or remove it for single-instance mode."
                ) from e
            logger.warning(
                "Falling back to in-memory storage (not suitable for multi-instance)"
            )
            limiter._storage = MemoryStorage()
    elif is_production:
        # Production without Redis - fail fast
        raise RuntimeError(
            "REDIS_URL is required in production for distributed rate limiting. "
            "Set REDIS_URL to a valid Redis instance."
        )
    else:
        logger.info(
            "Rate limiting configured with in-memory storage (single instance only)"
        )
        limiter._storage = MemoryStorage()

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
