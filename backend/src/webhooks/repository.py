"""Repository for webhook database operations."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.webhooks.models import WebhookConfig, WebhookExecution
from src.webhooks.schemas import WebhookConfigCreate, WebhookConfigUpdate


class WebhookRepository:
    """Repository for webhook database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # Config operations
    async def get_all_configs(self) -> list[WebhookConfig]:
        """Get all webhook configs."""
        result = await self.session.execute(
            select(WebhookConfig).order_by(WebhookConfig.event_type)
        )
        return list(result.scalars().all())

    async def get_by_id(self, config_id: UUID) -> WebhookConfig | None:
        """Get webhook config by ID."""
        result = await self.session.execute(
            select(WebhookConfig).where(WebhookConfig.id == config_id)
        )
        return result.scalar_one_or_none()

    async def get_by_event_type(self, event_type: str) -> WebhookConfig | None:
        """Get webhook config by event type."""
        result = await self.session.execute(
            select(WebhookConfig).where(WebhookConfig.event_type == event_type)
        )
        return result.scalar_one_or_none()

    async def get_active_by_event_type(self, event_type: str) -> WebhookConfig | None:
        """Get active webhook config by event type."""
        result = await self.session.execute(
            select(WebhookConfig).where(
                WebhookConfig.event_type == event_type,
                WebhookConfig.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def create(self, data: WebhookConfigCreate) -> WebhookConfig:
        """Create a new webhook config."""
        config = WebhookConfig(
            event_type=data.event_type,
            url=str(data.url),
            http_method=data.http_method,
            headers=data.headers,
            body_template=data.body_template,
            is_active=data.is_active,
            retry_count=data.retry_count,
            timeout_seconds=data.timeout_seconds,
        )
        self.session.add(config)
        await self.session.commit()
        await self.session.refresh(config)
        return config

    async def update(
        self, config: WebhookConfig, data: WebhookConfigUpdate
    ) -> WebhookConfig:
        """Update a webhook config."""
        update_data = data.model_dump(exclude_unset=True)
        if "url" in update_data and update_data["url"]:
            update_data["url"] = str(update_data["url"])
        for field, value in update_data.items():
            setattr(config, field, value)
        await self.session.commit()
        await self.session.refresh(config)
        return config

    async def delete(self, config: WebhookConfig) -> None:
        """Delete a webhook config."""
        await self.session.delete(config)
        await self.session.commit()

    # Execution operations
    async def get_executions(
        self,
        *,
        config_id: UUID | None = None,
        event_type: str | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> list[WebhookExecution]:
        """Get webhook executions with filters."""
        query = select(WebhookExecution).order_by(WebhookExecution.executed_at.desc())

        if config_id:
            query = query.where(WebhookExecution.webhook_config_id == config_id)
        if event_type:
            query = query.where(WebhookExecution.event_type == event_type)
        if status:
            query = query.where(WebhookExecution.status == status)

        query = query.offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def count_executions(
        self,
        *,
        config_id: UUID | None = None,
        event_type: str | None = None,
        status: str | None = None,
    ) -> int:
        """Count webhook executions with filters."""
        query = select(func.count(WebhookExecution.id))

        if config_id:
            query = query.where(WebhookExecution.webhook_config_id == config_id)
        if event_type:
            query = query.where(WebhookExecution.event_type == event_type)
        if status:
            query = query.where(WebhookExecution.status == status)

        result = await self.session.execute(query)
        return result.scalar_one()

    async def create_execution(
        self,
        *,
        webhook_config_id: UUID,
        event_type: str,
        event_payload: dict,
        request_url: str,
        request_headers: dict,
        request_body: str,
    ) -> WebhookExecution:
        """Create a new webhook execution record."""
        execution = WebhookExecution(
            webhook_config_id=webhook_config_id,
            event_type=event_type,
            event_payload=event_payload,
            request_url=request_url,
            request_headers=request_headers,
            request_body=request_body,
            status="pending",
            attempt_number=1,
        )
        self.session.add(execution)
        await self.session.commit()
        await self.session.refresh(execution)
        return execution

    async def update_execution(self, execution: WebhookExecution) -> WebhookExecution:
        """Update a webhook execution record."""
        await self.session.commit()
        await self.session.refresh(execution)
        return execution
