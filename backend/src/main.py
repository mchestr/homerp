from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.database import close_db, init_db


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

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    # Include routers
    from src.admin.router import router as admin_router
    from src.auth.router import router as auth_router
    from src.billing.router import router as billing_router
    from src.categories.router import router as categories_router
    from src.images.router import router as images_router
    from src.items.router import router as items_router
    from src.locations.router import router as locations_router

    app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(billing_router, prefix="/api/v1/billing", tags=["billing"])
    app.include_router(items_router, prefix="/api/v1/items", tags=["items"])
    app.include_router(categories_router, prefix="/api/v1/categories", tags=["categories"])
    app.include_router(locations_router, prefix="/api/v1/locations", tags=["locations"])
    app.include_router(images_router, prefix="/api/v1/images", tags=["images"])

    return app


app = create_app()
