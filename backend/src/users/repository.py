from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.users.models import User
from src.users.schemas import UserCreate


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
            select(User).where(User.oauth_provider == provider, User.oauth_id == oauth_id)
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
            if settings.admin_email and email == settings.admin_email and not user.is_admin:
                user.is_admin = True
                updated = True
            if updated:
                await self.session.commit()
                await self.session.refresh(user)
            return user, False

        # Create new user
        user_data = UserCreate(
            email=email,
            name=name,
            avatar_url=avatar_url,
            oauth_provider=provider,
            oauth_id=oauth_id,
        )
        user = await self.create(user_data)

        # Auto-admin: if email matches admin_email, make them admin
        if settings.admin_email and email == settings.admin_email:
            user.is_admin = True
            await self.session.commit()
            await self.session.refresh(user)

        return user, True
