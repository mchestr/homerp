"""Webhook HTTP execution with retry logic."""

import asyncio
import json
import logging
import re
from datetime import UTC, datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.url_validator import SSRFValidationError, validate_webhook_url
from src.webhooks.models import WebhookConfig, WebhookExecution
from src.webhooks.repository import WebhookRepository
from src.webhooks.template import build_default_payload, render_template

logger = logging.getLogger(__name__)

# Headers that contain sensitive values and should be redacted in logs
SENSITIVE_HEADERS = {
    "authorization",
    "x-api-key",
    "x-auth-token",
    "x-access-token",
    "api-key",
    "apikey",
    "token",
    "secret",
    "password",
    "x-webhook-secret",
    "x-hub-signature",
    "x-hub-signature-256",
}


def sanitize_headers_for_logging(headers: dict[str, str]) -> dict[str, str]:
    """
    Sanitize headers by redacting sensitive values for safe storage/logging.

    Sensitive header values are replaced with '[REDACTED]' to prevent
    credential leakage in logs and database records.
    """
    sanitized = {}
    for key, value in headers.items():
        # Check known sensitive headers and common sensitive patterns
        if key.lower() in SENSITIVE_HEADERS or re.search(
            r"(auth|token|key|secret|password)", key.lower()
        ):
            sanitized[key] = "[REDACTED]"
        else:
            sanitized[key] = value
    return sanitized


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
        # Validate URL for SSRF before execution
        try:
            validate_webhook_url(config.url)
        except SSRFValidationError as e:
            logger.error(f"Webhook URL validation failed: {e}")
            # Create a failed execution record
            execution = await self.repository.create_execution(
                webhook_config_id=config.id,
                event_type=config.event_type,
                event_payload=event_payload,
                request_url=config.url,
                request_headers={},
                request_body="",
            )
            execution.status = "failed"
            execution.error_message = f"URL validation failed: {e}"
            execution.completed_at = datetime.now(UTC)
            await self.repository.update_execution(execution)
            return execution

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

        # Create execution record with sanitized headers
        # Actual headers are used for the request, but sanitized version is stored
        sanitized_headers = sanitize_headers_for_logging(headers)
        execution = await self.repository.create_execution(
            webhook_config_id=config.id,
            event_type=config.event_type,
            event_payload=event_payload,
            request_url=config.url,
            request_headers=sanitized_headers,
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

            # Re-validate URL before each attempt to protect against DNS rebinding
            # DNS records could change between validation and execution
            try:
                validate_webhook_url(config.url)
            except SSRFValidationError as e:
                execution.error_message = f"URL validation failed on attempt {attempt}: {e}"
                logger.error(
                    f"Webhook URL re-validation failed on attempt {attempt}: {e}"
                )
                execution.status = "failed"
                execution.completed_at = datetime.now(UTC)
                await self.repository.update_execution(execution)
                return

            try:
                async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
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
                    execution.completed_at = datetime.now(UTC)
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
                logger.error(f"Webhook {config.event_type} error: {e}", exc_info=True)

            await self.repository.update_execution(execution)

        # All attempts exhausted
        execution.status = "failed"
        execution.completed_at = datetime.now(UTC)
        await self.repository.update_execution(execution)
        logger.error(
            f"Webhook {config.event_type} failed after {max_attempts} attempts"
        )
