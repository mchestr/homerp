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
    from datetime import UTC, datetime, timedelta

    invitation = InventoryCollaborator(
        id=uuid.uuid4(),
        owner_id=test_user.id,
        collaborator_id=second_user.id,
        invited_email=second_user.email,
        role=CollaboratorRole.VIEWER.value,
        status=CollaboratorStatus.PENDING.value,
        invitation_token="test_token_123",
        invitation_expires_at=datetime.now(UTC) + timedelta(days=7),
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


class TestCollaborationPermissionBoundaries:
    """Tests for permission edge cases in shared inventories."""

    async def test_viewer_can_list_shared_items(
        self,
        async_session: AsyncSession,
        test_settings: Settings,  # noqa: ARG002
        second_user: User,
        viewer_collaboration: InventoryCollaborator,  # noqa: ARG002
        owner_item,  # noqa: ARG002
        test_user: User,
    ):
        """Viewer can list items in shared inventory."""
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: second_user.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/items",
                headers={"X-Inventory-Context": str(test_user.id)},
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) >= 1

        app.dependency_overrides.clear()

    async def test_viewer_cannot_create_item_in_shared_inventory(
        self,
        async_session: AsyncSession,
        test_settings: Settings,  # noqa: ARG002
        second_user: User,
        viewer_collaboration: InventoryCollaborator,  # noqa: ARG002
        owner_category,
        owner_location,
        test_user: User,
    ):
        """Viewer cannot create items in shared inventory."""
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: second_user.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/items",
                json={
                    "name": "Viewer Created Item",
                    "category_id": str(owner_category.id),
                    "location_id": str(owner_location.id),
                },
                headers={"X-Inventory-Context": str(test_user.id)},
            )
            assert response.status_code == 403

        app.dependency_overrides.clear()

    async def test_viewer_cannot_delete_item_in_shared_inventory(
        self,
        async_session: AsyncSession,
        test_settings: Settings,  # noqa: ARG002
        second_user: User,
        viewer_collaboration: InventoryCollaborator,  # noqa: ARG002
        owner_item,
        test_user: User,
    ):
        """Viewer cannot delete items in shared inventory.

        Should return 403 (forbidden) to clearly indicate permission denied.
        Using 403 instead of 404 is preferred as it's more explicit about
        the reason for denial without leaking information.
        """
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: second_user.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.delete(
                f"/api/v1/items/{owner_item.id}",
                headers={"X-Inventory-Context": str(test_user.id)},
            )
            # 403 forbidden - viewer doesn't have write permission
            assert response.status_code == 403

        app.dependency_overrides.clear()

    async def test_editor_can_create_item_in_shared_inventory(
        self,
        async_session: AsyncSession,
        test_settings: Settings,  # noqa: ARG002
        second_user: User,
        editor_collaboration: InventoryCollaborator,  # noqa: ARG002
        owner_category,
        owner_location,
        test_user: User,
    ):
        """Editor can create items in shared inventory."""
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: second_user.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/items",
                json={
                    "name": "Editor Created Item",
                    "category_id": str(owner_category.id),
                    "location_id": str(owner_location.id),
                },
                headers={"X-Inventory-Context": str(test_user.id)},
            )
            assert response.status_code == 201

        app.dependency_overrides.clear()

    async def test_collaborator_cannot_access_third_party_inventory(
        self,
        async_session: AsyncSession,
        test_settings: Settings,  # noqa: ARG002
        second_user: User,
        viewer_collaboration: InventoryCollaborator,  # noqa: ARG002
        third_user: User,
    ):
        """Collaborator cannot access inventory they haven't been invited to."""
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: second_user.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Try to access third_user's inventory
            response = await client.get(
                "/api/v1/items",
                headers={"X-Inventory-Context": str(third_user.id)},
            )
            assert response.status_code == 403

        app.dependency_overrides.clear()

    async def test_cannot_accept_invitation_for_different_email(
        self,
        async_session: AsyncSession,
        test_settings: Settings,  # noqa: ARG002
        third_user: User,  # Different email than the invitation
        pending_invitation: InventoryCollaborator,  # Invitation to second_user
    ):
        """User cannot accept an invitation addressed to a different email."""
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: third_user.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/collaboration/invitations/{pending_invitation.id}/accept"
            )
            assert response.status_code == 404  # Not found for this user

        app.dependency_overrides.clear()

    async def test_cannot_update_other_users_collaborators(
        self,
        async_session: AsyncSession,
        test_settings: Settings,  # noqa: ARG002
        second_user: User,
        owner_has_another_collaborator: InventoryCollaborator,
    ):
        """User cannot update collaborators of an inventory they don't own."""
        from src.auth.dependencies import get_current_user_id
        from src.database import get_session
        from src.main import app

        async def override_session():
            yield async_session

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user_id] = lambda: second_user.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.put(
                f"/api/v1/collaboration/collaborators/{owner_has_another_collaborator.id}",
                json={"role": "editor"},
            )
            # Should be 404 - collaborator not found for this user's inventory
            assert response.status_code == 404

        app.dependency_overrides.clear()


