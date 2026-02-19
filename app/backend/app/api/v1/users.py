"""User management API endpoints."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    CurrentUser,
    DBSession,
    TenantCtx,
    get_current_user,
    get_tenant_context,
    require_admin,
    require_permission,
)
from app.core.constants import AuditAction, EventType
from app.core.events import event_bus
from app.core.exceptions import NotFoundError, ValidationError
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.base import MessageResponse, PaginatedResponse, PaginationParams
from app.schemas.user import (
    UserBrief,
    UserCreate,
    UserPasswordUpdate,
    UserRead,
    UserUpdate,
    UserWithRoles,
)

router = APIRouter()


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get current user",
    description="Get the currently authenticated user's profile.",
)
async def get_me(
    current_user: CurrentUser,
) -> UserRead:
    """Get current user profile."""
    return UserRead.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserRead,
    summary="Update current user",
    description="Update the currently authenticated user's profile.",
)
async def update_me(
    update_data: UserUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> UserRead:
    """Update current user profile."""
    # Update fields
    if update_data.first_name is not None:
        current_user.first_name = update_data.first_name
    if update_data.last_name is not None:
        current_user.last_name = update_data.last_name
    
    current_user.updated_at = datetime.now(timezone.utc)
    current_user.updated_by = current_user.id
    
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action=AuditAction.UPDATE,
        resource_type="user",
        resource_id=current_user.id,
        old_values={"first_name": current_user.first_name, "last_name": current_user.last_name},
        new_values=update_data.model_dump(exclude_unset=True),
    )
    db.add(audit_log)
    
    await db.commit()
    await db.refresh(current_user)
    
    return UserRead.model_validate(current_user)


@router.post(
    "/me/change-password",
    response_model=MessageResponse,
    summary="Change password",
    description="Change the current user's password.",
)
async def change_password(
    password_data: UserPasswordUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> MessageResponse:
    """Change current user password."""
    from app.core.security import verify_password
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise ValidationError("Current password is incorrect")
    
    # Update password
    current_user.hashed_password = hash_password(password_data.new_password)
    current_user.updated_at = datetime.now(timezone.utc)
    
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action=AuditAction.UPDATE,
        resource_type="user",
        resource_id=current_user.id,
        new_values={"password": "***updated***"},
    )
    db.add(audit_log)
    
    await db.commit()
    
    return MessageResponse(message="Password changed successfully")


@router.get(
    "/",
    response_model=PaginatedResponse[UserBrief],
    summary="List users",
    description="List all users in the current tenant. Requires admin role.",
    dependencies=[Depends(require_admin())],
)
async def list_users(
    db: DBSession,
    ctx: TenantCtx = Depends(get_tenant_context),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: bool | None = None,
    search: str | None = None,
) -> PaginatedResponse[UserBrief]:
    """List users in tenant (admin only)."""
    # Build query
    query = select(User).where(User.tenant_id == ctx.tenant_id)
    count_query = select(func.count()).select_from(User).where(User.tenant_id == ctx.tenant_id)
    
    # Filter by active status
    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)
    
    # Search by name or email
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (User.email.ilike(search_term))
            | (User.first_name.ilike(search_term))
            | (User.last_name.ilike(search_term))
        )
        count_query = count_query.where(
            (User.email.ilike(search_term))
            | (User.first_name.ilike(search_term))
            | (User.last_name.ilike(search_term))
        )
    
    # Exclude deleted users
    query = query.where(User.deleted_at.is_(None))
    count_query = count_query.where(User.deleted_at.is_(None))
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(User.created_at.desc())
    
    # Execute
    result = await db.execute(query)
    users = result.scalars().all()
    
    return PaginatedResponse.create(
        items=[UserBrief.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create user",
    description="Create a new user in the current tenant. Requires admin role.",
    dependencies=[Depends(require_admin())],
)
async def create_user(
    user_data: UserCreate,
    db: DBSession,
    ctx: TenantCtx = Depends(get_tenant_context),
) -> UserRead:
    """Create a new user (admin only)."""
    # Check if email exists
    result = await db.execute(
        select(User).where(
            User.tenant_id == ctx.tenant_id,
            User.email == user_data.email,
        )
    )
    if result.scalar_one_or_none():
        raise ValidationError(f"User with email {user_data.email} already exists")
    
    # Create user
    user = User(
        tenant_id=ctx.tenant_id,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        is_active=user_data.is_active,
        created_by=ctx.user_id,
    )
    
    db.add(user)
    await db.flush()
    
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        action=AuditAction.CREATE,
        resource_type="user",
        resource_id=user.id,
        new_values={"email": user.email, "first_name": user.first_name, "last_name": user.last_name},
    )
    db.add(audit_log)
    
    await db.commit()
    await db.refresh(user)
    
    # Publish event
    await event_bus.publish_event(
        EventType.USER_CREATED,
        ctx.tenant_id,
        {"user_id": str(user.id), "email": user.email, "created_by": str(ctx.user_id)},
    )
    
    return UserRead.model_validate(user)


@router.get(
    "/{user_id}",
    response_model=UserWithRoles,
    summary="Get user by ID",
    description="Get a specific user by ID. Requires admin role.",
    dependencies=[Depends(require_admin())],
)
async def get_user(
    user_id: uuid.UUID,
    db: DBSession,
    ctx: TenantCtx = Depends(get_tenant_context),
) -> UserWithRoles:
    """Get user by ID (admin only)."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(
            User.id == user_id,
            User.tenant_id == ctx.tenant_id,
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise NotFoundError("User", str(user_id))
    
    return UserWithRoles(
        **UserRead.model_validate(user).model_dump(),
        role_ids=[role.id for role in user.roles],
        role_names=[role.name for role in user.roles],
    )


