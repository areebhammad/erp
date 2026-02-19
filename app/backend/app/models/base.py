"""Base SQLAlchemy models for the ERP system."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, declared_attr

from app.core.database import Base

if TYPE_CHECKING:
    from uuid import UUID as UUIDType


class GlobalBase(Base):
    """
    Base model for global entities (not tenant-scoped).
    
    Examples: Tenant, SystemConfiguration
    
    Provides:
    - id: UUID primary key
    - created_at: Creation timestamp
    - updated_at: Last update timestamp
    """

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantScopedBase(Base):
    """
    Base model for tenant-scoped entities.
    
    Examples: User, Invoice, Customer, Product
    
    Provides:
    - id: UUID primary key
    - tenant_id: Foreign key to tenants table
    - created_at: Creation timestamp
    - updated_at: Last update timestamp
    - created_by: UUID of user who created the record
    - updated_by: UUID of user who last updated the record
    
    All tenant-scoped tables should inherit from this class.
    This enables automatic tenant filtering and audit trail.
    """

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    @declared_attr.directive
    @classmethod
    def __table_args__(cls) -> tuple:
        """Add tenant_id index to all tenant-scoped tables."""
        return (
            # Composite index for efficient tenant-filtered queries
            # Index(f"idx_{cls.__tablename__}_tenant", "tenant_id", "id"),
            # Note: Individual indexes are created via migrations for more control
            {},
        )


class SoftDeleteMixin:
    """
    Mixin to add soft delete capability to models.
    
    Adds:
    - deleted_at: Timestamp when record was soft-deleted
    - deleted_by: UUID of user who deleted the record
    
    Usage:
        class Invoice(TenantScopedBase, SoftDeleteMixin):
            ...
    """

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    @property
    def is_deleted(self) -> bool:
        """Check if record has been soft-deleted."""
        return self.deleted_at is not None


class TimestampMixin:
    """
    Mixin to add timestamp fields without tenant scope.
    
    Useful for join tables and association tables.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )