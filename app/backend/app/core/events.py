"""Event bus implementation using Redis pub/sub."""

import asyncio
import json
import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.core.constants import EventType
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class BaseEvent(BaseModel):
    """Base event model for all domain events."""

    event_id: UUID = Field(default_factory=uuid4)
    event_type: str
    tenant_id: UUID
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def to_json(self) -> str:
        """Serialize event to JSON string."""
        return self.model_dump_json()

    @classmethod
    def from_json(cls, data: str) -> "BaseEvent":
        """Deserialize event from JSON string."""
        return cls.model_validate_json(data)


class UserCreatedEvent(BaseEvent):
    """Event emitted when a user is created."""

    event_type: str = EventType.USER_CREATED


class UserUpdatedEvent(BaseEvent):
    """Event emitted when a user is updated."""

    event_type: str = EventType.USER_UPDATED


class UserDeletedEvent(BaseEvent):
    """Event emitted when a user is deleted."""

    event_type: str = EventType.USER_DELETED


class TenantCreatedEvent(BaseEvent):
    """Event emitted when a tenant is created."""

    event_type: str = EventType.TENANT_CREATED


class TenantProvisionedEvent(BaseEvent):
    """Event emitted when a tenant is fully provisioned."""

    event_type: str = EventType.TENANT_PROVISIONED


class FinanceJournalPostedEvent(BaseEvent):
    """Event emitted when a journal entry is posted."""

    event_type: str = EventType.FINANCE_JOURNAL_POSTED


class FinanceFiscalYearClosedEvent(BaseEvent):
    """Event emitted when a fiscal year is closed."""

    event_type: str = EventType.FINANCE_FISCAL_YEAR_CLOSED


# Event type mapping
EVENT_TYPES: dict[str, type[BaseEvent]] = {
    EventType.USER_CREATED: UserCreatedEvent,
    EventType.USER_UPDATED: UserUpdatedEvent,
    EventType.USER_DELETED: UserDeletedEvent,
    EventType.TENANT_CREATED: TenantCreatedEvent,
    EventType.TENANT_PROVISIONED: TenantProvisionedEvent,
    EventType.FINANCE_JOURNAL_POSTED: FinanceJournalPostedEvent,
    EventType.FINANCE_FISCAL_YEAR_CLOSED: FinanceFiscalYearClosedEvent,
}


class EventBus:
    """
    Event bus using Redis pub/sub for cross-module communication.
    
    Usage:
        # Initialize
        event_bus = EventBus()
        
        # Subscribe to events
        @event_bus.subscribe(EventType.USER_CREATED)
        async def on_user_created(event: UserCreatedEvent):
            await send_welcome_email(event.payload["email"])
        
        # Publish events
        await event_bus.publish(UserCreatedEvent(
            tenant_id=tenant_id,
            payload={"user_id": str(user.id), "email": user.email}
        ))
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[Callable[[BaseEvent], Any]]] = {}
        self._running = False

    def subscribe(
        self,
        event_type: str | EventType,
    ) -> Callable[[Callable[[BaseEvent], Any]], Callable[[BaseEvent], Any]]:
        """
        Decorator to subscribe a handler to an event type.
        
        Usage:
            @event_bus.subscribe(EventType.USER_CREATED)
            async def on_user_created(event: UserCreatedEvent):
                ...
        """
        event_type_str = event_type.value if isinstance(event_type, EventType) else event_type

        def decorator(func: Callable[[BaseEvent], Any]) -> Callable[[BaseEvent], Any]:
            if event_type_str not in self._handlers:
                self._handlers[event_type_str] = []
            self._handlers[event_type_str].append(func)
            logger.debug(f"Subscribed handler {func.__name__} to {event_type_str}")
            return func

        return decorator

    def register_handler(
        self,
        event_type: str | EventType,
        handler: Callable[[BaseEvent], Any],
    ) -> None:
        """Register a handler for an event type (non-decorator version)."""
        event_type_str = event_type.value if isinstance(event_type, EventType) else event_type
        if event_type_str not in self._handlers:
            self._handlers[event_type_str] = []
        self._handlers[event_type_str].append(handler)

    async def publish(self, event: BaseEvent) -> None:
        """
        Publish an event to Redis.
        
        Args:
            event: Event to publish
        """
        channel = f"events:{event.event_type}"
        try:
            await redis_client.publish(channel, event.to_json())
            logger.debug(f"Published event {event.event_type} to {channel}")
        except Exception as e:
            logger.error(f"Failed to publish event: {e}")
            raise

    async def publish_event(
        self,
        event_type: str | EventType,
        tenant_id: UUID,
        payload: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Publish an event by type.
        
        Convenience method for publishing events without creating event objects.
        """
        event_type_str = event_type.value if isinstance(event_type, EventType) else event_type
        event = BaseEvent(
            event_type=event_type_str,
            tenant_id=tenant_id,
            payload=payload,
            metadata=metadata or {},
        )
        await self.publish(event)

    async def _handle_event(self, event_data: str) -> None:
        """Handle an incoming event."""
        try:
            data = json.loads(event_data)
            event_type = data.get("event_type")

            # Get specific event class or use base
            event_class = EVENT_TYPES.get(event_type, BaseEvent)
            event = event_class.model_validate(data)

            # Get handlers for this event type
            handlers = self._handlers.get(event_type, [])

            if not handlers:
                logger.debug(f"No handlers registered for {event_type}")
                return

            # Execute all handlers
            for handler in handlers:
                try:
                    result = handler(event)
                    if asyncio.iscoroutine(result):
                        await result
                except Exception as e:
                    logger.error(f"Event handler failed for {event_type}: {e}")

        except Exception as e:
            logger.error(f"Failed to handle event: {e}")

    async def start_subscriber(self) -> None:
        """Start the event subscriber worker."""
        await redis_client.connect()
        pubsub = redis_client.pubsub()
        
        # Subscribe to all event channels
        await pubsub.psubscribe("events:*")
        self._running = True
        
        logger.info("Event subscriber started")
        
        try:
            while self._running:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                if message and message["type"] == "pmessage":
                    event_data = message["data"]
                    if isinstance(event_data, bytes):
                        event_data = event_data.decode("utf-8")
                    await self._handle_event(event_data)
        except asyncio.CancelledError:
            logger.info("Event subscriber cancelled")
        finally:
            await pubsub.close()
            self._running = False

    def stop(self) -> None:
        """Stop the event subscriber."""
        self._running = False


# Global event bus instance
event_bus = EventBus()