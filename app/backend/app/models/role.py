"""Role and Permission models for RBAC."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ActionType
from app.models.base import GlobalBase, TenantScopedBase, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class Role(TenantScopedBase):
    """
    Role model representing a set of permissions.
    
    Roles are tenant-scoped, allowing each tenant to define their own roles.
    System roles (is_system=True) cannot be deleted.
    """

    __tablename__ = "roles"
    __table_args__ = (
        # Unique constraint: role name must be unique within a tenant
        UniqueConstraint("tenant_id", "name", name="uq_roles_tenant_name"),
        Index("ix_roles_tenant_id", "tenant_id"),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        secondary="user_roles",
        back_populates="roles",
    )
    permissions: Mapped[list["Permission"]] = relationship(
        "Permission",
        back_populates="role",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


class Permission(GlobalBase):
    """
    Permission model representing a resource-action pair.
    
    Permissions are linked to roles via foreign key.
    Each permission grants access to a specific action on a resource.
    """

    __tablename__ = "permissions"
    __table_args__ = (
        # Unique constraint: permission must be unique per role
        UniqueConstraint(
            "role_id",
            "resource",
            "action",
            name="uq_permissions_role_resource_action",
        ),
        Index("ix_permissions_role_id", "role_id"),
        Index("ix_permissions_resource_action", "resource", "action"),
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
    )
    resource: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    action: Mapped[ActionType] = mapped_column(
        String(20),
        nullable=False,
    )

    # Relationships
    role: Mapped["Role"] = relationship(
        "Role",
        back_populates="permissions",
    )

    def __repr__(self) -> str:
        return f"<Permission {self.resource}:{self.action}>"


class UserRole(GlobalBase, TimestampMixin):
    """
    Association table for User-Role many-to-many relationship.
    
    This is an explicit association table to allow for additional metadata
    (like timestamps) and to make the relationship easier to query.
    """

    __tablename__ = "user_roles"
    __table_args__ = (
        # Primary key constraint
        UniqueConstraint("user_id", "role_id", name="pk_user_roles"),
        Index("ix_user_roles_user_id", "user_id"),
        Index("ix_user_roles_role_id", "role_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="user_roles",
    )
    role: Mapped["Role"] = relationship(
        "Role",
    )

    def __repr__(self) -> str:
        return f"<UserRole user={self.user_id} role={self.role_id}>"