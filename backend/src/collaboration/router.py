"""API endpoints for collaboration feature."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from src.auth.dependencies import CurrentUserDep, CurrentUserIdDep
from src.collaboration.models import CollaboratorStatus
from src.collaboration.repository import CollaborationRepository
from src.collaboration.schemas import (
    AcceptInvitationRequest,
    AcceptInvitationResponse,
    CollaboratorInviteRequest,
    CollaboratorOwnerInfo,
    CollaboratorResponse,
    CollaboratorUpdateRequest,
    InventoryContextResponse,
    PendingInvitationResponse,
    SharedInventoryResponse,
)
from src.database import AsyncSessionDep

router = APIRouter()


@router.get("/context")
async def get_inventory_context(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    current_user: CurrentUserDep,
) -> InventoryContextResponse:
    """Get the user's inventory context including own and shared inventories."""
    repo = CollaborationRepository(session, user_id)

    # Get shared inventories (accepted)
    shared = await repo.get_shared_inventories()
    shared_responses = [SharedInventoryResponse.from_model(s) for s in shared]

    # Get pending invitations for user's email
    pending = await repo.get_pending_invitations_for_email(current_user.email)
    pending_responses = [PendingInvitationResponse.from_model(p) for p in pending]

    return InventoryContextResponse(
        own_inventory=CollaboratorOwnerInfo(
            id=current_user.id,
            name=current_user.name,
            email=current_user.email,
            avatar_url=current_user.avatar_url,
        ),
        shared_inventories=shared_responses,
        pending_invitations=pending_responses,
    )


@router.get("/collaborators")
async def list_collaborators(
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> list[CollaboratorResponse]:
    """List all collaborators for the current user's inventory."""
    repo = CollaborationRepository(session, user_id)
    collaborators = await repo.get_collaborators()
    return [CollaboratorResponse.from_model(c) for c in collaborators]


@router.post("/collaborators", status_code=status.HTTP_201_CREATED)
async def invite_collaborator(
    data: CollaboratorInviteRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    current_user: CurrentUserDep,
) -> CollaboratorResponse:
    """Invite a new collaborator to the inventory."""
    # Cannot invite yourself
    if data.email.lower() == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite yourself",
        )

    repo = CollaborationRepository(session, user_id)

    # Check if invitation already exists
    existing = await repo.check_existing_invitation(data.email)
    if existing:
        if existing.status == CollaboratorStatus.ACCEPTED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This user is already a collaborator",
            )
        elif existing.status == CollaboratorStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An invitation is already pending for this email",
            )
        # If declined, we could allow re-inviting - for now, remove and re-create
        await repo.remove_collaborator(existing)

    collaborator = await repo.invite_collaborator(data.email, data.role)
    return CollaboratorResponse.from_model(collaborator)


@router.put("/collaborators/{collaborator_id}")
async def update_collaborator(
    collaborator_id: UUID,
    data: CollaboratorUpdateRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> CollaboratorResponse:
    """Update a collaborator's role."""
    repo = CollaborationRepository(session, user_id)
    collaborator = await repo.get_collaborator_by_id(collaborator_id)

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    updated = await repo.update_collaborator_role(collaborator, data.role)
    return CollaboratorResponse.from_model(updated)


@router.delete(
    "/collaborators/{collaborator_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_collaborator(
    collaborator_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Remove a collaborator from the inventory."""
    repo = CollaborationRepository(session, user_id)
    collaborator = await repo.get_collaborator_by_id(collaborator_id)

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    await repo.remove_collaborator(collaborator)


@router.post("/invitations/accept")
async def accept_invitation(
    data: AcceptInvitationRequest,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    current_user: CurrentUserDep,
) -> AcceptInvitationResponse:
    """Accept a collaboration invitation using the token."""
    repo = CollaborationRepository(session, user_id)
    invitation = await repo.get_by_invitation_token(data.token)

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation token",
        )

    # Validate that the invitation was sent to the current user's email
    if invitation.invited_email.lower() != current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was not sent to your email address",
        )

    accepted = await repo.accept_invitation(invitation)

    return AcceptInvitationResponse(
        id=accepted.id,
        owner_id=accepted.owner_id,
        owner_name=accepted.owner.name if accepted.owner else None,
        role=accepted.role_enum,
    )


@router.post("/invitations/{invitation_id}/accept")
async def accept_invitation_by_id(
    invitation_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    current_user: CurrentUserDep,
) -> AcceptInvitationResponse:
    """Accept a collaboration invitation by ID (for logged-in users)."""
    repo = CollaborationRepository(session, user_id)

    # Get pending invitations for user's email
    pending = await repo.get_pending_invitations_for_email(current_user.email)
    invitation = next((p for p in pending if p.id == invitation_id), None)

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or not for your email",
        )

    accepted = await repo.accept_invitation(invitation)

    return AcceptInvitationResponse(
        id=accepted.id,
        owner_id=accepted.owner_id,
        owner_name=accepted.owner.name if accepted.owner else None,
        role=accepted.role_enum,
    )


@router.post(
    "/invitations/{invitation_id}/decline", status_code=status.HTTP_204_NO_CONTENT
)
async def decline_invitation(
    invitation_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    current_user: CurrentUserDep,
) -> None:
    """Decline a collaboration invitation."""
    repo = CollaborationRepository(session, user_id)

    # Get pending invitations for user's email
    pending = await repo.get_pending_invitations_for_email(current_user.email)
    invitation = next((p for p in pending if p.id == invitation_id), None)

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or not for your email",
        )

    await repo.decline_invitation(invitation)


@router.delete("/shared/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def leave_shared_inventory(
    owner_id: UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Leave a shared inventory."""
    if owner_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot leave your own inventory",
        )

    repo = CollaborationRepository(session, user_id)
    left = await repo.leave_shared_inventory(owner_id)

    if not left:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared inventory not found",
        )
