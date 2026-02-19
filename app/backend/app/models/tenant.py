"""Tenant model for multi-tenant architecture."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import SubscriptionPlan, TenantStatus
from app.models.base import GlobalBase

if TYPE_CHECKING:
    from app.models.user import User


class Tenant(GlobalBase):
    """
    Tenant model representing a company/organization.
    
    This is a global entity (not tenant-scoped) as it represents the tenant itself.
    All other tenant-scoped entities reference this table.
    """

    __tablename__ = "tenants"

    # Basic info
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )
    domain: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
    )

    # Status
    status: Mapped[TenantStatus] = mapped_column(
        String(20),
        nullable=False,
        default=TenantStatus.TRIAL,
        index=True,
    )

    # Subscription
    subscription_plan: Mapped[SubscriptionPlan] = mapped_column(
        String(20),
        nullable=False,
        default=SubscriptionPlan.FREE,
    )

    # Settings (JSONB for flexible per-tenant configuration)
    settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    # Branding
    logo_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    primary_color: Mapped[str | None] = mapped_column(
        String(7),  # Hex color code
        nullable=True,
    )

    # Contact
    contact_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    contact_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    # Address
    address_line1: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    address_line2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    state: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    country: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    postal_code: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    # GST (India-specific)
    gstin: Mapped[str | None] = mapped_column(
        String(15),
        nullable=True,
    )
    pan: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )

    @property
    def is_active(self) -> bool:
        """Check if tenant is active."""
        return self.status == TenantStatus.ACTIVE

    @property
    def is_trial(self) -> bool:
        """Check if tenant is on trial."""
        return self.status == TenantStatus.TRIAL

    @property
    def is_suspended(self) -> bool:
        """Check if tenant is suspended."""
        return self.status == TenantStatus.SUSPENDED

    def __repr__(self) -> str:
        return f"<Tenant {self.name} ({self.slug})>"