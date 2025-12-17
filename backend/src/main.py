from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from src.common.rate_limiter import configure_rate_limiting
from src.common.security_headers import SecurityHeadersMiddleware
from src.config import get_settings
from src.database import close_db, get_session, init_db


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
        health = {"status": "healthy", "database": "connected"}

        # Check database connectivity
        try:
            async for session in get_session():
                await session.execute(text("SELECT 1"))
                break
        except Exception:
            health["status"] = "unhealthy"
            health["database"] = "disconnected"
            return JSONResponse(status_code=503, content=health)

        return health

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
