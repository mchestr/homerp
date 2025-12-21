"""Integration test fixtures for security-critical tests.

These fixtures provide additional utilities for testing security boundaries,
multi-tenancy isolation, and race conditions.
"""

import uuid
from collections.abc import AsyncGenerator, Callable
from datetime import UTC, datetime, timedelta
from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image as PILImage
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditPack, CreditTransaction
from src.categories.models import Category
from src.config import Settings
from src.images.models import Image
from src.items.models import Item
from src.locations.models import Location
from src.users.models import User

# Image dimension constants for test images
# Default user parameters for factory function
DEFAULT_USER_CREDIT_BALANCE = 10
DEFAULT_USER_FREE_CREDITS = 5
USER_FREE_CREDITS_RESET_DAYS = 30


def create_test_user(
    async_session: AsyncSession,
    *,
    email: str = "test@example.com",
    name: str = "Test User",
    oauth_provider: str = "google",
    oauth_id: str | None = None,
    credit_balance: int = DEFAULT_USER_CREDIT_BALANCE,
    free_credits_remaining: int = DEFAULT_USER_FREE_CREDITS,
    is_admin: bool = False,
) -> User:
    """Factory function to create a test user with configurable attributes.

    Args:
        async_session: Database session for adding the user.
        email: User's email address.
        name: User's display name.
        oauth_provider: OAuth provider (default: "google").
        oauth_id: OAuth ID (auto-generated from email if not provided).
        credit_balance: Initial credit balance.
        free_credits_remaining: Remaining free credits.
        is_admin: Whether user is an admin.

    Returns:
        User model instance (not yet committed).
    """
    if oauth_id is None:
        # Generate unique oauth_id from email prefix
        oauth_id = f"google_{email.split('@')[0]}_{uuid.uuid4().hex[:8]}"

    user = User(
        id=uuid.uuid4(),
        email=email,
        name=name,
        oauth_provider=oauth_provider,
        oauth_id=oauth_id,
        credit_balance=credit_balance,
        free_credits_remaining=free_credits_remaining,
        free_credits_reset_at=datetime.now(UTC)
        + timedelta(days=USER_FREE_CREDITS_RESET_DAYS),
        is_admin=is_admin,
    )
    async_session.add(user)
    return user


SMALL_IMAGE_DIMENSIONS = (10, 10)  # Creates ~1KB JPEG
LARGE_IMAGE_DIMENSIONS = (4000, 4000)  # Creates ~5MB compressed JPEG
OVERSIZED_IMAGE_DIMENSIONS = (5000, 5000)  # Exceeds 10MB limit as BMP


def create_test_image_bytes(
    width: int = 100,
    height: int = 100,
    format: str = "JPEG",
    color: tuple = (255, 0, 0),
) -> bytes:
    """Create a valid test image file as bytes."""
    img = PILImage.new("RGB", (width, height), color=color)
    buffer = BytesIO()
    img.save(buffer, format=format)
    return buffer.getvalue()


@pytest.fixture
def small_test_image() -> bytes:
    """Create a small valid JPEG image (under 1KB)."""
    return create_test_image_bytes(*SMALL_IMAGE_DIMENSIONS, "JPEG")


@pytest.fixture
def large_test_image() -> bytes:
    """Create a large JPEG image (about 5MB uncompressed, but compressed)."""
    # Create a large image that will be > 10MB to test size limits
    # Using large dimensions to increase file size
    return create_test_image_bytes(*LARGE_IMAGE_DIMENSIONS, "JPEG")


@pytest.fixture
def oversized_test_image() -> bytes:
    """Create an image that exceeds the upload limit.

    This creates raw bytes that will exceed 10MB when processed.
    We create it as uncompressed PNG to ensure large size.
    """
    # Create a very large image as BMP (no compression) to guarantee large size
    img = PILImage.new("RGB", OVERSIZED_IMAGE_DIMENSIONS, color=(255, 0, 0))
    buffer = BytesIO()
    img.save(buffer, format="BMP")
    return buffer.getvalue()


@pytest.fixture
def test_png_image() -> bytes:
    """Create a valid PNG image."""
    return create_test_image_bytes(50, 50, "PNG")


@pytest.fixture
def test_webp_image() -> bytes:
    """Create a valid WebP image."""
    return create_test_image_bytes(50, 50, "WEBP")


@pytest.fixture
def test_gif_image() -> bytes:
    """Create a valid GIF image."""
    img = PILImage.new("P", (50, 50))  # GIF requires palette mode
    buffer = BytesIO()
    img.save(buffer, format="GIF")
    return buffer.getvalue()


