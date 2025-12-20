"""HTTP integration tests for feedback router."""

import uuid

from httpx import AsyncClient

from src.feedback.models import Feedback


class TestCreateFeedbackEndpoint:
    """Tests for POST /api/v1/feedback."""

    async def test_create_feedback(self, authenticated_client: AsyncClient):
        """Test submitting feedback."""
        response = await authenticated_client.post(
            "/api/v1/feedback",
            json={
                "subject": "Test Subject",
                "message": "Test feedback message",
                "feedback_type": "bug",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["subject"] == "Test Subject"
        assert data["message"] == "Test feedback message"
        assert data["feedback_type"] == "bug"
        assert data["status"] == "pending"

    async def test_create_feedback_feature_request(
        self, authenticated_client: AsyncClient
    ):
        """Test submitting a feature request."""
        response = await authenticated_client.post(
            "/api/v1/feedback",
            json={
                "subject": "New Feature",
                "message": "Please add this feature",
                "feedback_type": "feature",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["feedback_type"] == "feature"

    async def test_create_feedback_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.post(
            "/api/v1/feedback",
            json={"subject": "Test", "message": "Test", "feedback_type": "bug"},
        )

        assert response.status_code == 401


class TestListMyFeedbackEndpoint:
    """Tests for GET /api/v1/feedback."""

    async def test_list_my_feedback_empty(self, authenticated_client: AsyncClient):
        """Test listing feedback when none exist."""
        response = await authenticated_client.get("/api/v1/feedback")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_list_my_feedback_with_data(
        self, authenticated_client: AsyncClient, test_feedback: Feedback
    ):
        """Test listing feedback with existing data."""
        response = await authenticated_client.get("/api/v1/feedback")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["message"] == test_feedback.message

    async def test_list_my_feedback_unauthenticated(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that unauthenticated request returns 401."""
        response = await unauthenticated_client.get("/api/v1/feedback")

        assert response.status_code == 401


class TestListAllFeedbackAdminEndpoint:
    """Tests for GET /api/v1/feedback/admin."""

    async def test_list_all_feedback_as_admin(
        self, admin_client: AsyncClient, test_feedback: Feedback
    ):
        """Test listing all feedback as admin."""
        response = await admin_client.get("/api/v1/feedback/admin")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_list_all_feedback_as_non_admin(
        self, authenticated_client: AsyncClient
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get("/api/v1/feedback/admin")

        assert response.status_code == 403

    async def test_list_all_feedback_filter_by_status(
        self, admin_client: AsyncClient, test_feedback: Feedback
    ):
        """Test filtering feedback by status."""
        response = await admin_client.get(
            "/api/v1/feedback/admin", params={"status": "open"}
        )

        assert response.status_code == 200


class TestGetFeedbackAdminEndpoint:
    """Tests for GET /api/v1/feedback/admin/{feedback_id}."""

    async def test_get_feedback_as_admin(
        self, admin_client: AsyncClient, test_feedback: Feedback
    ):
        """Test getting specific feedback as admin."""
        response = await admin_client.get(f"/api/v1/feedback/admin/{test_feedback.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_feedback.id)
        assert "user_email" in data

    async def test_get_feedback_as_non_admin(
        self, authenticated_client: AsyncClient, test_feedback: Feedback
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.get(
            f"/api/v1/feedback/admin/{test_feedback.id}"
        )

        assert response.status_code == 403

    async def test_get_feedback_not_found(self, admin_client: AsyncClient):
        """Test getting non-existent feedback."""
        response = await admin_client.get(f"/api/v1/feedback/admin/{uuid.uuid4()}")

        assert response.status_code == 404


class TestUpdateFeedbackAdminEndpoint:
    """Tests for PUT /api/v1/feedback/admin/{feedback_id}."""

    async def test_update_feedback_status(
        self, admin_client: AsyncClient, test_feedback: Feedback
    ):
        """Test updating feedback status as admin."""
        response = await admin_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}",
            json={"status": "in_progress", "admin_notes": "Working on this"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["admin_notes"] == "Working on this"

    async def test_update_feedback_as_non_admin(
        self, authenticated_client: AsyncClient, test_feedback: Feedback
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}",
            json={"status": "closed"},
        )

        assert response.status_code == 403

    async def test_update_feedback_not_found(self, admin_client: AsyncClient):
        """Test updating non-existent feedback."""
        response = await admin_client.put(
            f"/api/v1/feedback/admin/{uuid.uuid4()}", json={"status": "closed"}
        )

        assert response.status_code == 404

    async def test_update_feedback_with_null_status_preserves_existing(
        self, admin_client: AsyncClient, test_feedback: Feedback
    ):
        """Test that passing null status preserves the existing status."""
        # First, set a specific status
        response = await admin_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}",
            json={"status": "in_progress"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"

        # Now update with null status (should preserve "in_progress")
        response = await admin_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}",
            json={"status": None, "admin_notes": "Updated notes"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"  # Status should be unchanged
        assert data["admin_notes"] == "Updated notes"  # Notes should be updated

    async def test_update_feedback_with_only_admin_notes(
        self, admin_client: AsyncClient, test_feedback: Feedback
    ):
        """Test updating only admin notes without changing status."""
        # Set initial status
        response = await admin_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}",
            json={"status": "in_progress"},
        )
        assert response.status_code == 200

        # Update only admin_notes (omit status entirely)
        response = await admin_client.put(
            f"/api/v1/feedback/admin/{test_feedback.id}",
            json={"admin_notes": "Just updating notes"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"  # Status should be unchanged
        assert data["admin_notes"] == "Just updating notes"


class TestDeleteFeedbackAdminEndpoint:
    """Tests for DELETE /api/v1/feedback/admin/{feedback_id}."""

    async def test_delete_feedback_as_admin(
        self, admin_client: AsyncClient, test_feedback: Feedback
    ):
        """Test deleting feedback as admin."""
        response = await admin_client.delete(
            f"/api/v1/feedback/admin/{test_feedback.id}"
        )

        assert response.status_code == 204

        # Verify feedback is deleted
        get_response = await admin_client.get(
            f"/api/v1/feedback/admin/{test_feedback.id}"
        )
        assert get_response.status_code == 404

    async def test_delete_feedback_as_non_admin(
        self, authenticated_client: AsyncClient, test_feedback: Feedback
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.delete(
            f"/api/v1/feedback/admin/{test_feedback.id}"
        )

        assert response.status_code == 403

    async def test_delete_feedback_not_found(self, admin_client: AsyncClient):
        """Test deleting non-existent feedback."""
        response = await admin_client.delete(f"/api/v1/feedback/admin/{uuid.uuid4()}")

        assert response.status_code == 404


class TestRetriggerFeedbackWebhookEndpoint:
    """Tests for POST /api/v1/feedback/admin/{feedback_id}/retrigger-webhook."""

    async def test_retrigger_webhook_as_admin(
        self, admin_client: AsyncClient, test_feedback: Feedback
    ):
        """Test re-triggering webhook as admin."""
        response = await admin_client.post(
            f"/api/v1/feedback/admin/{test_feedback.id}/retrigger-webhook"
        )

        assert response.status_code == 202
        data = response.json()
        assert data["message"] == "Webhook re-triggered successfully"

    async def test_retrigger_webhook_as_non_admin(
        self, authenticated_client: AsyncClient, test_feedback: Feedback
    ):
        """Test that non-admin gets 403."""
        response = await authenticated_client.post(
            f"/api/v1/feedback/admin/{test_feedback.id}/retrigger-webhook"
        )

        assert response.status_code == 403

    async def test_retrigger_webhook_not_found(self, admin_client: AsyncClient):
        """Test re-triggering webhook for non-existent feedback."""
        response = await admin_client.post(
            f"/api/v1/feedback/admin/{uuid.uuid4()}/retrigger-webhook"
        )

        assert response.status_code == 404
