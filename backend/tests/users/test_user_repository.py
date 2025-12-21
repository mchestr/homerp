"""Tests for UserRepository.

Tests verify:
- User creation and retrieval
- OAuth-based user lookup and creation
- Auto-admin promotion based on email
- User settings updates
- Handling of duplicate OAuth users
- Signup credits granted to new users
"""

import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import AppSetting, CreditTransaction
from src.billing.settings_service import BillingSettingsService
from src.users.models import User
from src.users.repository import UserRepository
from src.users.schemas import UserSettingsUpdate


class TestUserRepositoryBasicOperations:
    """Tests for basic user repository operations."""

    async def test_get_by_id_returns_user(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_by_id should return the user when found."""
        repo = UserRepository(async_session)
        user = await repo.get_by_id(test_user.id)

        assert user is not None
        assert user.id == test_user.id
        assert user.email == test_user.email

    async def test_get_by_id_returns_none_for_nonexistent(
        self,
        async_session: AsyncSession,
    ):
        """get_by_id should return None when user doesn't exist."""
        repo = UserRepository(async_session)
        user = await repo.get_by_id(uuid.uuid4())

        assert user is None

    async def test_get_by_email_returns_user(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_by_email should return the user when found."""
        repo = UserRepository(async_session)
        user = await repo.get_by_email(test_user.email)

        assert user is not None
        assert user.email == test_user.email

    async def test_get_by_email_returns_none_for_nonexistent(
        self,
        async_session: AsyncSession,
    ):
        """get_by_email should return None when email doesn't exist."""
        repo = UserRepository(async_session)
        user = await repo.get_by_email("nonexistent@example.com")

        assert user is None

    async def test_get_by_oauth_returns_user(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_by_oauth should return user when provider and oauth_id match."""
        repo = UserRepository(async_session)
        user = await repo.get_by_oauth(test_user.oauth_provider, test_user.oauth_id)

        assert user is not None
        assert user.id == test_user.id

    async def test_get_by_oauth_returns_none_for_wrong_provider(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_by_oauth should return None when provider doesn't match."""
        repo = UserRepository(async_session)
        user = await repo.get_by_oauth("github", test_user.oauth_id)

        assert user is None

    async def test_get_by_oauth_returns_none_for_wrong_oauth_id(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_by_oauth should return None when oauth_id doesn't match."""
        repo = UserRepository(async_session)
        user = await repo.get_by_oauth(test_user.oauth_provider, "wrong_id")

        assert user is None


class TestUserRepositoryCreate:
    """Tests for user creation."""

    async def test_create_user_with_minimal_data(
        self,
        async_session: AsyncSession,
    ):
        """create should create user with minimal required data."""
        from src.users.schemas import UserCreate

        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)
        user_data = UserCreate(
            email=f"new.{unique_id}@example.com",
            oauth_provider="google",
            oauth_id=f"new_oauth_{unique_id}",
        )
        user = await repo.create(user_data)

        assert user.id is not None
        assert user.email == f"new.{unique_id}@example.com"
        assert user.oauth_provider == "google"
        assert user.oauth_id == f"new_oauth_{unique_id}"
        assert user.name is None

    async def test_create_user_with_full_data(
        self,
        async_session: AsyncSession,
    ):
        """create should create user with all optional fields."""
        from src.users.schemas import UserCreate

        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)
        user_data = UserCreate(
            email=f"full.{unique_id}@example.com",
            name="Full Name",
            avatar_url="https://example.com/avatar.jpg",
            oauth_provider="github",
            oauth_id=f"github_{unique_id}",
        )
        user = await repo.create(user_data)

        assert user.email == f"full.{unique_id}@example.com"
        assert user.name == "Full Name"
        assert user.avatar_url == "https://example.com/avatar.jpg"
        assert user.oauth_provider == "github"
        assert user.oauth_id == f"github_{unique_id}"


class TestUserRepositoryGetOrCreateFromOAuth:
    """Tests for OAuth-based user lookup and creation."""

    async def test_get_or_create_returns_existing_user(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_or_create_from_oauth should return existing user when found."""
        repo = UserRepository(async_session)
        user, was_created = await repo.get_or_create_from_oauth(
            provider=test_user.oauth_provider,
            oauth_id=test_user.oauth_id,
            email=test_user.email,
            name=test_user.name,
            avatar_url=test_user.avatar_url,
        )

        assert user.id == test_user.id
        assert was_created is False

    async def test_get_or_create_creates_new_user(
        self,
        async_session: AsyncSession,
    ):
        """get_or_create_from_oauth should create new user when not found."""
        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)
        user, was_created = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"new_oauth_{unique_id}",
            email=f"new.oauth.{unique_id}@example.com",
            name="New OAuth User",
            avatar_url="https://example.com/new.jpg",
        )

        assert user.id is not None
        assert user.email == f"new.oauth.{unique_id}@example.com"
        assert user.name == "New OAuth User"
        assert user.avatar_url == "https://example.com/new.jpg"
        assert was_created is True

    async def test_get_or_create_updates_email_on_change(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_or_create_from_oauth should update email if changed."""
        repo = UserRepository(async_session)
        new_email = "updated.email@example.com"

        user, was_created = await repo.get_or_create_from_oauth(
            provider=test_user.oauth_provider,
            oauth_id=test_user.oauth_id,
            email=new_email,
            name=test_user.name,
            avatar_url=test_user.avatar_url,
        )

        assert user.email == new_email
        assert was_created is False

    async def test_get_or_create_updates_name_on_change(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_or_create_from_oauth should update name if changed."""
        repo = UserRepository(async_session)
        new_name = "Updated Name"

        user, was_created = await repo.get_or_create_from_oauth(
            provider=test_user.oauth_provider,
            oauth_id=test_user.oauth_id,
            email=test_user.email,
            name=new_name,
            avatar_url=test_user.avatar_url,
        )

        assert user.name == new_name
        assert was_created is False

    async def test_get_or_create_updates_avatar_on_change(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """get_or_create_from_oauth should update avatar_url if changed."""
        repo = UserRepository(async_session)
        new_avatar = "https://example.com/new-avatar.jpg"

        user, was_created = await repo.get_or_create_from_oauth(
            provider=test_user.oauth_provider,
            oauth_id=test_user.oauth_id,
            email=test_user.email,
            name=test_user.name,
            avatar_url=new_avatar,
        )

        assert user.avatar_url == new_avatar
        assert was_created is False


class TestUserRepositoryAutoAdmin:
    """Tests for auto-admin promotion based on email."""

    async def test_auto_admin_on_new_user_creation(
        self,
        async_session: AsyncSession,
    ):
        """New user should be made admin if email matches admin_email setting."""
        from src.config import Settings

        unique_id = str(uuid.uuid4())
        admin_email = f"admin.new.{unique_id}@example.com"
        mock_settings = Settings(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            jwt_secret="test-secret-for-automated-testing-only",
            admin_email=admin_email,
            debug=True,
        )

        with patch("src.users.repository.get_settings", return_value=mock_settings):
            repo = UserRepository(async_session)
            user, was_created = await repo.get_or_create_from_oauth(
                provider="google",
                oauth_id=f"admin_oauth_{unique_id}",
                email=admin_email,
                name="Admin User",
                avatar_url=None,
            )

        assert user.is_admin is True
        assert was_created is True

    async def test_auto_admin_on_existing_user_login(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """Existing user should be made admin if email matches admin_email setting."""
        from src.config import Settings

        # First verify user is not admin
        assert test_user.is_admin is False

        mock_settings = Settings(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            jwt_secret="test-secret-for-automated-testing-only",
            admin_email=test_user.email,  # Match the test user's email
            debug=True,
        )

        with patch("src.users.repository.get_settings", return_value=mock_settings):
            repo = UserRepository(async_session)
            user, was_created = await repo.get_or_create_from_oauth(
                provider=test_user.oauth_provider,
                oauth_id=test_user.oauth_id,
                email=test_user.email,
                name=test_user.name,
                avatar_url=test_user.avatar_url,
            )

        assert user.is_admin is True
        assert was_created is False

    async def test_no_auto_admin_when_email_does_not_match(
        self,
        async_session: AsyncSession,
    ):
        """New user should not be admin if email doesn't match admin_email setting."""
        from src.config import Settings

        unique_id = str(uuid.uuid4())
        mock_settings = Settings(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            jwt_secret="test-secret-for-automated-testing-only",
            admin_email="different.admin@example.com",
            debug=True,
        )

        with patch("src.users.repository.get_settings", return_value=mock_settings):
            repo = UserRepository(async_session)
            user, was_created = await repo.get_or_create_from_oauth(
                provider="google",
                oauth_id=f"normal_oauth_{unique_id}",
                email=f"normal.user.{unique_id}@example.com",
                name="Normal User",
                avatar_url=None,
            )

        assert user.is_admin is False
        assert was_created is True

    async def test_no_auto_admin_when_admin_email_not_configured(
        self,
        async_session: AsyncSession,
    ):
        """New user should not be admin when admin_email is not configured."""
        from src.config import Settings

        unique_id = str(uuid.uuid4())
        mock_settings = Settings(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            jwt_secret="test-secret-for-automated-testing-only",
            admin_email="",  # Not configured (empty string is default)
            debug=True,
        )

        with patch("src.users.repository.get_settings", return_value=mock_settings):
            repo = UserRepository(async_session)
            user, was_created = await repo.get_or_create_from_oauth(
                provider="google",
                oauth_id=f"no_admin_oauth_{unique_id}",
                email=f"no.admin.{unique_id}@example.com",
                name="No Admin User",
                avatar_url=None,
            )

        assert user.is_admin is False
        assert was_created is True


class TestUserRepositoryUpdateSettings:
    """Tests for user settings updates."""

    async def test_update_currency(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """update_settings should update currency when provided."""
        repo = UserRepository(async_session)
        settings = UserSettingsUpdate(currency="EUR")

        updated_user = await repo.update_settings(test_user, settings)

        assert updated_user.currency == "EUR"

    async def test_update_language(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """update_settings should update language when provided."""
        repo = UserRepository(async_session)
        settings = UserSettingsUpdate(language="de")

        updated_user = await repo.update_settings(test_user, settings)

        assert updated_user.language == "de"

    async def test_update_multiple_settings(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """update_settings should update multiple fields at once."""
        repo = UserRepository(async_session)
        settings = UserSettingsUpdate(currency="JPY", language="ja")

        updated_user = await repo.update_settings(test_user, settings)

        assert updated_user.currency == "JPY"
        assert updated_user.language == "ja"

    async def test_update_preserves_unchanged_fields(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """update_settings should not change fields that are not provided."""
        repo = UserRepository(async_session)
        original_email = test_user.email
        original_name = test_user.name

        settings = UserSettingsUpdate(currency="GBP")
        updated_user = await repo.update_settings(test_user, settings)

        assert updated_user.email == original_email
        assert updated_user.name == original_name

    async def test_update_with_empty_settings(
        self,
        async_session: AsyncSession,
        test_user: User,
    ):
        """update_settings with no fields should not change anything."""
        repo = UserRepository(async_session)
        original_currency = test_user.currency
        original_language = test_user.language

        settings = UserSettingsUpdate()
        updated_user = await repo.update_settings(test_user, settings)

        assert updated_user.currency == original_currency
        assert updated_user.language == original_language


class TestUserRepositoryEdgeCases:
    """Tests for edge cases and error handling."""

    async def test_email_uniqueness_enforced(
        self,
        async_session: AsyncSession,
    ):
        """Email uniqueness should be enforced at database level."""
        from sqlalchemy.exc import IntegrityError

        from src.users.schemas import UserCreate

        repo = UserRepository(async_session)

        # Create first user
        user1_data = UserCreate(
            email="unique.email@example.com",
            oauth_provider="google",
            oauth_id="google_unique_123",
        )
        await repo.create(user1_data)

        # Try to create second user with same email - should fail
        user2_data = UserCreate(
            email="unique.email@example.com",
            oauth_provider="github",
            oauth_id="github_unique_456",
        )
        with pytest.raises(IntegrityError) as exc_info:
            await repo.create(user2_data)

        # Verify the correct constraint was violated (PostgreSQL naming convention)
        assert "users_email_key" in str(exc_info.value)

    async def test_get_or_create_with_none_avatar_and_name(
        self,
        async_session: AsyncSession,
    ):
        """get_or_create_from_oauth should handle None for optional fields."""
        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)
        user, was_created = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"minimal_oauth_{unique_id}",
            email=f"minimal.{unique_id}@example.com",
            name=None,
            avatar_url=None,
        )

        assert user.id is not None
        assert user.name is None
        assert user.avatar_url is None
        assert was_created is True

    async def test_get_or_create_updates_none_to_value(
        self,
        async_session: AsyncSession,
    ):
        """get_or_create_from_oauth should update from None to a value."""
        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)

        # First create user with no name
        user1, _ = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"update_none_{unique_id}",
            email=f"update.none.{unique_id}@example.com",
            name=None,
            avatar_url=None,
        )
        assert user1.name is None

        # Then login again with a name
        user2, was_created = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"update_none_{unique_id}",
            email=f"update.none.{unique_id}@example.com",
            name="Now Has Name",
            avatar_url="https://example.com/avatar.jpg",
        )

        assert user2.id == user1.id
        assert user2.name == "Now Has Name"
        assert user2.avatar_url == "https://example.com/avatar.jpg"
        assert was_created is False


class TestUserRepositorySignupCredits:
    """Tests for signup credits in UserRepository.get_or_create_from_oauth."""

    async def test_new_user_gets_signup_credits(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test that new users receive signup credits."""
        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)

        user, was_created = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"test-oauth-id-{unique_id}",
            email=f"newuser-{unique_id}@example.com",
            name="New User",
            avatar_url=None,
        )

        assert was_created is True
        assert user.free_credits_remaining == 5  # From app_setting fixture
        assert user.free_credits_reset_at is None  # No monthly reset

    async def test_new_user_gets_signup_transaction(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test that new users get a signup_bonus transaction."""
        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)

        user, was_created = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"test-oauth-id-{unique_id}",
            email=f"transactionuser-{unique_id}@example.com",
            name="Transaction User",
            avatar_url=None,
        )

        assert was_created is True

        # Check transaction was created
        result = await async_session.execute(
            select(CreditTransaction).where(CreditTransaction.user_id == user.id)
        )
        transactions = result.scalars().all()

        assert len(transactions) == 1
        assert transactions[0].transaction_type == "signup_bonus"
        assert transactions[0].amount == 5

    async def test_existing_user_does_not_get_additional_credits(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test that existing users don't get additional signup credits."""
        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)

        # Create user first time
        user1, was_created1 = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"test-oauth-id-{unique_id}",
            email=f"existinguser-{unique_id}@example.com",
            name="Existing User",
            avatar_url=None,
        )
        assert was_created1 is True
        original_credits = user1.free_credits_remaining

        # Try to get the same user again
        user2, was_created2 = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"test-oauth-id-{unique_id}",
            email=f"existinguser-{unique_id}@example.com",
            name="Existing User",
            avatar_url=None,
        )

        assert was_created2 is False
        assert user2.id == user1.id
        assert user2.free_credits_remaining == original_credits

    async def test_new_user_with_zero_signup_credits(
        self, async_session: AsyncSession, app_setting: AppSetting
    ):
        """Test new user when signup_credits is set to 0."""
        unique_id = str(uuid.uuid4())
        # Update setting to 0 using the service
        billing_service = BillingSettingsService(async_session)
        await billing_service.update_setting(app_setting.id, value_int=0)

        repo = UserRepository(async_session)

        user, was_created = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"test-oauth-id-{unique_id}",
            email=f"zerouser-{unique_id}@example.com",
            name="Zero User",
            avatar_url=None,
        )

        assert was_created is True
        # When signup_credits is 0, user should have 0 credits
        assert user.free_credits_remaining == 0

        # No transaction should be created for 0 credits
        result = await async_session.execute(
            select(CreditTransaction).where(CreditTransaction.user_id == user.id)
        )
        transactions = result.scalars().all()
        assert len(transactions) == 0

    async def test_new_user_uses_default_when_no_setting(
        self, async_session: AsyncSession
    ):
        """Test new user uses default signup credits when no setting exists."""
        unique_id = str(uuid.uuid4())
        repo = UserRepository(async_session)

        user, was_created = await repo.get_or_create_from_oauth(
            provider="google",
            oauth_id=f"test-oauth-id-{unique_id}",
            email=f"defaultuser-{unique_id}@example.com",
            name="Default User",
            avatar_url=None,
        )

        assert was_created is True
        # Default from DEFAULT_SETTINGS is 5
        assert user.free_credits_remaining == 5
