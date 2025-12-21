"""Tests for AI session repository CRUD operations."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.session_repository import AISessionRepository
from src.users.models import User


class TestAISessionRepository:
    """Tests for AISessionRepository CRUD operations."""

    @pytest.fixture
    async def repo(self, async_session: AsyncSession, test_user: User):
        """Create a session repository for testing."""
        return AISessionRepository(async_session, test_user.id)

    @pytest.fixture
    async def other_user(self, async_session: AsyncSession) -> User:
        """Create another user for isolation tests."""
        user = User(
            id=uuid.uuid4(),
            email="other@example.com",
            name="Other User",
            oauth_provider="google",
            oauth_id="google_other_123",
            credit_balance=0,
            free_credits_remaining=5,
            is_admin=False,
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)
        return user

    async def test_create_session(self, repo: AISessionRepository):
        """Test creating a new conversation session."""
        session = await repo.create_session("Test Session")

        assert session.id is not None
        assert session.title == "Test Session"
        assert session.is_active is True
        assert session.user_id == repo.user_id

    async def test_create_session_no_commit(
        self, async_session: AsyncSession, test_user: User
    ):
        """Test creating a session without committing."""
        repo = AISessionRepository(async_session, test_user.id)
        session = await repo.create_session("No Commit Session", commit=False)

        assert session.id is not None
        assert session.title == "No Commit Session"
        # Session should still be in pending state
        # We can verify it's flushed but not committed by checking if it has an ID

    async def test_get_session(self, repo: AISessionRepository):
        """Test retrieving a session by ID."""
        created = await repo.create_session("Get Test Session")
        retrieved = await repo.get_session(created.id)

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.title == "Get Test Session"

    async def test_get_session_not_found(self, repo: AISessionRepository):
        """Test retrieving a non-existent session returns None."""
        result = await repo.get_session(uuid.uuid4())
        assert result is None

    async def test_get_session_isolation(
        self,
        async_session: AsyncSession,
        test_user: User,
        other_user: User,
    ):
        """Test that users can only access their own sessions."""
        # Create session as test_user
        repo1 = AISessionRepository(async_session, test_user.id)
        session = await repo1.create_session("User 1 Session")

        # Try to access as other_user
        repo2 = AISessionRepository(async_session, other_user.id)
        result = await repo2.get_session(session.id)

        assert result is None

    async def test_list_sessions(self, repo: AISessionRepository):
        """Test listing user sessions."""
        # Create multiple sessions
        await repo.create_session("Session 1")
        await repo.create_session("Session 2")
        await repo.create_session("Session 3")

        sessions = await repo.list_sessions()

        assert len(sessions) == 3

    async def test_list_sessions_ordering(self, repo: AISessionRepository):
        """Test that sessions are ordered by updated_at descending."""
        s1 = await repo.create_session("First")
        s2 = await repo.create_session("Second")
        s3 = await repo.create_session("Third")

        sessions = await repo.list_sessions()

        # Most recently created should be first
        assert sessions[0].id == s3.id
        assert sessions[1].id == s2.id
        assert sessions[2].id == s1.id

    async def test_list_sessions_active_only(self, repo: AISessionRepository):
        """Test filtering active sessions only."""
        await repo.create_session("Active Session")
        archived = await repo.create_session("Archived Session")
        await repo.archive_session(archived.id)

        active_sessions = await repo.list_sessions(active_only=True)
        all_sessions = await repo.list_sessions(active_only=False)

        assert len(active_sessions) == 1
        assert len(all_sessions) == 2

    async def test_list_sessions_pagination(self, repo: AISessionRepository):
        """Test session listing with pagination."""
        for i in range(5):
            await repo.create_session(f"Session {i}")

        page1 = await repo.list_sessions(limit=2, offset=0)
        page2 = await repo.list_sessions(limit=2, offset=2)
        page3 = await repo.list_sessions(limit=2, offset=4)

        assert len(page1) == 2
        assert len(page2) == 2
        assert len(page3) == 1

    async def test_list_sessions_with_counts(self, repo: AISessionRepository):
        """Test listing sessions with message counts."""
        session = await repo.create_session("With Messages")
        await repo.add_message(session.id, "user", "Hello")
        await repo.add_message(session.id, "assistant", "Hi there!")

        empty_session = await repo.create_session("Empty Session")

        results = await repo.list_sessions_with_counts()

        # Find sessions in results
        session_with_msgs = next((s, c) for s, c in results if s.id == session.id)
        empty = next((s, c) for s, c in results if s.id == empty_session.id)

        assert session_with_msgs[1] == 2
        assert empty[1] == 0

    async def test_count_sessions(self, repo: AISessionRepository):
        """Test counting sessions."""
        await repo.create_session("Session 1")
        await repo.create_session("Session 2")
        archived = await repo.create_session("Archived")
        await repo.archive_session(archived.id)

        active_count = await repo.count_sessions(active_only=True)
        total_count = await repo.count_sessions(active_only=False)

        assert active_count == 2
        assert total_count == 3

    async def test_update_session_title(self, repo: AISessionRepository):
        """Test updating session title."""
        session = await repo.create_session("Original Title")
        updated = await repo.update_session_title(session.id, "New Title")

        assert updated is not None
        assert updated.title == "New Title"

    async def test_update_session_title_not_found(self, repo: AISessionRepository):
        """Test updating non-existent session returns None."""
        result = await repo.update_session_title(uuid.uuid4(), "New Title")
        assert result is None

    async def test_archive_session(self, repo: AISessionRepository):
        """Test archiving (soft delete) a session."""
        session = await repo.create_session("To Archive")
        result = await repo.archive_session(session.id)

        assert result is True

        # Session should still exist but not be active
        archived = await repo.get_session(session.id)
        assert archived is not None
        assert archived.is_active is False

    async def test_archive_session_not_found(self, repo: AISessionRepository):
        """Test archiving non-existent session returns False."""
        result = await repo.archive_session(uuid.uuid4())
        assert result is False

    async def test_delete_session_permanent(self, repo: AISessionRepository):
        """Test permanently deleting a session."""
        session = await repo.create_session("To Delete")
        result = await repo.delete_session(session.id)

        assert result is True

        # Session should be gone
        deleted = await repo.get_session(session.id)
        assert deleted is None

    async def test_delete_session_not_found(self, repo: AISessionRepository):
        """Test deleting non-existent session returns False."""
        result = await repo.delete_session(uuid.uuid4())
        assert result is False

    async def test_add_message(self, repo: AISessionRepository):
        """Test adding a message to a session."""
        session = await repo.create_session("Message Test")
        message = await repo.add_message(
            session.id,
            role="user",
            content="Hello, AI!",
        )

        assert message.id is not None
        assert message.role == "user"
        assert message.content == "Hello, AI!"
        assert message.session_id == session.id

    async def test_add_message_with_tool_calls(self, repo: AISessionRepository):
        """Test adding an assistant message with tool calls."""
        session = await repo.create_session("Tool Calls Test")
        tool_calls = [
            {
                "id": "call_123",
                "type": "function",
                "function": {"name": "search_items", "arguments": '{"query":"drill"}'},
            }
        ]
        message = await repo.add_message(
            session.id,
            role="assistant",
            content=None,
            tool_calls=tool_calls,
        )

        assert message.role == "assistant"
        assert message.tool_calls == tool_calls
        assert message.content is None

    async def test_add_message_tool_response(self, repo: AISessionRepository):
        """Test adding a tool response message."""
        session = await repo.create_session("Tool Response Test")
        message = await repo.add_message(
            session.id,
            role="tool",
            content='{"items": []}',
            tool_call_id="call_123",
            tool_name="search_items",
        )

        assert message.role == "tool"
        assert message.tool_call_id == "call_123"
        assert message.tool_name == "search_items"

    async def test_add_messages_batch(self, repo: AISessionRepository):
        """Test adding multiple messages in a batch."""
        session = await repo.create_session("Batch Test")
        messages_data = [
            {"role": "user", "content": "What items do I have?"},
            {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": "call_1",
                        "type": "function",
                        "function": {
                            "name": "get_inventory_summary",
                            "arguments": "{}",
                        },
                    }
                ],
            },
            {
                "role": "tool",
                "name": "get_inventory_summary",
                "tool_call_id": "call_1",
                "content": '{"total_items": 10}',
            },
            {"role": "assistant", "content": "You have 10 items in your inventory."},
        ]

        saved = await repo.add_messages_batch(session.id, messages_data)

        assert len(saved) == 4
        assert saved[0].role == "user"
        assert saved[1].role == "assistant"
        assert saved[2].role == "tool"
        assert saved[3].role == "assistant"

    async def test_get_messages_for_openai(self, repo: AISessionRepository):
        """Test getting messages in OpenAI API format."""
        session = await repo.create_session("OpenAI Format Test")

        # Add various message types
        await repo.add_message(session.id, "user", "Search for drills")
        await repo.add_message(
            session.id,
            "assistant",
            content=None,
            tool_calls=[
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {
                        "name": "search_items",
                        "arguments": '{"query":"drill"}',
                    },
                }
            ],
        )
        await repo.add_message(
            session.id,
            "tool",
            content='{"items": []}',
            tool_call_id="call_1",
            tool_name="search_items",
        )
        await repo.add_message(
            session.id, "assistant", "I found no drills in your inventory."
        )

        messages = await repo.get_messages_for_openai(session.id)

        assert len(messages) == 4

        # User message
        assert messages[0] == {"role": "user", "content": "Search for drills"}

        # Assistant with tool calls
        assert messages[1]["role"] == "assistant"
        assert "tool_calls" in messages[1]

        # Tool response
        assert messages[2]["role"] == "tool"
        assert messages[2]["tool_call_id"] == "call_1"
        assert messages[2]["name"] == "search_items"

        # Final assistant message
        assert messages[3] == {
            "role": "assistant",
            "content": "I found no drills in your inventory.",
        }

    async def test_get_message_count(self, repo: AISessionRepository):
        """Test counting messages in a session."""
        session = await repo.create_session("Count Test")
        await repo.add_message(session.id, "user", "Hello")
        await repo.add_message(session.id, "assistant", "Hi!")
        await repo.add_message(session.id, "user", "How are you?")

        count = await repo.get_message_count(session.id)
        assert count == 3

    async def test_session_updated_at_on_message(self, repo: AISessionRepository):
        """Test that session's updated_at is updated when adding messages."""
        session = await repo.create_session("Update Test")
        original_updated_at = session.updated_at

        # Add a message
        await repo.add_message(session.id, "user", "Hello")

        # Refresh session
        updated_session = await repo.get_session(session.id)
        assert updated_session.updated_at >= original_updated_at
