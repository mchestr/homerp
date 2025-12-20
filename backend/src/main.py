import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.middleware import SlowAPIMiddleware

from src.common.rate_limiter import configure_rate_limiting
from src.common.request_id_middleware import RequestIDMiddleware
from src.common.security_headers import SecurityHeadersMiddleware
from src.config import get_settings
from src.database import check_db_connectivity, close_db, init_db


class RequestIDFilter(logging.Filter):
    """
    Logging filter that adds request ID to log records.

    If a request ID is available in the current context, it will be
    included in the log record. Otherwise, a placeholder is used.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        from src.common.request_context import get_request_id

        # Add request_id attribute to every log record
        request_id = get_request_id()
        record.request_id = request_id if request_id else "-"
        return True


def configure_logging() -> None:
    """Configure application logging.

    Sets up structured logging with timestamps, request IDs, and log levels.
    Log level is configurable via LOG_LEVEL environment variable.
    """
    settings = get_settings()

    # Get log level from settings (default INFO)
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(request_id)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
        force=True,  # Override any existing configuration
    )

    # Add request ID filter to root logger
    request_id_filter = RequestIDFilter()
    logging.getLogger().addFilter(request_id_filter)

    # Set uvicorn access logs to same level (prevents duplicate logs)
    logging.getLogger("uvicorn.access").setLevel(log_level)

    # Reduce noise from third-party libraries
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("aiosmtplib").setLevel(logging.INFO)

    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured: level={settings.log_level.upper()}")


# Configure logging on module load
configure_logging()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Application lifespan handler."""
    settings = get_settings()
    init_db(settings)
    yield
    await close_db()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="Home inventory system with AI-powered item classification",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add request ID tracking for distributed tracing and log correlation
    app.add_middleware(RequestIDMiddleware)

    # Add security headers to all responses
    app.add_middleware(SecurityHeadersMiddleware)

    # Configure rate limiting
    configure_rate_limiting(app)
    app.add_middleware(SlowAPIMiddleware)

    # Health check endpoint for Kubernetes probes
    @app.get("/health")
    async def health_check():
        """
        Health check endpoint for Kubernetes liveness/readiness probes.

        Returns 200 if healthy, 503 if database is unavailable.
        """
        db_connected = await check_db_connectivity()

        if db_connected:
            return {"status": "healthy", "database": "connected"}

        logger.warning("Health check failed: database connectivity check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected"},
        )

    # Include routers
    from src.admin.router import router as admin_router
    from src.ai.router import router as ai_router
    from src.apikeys.router import router as apikeys_router
    from src.auth.router import router as auth_router
    from src.billing.router import router as billing_router
    from src.categories.router import router as categories_router
    from src.collaboration.router import router as collaboration_router
    from src.feedback.router import router as feedback_router
    from src.gridfinity.router import router as gridfinity_router
    from src.images.router import router as images_router
    from src.items.router import router as items_router
    from src.locations.router import router as locations_router
    from src.notifications.router import router as notifications_router
    from src.profile.router import router as profile_router
    from src.webhooks.router import router as webhooks_router

    app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
    app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"])
    app.include_router(apikeys_router, prefix="/api/v1/admin/apikeys", tags=["apikeys"])
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(billing_router, prefix="/api/v1/billing", tags=["billing"])
    app.include_router(feedback_router, prefix="/api/v1/feedback", tags=["feedback"])
    app.include_router(items_router, prefix="/api/v1/items", tags=["items"])
    app.include_router(
        categories_router, prefix="/api/v1/categories", tags=["categories"]
    )
    app.include_router(locations_router, prefix="/api/v1/locations", tags=["locations"])
    app.include_router(
        gridfinity_router, prefix="/api/v1/gridfinity", tags=["gridfinity"]
    )
    app.include_router(images_router, prefix="/api/v1/images", tags=["images"])
    app.include_router(profile_router, prefix="/api/v1/profile", tags=["profile"])
    app.include_router(webhooks_router, prefix="/api/v1/webhooks", tags=["webhooks"])
    app.include_router(
        collaboration_router, prefix="/api/v1/collaboration", tags=["collaboration"]
    )
    app.include_router(
        notifications_router, prefix="/api/v1/notifications", tags=["notifications"]
    )

    return app


app = create_app()
