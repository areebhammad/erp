"""Finance module SQLAlchemy models."""

import uuid
from datetime import date
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantScopedBase

if TYPE_CHECKING:
    pass

class FiscalYear(TenantScopedBase):
    """Fiscal Year model."""
    __tablename__ = "fiscal_years"
    __table_args__ = (
        Index("ix_fiscal_years_tenant_id_status", "tenant_id", "status"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")  # open, closed
    closing_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal_entries.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )

class Account(TenantScopedBase):
    """Chart of Accounts."""
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "account_code", name="uq_accounts_tenant_code"),
        Index("ix_accounts_tenant_id_code", "tenant_id", "account_code"),
    )

    account_code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False) # asset, liability, equity, revenue, expense
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=True,
    )
    is_group: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

class JournalEntry(TenantScopedBase):
    """Immutable Journal Entry."""
    __tablename__ = "journal_entries"
    __table_args__ = (
        Index("ix_journal_entries_tenant_id_date", "tenant_id", "posting_date"),
    )

    journal_number: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft") # draft, posted
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reversal_of: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal_entries.id", ondelete="SET NULL"),
        nullable=True,
    )
    reversed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal_entries.id", ondelete="SET NULL"),
        nullable=True,
    )
    fiscal_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fiscal_years.id", ondelete="RESTRICT"),
        nullable=False,
    )

class JournalLine(TenantScopedBase):
    """Line item in a journal entry."""
    __tablename__ = "journal_lines"
    __table_args__ = (
        Index("ix_journal_lines_tenant_id_account", "tenant_id", "account_id"),
        Index("ix_journal_lines_journal_entry", "journal_entry_id"),
    )

    journal_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    debit: Mapped[Numeric] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    credit: Mapped[Numeric] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class TaxRate(TenantScopedBase):
    """GST tax rate configuration."""
    __tablename__ = "tax_rates"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    tax_type: Mapped[str] = mapped_column(String(20), nullable=False) # CGST, SGST, IGST, CESS
    rate: Mapped[Numeric] = mapped_column(Numeric(5, 4), nullable=False)
    linked_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
