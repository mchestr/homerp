"""Webhook service for triggering webhooks on events."""

import logging
from datetime import datetime
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from src.webhooks.executor import WebhookExecutor
from src.webhooks.repository import WebhookRepository

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for triggering webhooks."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = WebhookRepository(session)

    async def trigger_event(
        self,
        event_type: str,
        payload: dict,
        background_tasks: BackgroundTasks,
    ) -> None:
        """Trigger webhook for an event type.

        Runs asynchronously in background to not block the response.

        Args:
            event_type: The event type identifier (e.g., "feedback.created")
            payload: Event data to send to the webhook
            background_tasks: FastAPI BackgroundTasks for async execution
        """
        config = await self.repository.get_active_by_event_type(event_type)

        if not config:
            logger.debug(f"No active webhook configured for {event_type}")
            return

        # Add timestamp to payload
        payload["timestamp"] = datetime.utcnow().isoformat()

        # Execute in background
        background_tasks.add_task(
            self._execute_webhook,
            config.id,
            event_type,
            payload,
        )
        logger.info(f"Queued webhook for {event_type}")

    async def _execute_webhook(
        self,
        config_id: UUID,
        _event_type: str,
        payload: dict,
    ) -> None:
        """Background task to execute webhook.

        Creates a new session for the background task to avoid
        session conflicts with the main request.
        """
        from src.database import get_session

        async for session in get_session():
            try:
                repo = WebhookRepository(session)
                config = await repo.get_by_id(config_id)

                if not config or not config.is_active:
                    return

                executor = WebhookExecutor(session)
                await executor.execute(config, payload)
            except Exception as e:
                logger.error(
                    f"Background webhook execution failed: {e}", exc_info=True
                )


def get_webhook_service(session: AsyncSession) -> WebhookService:
    """Factory for WebhookService."""
    return WebhookService(session)