@pytest.fixture
async def third_user(async_session: AsyncSession) -> User:
    """Create a third test user."""
    user = User(
        id=uuid.uuid4(),
        email="third@example.com",
        name="Third User",
        oauth_provider="google",
        oauth_id="google_third_collab_123",
        credit_balance=0,
        free_credits_remaining=5,
        is_admin=False,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def viewer_collaboration(
    async_session: AsyncSession,
    test_user: User,
    second_user: User,
) -> InventoryCollaborator:
    """Create an accepted viewer collaboration."""
    from datetime import UTC, datetime

    collaboration = InventoryCollaborator(
        id=uuid.uuid4(),
        owner_id=test_user.id,
        collaborator_id=second_user.id,
        invited_email=second_user.email,
        role=CollaboratorRole.VIEWER.value,
        status=CollaboratorStatus.ACCEPTED.value,
        accepted_at=datetime.now(UTC),
    )
    async_session.add(collaboration)
    await async_session.commit()
    await async_session.refresh(collaboration)
    return collaboration


@pytest.fixture
async def editor_collaboration(
    async_session: AsyncSession,
    test_user: User,
    second_user: User,
) -> InventoryCollaborator:
    """Create an accepted editor collaboration."""
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


@pytest.fixture
async def owner_category(async_session: AsyncSession, test_user: User):
    """Create a category owned by test_user."""
    from sqlalchemy_utils import Ltree

    from src.categories.models import Category

    category = Category(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Owner Category",
        path=Ltree("owner_category"),
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


@pytest.fixture
async def owner_location(async_session: AsyncSession, test_user: User):
    """Create a location owned by test_user."""
    from sqlalchemy_utils import Ltree

    from src.locations.models import Location

    location = Location(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Owner Location",
        path=Ltree("owner_location"),
    )
    async_session.add(location)
    await async_session.commit()
    await async_session.refresh(location)
    return location


@pytest.fixture
async def owner_item(
    async_session: AsyncSession,
    test_user: User,
    owner_category,
    owner_location,
):
    """Create an item owned by test_user."""
    from src.items.models import Item

    item = Item(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Owner Item",
        category_id=owner_category.id,
        location_id=owner_location.id,
        quantity=1,
    )
    async_session.add(item)
    await async_session.commit()
    await async_session.refresh(item)
    return item


@pytest.fixture
async def owner_has_another_collaborator(
    async_session: AsyncSession,
    test_user: User,
    third_user: User,
) -> InventoryCollaborator:
    """Create a collaboration record between owner and third_user."""
    from datetime import UTC, datetime

    collaboration = InventoryCollaborator(
        id=uuid.uuid4(),
        owner_id=test_user.id,
        collaborator_id=third_user.id,
        invited_email=third_user.email,
        role=CollaboratorRole.VIEWER.value,
        status=CollaboratorStatus.ACCEPTED.value,
        accepted_at=datetime.now(UTC),
    )
    async_session.add(collaboration)
    await async_session.commit()
    await async_session.refresh(collaboration)
    return collaboration
