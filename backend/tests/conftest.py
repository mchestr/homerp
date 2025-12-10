"""Shared test fixtures and configuration.

This module provides PostgreSQL-based test fixtures using testcontainers.
This ensures tests run against the same database engine as production,
avoiding issues with PostgreSQL-specific types (UUID, JSONB, LtreeType).
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

from src.billing.models import CreditPack, CreditTransaction
from src.config import Settings
from src.database import Base
from src.users.models import User


@pytest.fixture(scope="session")
def postgres_container():
    """Start a PostgreSQL container for the test session."""
    with PostgresContainer("postgres:16") as postgres:
        yield postgres


@pytest.fixture(scope="session")
def database_url(postgres_container) -> str:
    """Get the async database URL for the PostgreSQL container."""
    # testcontainers provides psycopg2 URL, convert to asyncpg
    sync_url = postgres_container.get_connection_url()
    # Replace postgresql:// with postgresql+asyncpg://
    async_url = sync_url.replace("postgresql://", "postgresql+asyncpg://")
    # Remove driver suffix if present (e.g., +psycopg2)
    async_url = async_url.replace("+psycopg2", "+asyncpg")
    return async_url


# Synchronous test client for simple endpoint tests
@pytest.fixture
def client():
    """Create a test client for synchronous tests."""
    from fastapi.testclient import TestClient

    from src.main import app

    with TestClient(app) as test_client:
        yield test_client


# Test settings with PostgreSQL from testcontainers
@pytest.fixture
def test_settings(database_url: str) -> Settings:
    """Create test settings with PostgreSQL."""
    return Settings(
        database_url=database_url,
        debug=False,
        jwt_secret="test-secret",
        stripe_secret_key="sk_test_fake",
        stripe_publishable_key="pk_test_fake",
        stripe_webhook_secret="whsec_test_fake",
        free_monthly_credits=5,
        openai_api_key="test-key",
        cors_origins=["http://localhost:3000"],
    )


@pytest.fixture
async def async_engine(database_url: str):
    """Create async test engine with PostgreSQL."""
    from sqlalchemy import text

    engine = create_async_engine(
        database_url,
        echo=False,
    )

    # Enable required PostgreSQL extensions
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS ltree"))

    # Create all tables from the real models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables after tests
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create async test session."""
    session_factory = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with session_factory() as session:
        yield session
        # Rollback any uncommitted changes to keep tests isolated
        await session.rollback()


@pytest.fixture
def user_id() -> uuid.UUID:
    """Generate a test user ID."""
    return uuid.uuid4()