@router.patch(
    "/{user_id}",
    response_model=UserRead,
    summary="Update user",
    description="Update a user's details. Requires admin role.",
    dependencies=[Depends(require_admin())],
)
async def update_user(
    user_id: uuid.UUID,
    update_data: UserUpdate,
    db: DBSession,
    ctx: TenantCtx = Depends(get_tenant_context),
) -> UserRead:
    """Update user (admin only)."""
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == ctx.tenant_id,
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise NotFoundError("User", str(user_id))
    
    # Store old values for audit
    old_values = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
    }
    
    # Update fields
    if update_data.first_name is not None:
        user.first_name = update_data.first_name
    if update_data.last_name is not None:
        user.last_name = update_data.last_name
    if update_data.is_active is not None:
        user.is_active = update_data.is_active
    
    user.updated_at = datetime.now(timezone.utc)
    user.updated_by = ctx.user_id
    
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        action=AuditAction.UPDATE,
        resource_type="user",
        resource_id=user.id,
        old_values=old_values,
        new_values=update_data.model_dump(exclude_unset=True),
    )
    db.add(audit_log)
    
    await db.commit()
    await db.refresh(user)
    
    # Publish event
    await event_bus.publish_event(
        EventType.USER_UPDATED,
        ctx.tenant_id,
        {"user_id": str(user.id), "updated_by": str(ctx.user_id)},
    )
    
    return UserRead.model_validate(user)


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Delete user",
    description="Soft delete a user. Requires admin role.",
    dependencies=[Depends(require_admin())],
)
async def delete_user(
    user_id: uuid.UUID,
    db: DBSession,
    ctx: TenantCtx = Depends(get_tenant_context),
) -> MessageResponse:
    """Soft delete user (admin only)."""
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == ctx.tenant_id,
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise NotFoundError("User", str(user_id))
    
    # Prevent self-deletion
    if user.id == ctx.user_id:
        raise ValidationError("Cannot delete your own account")
    
    # Soft delete
    user.deleted_at = datetime.now(timezone.utc)
    user.deleted_by = ctx.user_id
    user.is_active = False
    
    # Create audit log
    audit_log = AuditLog.create_entry(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        action=AuditAction.DELETE,
        resource_type="user",
        resource_id=user.id,
        old_values={"email": user.email, "is_active": True},
        new_values={"is_active": False, "deleted_at": str(user.deleted_at)},
    )
    db.add(audit_log)
    
    await db.commit()
    
    # Publish event
    await event_bus.publish_event(
        EventType.USER_DELETED,
        ctx.tenant_id,
        {"user_id": str(user.id), "deleted_by": str(ctx.user_id)},
    )
    
    return MessageResponse(message="User deleted successfully")