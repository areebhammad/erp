"""Core module for ERP backend."""

from app.core.config import Settings, get_settings, settings
from app.core.constants import (
    ActionType,
    AuditAction,
    Environment,
    EventType,
    JobQueue,
    ResourceType,
    SubscriptionPlan,
    TenantStatus,
    UserRole,
)
from app.core.database import (
    Base,
    async_session_factory,
    check_database_connection,
    engine,
    get_db,
    get_db_context,
    set_tenant_context,
)

__all__ = [
    # Config
    "Settings",
    "get_settings",
    "settings",
    # Constants
    "ActionType",
    "AuditAction",
    "Environment",
    "EventType",
    "JobQueue",
    "ResourceType",
    "SubscriptionPlan",
    "TenantStatus",
    "UserRole",
    # Database
    "Base",
    "async_session_factory",
    "check_database_connection",
    "engine",
    "get_db",
    "get_db_context",
    "set_tenant_context",
]