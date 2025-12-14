"""Repository for collaboration operations."""

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.collaboration.models import (
    CollaboratorRole,
    CollaboratorStatus,
    InventoryCollaborator,
)
from src.users.models import User

# Default invitation expiration time (7 days)
INVITATION_EXPIRY_DAYS = 7


class CollaborationRepository:
    """Repository for managing inventory collaborations."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def get_collaborators(self) -> list[InventoryCollaborator]:
        """Get all collaborators for the current user's inventory."""
        result = await self.session.execute(
            select(InventoryCollaborator)
            .options(joinedload(InventoryCollaborator.collaborator))
            .where(InventoryCollaborator.owner_id == self.user_id)
            .order_by(InventoryCollaborator.created_at.desc())
        )
        return list(result.scalars().unique().all())

    async def get_collaborator_by_id(
        self, collaborator_id: UUID
    ) -> InventoryCollaborator | None:
        """Get a specific collaborator by ID (must be owned by current user)."""
        result = await self.session.execute(
            select(InventoryCollaborator)
            .options(joinedload(InventoryCollaborator.collaborator))
            .where(
                InventoryCollaborator.id == collaborator_id,
                InventoryCollaborator.owner_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_shared_inventories(self) -> list[InventoryCollaborator]:
        """Get inventories shared with the current user (accepted only)."""
        result = await self.session.execute(
            select(InventoryCollaborator)
            .options(joinedload(InventoryCollaborator.owner))
            .where(
                InventoryCollaborator.collaborator_id == self.user_id,
                InventoryCollaborator.status == CollaboratorStatus.ACCEPTED.value,
            )
            .order_by(InventoryCollaborator.accepted_at.desc())
        )
        return list(result.scalars().unique().all())

    async def get_pending_invitations_for_email(
        self, email: str
    ) -> list[InventoryCollaborator]:
        """Get pending invitations for a specific email."""
        result = await self.session.execute(
            select(InventoryCollaborator)
            .options(joinedload(InventoryCollaborator.owner))
            .where(
                InventoryCollaborator.invited_email == email.lower(),
                InventoryCollaborator.status == CollaboratorStatus.PENDING.value,
            )
            .order_by(InventoryCollaborator.created_at.desc())
        )
        return list(result.scalars().unique().all())

    async def get_by_invitation_token(self, token: str) -> InventoryCollaborator | None:
        """Get invitation by token (only if not expired)."""
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(InventoryCollaborator)
            .options(joinedload(InventoryCollaborator.owner))
            .where(
                InventoryCollaborator.invitation_token == token,
                InventoryCollaborator.status == CollaboratorStatus.PENDING.value,
                # Check expiration (allow if expires_at is NULL for backwards compat)
                (InventoryCollaborator.invitation_expires_at.is_(None))
                | (InventoryCollaborator.invitation_expires_at > now),
            )
        )
        return result.scalar_one_or_none()

    async def check_existing_invitation(
        self, email: str
    ) -> InventoryCollaborator | None:
        """Check if an invitation already exists for this email from current user."""
        result = await self.session.execute(
            select(InventoryCollaborator).where(
                InventoryCollaborator.owner_id == self.user_id,
                InventoryCollaborator.invited_email == email.lower(),
            )
        )
        return result.scalar_one_or_none()

    async def invite_collaborator(
        self, email: str, role: CollaboratorRole
    ) -> InventoryCollaborator:
        """Create a new collaboration invitation."""
        # Generate a secure token
        token = secrets.token_urlsafe(32)
        # Set expiration time
        expires_at = datetime.now(UTC) + timedelta(days=INVITATION_EXPIRY_DAYS)

        # Check if the invited user already exists
        user_result = await self.session.execute(
            select(User).where(User.email == email.lower())
        )
        existing_user = user_result.scalar_one_or_none()

        collaborator = InventoryCollaborator(
            owner_id=self.user_id,
            collaborator_id=existing_user.id if existing_user else None,
            invited_email=email.lower(),
            role=role.value,
            status=CollaboratorStatus.PENDING.value,
            invitation_token=token,
            invitation_expires_at=expires_at,
        )

        self.session.add(collaborator)
        await self.session.commit()
        await self.session.refresh(collaborator, ["collaborator"])

        return collaborator

    async def accept_invitation(
        self, invitation: InventoryCollaborator
    ) -> InventoryCollaborator:
        """Accept a collaboration invitation."""
        invitation.collaborator_id = self.user_id
        invitation.status = CollaboratorStatus.ACCEPTED.value
        invitation.accepted_at = datetime.now(UTC)
        invitation.invitation_token = None  # Clear token after use

        await self.session.commit()
        await self.session.refresh(invitation, ["owner"])

        return invitation

    async def decline_invitation(
        self, invitation: InventoryCollaborator
    ) -> InventoryCollaborator:
        """Decline a collaboration invitation."""
        invitation.status = CollaboratorStatus.DECLINED.value
        invitation.invitation_token = None

        await self.session.commit()
        return invitation

    async def update_collaborator_role(
        self, collaborator: InventoryCollaborator, role: CollaboratorRole
    ) -> InventoryCollaborator:
        """Update a collaborator's role."""
        collaborator.role = role.value
        await self.session.commit()
        # Refresh all attributes and relationships to avoid lazy load issues
        await self.session.refresh(collaborator)
        # Also refresh the collaborator relationship if needed
        if collaborator.collaborator_id:
            # Re-query to get the relationship loaded
            result = await self.session.execute(
                select(InventoryCollaborator)
                .options(joinedload(InventoryCollaborator.collaborator))
                .where(InventoryCollaborator.id == collaborator.id)
            )
            return result.scalar_one()
        return collaborator

    async def remove_collaborator(self, collaborator: InventoryCollaborator) -> None:
        """Remove a collaborator from the inventory."""
        await self.session.delete(collaborator)
        await self.session.commit()

    async def leave_shared_inventory(self, owner_id: UUID) -> bool:
        """Leave a shared inventory (as a collaborator)."""
        result = await self.session.execute(
            select(InventoryCollaborator).where(
                InventoryCollaborator.owner_id == owner_id,
                InventoryCollaborator.collaborator_id == self.user_id,
                InventoryCollaborator.status == CollaboratorStatus.ACCEPTED.value,
            )
        )
        collaboration = result.scalar_one_or_none()

        if collaboration:
            await self.session.delete(collaboration)
            await self.session.commit()
            return True
        return False

    async def get_collaboration_for_owner(
        self, owner_id: UUID
    ) -> InventoryCollaborator | None:
        """Get collaboration record for accessing another user's inventory."""
        result = await self.session.execute(
            select(InventoryCollaborator).where(
                InventoryCollaborator.owner_id == owner_id,
                InventoryCollaborator.collaborator_id == self.user_id,
                InventoryCollaborator.status == CollaboratorStatus.ACCEPTED.value,
            )
        )
        return result.scalar_one_or_none()

    async def can_access_inventory(self, owner_id: UUID) -> bool:
        """Check if user can access the specified owner's inventory."""
        # User can always access their own inventory
        if owner_id == self.user_id:
            return True

        collaboration = await self.get_collaboration_for_owner(owner_id)
        return collaboration is not None

    async def can_edit_inventory(self, owner_id: UUID) -> bool:
        """Check if user can edit the specified owner's inventory."""
        # User can always edit their own inventory
        if owner_id == self.user_id:
            return True

        collaboration = await self.get_collaboration_for_owner(owner_id)
        return collaboration is not None and collaboration.can_edit
