"""Core constants and enumerations for the ERP system."""

from enum import Enum


class Environment(str, Enum):
    """Application environment types."""

    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class TenantStatus(str, Enum):
    """Tenant account status."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    CHURNED = "churned"


class SubscriptionPlan(str, Enum):
    """Tenant subscription plans."""

    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class UserRole(str, Enum):
    """System user roles."""

    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"
    VIEWER = "viewer"


class ActionType(str, Enum):
    """Permission action types."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXPORT = "export"
    IMPORT = "import"


class ResourceType(str, Enum):
    """Resource types for permissions."""

    # Core resources
    TENANTS = "tenants"
    USERS = "users"
    ROLES = "roles"
    PERMISSIONS = "permissions"
    AUDIT_LOGS = "audit_logs"

    # Business resources (future modules)
    CUSTOMERS = "customers"
    VENDORS = "vendors"
    INVOICES = "invoices"
    PAYMENTS = "payments"
    PRODUCTS = "products"
    INVENTORY = "inventory"
    ORDERS = "orders"
    REPORTS = "reports"


class EventType(str, Enum):
    """Domain event types."""

    # User events
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_VERIFIED = "user.verified"

    # Tenant events
    TENANT_CREATED = "tenant.created"
    TENANT_UPDATED = "tenant.updated"
    TENANT_SUSPENDED = "tenant.suspended"
    TENANT_PROVISIONED = "tenant.provisioned"

    # Authentication events
    AUTH_LOGIN = "auth.login"
    AUTH_LOGOUT = "auth.logout"
    AUTH_TOKEN_REFRESH = "auth.token_refresh"
    AUTH_PASSWORD_RESET = "auth.password_reset"


class JobQueue(str, Enum):
    """Background job queue names."""

    DEFAULT = "default"
    HIGH_PRIORITY = "high_priority"
    LOW_PRIORITY = "low_priority"
    EMAIL = "email"
    REPORTS = "reports"


class AuditAction(str, Enum):
    """Audit log action types."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    EXPORT = "export"
    IMPORT = "import"


# HTTP Status Messages
HTTP_400_BAD_REQUEST = "Bad request"
HTTP_401_UNAUTHORIZED = "Could not validate credentials"
HTTP_403_FORBIDDEN = "Permission denied"
HTTP_404_NOT_FOUND = "Resource not found"
HTTP_409_CONFLICT = "Resource already exists"
HTTP_422_UNPROCESSABLE = "Validation error"
HTTP_429_TOO_MANY_REQUESTS = "Too many requests"
HTTP_500_INTERNAL_ERROR = "Internal server error"

# Pagination defaults
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# Token types
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"

# Cache key prefixes
CACHE_KEY_TENANT = "tenant:"
CACHE_KEY_USER = "user:"
CACHE_KEY_PERMISSIONS = "permissions:"
CACHE_KEY_SETTINGS = "settings:"