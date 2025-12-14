"""Tests for collaboration router endpoints."""

import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.collaboration.models import (
    CollaboratorRole,
    CollaboratorStatus,
    InventoryCollaborator,
)
from src.config import Settings
from src.users.models import User


@pytest.fixture
async def second_user(async_session: AsyncSession) -> User:
    """Create a second test user for collaboration tests."""
    user = User(
        id=uuid.uuid4(),
        email="collaborator@example.com",
        name="Collaborator User",
        oauth_provider="google",
        oauth_id="google_collaborator_123",
        credit_balance=0,
        free_credits_remaining=5,
        is_admin=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def second_user_client(
    async_session: AsyncSession,
    test_settings: Settings,  # noqa: ARG001
    second_user: User,  # noqa: ARG001
) -> AsyncGenerator[AsyncClient, None]:
    """Create an authenticated client for the second user."""
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
async def pending_invitation(
    async_session: AsyncSession,
    test_user: User,
    second_user: User,
) -> InventoryCollaborator:
    """Create a pending invitation from test_user to second_user."""
    invitation = InventoryCollaborator(
        id=uuid.uuid4(),
        owner_id=test_user.id,
        collaborator_id=second_user.id,
        invited_email=second_user.email,
        role=CollaboratorRole.VIEWER.value,
        status=CollaboratorStatus.PENDING.value,
        invitation_token="test_token_123",
    )
    async_session.add(invitation)
    await async_session.commit()
    await async_session.refresh(invitation)
    return invitation


@pytest.fixture
async def accepted_collaboration(
    async_session: AsyncSession,
    test_user: User,
    second_user: User,
) -> InventoryCollaborator:
    """Create an accepted collaboration."""
    from datetime import UTC, datetime

    collaboration = InventoryCollaborator(
        id=uuid.uuid4(),
        owner_id=test_user.id,
        collaborator_id=second_user.id,
        invited_email=second_user.email,
        role=CollaboratorRole.EDITOR.value,
        status=CollaboratorStatus.ACCEPTED.value,
        accepted_at=datetime.now(UTC),
    )
    async_session.add(collaboration)
    await async_session.commit()
    await async_session.refresh(collaboration)
    return collaboration


class TestInventoryContext:
    """Tests for the /context endpoint."""

    async def test_get_context_returns_own_inventory(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test that context includes user's own inventory info."""
        response = await authenticated_client.get("/api/v1/collaboration/context")
        assert response.status_code == 200

        data = response.json()
        assert data["own_inventory"]["id"] == str(test_user.id)
        assert data["own_inventory"]["email"] == test_user.email
        assert data["shared_inventories"] == []
        assert data["pending_invitations"] == []

    async def test_get_context_includes_pending_invitations(
        self,
        second_user_client: AsyncClient,
        pending_invitation: InventoryCollaborator,  # noqa: ARG002
        second_user: User,
        test_user: User,  # noqa: ARG002
    ):
        """Test that pending invitations are included in context."""
        response = await second_user_client.get("/api/v1/collaboration/context")
        assert response.status_code == 200

        data = response.json()
        assert len(data["pending_invitations"]) == 1
        assert data["pending_invitations"][0]["invited_email"] == second_user.email

    async def test_get_context_includes_shared_inventories(
        self,
        second_user_client: AsyncClient,
        accepted_collaboration: InventoryCollaborator,  # noqa: ARG002
        test_user: User,
    ):
        """Test that accepted shared inventories are included."""
        response = await second_user_client.get("/api/v1/collaboration/context")
        assert response.status_code == 200

        data = response.json()
        assert len(data["shared_inventories"]) == 1
        assert data["shared_inventories"][0]["owner_id"] == str(test_user.id)


class TestListCollaborators:
    """Tests for listing collaborators."""

    async def test_list_collaborators_empty(self, authenticated_client: AsyncClient):
        """Test listing collaborators when none exist."""
        response = await authenticated_client.get("/api/v1/collaboration/collaborators")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_collaborators_with_pending_invitation(
        self,
        authenticated_client: AsyncClient,
        pending_invitation: InventoryCollaborator,
    ):
        """Test listing collaborators includes pending invitations."""
        response = await authenticated_client.get("/api/v1/collaboration/collaborators")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(pending_invitation.id)
        assert data[0]["status"] == "pending"


class TestInviteCollaborator:
    """Tests for inviting collaborators."""

    async def test_invite_collaborator_success(
        self,
        authenticated_client: AsyncClient,
        second_user: User,  # noqa: ARG002
    ):
        """Test successful invitation."""
        response = await authenticated_client.post(
            "/api/v1/collaboration/collaborators",
            json={"email": "new_collaborator@example.com", "role": "viewer"},
        )
        assert response.status_code == 201

        data = response.json()
        assert data["invited_email"] == "new_collaborator@example.com"
        assert data["role"] == "viewer"
        assert data["status"] == "pending"

    async def test_invite_self_fails(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test that inviting yourself fails."""
        response = await authenticated_client.post(
            "/api/v1/collaboration/collaborators",
            json={"email": test_user.email, "role": "viewer"},
        )
        assert response.status_code == 400
        assert "cannot invite yourself" in response.json()["detail"].lower()

    async def test_invite_duplicate_fails(
        self,
        authenticated_client: AsyncClient,
        pending_invitation: InventoryCollaborator,  # noqa: ARG002
        second_user: User,
    ):
        """Test that duplicate invitations fail."""
        response = await authenticated_client.post(
            "/api/v1/collaboration/collaborators",
            json={"email": second_user.email, "role": "viewer"},
        )
        assert response.status_code == 409


class TestAcceptInvitation:
    """Tests for accepting invitations."""

    async def test_accept_invitation_success(
        self,
        second_user_client: AsyncClient,
        pending_invitation: InventoryCollaborator,
    ):
        """Test successful acceptance of invitation."""
        response = await second_user_client.post(
            f"/api/v1/collaboration/invitations/{pending_invitation.id}/accept"
        )
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == str(pending_invitation.id)
        assert data["role"] == "viewer"

    async def test_accept_nonexistent_invitation_fails(
        self, second_user_client: AsyncClient
    ):
        """Test that accepting a non-existent invitation fails."""
        fake_id = uuid.uuid4()
        response = await second_user_client.post(
            f"/api/v1/collaboration/invitations/{fake_id}/accept"
        )
        assert response.status_code == 404


class TestDeclineInvitation:
    """Tests for declining invitations."""

    async def test_decline_invitation_success(
        self,
        second_user_client: AsyncClient,
        pending_invitation: InventoryCollaborator,
    ):
        """Test successful declining of invitation."""
        response = await second_user_client.post(
            f"/api/v1/collaboration/invitations/{pending_invitation.id}/decline"
        )
        assert response.status_code == 204


class TestRemoveCollaborator:
    """Tests for removing collaborators."""

    async def test_remove_collaborator_success(
        self,
        authenticated_client: AsyncClient,
        accepted_collaboration: InventoryCollaborator,
    ):
        """Test removing a collaborator."""
        response = await authenticated_client.delete(
            f"/api/v1/collaboration/collaborators/{accepted_collaboration.id}"
        )
        assert response.status_code == 204

    async def test_remove_nonexistent_collaborator_fails(
        self, authenticated_client: AsyncClient
    ):
        """Test removing a non-existent collaborator fails."""
        fake_id = uuid.uuid4()
        response = await authenticated_client.delete(
            f"/api/v1/collaboration/collaborators/{fake_id}"
        )
        assert response.status_code == 404


class TestLeaveSharedInventory:
    """Tests for leaving shared inventories."""

    async def test_leave_shared_inventory_success(
        self,
        second_user_client: AsyncClient,
        accepted_collaboration: InventoryCollaborator,  # noqa: ARG002
        test_user: User,
    ):
        """Test leaving a shared inventory."""
        response = await second_user_client.delete(
            f"/api/v1/collaboration/shared/{test_user.id}"
        )
        assert response.status_code == 204

    async def test_leave_own_inventory_fails(
        self, authenticated_client: AsyncClient, test_user: User
    ):
        """Test that leaving your own inventory fails."""
        response = await authenticated_client.delete(
            f"/api/v1/collaboration/shared/{test_user.id}"
        )
        assert response.status_code == 400


class TestUpdateCollaboratorRole:
    """Tests for updating collaborator roles."""

    async def test_update_role_success(
        self,
        authenticated_client: AsyncClient,
        accepted_collaboration: InventoryCollaborator,
    ):
        """Test updating a collaborator's role."""
        response = await authenticated_client.put(
            f"/api/v1/collaboration/collaborators/{accepted_collaboration.id}",
            json={"role": "viewer"},
        )
        assert response.status_code == 200
        assert response.json()["role"] == "viewer"