@pytest.fixture
async def second_user(async_session: AsyncSession) -> User:
    """Create a second test user for multi-tenancy tests."""
    user = create_test_user(
        async_session,
        email="second@example.com",
        name="Second User",
    )
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def third_user(async_session: AsyncSession) -> User:
    """Create a third test user for isolation tests."""
    user = create_test_user(
        async_session,
        email="third@example.com",
        name="Third User",
        credit_balance=0,
    )
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def user_with_one_credit(async_session: AsyncSession) -> User:
    """Create a user with exactly one credit for race condition tests."""
    user = create_test_user(
        async_session,
        email="onecredit@example.com",
        name="One Credit User",
        credit_balance=1,
        free_credits_remaining=0,
    )
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def second_user_client(
    async_session: AsyncSession,
    test_settings: Settings,  # noqa: ARG001
    second_user: User,
) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client authenticated as second user."""
    from src.auth.dependencies import get_current_user_id
    from src.database import get_session
    from src.main import app

    async def override_session():
        yield async_session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user_id] = lambda: second_user.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def authenticated_client_factory(
    async_session: AsyncSession,
    test_settings: Settings,  # noqa: ARG001
) -> Callable[[User], AsyncClient]:
    """Factory to create authenticated clients for any user.

    Usage:
        client = authenticated_client_factory(some_user)
    """
    from src.auth.dependencies import get_current_user_id
    from src.database import get_session
    from src.main import app

    async def override_session():
        yield async_session

    def create_client(user: User) -> AsyncClient:
        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: user.id
        transport = ASGITransport(app=app)
        return AsyncClient(transport=transport, base_url="http://test")

    return create_client


@pytest.fixture
async def second_user_category(
    async_session: AsyncSession, second_user: User
) -> Category:
    """Create a category owned by second user."""
    from sqlalchemy_utils import Ltree

    category = Category(
        id=uuid.uuid4(),
        user_id=second_user.id,
        name="Second User Category",
        path=Ltree("second_user_category"),
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


@pytest.fixture
async def second_user_location(
    async_session: AsyncSession, second_user: User
) -> Location:
    """Create a location owned by second user."""
    from sqlalchemy_utils import Ltree

    location = Location(
        id=uuid.uuid4(),
        user_id=second_user.id,
        name="Second User Location",
        path=Ltree("second_user_location"),
    )
    async_session.add(location)
    await async_session.commit()
    await async_session.refresh(location)
    return location


@pytest.fixture
async def second_user_item(
    async_session: AsyncSession,
    second_user: User,
    second_user_category: Category,
    second_user_location: Location,
) -> Item:
    """Create an item owned by second user."""
    item = Item(
        id=uuid.uuid4(),
        user_id=second_user.id,
        name="Second User Item",
        description="An item that belongs to second user",
        quantity=1,
        category_id=second_user_category.id,
        location_id=second_user_location.id,
    )
    async_session.add(item)
    await async_session.commit()
    await async_session.refresh(item)
    return item


@pytest.fixture
async def second_user_image(async_session: AsyncSession, second_user: User) -> Image:
    """Create an image owned by second user."""
    image = Image(
        id=uuid.uuid4(),
        user_id=second_user.id,
        original_filename="second_user_image.jpg",
        mime_type="image/jpeg",
        size_bytes=1024,
        storage_path="/uploads/second_user_image.jpg",
        thumbnail_path="/uploads/second_user_image_thumb.jpg",
        storage_type="local",
    )
    async_session.add(image)
    await async_session.commit()
    await async_session.refresh(image)
    return image


@pytest.fixture
async def credit_pack_for_race_test(async_session: AsyncSession) -> CreditPack:
    """Create a credit pack for race condition tests."""
    pack = CreditPack(
        id=uuid.uuid4(),
        name="Race Test Pack",
        credits=1,
        price_cents=100,
        stripe_price_id="price_test_race",
        is_active=True,
        sort_order=99,
    )
    async_session.add(pack)
    await async_session.commit()
    await async_session.refresh(pack)
    return pack


@pytest.fixture
async def multiple_purchase_transactions(
    async_session: AsyncSession,
    user_with_purchased_credits: User,
    credit_pack: CreditPack,
) -> list[CreditTransaction]:
    """Create multiple purchase transactions for testing."""
    transactions = []
    for i in range(3):
        transaction = CreditTransaction(
            id=uuid.uuid4(),
            user_id=user_with_purchased_credits.id,
            amount=25,
            transaction_type="purchase",
            description=f"Purchased Starter Pack #{i + 1} (25 credits)",
            credit_pack_id=credit_pack.id,
            stripe_payment_intent_id=f"pi_test_{i}",
            stripe_checkout_session_id=f"cs_test_{i}",
            is_refunded=False,
        )
        async_session.add(transaction)
        transactions.append(transaction)

    await async_session.commit()
    for txn in transactions:
        await async_session.refresh(txn)
    return transactions


@pytest.fixture
async def second_user_transaction(
    async_session: AsyncSession,
    second_user: User,
    credit_pack: CreditPack,
) -> CreditTransaction:
    """Create a transaction for second_user to test isolation."""
    transaction = CreditTransaction(
        id=uuid.uuid4(),
        user_id=second_user.id,
        amount=50,
        transaction_type="purchase",
        description="Second User Purchase (50 credits)",
        credit_pack_id=credit_pack.id,
        stripe_payment_intent_id="pi_second_user_test",
        stripe_checkout_session_id="cs_second_user_test",
        is_refunded=False,
    )
    async_session.add(transaction)
    await async_session.commit()
    await async_session.refresh(transaction)
    return transaction


@pytest.fixture
async def test_user_transaction(
    async_session: AsyncSession,
    test_user: User,
    credit_pack: CreditPack,
) -> CreditTransaction:
    """Create a transaction for test_user."""
    transaction = CreditTransaction(
        id=uuid.uuid4(),
        user_id=test_user.id,
        amount=25,
        transaction_type="purchase",
        description="Test User Purchase (25 credits)",
        credit_pack_id=credit_pack.id,
        stripe_payment_intent_id="pi_test_user_test",
        stripe_checkout_session_id="cs_test_user_test",
        is_refunded=False,
    )
    async_session.add(transaction)
    await async_session.commit()
    await async_session.refresh(transaction)
    return transaction
