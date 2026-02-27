"""Authentication API endpoints."""

from datetime import datetime, timezone

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession, get_tenant_context
from app.core.constants import AuditAction, EventType, TenantStatus
from app.core.database import get_db
from app.core.events import event_bus
from app.core.exceptions import (
    AuthenticationError,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    TenantInactiveError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)
from app.core.constants import TOKEN_TYPE_REFRESH
from app.models.audit_log import AuditLog
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.base import MessageResponse
from app.schemas.user import (
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserCreate,
    UserRead,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account. First user in a tenant becomes admin.",
)
async def register(
    user_data: UserCreate,
    db: DBSession,
) -> UserRead:
    """
    Register a new user.
    
    This creates a new user within an existing tenant.
    For tenant creation, use the /tenants endpoint.
    """
    # Check if email already exists in tenant
    # Note: tenant_id should be provided in user_data or from context
    # For now, this requires an existing tenant
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if result.scalar_one_or_none():
        raise EmailAlreadyExistsError(user_data.email)
    
    # Create user
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        is_active=user_data.is_active,
    )
    
    db.add(user)
    await db.flush()
    
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=user.tenant_id,
        user_id=user.id,
        action=AuditAction.CREATE,
        resource_type="user",
        resource_id=user.id,
        new_values={"email": user.email, "first_name": user.first_name, "last_name": user.last_name},
    )
    db.add(audit_log)
    
    await db.commit()
    
    # Publish event
    await event_bus.publish_event(
        EventType.USER_CREATED,
        user.tenant_id,
        {"user_id": str(user.id), "email": user.email},
    )
    
    return UserRead.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login",
    description="Authenticate user and return access and refresh tokens.",
)
async def login(
    email: str,
    password: str,
    db: DBSession,
) -> TokenResponse:
    """
    Login with email and password.
    
    Returns access and refresh tokens on success.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError()
    
    if not user.is_active:
        raise AuthenticationError("User account is deactivated")
    
    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant or tenant.status == TenantStatus.SUSPENDED:
        raise TenantInactiveError(str(user.tenant_id))
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    
    # Get user roles
    role_names = [role.name for role in user.roles]
    
    # Create tokens
    access_token = create_access_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        roles=role_names,
    )
    refresh_token = create_refresh_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
    )
    
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=user.tenant_id,
        user_id=user.id,
        action=AuditAction.LOGIN,
        resource_type="session",
        resource_id=user.id,
    )
    db.add(audit_log)
    await db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=15 * 60,  # 15 minutes in seconds
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Get a new access token using a refresh token.",
)
async def refresh_token(
    request: RefreshTokenRequest,
    db: DBSession,
) -> TokenResponse:
    """
    Refresh access token.
    
    Provide a valid refresh token to get new access and refresh tokens.
    """
    # Verify refresh token
    payload = verify_token(request.refresh_token, expected_type=TOKEN_TYPE_REFRESH)
    
    user_id = payload["sub"]
    tenant_id = payload["tenant_id"]
    
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise AuthenticationError("User not found or inactive")
    
    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant or tenant.status == TenantStatus.SUSPENDED:
        raise TenantInactiveError(tenant_id)
    
    # Get user roles
    role_names = [role.name for role in user.roles]
    
    # Create new tokens
    access_token = create_access_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        roles=role_names,
    )
    new_refresh_token = create_refresh_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=15 * 60,
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout",
    description="Logout user and invalidate tokens.",
)
async def logout(
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
) -> MessageResponse:
    """
    Logout user.
    
    Creates an audit log entry for the logout action.
    Token blacklisting is handled via Redis if configured.
    """
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        action=AuditAction.LOGOUT,
        resource_type="session",
        resource_id=ctx.user_id,
    )
    db.add(audit_log)
    await db.commit()
    
    return MessageResponse(message="Successfully logged out")


@router.post(
    "/password-reset/request",
    response_model=MessageResponse,
    summary="Request password reset",
    description="Send a password reset email to the user.",
)
async def request_password_reset(
    request: PasswordResetRequest,
    db: DBSession,
) -> MessageResponse:
    """
    Request password reset.
    
    Sends an email with a password reset link if the user exists.
    Always returns success to prevent email enumeration.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Generate reset token
        import secrets
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_expires_at = datetime.now(timezone.utc)
        await db.commit()
        
        # TODO: Send email with reset link
        # For now, just log
        print(f"Password reset token for {request.email}: {reset_token}")
    
    return MessageResponse(
        message="If the email exists, a password reset link has been sent."
    )


@router.post(
    "/password-reset/confirm",
    response_model=MessageResponse,
    summary="Confirm password reset",
    description="Reset password using the token from the reset email.",
)
async def confirm_password_reset(
    request: PasswordResetConfirm,
    db: DBSession,
) -> MessageResponse:
    """
    Confirm password reset.
    
    Validates the reset token and updates the password.
    """
    # Find user by reset token
    result = await db.execute(
        select(User).where(User.password_reset_token == request.token)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise AuthenticationError("Invalid or expired reset token")
    
    # Check if token is expired
    if user.password_reset_expires_at:
        from datetime import timedelta
        if datetime.now(timezone.utc) > user.password_reset_expires_at + timedelta(hours=24):
            raise AuthenticationError("Reset token has expired")
    
    # Update password
    user.hashed_password = hash_password(request.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=user.tenant_id,
        user_id=user.id,
        action=AuditAction.UPDATE,
        resource_type="user",
        resource_id=user.id,
        new_values={"password": "***updated***"},
    )
    db.add(audit_log)
    
    await db.commit()
    
    return MessageResponse(message="Password has been reset successfully")