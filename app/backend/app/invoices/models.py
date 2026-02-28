"""Invoice module SQLAlchemy models."""

import uuid
from datetime import date
from typing import Any, Optional

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantScopedBase


class Customer(TenantScopedBase):
    """Customer Master Data."""
    __tablename__ = "customers"
    __table_args__ = (
        Index("ix_customers_tenant_id_gstin", "tenant_id", "gstin"),
        Index("ix_customers_tenant_id_is_active", "tenant_id", "is_active"),
    )

    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    billing_address: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    shipping_address: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    receivable_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Vendor(TenantScopedBase):
    """Vendor Master Data."""
    __tablename__ = "vendors"
    __table_args__ = (
        Index("ix_vendors_tenant_id_gstin", "tenant_id", "gstin"),
        Index("ix_vendors_tenant_id_is_active", "tenant_id", "is_active"),
    )

    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    billing_address: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    shipping_address: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    payable_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Invoice(TenantScopedBase):
    """Invoice Header."""
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", name="uq_invoices_tenant_number"),
        Index("ix_invoices_tenant_id_date", "tenant_id", "invoice_date"),
        Index("ix_invoices_tenant_id_status_due", "tenant_id", "status", "due_date"),
        Index("ix_invoices_tenant_id_party", "tenant_id", "party_id", "party_type"),
    )

    invoice_number: Mapped[int] = mapped_column(Integer, nullable=False)
    invoice_type: Mapped[str] = mapped_column(String(20), nullable=False)  # sales, purchase, credit_note, debit_note
    party_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    party_type: Mapped[str] = mapped_column(String(20), nullable=False)  # customer, vendor
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft, submitted, cancelled
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    exchange_rate: Mapped[Numeric] = mapped_column(Numeric(12, 6), nullable=False, default=1.0)
    subtotal: Mapped[Numeric] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_tax: Mapped[Numeric] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total: Mapped[Numeric] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal_entries.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )
    reversal_of: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    lines: Mapped[list["InvoiceLine"]] = relationship(
        "InvoiceLine", back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceLine(TenantScopedBase):
    """Invoice Line Item."""
    __tablename__ = "invoice_lines"
    __table_args__ = (
        Index("ix_invoice_lines_invoice_id", "invoice_id"),
        Index("ix_invoice_lines_tenant_account", "tenant_id", "account_id"),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Numeric] = mapped_column(Numeric(12, 4), nullable=False)
    unit_price: Mapped[Numeric] = mapped_column(Numeric(18, 4), nullable=False)
    discount_percent: Mapped[Numeric] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    line_total: Mapped[Numeric] = mapped_column(Numeric(18, 4), nullable=False)
    
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    tax_rate_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tax_rates.id", ondelete="RESTRICT"),
        nullable=True,
    )
    tax_amount: Mapped[Numeric] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="lines")
