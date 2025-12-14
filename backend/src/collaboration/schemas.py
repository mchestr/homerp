"""Pydantic schemas for collaboration feature."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from src.collaboration.models import CollaboratorRole, CollaboratorStatus


class CollaboratorInviteRequest(BaseModel):
    """Request to invite a collaborator."""

    email: EmailStr
    role: CollaboratorRole = CollaboratorRole.VIEWER


class CollaboratorUpdateRequest(BaseModel):
    """Request to update a collaborator's role."""

    role: CollaboratorRole


class CollaboratorOwnerInfo(BaseModel):
    """Basic info about an inventory owner."""

    id: UUID
    name: str | None
    email: str
    avatar_url: str | None

    model_config = ConfigDict(from_attributes=True)


class CollaboratorUserInfo(BaseModel):
    """Basic info about a collaborator user."""

    id: UUID
    name: str | None
    email: str
    avatar_url: str | None

    model_config = ConfigDict(from_attributes=True)


class CollaboratorResponse(BaseModel):
    """Response for a single collaborator."""

    id: UUID
    owner_id: UUID
    collaborator_id: UUID | None
    invited_email: str
    role: CollaboratorRole
    status: CollaboratorStatus
    created_at: datetime
    updated_at: datetime
    accepted_at: datetime | None
    # Populated user info when collaborator has accepted
    collaborator: CollaboratorUserInfo | None = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_model(cls, model) -> "CollaboratorResponse":
        """Create response from model with relationships."""
        collaborator_info = None
        if model.collaborator:
            collaborator_info = CollaboratorUserInfo(
                id=model.collaborator.id,
                name=model.collaborator.name,
                email=model.collaborator.email,
                avatar_url=model.collaborator.avatar_url,
            )
        return cls(
            id=model.id,
            owner_id=model.owner_id,
            collaborator_id=model.collaborator_id,
            invited_email=model.invited_email,
            role=CollaboratorRole(model.role),
            status=CollaboratorStatus(model.status),
            created_at=model.created_at,
            updated_at=model.updated_at,
            accepted_at=model.accepted_at,
            collaborator=collaborator_info,
        )


class SharedInventoryResponse(BaseModel):
    """Response for a shared inventory the user has access to."""

    id: UUID
    owner_id: UUID
    role: CollaboratorRole
    status: CollaboratorStatus
    accepted_at: datetime | None
    # Owner info
    owner: CollaboratorOwnerInfo

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_model(cls, model) -> "SharedInventoryResponse":
        """Create response from model with relationships."""
        owner_info = CollaboratorOwnerInfo(
            id=model.owner.id,
            name=model.owner.name,
            email=model.owner.email,
            avatar_url=model.owner.avatar_url,
        )
        return cls(
            id=model.id,
            owner_id=model.owner_id,
            role=CollaboratorRole(model.role),
            status=CollaboratorStatus(model.status),
            accepted_at=model.accepted_at,
            owner=owner_info,
        )


class PendingInvitationResponse(BaseModel):
    """Response for a pending invitation."""

    id: UUID
    owner_id: UUID
    role: CollaboratorRole
    invited_email: str
    created_at: datetime
    owner: CollaboratorOwnerInfo

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_model(cls, model) -> "PendingInvitationResponse":
        """Create response from model with relationships."""
        owner_info = CollaboratorOwnerInfo(
            id=model.owner.id,
            name=model.owner.name,
            email=model.owner.email,
            avatar_url=model.owner.avatar_url,
        )
        return cls(
            id=model.id,
            owner_id=model.owner_id,
            role=CollaboratorRole(model.role),
            invited_email=model.invited_email,
            created_at=model.created_at,
            owner=owner_info,
        )


class AcceptInvitationRequest(BaseModel):
    """Request to accept an invitation via token."""

    token: str


class AcceptInvitationResponse(BaseModel):
    """Response after accepting an invitation."""

    id: UUID
    owner_id: UUID
    owner_name: str | None
    role: CollaboratorRole


class InventoryContextResponse(BaseModel):
    """Response with current inventory context info."""

    # Current user's own inventory is always available
    own_inventory: CollaboratorOwnerInfo
    # Inventories shared with the user
    shared_inventories: list[SharedInventoryResponse]
    # Pending invitations for the user
    pending_invitations: list[PendingInvitationResponse]
