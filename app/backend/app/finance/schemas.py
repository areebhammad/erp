"""Finance module Pydantic schemas."""

from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.base import BaseSchema


class AccountCreate(BaseSchema):
    account_code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=255)
    account_type: str = Field(..., max_length=50) # asset, liability, equity, revenue, expense
    parent_id: Optional[UUID] = None
    is_group: bool = False
    currency_code: str = Field("INR", max_length=3)
    is_active: bool = True


class AccountUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class AccountRead(AccountCreate):
    id: UUID
    tenant_id: UUID
    parent_path: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class FiscalYearCreate(BaseSchema):
    name: str = Field(..., max_length=100)
    start_date: date
    end_date: date
    status: str = Field("open", max_length=20)


class FiscalYearRead(FiscalYearCreate):
    id: UUID
    tenant_id: UUID
    closing_entry_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


class JournalLineInput(BaseSchema):
    account_id: UUID
    debit: float = Field(default=0.0, ge=0)
    credit: float = Field(default=0.0, ge=0)
    description: Optional[str] = None


class JournalEntryCreate(BaseSchema):
    description: str
    posting_date: date
    reference: Optional[str] = Field(None, max_length=100)
    lines: list[JournalLineInput]

    @model_validator(mode="after")
    def validate_lines(self) -> "JournalEntryCreate":
        if len(self.lines) < 2:
            raise ValueError("At least 2 lines required")
            
        total_debit = 0.0
        total_credit = 0.0
        
        for line in self.lines:
            if (line.debit > 0 and line.credit > 0) or (line.debit == 0 and line.credit == 0):
                raise ValueError("Each line must have exactly one of debit > 0 or credit > 0")
            total_debit += line.debit
            total_credit += line.credit
            
        if abs(total_debit - total_credit) > 0.0001:
            raise ValueError(f"Debit ({total_debit}) and credit ({total_credit}) totals must match")
            
        # posting_date cannot be in the future by more than 7 days
        if self.posting_date > (datetime.now().date() + timedelta(days=7)):
            raise ValueError("Posting date cannot be more than 7 days in the future")
            
        return self


class JournalLineRead(JournalLineInput):
    id: UUID
    journal_entry_id: UUID
    
    model_config = ConfigDict(from_attributes=True)


class JournalEntryRead(BaseSchema):
    id: UUID
    tenant_id: UUID
    journal_number: int
    description: str
    posting_date: date
    status: str
    reference: Optional[str] = None
    reversal_of: Optional[UUID] = None
    reversed_by: Optional[UUID] = None
    fiscal_year_id: UUID
    lines: list[JournalLineRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TaxRateCreate(BaseSchema):
    name: str = Field(..., max_length=100)
    tax_type: str = Field(..., max_length=20)
    rate: float
    linked_account_id: UUID
    is_active: bool = True


class TaxRateUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    rate: Optional[float] = None
    is_active: Optional[bool] = None


class TaxRateRead(TaxRateCreate):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class TrialBalanceLine(BaseSchema):
    account_code: str
    account_name: str
    account_type: str
    total_debit: float
    total_credit: float
    balance: float


class TrialBalanceResponse(BaseSchema):
    lines: list[TrialBalanceLine]
    total_debit: float
    total_credit: float
    as_of: Optional[date] = None
    fiscal_year_id: UUID
