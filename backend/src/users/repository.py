import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.billing.models import CreditTransaction
from src.billing.settings_service import BillingSettingsService
from src.config import get_settings
from src.users.models import User
from src.users.schemas import UserCreate, UserSettingsUpdate

logger = logging.getLogger(__name__)


class UserRepository:
    """Repository for user database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        """Get a user by ID."""
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """Get a user by email."""
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_oauth(self, provider: str, oauth_id: str) -> User | None:
        """Get a user by OAuth provider and ID."""
        result = await self.session.execute(
            select(User).where(
                User.oauth_provider == provider, User.oauth_id == oauth_id
            )
        )
        return result.scalar_one_or_none()

    async def create(self, user_data: UserCreate) -> User:
        """Create a new user."""
        user = User(
            email=user_data.email,
            name=user_data.name,
            avatar_url=user_data.avatar_url,
            oauth_provider=user_data.oauth_provider,
            oauth_id=user_data.oauth_id,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_or_create_from_oauth(
        self,
        provider: str,
        oauth_id: str,
        email: str,
        name: str | None,
        avatar_url: str | None,
    ) -> tuple[User, bool]:
        """
        Get or create a user from OAuth info.

        Returns:
            Tuple of (user, was_created)
        """
        settings = get_settings()

        # Try to find by OAuth
        user = await self.get_by_oauth(provider, oauth_id)
        if user:
            # Update user info if changed
            updated = False
            if user.email != email:
                user.email = email
                updated = True
            if user.name != name:
                user.name = name
                updated = True
            if user.avatar_url != avatar_url:
                user.avatar_url = avatar_url
                updated = True
            # Auto-admin: if email matches admin_email and not already admin
            if (
                settings.admin_email
                and email == settings.admin_email
                and not user.is_admin
            ):
                user.is_admin = True
                updated = True
            if updated:
                await self.session.commit()
                await self.session.refresh(user)
            return user, False

        # Get signup credits setting before creating user
        billing_settings = BillingSettingsService(self.session)
        signup_credits = await billing_settings.get_signup_credits()

        # Create new user with all initial values set atomically
        user = User(
            email=email,
            name=name,
            avatar_url=avatar_url,
            oauth_provider=provider,
            oauth_id=oauth_id,
            is_admin=bool(settings.admin_email and email == settings.admin_email),
            free_credits_remaining=signup_credits,
            free_credits_reset_at=None,  # No monthly resets
        )
        self.session.add(user)

        # Flush to get user.id for the transaction record
        await self.session.flush()

        if signup_credits > 0:
            # Create transaction record for signup bonus
            transaction = CreditTransaction(
                user_id=user.id,
                amount=signup_credits,
                transaction_type="signup_bonus",
                description="Signup credits bonus",
            )
            self.session.add(transaction)
            logger.info(
                f"Granted signup credits: user_id={user.id}, credits={signup_credits}"
            )

        await self.session.commit()
        await self.session.refresh(user)

        return user, True

    async def update_settings(self, user: User, settings: UserSettingsUpdate) -> User:
        """Update user settings."""
        if settings.currency is not None:
            user.currency = settings.currency
        if settings.language is not None:
            user.language = settings.language
        await self.session.commit()
        await self.session.refresh(user)
        return user
