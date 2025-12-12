"""Webhook HTTP execution with retry logic."""

import asyncio
import json
import logging
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.webhooks.models import WebhookConfig, WebhookExecution
from src.webhooks.repository import WebhookRepository
from src.webhooks.template import build_default_payload, render_template

logger = logging.getLogger(__name__)


class WebhookExecutor:
    """Handles webhook execution with retry logic."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = WebhookRepository(session)

    async def execute(
        self,
        config: WebhookConfig,
        event_payload: dict,
    ) -> WebhookExecution:
        """Execute a webhook with the given payload."""
        # Build request body
        if config.body_template:
            request_body = render_template(config.body_template, event_payload)
        else:
            request_body = json.dumps(
                build_default_payload(config.event_type, event_payload)
            )

        # Build headers
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "HomERP-Webhook/1.0",
            **config.headers,
        }

        # Create execution record
        execution = await self.repository.create_execution(
            webhook_config_id=config.id,
            event_type=config.event_type,
            event_payload=event_payload,
            request_url=config.url,
            request_headers=headers,
            request_body=request_body,
        )

        # Execute with retries
        await self._execute_with_retries(execution, config, headers, request_body)

        return execution

    async def _execute_with_retries(
        self,
        execution: WebhookExecution,
        config: WebhookConfig,
        headers: dict,
        body: str,
    ) -> None:
        """Execute webhook with exponential backoff retries."""
        max_attempts = config.retry_count + 1  # Initial + retries

        for attempt in range(1, max_attempts + 1):
            execution.attempt_number = attempt

            if attempt > 1:
                execution.status = "retrying"
                await self.repository.update_execution(execution)
                # Exponential backoff: 2^attempt seconds (2, 4, 8...)
                await asyncio.sleep(2**attempt)

            try:
                async with httpx.AsyncClient(
                    timeout=config.timeout_seconds
                ) as client:
                    response = await client.request(
                        method=config.http_method,
                        url=config.url,
                        headers=headers,
                        content=body,
                    )

                execution.response_status = response.status_code
                # Truncate response body to prevent storing massive responses
                execution.response_body = response.text[:10000]

                if 200 <= response.status_code < 300:
                    execution.status = "success"
                    execution.completed_at = datetime.utcnow()
                    await self.repository.update_execution(execution)
                    logger.info(
                        f"Webhook {config.event_type} succeeded: {response.status_code}"
                    )
                    return
                else:
                    execution.error_message = f"HTTP {response.status_code}"

            except httpx.TimeoutException:
                execution.error_message = "Request timed out"
                logger.warning(
                    f"Webhook {config.event_type} timed out (attempt {attempt})"
                )
            except httpx.RequestError as e:
                execution.error_message = str(e)
                logger.warning(
                    f"Webhook {config.event_type} failed: {e} (attempt {attempt})"
                )
            except Exception as e:
                execution.error_message = f"Unexpected error: {e}"
                logger.error(
                    f"Webhook {config.event_type} error: {e}", exc_info=True
                )

            await self.repository.update_execution(execution)

        # All attempts exhausted
        execution.status = "failed"
        execution.completed_at = datetime.utcnow()
        await self.repository.update_execution(execution)
        logger.error(
            f"Webhook {config.event_type} failed after {max_attempts} attempts"
        )
