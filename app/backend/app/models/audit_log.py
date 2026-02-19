"""Audit Log model for compliance and tracking."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import AuditAction
from app.models.base import GlobalBase


class AuditLog(GlobalBase):
    """
    Audit Log model for tracking all changes in the system.
    
    Records all create, update, delete, and access actions for compliance
    and security auditing. Retained for 7 years per regulatory requirements.
    
    Note: This table should be partitioned by month for performance at scale.
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_tenant_id", "tenant_id"),
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_tenant_created", "tenant_id", "created_at"),
    )

    # Tenant context
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # User who performed the action
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Action details
    action: Mapped[AuditAction] = mapped_column(
        String(20),
        nullable=False,
    )

    # Resource being acted upon
    resource_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Changes (for create/update/delete)
    changes: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    old_values: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    new_values: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Request context
    ip_address: Mapped[str | None] = mapped_column(
        String(45),  # IPv6 max length
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    request_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
    )

    # Additional metadata
    metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Note: created_at is inherited from GlobalBase

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.resource_type}:{self.resource_id}>"

    @classmethod
    def create_entry(
        cls,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID | None,
        action: AuditAction,
        resource_type: str,
        resource_id: uuid.UUID | None = None,
        old_values: dict[str, Any] | None = None,
        new_values: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "AuditLog":
        """
        Factory method to create an audit log entry.
        
        Args:
            tenant_id: ID of the tenant
            user_id: ID of the user performing the action
            action: Type of action (create, read, update, delete, etc.)
            resource_type: Type of resource being acted upon
            resource_id: ID of the resource being acted upon
            old_values: Previous values (for update/delete)
            new_values: New values (for create/update)
            ip_address: IP address of the request
            user_agent: User agent string
            request_id: Request ID for tracing
            metadata: Additional metadata
            
        Returns:
            AuditLog instance (not persisted)
        """
        changes = None
        if old_values or new_values:
            changes = {
                "old": old_values,
                "new": new_values,
            }

        return cls(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            changes=changes,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            metadata=metadata,
        )