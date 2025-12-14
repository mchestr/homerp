"""Collaboration models for multi-user inventory sharing."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class CollaboratorRole(str, Enum):
    """Role levels for inventory collaborators."""

    VIEWER = "viewer"  # Can view items, categories, locations
    EDITOR = "editor"  # Can create, edit items (but not delete or manage settings)


class CollaboratorStatus(str, Enum):
    """Status of a collaboration invitation."""

    PENDING = "pending"  # Invitation sent, not yet accepted
    ACCEPTED = "accepted"  # Invitation accepted, collaboration active
    DECLINED = "declined"  # Invitation declined


class InventoryCollaborator(Base):
    """Model for tracking inventory collaboration between users.

    This enables multi-user access to a single user's inventory.
    The owner grants access to collaborators via email invitations.
    """

    __tablename__ = "inventory_collaborators"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    # The owner of the inventory being shared
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The user who has been granted access (NULL until invitation accepted)
    collaborator_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Email used for invitation
    invited_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    # Role determines permissions
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=CollaboratorRole.VIEWER.value
    )
    # Status of the invitation
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=CollaboratorStatus.PENDING.value
    )
    # Token for accepting invitation (cleared after acceptance)
    invitation_token: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    # Token expiration time
    invitation_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    owner: Mapped["User"] = relationship(
        "User", foreign_keys=[owner_id], back_populates="owned_collaborations"
    )
    collaborator: Mapped["User | None"] = relationship(
        "User", foreign_keys=[collaborator_id], back_populates="shared_inventories"
    )

    @property
    def role_enum(self) -> CollaboratorRole:
        """Get role as enum."""
        return CollaboratorRole(self.role)

    @property
    def status_enum(self) -> CollaboratorStatus:
        """Get status as enum."""
        return CollaboratorStatus(self.status)

    @property
    def is_active(self) -> bool:
        """Check if collaboration is active."""
        return self.status == CollaboratorStatus.ACCEPTED.value

    @property
    def can_edit(self) -> bool:
        """Check if collaborator has edit permissions."""
        return self.is_active and self.role == CollaboratorRole.EDITOR.value


# Import at bottom to avoid circular imports
from src.users.models import User  # noqa: E402
