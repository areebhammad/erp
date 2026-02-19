"""FastAPI dependencies for authentication and authorization."""

import uuid
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import TenantStatus
from app.core.database import get_db
from app.core.exceptions import (
    AuthenticationError,
    InvalidTokenError,
    PermissionDeniedError,
    TenantInactiveError,
    TenantNotFoundError,
    TokenExpiredError,
    UserNotFoundError,
)
from app.core.security import TokenPayload, verify_token
from app.models.tenant import Tenant
from app.models.user import User

# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)


async def get_token_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ],
) -> TokenPayload:
    """
    Extract and validate JWT token from Authorization header.
    
    Raises:
        AuthenticationError: If token is missing or invalid
        TokenExpiredError: If token has expired
    """
    if credentials is None:
        raise AuthenticationError("Authorization header missing")
    
    token = credentials.credentials
    
    try:
        payload = verify_token(token)
        return TokenPayload(payload)
    except JWTError as e:
        if "expired" in str(e).lower():
            raise TokenExpiredError()
        raise InvalidTokenError(str(e))


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    token_payload: Annotated[TokenPayload, Depends(get_token_payload)],
) -> User:
    """
    Get the current authenticated user from JWT token.
    
    Raises:
        UserNotFoundError: If user doesn't exist
        AuthenticationError: If user is inactive
    """
    result = await db.execute(
        select(User).where(User.id == token_payload.user_id)
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise UserNotFoundError(str(token_payload.user_id))
    
    if not user.is_active:
        raise AuthenticationError("User account is deactivated")
    
    if user.is_deleted:
        raise AuthenticationError("User account has been deleted")
    
    return user


async def get_current_tenant(
    db: Annotated[AsyncSession, Depends(get_db)],
    token_payload: Annotated[TokenPayload, Depends(get_token_payload)],
) -> Tenant:
    """
    Get the current tenant from JWT token.
    
    Raises:
        TenantNotFoundError: If tenant doesn't exist
        TenantInactiveError: If tenant is not active
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == token_payload.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if tenant is None:
        raise TenantNotFoundError(str(token_payload.tenant_id))
    
    if tenant.status == TenantStatus.SUSPENDED:
        raise TenantInactiveError(str(tenant.id))
    
    return tenant


class TenantContext:
    """Tenant context container."""

    def __init__(
        self,
        tenant: Tenant,
        user: User,
        roles: list[str],
    ) -> None:
        self.tenant = tenant
        self.user = user
        self.roles = roles
        self.tenant_id = tenant.id
        self.user_id = user.id

    @property
    def is_admin(self) -> bool:
        """Check if user has admin role."""
        return "admin" in self.roles

    @property
    def is_superuser(self) -> bool:
        """Check if user is a superuser."""
        return self.user.is_superuser


async def get_tenant_context(
    db: Annotated[AsyncSession, Depends(get_db)],
    token_payload: Annotated[TokenPayload, Depends(get_token_payload)],
    user: Annotated[User, Depends(get_current_user)],
    tenant: Annotated[Tenant, Depends(get_current_tenant)],
) -> TenantContext:
    """
    Get the full tenant context (tenant, user, roles).
    
    This is the main dependency for authenticated endpoints.
    """
    return TenantContext(
        tenant=tenant,
        user=user,
        roles=token_payload.roles,
    )


async def has_permission(
    db: AsyncSession,
    user: User,
    resource: str,
    action: str,
) -> bool:
    """
    Check if user has permission for a resource action.
    
    Args:
        db: Database session
        user: User to check
        resource: Resource name (e.g., 'users', 'invoices')
        action: Action name (e.g., 'create', 'read', 'update', 'delete')
        
    Returns:
        True if user has permission, False otherwise
    """
    # Superusers have all permissions
    if user.is_superuser:
        return True
    
    # Check permissions through roles
    from app.models.role import Permission
    
    result = await db.execute(
        select(Permission)
        .join(Permission.role)
        .where(
            Permission.role_id.in_([role.id for role in user.roles]),
            Permission.resource == resource,
            Permission.action == action,
        )
    )
    return result.scalar_one_or_none() is not None


def require_permission(resource: str, action: str):
    """
    Dependency factory for permission checking.
    
    Usage:
        @app.post("/users")
        async def create_user(
            _: None = Depends(require_permission("users", "create")),
            ctx: TenantContext = Depends(get_tenant_context),
        ):
            ...
    """
    async def permission_checker(
        db: AsyncSession = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> None:
        if not await has_permission(db, user, resource, action):
            raise PermissionDeniedError(resource, action)
    
    return Depends(permission_checker)


def require_superuser():
    """
    Dependency that requires the user to be a superuser.
    
    Usage:
        @app.delete("/tenants/{id}")
        async def delete_tenant(
            _: None = Depends(require_superuser()),
            ctx: TenantContext = Depends(get_tenant_context),
        ):
            ...
    """
    async def superuser_checker(
        user: User = Depends(get_current_user),
    ) -> None:
        if not user.is_superuser:
            raise PermissionDeniedError("system", "admin")
    
    return Depends(superuser_checker)


def require_admin():
    """
    Dependency that requires the user to have admin role.
    
    Usage:
        @app.post("/users")
        async def create_user(
            _: None = Depends(require_admin()),
            ctx: TenantContext = Depends(get_tenant_context),
        ):
            ...
    """
    async def admin_checker(
        ctx: TenantContext = Depends(get_tenant_context),
    ) -> None:
        if not ctx.is_admin and not ctx.is_superuser:
            raise PermissionDeniedError("system", "admin")
    
    return Depends(admin_checker)


# Type aliases for cleaner function signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentTenant = Annotated[Tenant, Depends(get_current_tenant)]
TenantCtx = Annotated[TenantContext, Depends(get_tenant_context)]
DBSession = Annotated[AsyncSession, Depends(get_db)]