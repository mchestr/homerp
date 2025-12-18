import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.config import Settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""

    pass


def create_engine(settings: Settings):
    """Create async database engine."""
    return create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_pre_ping=True,
    )


def create_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    """Create async session factory."""
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


# Global engine and session factory (initialized on startup)
_engine = None
_session_factory = None
_db_host = "unknown"  # Stored for logging (without credentials)


def _extract_db_host(database_url: str) -> str:
    """Extract host info from database URL for safe logging (without credentials)."""
    try:
        # URL format: postgresql+asyncpg://user:pass@host:port/dbname
        if "@" in database_url:
            return database_url.split("@")[-1].split("?")[0]
        return "unknown"
    except Exception:
        return "unknown"


def init_db(settings: Settings):
    """Initialize database engine and session factory."""
    global _engine, _session_factory, _db_host
    _engine = create_engine(settings)
    _session_factory = create_session_factory(_engine)
    _db_host = _extract_db_host(settings.database_url)
    logger.info(f"Database engine initialized: host={_db_host}")


async def close_db():
    """Close database connections."""
    global _engine
    if _engine:
        await _engine.dispose()


@asynccontextmanager
async def get_tenant_session(user_id: UUID) -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session with RLS tenant context set.

    This sets the PostgreSQL session variable that RLS policies use
    to filter data by user_id.
    """
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    async with _session_factory() as session:
        # Set the tenant context for RLS
        await session.execute(
            text("SET app.current_user_id = :user_id"),
            {"user_id": str(user_id)},
        )
        try:
            yield session
        finally:
            # Reset the tenant context
            await session.execute(text("RESET app.current_user_id"))


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session without tenant context.

    Use this for operations that don't need RLS (e.g., user creation during OAuth).
    """
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    async with _session_factory() as session:
        yield session


# Type alias for dependency injection
AsyncSessionDep = Annotated[AsyncSession, Depends(get_session)]


async def check_db_connectivity() -> bool:
    """
    Check database connectivity by executing a simple query.

    Returns True if the database is reachable, False otherwise.
    """
    if _session_factory is None:
        logger.warning(
            "Database connectivity check failed: session factory not initialized"
        )
        return False

    try:
        async with _session_factory() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception as e:
        logger.error(
            f"Database connectivity check failed: host={_db_host}, "
            f"error={type(e).__name__}: {e}"
        )
        return False
