"""Pydantic schemas for the invoice module."""

import uuid
from datetime import date
from typing import Any, Optional
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CustomerCreate(BaseModel):
    """Schema for creating a customer."""
    legal_name: str = Field(..., max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    gstin: Optional[str] = Field(None, pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    pan: Optional[str] = Field(None, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
    billing_address: dict[str, Any] = Field(default_factory=dict)
    shipping_address: Optional[dict[str, Any]] = None
    currency_code: str = Field("INR", max_length=3)
    payment_terms_days: int = Field(30, ge=0)
    receivable_account_id: uuid.UUID


class CustomerUpdate(BaseModel):
    """Schema for updating a customer."""
    legal_name: Optional[str] = Field(None, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    gstin: Optional[str] = Field(None, pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    pan: Optional[str] = Field(None, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
    billing_address: Optional[dict[str, Any]] = None
    shipping_address: Optional[dict[str, Any]] = None
    currency_code: Optional[str] = Field(None, max_length=3)
    payment_terms_days: Optional[int] = Field(None, ge=0)
    receivable_account_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def check_at_least_one_field(self) -> "CustomerUpdate":
        if not any(v is not None for v in self.model_dump().values()):
            raise ValueError("At least one field must be provided for update")
        return self


class CustomerResponse(BaseModel):
    """Schema for a customer response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    legal_name: str
    display_name: Optional[str]
    gstin: Optional[str]
    pan: Optional[str]
    billing_address: dict[str, Any]
    shipping_address: Optional[dict[str, Any]]
    currency_code: str
    payment_terms_days: int
    receivable_account_id: uuid.UUID
    is_active: bool


class VendorCreate(BaseModel):
    """Schema for creating a vendor."""
    legal_name: str = Field(..., max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    gstin: Optional[str] = Field(None, pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    pan: Optional[str] = Field(None, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
    billing_address: dict[str, Any] = Field(default_factory=dict)
    shipping_address: Optional[dict[str, Any]] = None
    currency_code: str = Field("INR", max_length=3)
    payment_terms_days: int = Field(30, ge=0)
    payable_account_id: uuid.UUID


class VendorUpdate(BaseModel):
    """Schema for updating a vendor."""
    legal_name: Optional[str] = Field(None, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    gstin: Optional[str] = Field(None, pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    pan: Optional[str] = Field(None, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
    billing_address: Optional[dict[str, Any]] = None
    shipping_address: Optional[dict[str, Any]] = None
    currency_code: Optional[str] = Field(None, max_length=3)
    payment_terms_days: Optional[int] = Field(None, ge=0)
    payable_account_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def check_at_least_one_field(self) -> "VendorUpdate":
        if not any(v is not None for v in self.model_dump().values()):
            raise ValueError("At least one field must be provided for update")
        return self


class VendorResponse(BaseModel):
    """Schema for a vendor response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    legal_name: str
    display_name: Optional[str]
    gstin: Optional[str]
    pan: Optional[str]
    billing_address: dict[str, Any]
    shipping_address: Optional[dict[str, Any]]
    currency_code: str
    payment_terms_days: int
    payable_account_id: uuid.UUID
    is_active: bool


class InvoiceLineCreate(BaseModel):
    """Schema for creating an invoice line."""
    description: str = Field(..., min_length=1)
    quantity: Decimal = Field(..., gt=0, decimal_places=4)
    unit_price: Decimal = Field(..., ge=0, decimal_places=4)
    discount_percent: Decimal = Field(Decimal("0.0"), ge=0, le=100, decimal_places=2)
    account_id: uuid.UUID
    tax_rate_id: Optional[uuid.UUID] = None


class InvoiceLineResponse(BaseModel):
    """Schema for an invoice line response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal
    account_id: uuid.UUID
    tax_rate_id: Optional[uuid.UUID]
    line_number: int
    line_total: Decimal
    tax_amount: Decimal


class InvoiceCreate(BaseModel):
    """Schema for creating an invoice."""
    invoice_type: str = Field(..., pattern="^(sales|purchase|credit_note|debit_note)$")
    party_id: uuid.UUID
    party_type: str = Field(..., pattern="^(customer|vendor)$")
    invoice_date: date
    due_date: date
    currency_code: str = Field("INR", max_length=3)
    notes: Optional[str] = None
    terms: Optional[str] = None
    lines: list[InvoiceLineCreate] = Field(..., min_length=1)

    @model_validator(mode="after")
    def check_due_date(self) -> "InvoiceCreate":
        if self.due_date < self.invoice_date:
            raise ValueError("due_date must be greater than or equal to invoice_date")
        return self


class InvoiceUpdate(BaseModel):
    """Schema for updating a draft invoice."""
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    lines: Optional[list[InvoiceLineCreate]] = Field(None, min_length=1)


class InvoiceSummary(BaseModel):
    """Schema for an invoice summary in list endpoints."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    invoice_number: int
    invoice_type: str
    party_id: uuid.UUID
    party_type: str
    invoice_date: date
    due_date: date
    status: str
    currency_code: str
    subtotal: Decimal
    total_tax: Decimal
    total: Decimal


class InvoiceResponse(InvoiceSummary):
    """Schema for a full invoice response including lines."""
    exchange_rate: Decimal
    journal_entry_id: Optional[uuid.UUID]
    reversal_of: Optional[uuid.UUID]
    notes: Optional[str]
    terms: Optional[str]
    lines: list[InvoiceLineResponse]


class AgingBucket(BaseModel):
    """Aging buckets."""
    current: Decimal = Decimal("0.0")
    days_1_30: Decimal = Decimal("0.0")
    days_31_60: Decimal = Decimal("0.0")
    days_61_90: Decimal = Decimal("0.0")
    days_91_plus: Decimal = Decimal("0.0")
    total: Decimal = Decimal("0.0")


class AgingRow(BaseModel):
    """Row in an aging report."""
    party_id: uuid.UUID
    party_name: str
    gstin: Optional[str]
    buckets: AgingBucket


class AgingReport(BaseModel):
    """AR/AP Aging Report."""
    as_of: date
    rows: list[AgingRow]
    totals: AgingBucket
