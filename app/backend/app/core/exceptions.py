"""Custom exceptions for the ERP system."""

from typing import Any


class ERPEXception(Exception):
    """Base exception for all ERP errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


# =============================================================================
# Authentication Exceptions
# =============================================================================


class AuthenticationError(ERPEXception):
    """Base authentication error."""

    def __init__(
        self,
        message: str = "Could not validate credentials",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message, status_code=401, details=details)


class InvalidCredentialsError(AuthenticationError):
    """Invalid email or password."""

    def __init__(self) -> None:
        super().__init__("Invalid email or password")


class TokenExpiredError(AuthenticationError):
    """JWT token has expired."""

    def __init__(self, token_type: str = "access") -> None:
        super().__init__(f"{token_type.capitalize()} token has expired")


class InvalidTokenError(AuthenticationError):
    """JWT token is invalid."""

    def __init__(self, reason: str = "Invalid token") -> None:
        super().__init__(reason)


class TokenMissingError(AuthenticationError):
    """Authorization header missing or malformed."""

    def __init__(self) -> None:
        super().__init__("Authorization header missing")


# =============================================================================
# Authorization Exceptions
# =============================================================================


class AuthorizationError(ERPEXception):
    """Base authorization error."""

    def __init__(
        self,
        message: str = "Permission denied",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message, status_code=403, details=details)


class PermissionDeniedError(AuthorizationError):
    """User lacks required permission."""

    def __init__(self, resource: str, action: str) -> None:
        super().__init__(
            f"Permission denied: cannot {action} {resource}",
            details={"resource": resource, "action": action},
        )


class RoleNotFoundError(AuthorizationError):
    """Role not found."""

    def __init__(self, role_id: str) -> None:
        super().__init__(f"Role not found: {role_id}")


# =============================================================================
# Resource Exceptions
# =============================================================================


class NotFoundError(ERPEXception):
    """Resource not found error."""

    def __init__(
        self,
        resource_type: str,
        resource_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        message = f"{resource_type} not found"
        if resource_id:
            message = f"{resource_type} with id '{resource_id}' not found"
        super().__init__(message, status_code=404, details=details)


class TenantNotFoundError(NotFoundError):
    """Tenant not found."""

    def __init__(self, tenant_id: str | None = None) -> None:
        super().__init__("Tenant", tenant_id)


class UserNotFoundError(NotFoundError):
    """User not found."""

    def __init__(self, user_id: str | None = None) -> None:
        super().__init__("User", user_id)


# =============================================================================
# Validation Exceptions
# =============================================================================


class ValidationError(ERPEXception):
    """Validation error."""

    def __init__(
        self,
        message: str = "Validation error",
        errors: list[dict[str, Any]] | None = None,
    ) -> None:
        details = {"errors": errors} if errors else {}
        super().__init__(message, status_code=422, details=details)


class DuplicateError(ERPEXception):
    """Duplicate resource error."""

    def __init__(
        self,
        resource_type: str,
        field: str,
        value: str,
    ) -> None:
        super().__init__(
            f"{resource_type} with {field}='{value}' already exists",
            status_code=409,
            details={"resource": resource_type, "field": field, "value": value},
        )


class ConflictError(ERPEXception):
    """Resource state conflict error."""
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=409)


class ForbiddenError(AuthorizationError):
    """User is forbidden from taking this action."""
    def __init__(self, message: str = "Action forbidden") -> None:
        super().__init__(message, status_code=403)



class EmailAlreadyExistsError(DuplicateError):
    """Email already exists in tenant."""

    def __init__(self, email: str) -> None:
        super().__init__("User", "email", email)


class TenantSlugExistsError(DuplicateError):
    """Tenant slug already exists."""

    def __init__(self, slug: str) -> None:
        super().__init__("Tenant", "slug", slug)


# =============================================================================
# Tenant Exceptions
# =============================================================================


class TenantError(ERPEXception):
    """Base tenant error."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message, status_code=status_code, details=details)


class TenantSuspendedError(TenantError):
    """Tenant is suspended."""

    def __init__(self, tenant_id: str) -> None:
        super().__init__(
            "Tenant is suspended. Please contact support.",
            status_code=403,
            details={"tenant_id": tenant_id},
        )


class TenantInactiveError(TenantError):
    """Tenant is not active."""

    def __init__(self, tenant_id: str) -> None:
        super().__init__(
            "Tenant is not active",
            status_code=403,
            details={"tenant_id": tenant_id},
        )


class TenantProvisioningError(TenantError):
    """Tenant provisioning failed."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"Tenant provisioning failed: {reason}")


# =============================================================================
# Rate Limiting Exceptions
# =============================================================================


class RateLimitError(ERPEXception):
    """Rate limit exceeded."""

    def __init__(
        self,
        retry_after: int = 60,
    ) -> None:
        super().__init__(
            "Too many requests. Please try again later.",
            status_code=429,
            details={"retry_after": retry_after},
        )
        self.retry_after = retry_after


# =============================================================================
# Database Exceptions
# =============================================================================


class DatabaseError(ERPEXception):
    """Database error."""

    def __init__(
        self,
        message: str = "Database error",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message, status_code=500, details=details)


class ConnectionError(DatabaseError):
    """Database connection error."""

    def __init__(self) -> None:
        super().__init__("Failed to connect to database")


# =============================================================================
# External Service Exceptions
# =============================================================================


class ExternalServiceError(ERPEXception):
    """External service error."""

    def __init__(
        self,
        service: str,
        message: str = "External service error",
    ) -> None:
        super().__init__(
            f"{service}: {message}",
            status_code=502,
            details={"service": service},
        )


class AIServiceError(ExternalServiceError):
    """AI service error."""

    def __init__(self, message: str = "AI service error") -> None:
        super().__init__("AI Service", message)


class EmailServiceError(ExternalServiceError):
    """Email service error."""

    def __init__(self, message: str = "Email service error") -> None:
        super().__init__("Email Service", message)