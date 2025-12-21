"""Repository for AI conversation session persistence."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.ai.models import AIConversationMessage, AIConversationSession


class AISessionRepository:
    """Repository for AI conversation sessions and messages."""

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def create_session(
        self, title: str, *, commit: bool = True
    ) -> AIConversationSession:
        """Create a new conversation session.

        Args:
            title: Title for the session
            commit: Whether to commit the transaction (default True)

        Returns:
            The created session
        """
        session_obj = AIConversationSession(
            user_id=self.user_id,
            title=title,
        )
        self.session.add(session_obj)
        if commit:
            await self.session.commit()
        else:
            await self.session.flush()
        await self.session.refresh(session_obj)
        return session_obj

    async def get_session(self, session_id: UUID) -> AIConversationSession | None:
        """Get a session by ID with messages.

        Args:
            session_id: UUID of the session

        Returns:
            The session with messages, or None if not found
        """
        result = await self.session.execute(
            select(AIConversationSession)
            .options(selectinload(AIConversationSession.messages))
            .where(
                AIConversationSession.id == session_id,
                AIConversationSession.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_sessions(
        self,
        active_only: bool = True,
        limit: int = 20,
        offset: int = 0,
    ) -> list[AIConversationSession]:
        """List user's sessions, newest first.

        Args:
            active_only: Only return active sessions
            limit: Maximum number of sessions to return
            offset: Number of sessions to skip

        Returns:
            List of sessions
        """
        query = select(AIConversationSession).where(
            AIConversationSession.user_id == self.user_id
        )
        if active_only:
            query = query.where(AIConversationSession.is_active.is_(True))

        query = (
            query.order_by(AIConversationSession.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_sessions_with_counts(
        self,
        active_only: bool = True,
        limit: int = 20,
        offset: int = 0,
    ) -> list[tuple[AIConversationSession, int]]:
        """List user's sessions with message counts in a single query.

        This avoids N+1 queries by using a subquery for message counts.

        Args:
            active_only: Only return active sessions
            limit: Maximum number of sessions to return
            offset: Number of sessions to skip

        Returns:
            List of tuples (session, message_count)
        """
        # Subquery for message count
        message_count_subq = (
            select(func.count(AIConversationMessage.id))
            .where(AIConversationMessage.session_id == AIConversationSession.id)
            .correlate(AIConversationSession)
            .scalar_subquery()
        )

        query = select(AIConversationSession, message_count_subq).where(
            AIConversationSession.user_id == self.user_id
        )
        if active_only:
            query = query.where(AIConversationSession.is_active.is_(True))

        query = (
            query.order_by(AIConversationSession.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return [(row[0], row[1]) for row in result.all()]

    async def count_sessions(self, active_only: bool = True) -> int:
        """Count user's sessions.

        Args:
            active_only: Only count active sessions

        Returns:
            Number of sessions
        """
        query = select(func.count(AIConversationSession.id)).where(
            AIConversationSession.user_id == self.user_id
        )
        if active_only:
            query = query.where(AIConversationSession.is_active.is_(True))
        result = await self.session.execute(query)
        return result.scalar_one()

    async def update_session_title(
        self, session_id: UUID, title: str
    ) -> AIConversationSession | None:
        """Update session title.

        Args:
            session_id: UUID of the session
            title: New title

        Returns:
            Updated session, or None if not found
        """
        result = await self.session.execute(
            select(AIConversationSession).where(
                AIConversationSession.id == session_id,
                AIConversationSession.user_id == self.user_id,
            )
        )
        session_obj = result.scalar_one_or_none()
        if session_obj:
            session_obj.title = title
            session_obj.updated_at = datetime.now(UTC)
            await self.session.commit()
            await self.session.refresh(session_obj)
        return session_obj

    async def archive_session(self, session_id: UUID) -> bool:
        """Archive (soft delete) a session.

        Args:
            session_id: UUID of the session

        Returns:
            True if archived, False if not found
        """
        result = await self.session.execute(
            select(AIConversationSession).where(
                AIConversationSession.id == session_id,
                AIConversationSession.user_id == self.user_id,
            )
        )
        session_obj = result.scalar_one_or_none()
        if session_obj:
            session_obj.is_active = False
            session_obj.updated_at = datetime.now(UTC)
            await self.session.commit()
            return True
        return False

    async def delete_session(self, session_id: UUID) -> bool:
        """Permanently delete a session.

        Args:
            session_id: UUID of the session

        Returns:
            True if deleted, False if not found
        """
        result = await self.session.execute(
            select(AIConversationSession).where(
                AIConversationSession.id == session_id,
                AIConversationSession.user_id == self.user_id,
            )
        )
        session_obj = result.scalar_one_or_none()
        if session_obj:
            await self.session.delete(session_obj)
            await self.session.commit()
            return True
        return False

    async def add_message(
        self,
        session_id: UUID,
        role: str,
        content: str | None = None,
        tool_calls: list[dict[str, Any]] | None = None,
        tool_call_id: str | None = None,
        tool_name: str | None = None,
    ) -> AIConversationMessage:
        """Add a message to a session.

        Args:
            session_id: UUID of the session
            role: Message role (user, assistant, tool, system)
            content: Message content (nullable for tool calls)
            tool_calls: OpenAI tool_calls structure (for assistant messages)
            tool_call_id: Tool call ID (for tool responses)
            tool_name: Name of tool called (for tool responses)

        Returns:
            The created message
        """
        message = AIConversationMessage(
            session_id=session_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_call_id=tool_call_id,
            tool_name=tool_name,
        )
        self.session.add(message)

        # Update session's updated_at
        result = await self.session.execute(
            select(AIConversationSession).where(AIConversationSession.id == session_id)
        )
        session_obj = result.scalar_one_or_none()
        if session_obj:
            session_obj.updated_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def add_messages_batch(
        self,
        session_id: UUID,
        messages: list[dict[str, Any]],
        *,
        commit: bool = True,
    ) -> list[AIConversationMessage]:
        """Add multiple messages to a session efficiently.

        Args:
            session_id: UUID of the session
            messages: List of message dicts with role, content, etc.
            commit: Whether to commit the transaction (default True)

        Returns:
            List of created messages
        """
        created_messages = []
        for msg in messages:
            message = AIConversationMessage(
                session_id=session_id,
                role=msg["role"],
                content=msg.get("content"),
                tool_calls=msg.get("tool_calls"),
                tool_call_id=msg.get("tool_call_id"),
                tool_name=msg.get("name"),  # OpenAI uses 'name' for tool name
            )
            self.session.add(message)
            created_messages.append(message)

        # Update session's updated_at
        result = await self.session.execute(
            select(AIConversationSession).where(AIConversationSession.id == session_id)
        )
        session_obj = result.scalar_one_or_none()
        if session_obj:
            session_obj.updated_at = datetime.now(UTC)

        if commit:
            await self.session.commit()
        else:
            await self.session.flush()
        for msg in created_messages:
            await self.session.refresh(msg)

        return created_messages

    async def get_messages_for_openai(self, session_id: UUID) -> list[dict[str, Any]]:
        """Get messages in OpenAI API format for context.

        Args:
            session_id: UUID of the session

        Returns:
            List of messages in OpenAI chat format
        """
        result = await self.session.execute(
            select(AIConversationMessage)
            .where(AIConversationMessage.session_id == session_id)
            .order_by(AIConversationMessage.created_at)
        )
        messages = result.scalars().all()

        openai_messages: list[dict[str, Any]] = []
        for msg in messages:
            if msg.role == "tool":
                openai_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": msg.tool_call_id,
                        "name": msg.tool_name,
                        "content": msg.content or "",
                    }
                )
            elif msg.role == "assistant" and msg.tool_calls:
                entry: dict[str, Any] = {"role": "assistant"}
                if msg.content:
                    entry["content"] = msg.content
                entry["tool_calls"] = msg.tool_calls
                openai_messages.append(entry)
            else:
                openai_messages.append(
                    {
                        "role": msg.role,
                        "content": msg.content or "",
                    }
                )

        return openai_messages

    async def get_message_count(self, session_id: UUID) -> int:
        """Get the number of messages in a session.

        Args:
            session_id: UUID of the session

        Returns:
            Number of messages
        """
        result = await self.session.execute(
            select(func.count(AIConversationMessage.id)).where(
                AIConversationMessage.session_id == session_id
            )
        )
        return result.scalar_one()
