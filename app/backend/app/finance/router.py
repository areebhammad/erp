"""Finance API router."""

from datetime import date
from typing import Annotated, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession, get_tenant_context, require_role
from app.core.constants import UserRole
from app.finance.schemas import (
    AccountCreate,
    AccountRead,
    AccountUpdate,
    FiscalYearCreate,
    FiscalYearRead,
    JournalEntryCreate,
    JournalEntryRead,
    TaxRateCreate,
    TaxRateRead,
    TaxRateUpdate,
    TrialBalanceResponse,
)
from app.finance.services import (
    ChartOfAccountsService,
    FiscalYearService,
    GSTConfigService,
    LedgerService,
    TrialBalanceService,
)

router = APIRouter(prefix="/finance", tags=["Finance"])

# Services
coa_service = ChartOfAccountsService()
fy_service = FiscalYearService()
ledger_service = LedgerService(fiscal_year_service=fy_service)
tb_service = TrialBalanceService()
gst_service = GSTConfigService()


# ---------------------------------------------------------------------------
# Chart of Accounts
# ---------------------------------------------------------------------------
@router.get("/accounts", response_model=list[AccountRead])
async def list_accounts(
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    include_inactive: bool = Query(False, description="Include inactive accounts"),
) -> list[AccountRead]:
    """List chart of accounts for the tenant."""
    return await coa_service.list_accounts(db, ctx.tenant_id, include_inactive)


@router.post("/accounts", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> AccountRead:
    """Create a new account (Admin only)."""
    return await coa_service.create_account(db, ctx.tenant_id, data)


@router.patch("/accounts/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: UUID,
    data: AccountUpdate,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> AccountRead:
    """Update an account (Admin only)."""
    return await coa_service.update_account(db, ctx.tenant_id, account_id, data)


@router.delete("/accounts/{account_id}", response_model=AccountRead)
async def deactivate_account(
    account_id: UUID,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> AccountRead:
    """Deactivate an account (Admin only)."""
    return await coa_service.deactivate_account(db, ctx.tenant_id, account_id)


# ---------------------------------------------------------------------------
# Fiscal Years
# ---------------------------------------------------------------------------
@router.get("/fiscal-years", response_model=list[FiscalYearRead])
async def list_fiscal_years(
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
) -> list[FiscalYearRead]:
    """List all fiscal years for the tenant."""
    return await fy_service.list_fiscal_years(db, ctx.tenant_id)


@router.post("/fiscal-years", response_model=FiscalYearRead, status_code=status.HTTP_201_CREATED)
async def create_fiscal_year(
    data: FiscalYearCreate,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> FiscalYearRead:
    """Create a new fiscal year (Admin only)."""
    return await fy_service.create_fiscal_year(db, ctx.tenant_id, data)


@router.patch("/fiscal-years/{fiscal_year_id}/close", response_model=FiscalYearRead)
async def close_fiscal_year(
    fiscal_year_id: UUID,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> FiscalYearRead:
    """Close a fiscal year and generate closing entries (Admin only)."""
    return await fy_service.close_fiscal_year(db, ctx.tenant_id, fiscal_year_id, ctx.user_id)


# ---------------------------------------------------------------------------
# Journal Entries
# ---------------------------------------------------------------------------
@router.get("/journal-entries", response_model=list[JournalEntryRead])
async def list_journal_entries(
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    fiscal_year_id: Optional[UUID] = Query(None),
    account_id: Optional[UUID] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[JournalEntryRead]:
    """List journal entries with pagination and filtering."""
    return await ledger_service.list_journal_entries(
        db, ctx.tenant_id, fiscal_year_id, account_id, limit, offset
    )


@router.post("/journal-entries", response_model=JournalEntryRead, status_code=status.HTTP_201_CREATED)
async def post_journal_entry(
    data: JournalEntryCreate,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    # In a real system we'd allow ACCOUNTANT role as well
    _: Any = Depends(require_role([UserRole.ADMIN])), 
) -> JournalEntryRead:
    """Post a new balanced journal entry."""
    return await ledger_service.post_journal(db, ctx.tenant_id, data, ctx.user_id)


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryRead)
async def get_journal_entry(
    entry_id: UUID,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
) -> JournalEntryRead:
    """Get a specific journal entry by ID."""
    return await ledger_service.get_journal_entry(db, ctx.tenant_id, entry_id)


from pydantic import BaseModel
class ReversalRequest(BaseModel):
    reversal_date: date
    description: str

@router.post("/journal-entries/{entry_id}/reverse", response_model=JournalEntryRead)
async def reverse_journal_entry(
    entry_id: UUID,
    data: ReversalRequest,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> JournalEntryRead:
    """Reverse a posted journal entry."""
    return await ledger_service.reverse_journal(
        db, ctx.tenant_id, entry_id, data.reversal_date, data.description, ctx.user_id
    )


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
@router.get("/reports/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    fiscal_year_id: UUID = Query(...),
    as_of: Optional[date] = Query(None),
) -> TrialBalanceResponse:
    """Get trial balance for a specific fiscal year and optional date."""
    return await tb_service.get(db, ctx.tenant_id, fiscal_year_id, as_of)


# ---------------------------------------------------------------------------
# Tax Rates
# ---------------------------------------------------------------------------
@router.get("/tax-rates", response_model=list[TaxRateRead])
async def list_tax_rates(
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    active_only: bool = Query(True),
) -> list[TaxRateRead]:
    """List all GST tax rates for the tenant."""
    return await gst_service.list_tax_rates(db, ctx.tenant_id, active_only)


@router.post("/tax-rates", response_model=TaxRateRead, status_code=status.HTTP_201_CREATED)
async def create_tax_rate(
    data: TaxRateCreate,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> TaxRateRead:
    """Create a new GST tax rate (Admin only)."""
    return await gst_service.create_tax_rate(db, ctx.tenant_id, data)


@router.patch("/tax-rates/{rate_id}", response_model=TaxRateRead)
async def update_tax_rate(
    rate_id: UUID,
    data: TaxRateUpdate,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> TaxRateRead:
    """Update a GST tax rate (Admin only)."""
    return await gst_service.update_tax_rate(db, ctx.tenant_id, rate_id, data)


@router.delete("/tax-rates/{rate_id}", response_model=TaxRateRead)
async def deactivate_tax_rate(
    rate_id: UUID,
    ctx: Annotated[Any, Depends(get_tenant_context)],
    db: DBSession,
    _: Any = Depends(require_role([UserRole.ADMIN])),
) -> TaxRateRead:
    """Deactivate a GST tax rate (Admin only)."""
    return await gst_service.deactivate_tax_rate(db, ctx.tenant_id, rate_id)
