"""User model for authentication and authorization."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteMixin, TenantScopedBase

if TYPE_CHECKING:
    from app.models.role import Role, UserRole
    from app.models.tenant import Tenant


class User(TenantScopedBase, SoftDeleteMixin):
    """
    User model representing a user within a tenant.
    
    Users are tenant-scoped entities, meaning each tenant has its own set of users.
    Supports soft deletion for audit compliance.
    """

    __tablename__ = "users"
    __table_args__ = (
        # Unique constraint: email must be unique within a tenant
        UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),
        # Index for tenant-filtered queries
        Index("ix_users_tenant_id", "tenant_id"),
        Index("ix_users_tenant_email", "tenant_id", "email"),
        Index("ix_users_tenant_deleted", "tenant_id", "deleted_at"),
    )

    # Authentication
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Profile
    first_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Verification
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Last login
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_login_ip: Mapped[str | None] = mapped_column(
        String(45),  # IPv6 max length
        nullable=True,
    )

    # Password reset
    password_reset_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="users",
    )
    roles: Mapped[list["Role"]] = relationship(
        "Role",
        secondary="user_roles",
        back_populates="users",
        lazy="selectin",
    )
    user_roles: Mapped[list["UserRole"]] = relationship(
        "UserRole",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @property
    def full_name(self) -> str:
        """Get user's full name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.last_name or self.email

    @property
    def is_deleted(self) -> bool:
        """Check if user has been soft-deleted."""
        return self.deleted_at is not None

    def __repr__(self) -> str:
        return f"<User {self.email}>"