@pytest.fixture
async def test_user(async_session: AsyncSession, user_id: uuid.UUID) -> User:
    """Create a test user."""
    user = User(
        id=user_id,
        email="test@example.com",
        name="Test User",
        oauth_provider="google",
        oauth_id="google_123",
        credit_balance=0,
        free_credits_remaining=5,
        free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        is_admin=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def admin_user(async_session: AsyncSession) -> User:
    """Create an admin test user."""
    user = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        name="Admin User",
        oauth_provider="google",
        oauth_id="google_admin_123",
        credit_balance=0,
        free_credits_remaining=5,
        free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        is_admin=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def user_with_purchased_credits(async_session: AsyncSession) -> User:
    """Create a test user with purchased credits."""
    user = User(
        id=uuid.uuid4(),
        email="purchaser@example.com",
        name="Purchaser User",
        oauth_provider="google",
        oauth_id="google_purchaser_123",
        credit_balance=100,
        free_credits_remaining=5,
        free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        is_admin=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def user_with_no_credits(async_session: AsyncSession) -> User:
    """Create a test user with no credits at all."""
    user = User(
        id=uuid.uuid4(),
        email="nocredits@example.com",
        name="No Credits User",
        oauth_provider="google",
        oauth_id="google_nocredits_123",
        credit_balance=0,
        free_credits_remaining=0,
        free_credits_reset_at=datetime.utcnow() + timedelta(days=30),
        is_admin=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def user_with_expired_free_credits(async_session: AsyncSession) -> User:
    """Create a test user whose free credits need to be reset."""
    user = User(
        id=uuid.uuid4(),
        email="expired@example.com",
        name="Expired User",
        oauth_provider="google",
        oauth_id="google_expired_123",
        credit_balance=10,
        free_credits_remaining=0,  # Used all free credits
        free_credits_reset_at=datetime.utcnow()
        - timedelta(days=1),  # Reset date passed
        is_admin=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def new_user_without_reset_date(async_session: AsyncSession) -> User:
    """Create a new user without free_credits_reset_at set."""
    user = User(
        id=uuid.uuid4(),
        email="newuser@example.com",
        name="New User",
        oauth_provider="google",
        oauth_id="google_newuser_123",
        credit_balance=0,
        free_credits_remaining=0,  # Will be initialized
        free_credits_reset_at=None,  # Not set yet
        is_admin=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def credit_pack(async_session: AsyncSession) -> CreditPack:
    """Create a test credit pack."""
    pack = CreditPack(
        id=uuid.uuid4(),
        name="Starter Pack",
        credits=25,
        price_cents=300,
        stripe_price_id="price_test_starter",
        is_active=True,
        sort_order=1,
    )
    async_session.add(pack)
    await async_session.commit()
    await async_session.refresh(pack)
    return pack


@pytest.fixture
async def credit_packs(async_session: AsyncSession) -> list[CreditPack]:
    """Create multiple test credit packs."""
    packs = [
        CreditPack(
            id=uuid.uuid4(),
            name="Starter Pack",
            credits=25,
            price_cents=300,
            stripe_price_id="price_test_starter",
            is_active=True,
            sort_order=1,
        ),
        CreditPack(
            id=uuid.uuid4(),
            name="Pro Pack",
            credits=100,
            price_cents=1000,
            stripe_price_id="price_test_pro",
            is_active=True,
            sort_order=2,
        ),
        CreditPack(
            id=uuid.uuid4(),
            name="Enterprise Pack",
            credits=500,
            price_cents=4000,
            stripe_price_id="price_test_enterprise",
            is_active=True,
            sort_order=3,
        ),
        CreditPack(
            id=uuid.uuid4(),
            name="Inactive Pack",
            credits=10,
            price_cents=100,
            stripe_price_id="price_test_inactive",
            is_active=False,
            sort_order=4,
        ),
    ]
    for pack in packs:
        async_session.add(pack)
    await async_session.commit()
    return packs


@pytest.fixture
async def purchase_transaction(
    async_session: AsyncSession,
    user_with_purchased_credits: User,
    credit_pack: CreditPack,
) -> CreditTransaction:
    """Create a purchase transaction."""
    transaction = CreditTransaction(
        id=uuid.uuid4(),
        user_id=user_with_purchased_credits.id,
        amount=25,
        transaction_type="purchase",
        description="Purchased Starter Pack (25 credits)",
        credit_pack_id=credit_pack.id,
        stripe_payment_intent_id="pi_test_123",
        stripe_checkout_session_id="cs_test_123",
        is_refunded=False,
    )
    async_session.add(transaction)
    await async_session.commit()
    await async_session.refresh(transaction)
    return transaction


@pytest.fixture
async def refunded_transaction(
    async_session: AsyncSession,
    test_user: User,
    credit_pack: CreditPack,
) -> CreditTransaction:
    """Create a refunded transaction."""
    transaction = CreditTransaction(
        id=uuid.uuid4(),
        user_id=test_user.id,
        amount=25,
        transaction_type="purchase",
        description="Purchased Starter Pack (25 credits)",
        credit_pack_id=credit_pack.id,
        stripe_payment_intent_id="pi_test_refunded",
        is_refunded=True,
    )
    async_session.add(transaction)
    await async_session.commit()
    await async_session.refresh(transaction)
    return transaction


@pytest.fixture
def mock_stripe():
    """Create mock Stripe module."""
    with patch("src.billing.service.stripe") as mock:
        # Mock Customer
        mock.Customer.create.return_value = MagicMock(id="cus_test_123")

        # Mock Checkout Session
        mock_checkout = MagicMock()
        mock_checkout.url = "https://checkout.stripe.com/test"
        mock_checkout.id = "cs_test_123"
        mock.checkout.Session.create.return_value = mock_checkout

        # Mock Portal Session
        mock_portal = MagicMock()
        mock_portal.url = "https://billing.stripe.com/test"
        mock.billing_portal.Session.create.return_value = mock_portal

        # Mock Refund
        mock.Refund.create.return_value = MagicMock(id="re_test_123")

        yield mock


@pytest.fixture
def stripe_webhook_payload():
    """Create a sample Stripe webhook payload for checkout.session.completed."""
    return {
        "id": "evt_test_123",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "payment_intent": "pi_test_123",
                "metadata": {
                    "user_id": "",  # Will be filled in tests
                    "credit_pack_id": "",  # Will be filled in tests
                    "credits": "25",
                },
            }
        },
    }


@pytest.fixture
def mock_stripe_webhook_event(stripe_webhook_payload):
    """Create a mock Stripe webhook event."""
    mock_event = MagicMock()
    mock_event.type = stripe_webhook_payload["type"]
    mock_event.data.object = MagicMock()
    mock_event.data.object.id = stripe_webhook_payload["data"]["object"]["id"]
    mock_event.data.object.payment_intent = stripe_webhook_payload["data"]["object"][
        "payment_intent"
    ]
    mock_event.data.object.metadata = MagicMock()
    mock_event.data.object.metadata.get = (
        lambda key, default=None: stripe_webhook_payload["data"]["object"][
            "metadata"
        ].get(key, default)
    )
    return mock_event
