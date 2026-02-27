"""Finance module services."""

import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.events import event_bus
from app.core.constants import EventType

from app.finance.models import Account, FiscalYear, JournalEntry, JournalLine, TaxRate
from app.finance.schemas import (
    AccountCreate,
    AccountUpdate,
    FiscalYearCreate,
    JournalEntryCreate,
    TaxRateCreate,
    TaxRateUpdate,
    TrialBalanceLine,
    TrialBalanceResponse,
)


class ChartOfAccountsService:
    """Service to manage Chart of Accounts."""

    async def create_account(self, session: AsyncSession, tenant_id: uuid.UUID, data: AccountCreate) -> Account:
        if data.parent_id:
            parent_acc = await session.scalar(
                select(Account).where(Account.id == data.parent_id, Account.tenant_id == tenant_id)
            )
            if not parent_acc:
                raise NotFoundError("Account", str(data.parent_id), details={"field": "parent_id"})
            if not parent_acc.is_group:
                raise ValidationError("Parent account must be a group account")

        existing = await session.scalar(
            select(Account).where(Account.account_code == data.account_code, Account.tenant_id == tenant_id)
        )
        if existing:
            raise ConflictError(f"Account code {data.account_code} already exists")

        account = Account(tenant_id=tenant_id, **data.model_dump())
        session.add(account)
        await session.flush()
        return account

    async def list_accounts(
        self, session: AsyncSession, tenant_id: uuid.UUID, include_inactive: bool = False
    ) -> list[Account]:
        query = select(Account).where(Account.tenant_id == tenant_id)
        if not include_inactive:
            query = query.where(Account.is_active.is_(True))
        result = await session.execute(query.order_by(Account.account_code))
        return list(result.scalars().all())

    async def get_account(self, session: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID) -> Account:
        account = await session.scalar(
            select(Account).where(Account.id == account_id, Account.tenant_id == tenant_id)
        )
        if not account:
            raise NotFoundError("Account", str(account_id))
        return account

    async def update_account(
        self, session: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID, data: AccountUpdate
    ) -> Account:
        account = await self.get_account(session, tenant_id, account_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(account, field, value)
        await session.flush()
        return account

    async def deactivate_account(self, session: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID) -> Account:
        account = await self.get_account(session, tenant_id, account_id)
        lines_count = await session.scalar(
            select(func.count(JournalLine.id)).where(JournalLine.account_id == account_id)
        )
        if lines_count and lines_count > 0:
            raise ConflictError("Cannot deactivate account with existing journal lines")
        account.is_active = False
        await session.flush()
        return account

    async def get_account_path(self, session: AsyncSession, account: Account) -> list[str]:
        path = [account.name]
        current = account
        while current.parent_id:
            current = await session.scalar(select(Account).where(Account.id == current.parent_id))
            if not current:
                break
            path.insert(0, current.name)
        return path


class FiscalYearService:
    """Service to manage Fiscal Years."""

    async def create_fiscal_year(self, session: AsyncSession, tenant_id: uuid.UUID, data: FiscalYearCreate) -> FiscalYear:
        if data.status == "open":
            existing_open = await self.get_open_fiscal_year(session, tenant_id)
            if existing_open:
                raise ConflictError("An open fiscal year already exists")

        fy = FiscalYear(tenant_id=tenant_id, **data.model_dump())
        session.add(fy)
        await session.flush()
        return fy

    async def list_fiscal_years(self, session: AsyncSession, tenant_id: uuid.UUID) -> list[FiscalYear]:
        result = await session.execute(
            select(FiscalYear).where(FiscalYear.tenant_id == tenant_id).order_by(FiscalYear.start_date.desc())
        )
        return list(result.scalars().all())

    async def get_open_fiscal_year(self, session: AsyncSession, tenant_id: uuid.UUID) -> Optional[FiscalYear]:
        return await session.scalar(
            select(FiscalYear).where(FiscalYear.tenant_id == tenant_id, FiscalYear.status == "open")
        )

    async def resolve_fiscal_year(self, session: AsyncSession, tenant_id: uuid.UUID, posting_date: date) -> FiscalYear:
        fy = await session.scalar(
            select(FiscalYear).where(
                FiscalYear.tenant_id == tenant_id,
                FiscalYear.start_date <= posting_date,
                FiscalYear.end_date >= posting_date,
            )
        )
        if not fy:
            raise ValidationError(f"Posting date {posting_date} does not fall in any fiscal year")
        if fy.status != "open":
            raise ValidationError(f"Fiscal year {fy.name} is closed")
        return fy

    async def close_fiscal_year(
        self, session: AsyncSession, tenant_id: uuid.UUID, fiscal_year_id: uuid.UUID, closing_user_id: Optional[uuid.UUID]
    ) -> FiscalYear:
        fy = await session.scalar(
            select(FiscalYear).where(FiscalYear.id == fiscal_year_id, FiscalYear.tenant_id == tenant_id)
        )
        if not fy:
            raise NotFoundError("FiscalYear", str(fiscal_year_id))
        if fy.status == "closed":
            raise ConflictError("Fiscal year is already closed")

        # In a full system we would generate closing entries here.
        # For this foundation, we just mark it closed.
        fy.status = "closed"
        
        from datetime import timedelta
        # Create next fiscal year
        next_start = fy.end_date + timedelta(days=1)
        next_end = date(next_start.year + 1, next_start.month, next_start.day) - timedelta(days=1)
        next_name = f"FY{next_start.year}-{next_start.year+1}"
        next_fy = FiscalYear(
            tenant_id=tenant_id,
            name=next_name,
            start_date=next_start,
            end_date=next_end,
            status="open",
        )
        session.add(next_fy)
        await session.flush()
        
        await event_bus.publish_event(
            EventType.FINANCE_FISCAL_YEAR_CLOSED,
            tenant_id,
            {"fiscal_year_id": str(fy.id), "closed_by": str(closing_user_id) if closing_user_id else None},
        )
        
        return fy


class LedgerService:
    """Service to handle core journal entries."""
    
    def __init__(self, fiscal_year_service: FiscalYearService):
        self.fiscal_year_service = fiscal_year_service

    async def post_journal(
        self, session: AsyncSession, tenant_id: uuid.UUID, data: JournalEntryCreate, created_by: Optional[uuid.UUID]
    ) -> JournalEntry:
        # Validate Fiscal Year
        fy = await self.fiscal_year_service.resolve_fiscal_year(session, tenant_id, data.posting_date)
        
        # Determine journal number
        prev_num = await session.scalar(
            select(func.max(JournalEntry.journal_number)).where(JournalEntry.tenant_id == tenant_id)
        )
        next_num = (prev_num or 0) + 1

        # Check accounts
        account_ids = [line.account_id for line in data.lines]
        accounts = await session.scalars(
            select(Account).where(Account.id.in_(account_ids), Account.tenant_id == tenant_id)
        )
        valid_accounts = {acc.id: acc for acc in accounts}
        
        for idx, line in enumerate(data.lines):
            acc = valid_accounts.get(line.account_id)
            if not acc:
                raise ValidationError(f"Line {idx+1}: Account {line.account_id} not found or doesn't belong to tenant")
            if acc.is_group:
                raise ValidationError(f"Line {idx+1}: Cannot post to group account {acc.account_code}")

        entry = JournalEntry(
            tenant_id=tenant_id,
            journal_number=next_num,
            description=data.description,
            posting_date=data.posting_date,
            status="posted",
            reference=data.reference,
            fiscal_year_id=fy.id,
        )
        session.add(entry)
        await session.flush()

        for line in data.lines:
            jline = JournalLine(
                tenant_id=tenant_id,
                journal_entry_id=entry.id,
                account_id=line.account_id,
                debit=line.debit,
                credit=line.credit,
                description=line.description,
            )
            session.add(jline)

        await session.flush()

        # Publish event
        await event_bus.publish_event(
            EventType.FINANCE_JOURNAL_POSTED,
            tenant_id,
            {"journal_entry_id": str(entry.id), "posted_by": str(created_by) if created_by else None},
        )

        # To return complete object with lines loaded
        await session.refresh(entry, ['lines'])
        return entry

    async def reverse_journal(
        self, session: AsyncSession, tenant_id: uuid.UUID, entry_id: uuid.UUID, reversal_date: date, description: str, reversed_by: Optional[uuid.UUID]
    ) -> JournalEntry:
        original = await self.get_journal_entry(session, tenant_id, entry_id)
        if original.status != "posted":
            raise ConflictError("Cannot reverse a non-posted entry")
        if original.reversed_by:
            raise ConflictError("Entry is already reversed")
            
        fy = await self.fiscal_year_service.resolve_fiscal_year(session, tenant_id, reversal_date)

        prev_num = await session.scalar(
            select(func.max(JournalEntry.journal_number)).where(JournalEntry.tenant_id == tenant_id)
        )
        next_num = (prev_num or 0) + 1

        reversal = JournalEntry(
            tenant_id=tenant_id,
            journal_number=next_num,
            description=description,
            posting_date=reversal_date,
            status="posted",
            reference=f"Reversal of #{original.journal_number}",
            reversal_of=entry_id,
            fiscal_year_id=fy.id,
        )
        session.add(reversal)
        await session.flush()
        
        for line in original.lines:
            r_line = JournalLine(
                tenant_id=tenant_id,
                journal_entry_id=reversal.id,
                account_id=line.account_id,
                debit=line.credit,  # swap
                credit=line.debit,  # swap
                description=f"Reversal: {line.description}" if line.description else "Reversal",
            )
            session.add(r_line)

        original.reversed_by = reversal.id
        await session.flush()
        await session.refresh(reversal, ['lines'])
        
        await event_bus.publish_event(
            EventType.FINANCE_JOURNAL_POSTED,
            tenant_id,
            {"journal_entry_id": str(reversal.id), "posted_by": str(reversed_by) if reversed_by else None, "is_reversal": True},
        )
        return reversal

    async def get_journal_entry(self, session: AsyncSession, tenant_id: uuid.UUID, entry_id: uuid.UUID) -> JournalEntry:
        entry = await session.scalar(
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == tenant_id)
        )
        if not entry:
            raise NotFoundError("JournalEntry", str(entry_id))
        return entry

    async def list_journal_entries(
        self, session: AsyncSession, tenant_id: uuid.UUID, fiscal_year_id: Optional[uuid.UUID] = None, account_id: Optional[uuid.UUID] = None, limit: int = 50, offset: int = 0
    ) -> list[JournalEntry]:
        query = select(JournalEntry).options(selectinload(JournalEntry.lines)).where(JournalEntry.tenant_id == tenant_id)
        if fiscal_year_id:
            query = query.where(JournalEntry.fiscal_year_id == fiscal_year_id)
        if account_id:
            query = query.join(JournalLine).where(JournalLine.account_id == account_id).distinct()
            
        query = query.order_by(JournalEntry.posting_date.desc(), JournalEntry.journal_number.desc()).limit(limit).offset(offset)
        result = await session.execute(query)
        return list(result.scalars().all())


class TrialBalanceService:
    """Service to generate the trial balance."""
    
    async def get(
        self, session: AsyncSession, tenant_id: uuid.UUID, fiscal_year_id: uuid.UUID, as_of: Optional[date] = None
    ) -> TrialBalanceResponse:
        # Check if fiscal year exists and belongs to tenant
        fy = await session.scalar(
            select(FiscalYear).where(FiscalYear.id == fiscal_year_id, FiscalYear.tenant_id == tenant_id)
        )
        if not fy:
            raise NotFoundError("FiscalYear", str(fiscal_year_id))
            
        query = (
            select(
                Account.account_code,
                Account.name.label("account_name"),
                Account.account_type,
                func.sum(JournalLine.debit).label("total_debit"),
                func.sum(JournalLine.credit).label("total_credit"),
            )
            .select_from(JournalLine)
            .join(JournalEntry)
            .join(Account)
            .where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.fiscal_year_id == fiscal_year_id,
                JournalEntry.status == "posted",
            )
            .group_by(Account.id, Account.account_code, Account.name, Account.account_type)
        )

        if as_of:
            query = query.where(JournalEntry.posting_date <= as_of)
            
        result = await session.execute(query.order_by(Account.account_code))
        rows = result.all()
        
        lines = []
        overall_debit = 0.0
        overall_credit = 0.0
        
        for row in rows:
            td = float(row.total_debit or 0.0)
            tc = float(row.total_credit or 0.0)
            bal = td - tc if row.account_type in ("asset", "expense") else tc - td
            
            overall_debit += td
            overall_credit += tc
            
            lines.append(
                TrialBalanceLine(
                    account_code=row.account_code,
                    account_name=row.account_name,
                    account_type=row.account_type,
                    total_debit=td,
                    total_credit=tc,
                    balance=bal,
                )
            )
            
        return TrialBalanceResponse(
            lines=lines,
            total_debit=overall_debit,
            total_credit=overall_credit,
            as_of=as_of,
            fiscal_year_id=fiscal_year_id,
        )


class GSTConfigService:
    """Service to manage GST Configuration."""

    async def create_tax_rate(self, session: AsyncSession, tenant_id: uuid.UUID, data: TaxRateCreate) -> TaxRate:
        acc = await session.scalar(
            select(Account).where(Account.id == data.linked_account_id, Account.tenant_id == tenant_id)
        )
        if not acc:
            raise ValidationError(f"Linked account {data.linked_account_id} not found")
            
        tr = TaxRate(tenant_id=tenant_id, **data.model_dump())
        session.add(tr)
        await session.flush()
        return tr

    async def list_tax_rates(self, session: AsyncSession, tenant_id: uuid.UUID, active_only: bool = True) -> list[TaxRate]:
        query = select(TaxRate).where(TaxRate.tenant_id == tenant_id)
        if active_only:
            query = query.where(TaxRate.is_active.is_(True))
        result = await session.execute(query.order_by(TaxRate.name))
        return list(result.scalars().all())

    async def update_tax_rate(self, session: AsyncSession, tenant_id: uuid.UUID, rate_id: uuid.UUID, data: TaxRateUpdate) -> TaxRate:
        tr = await session.scalar(
            select(TaxRate).where(TaxRate.id == rate_id, TaxRate.tenant_id == tenant_id)
        )
        if not tr:
            raise NotFoundError("TaxRate", str(rate_id))
            
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(tr, field, value)
        await session.flush()
        return tr

    async def deactivate_tax_rate(self, session: AsyncSession, tenant_id: uuid.UUID, rate_id: uuid.UUID) -> TaxRate:
        tr = await session.scalar(
            select(TaxRate).where(TaxRate.id == rate_id, TaxRate.tenant_id == tenant_id)
        )
        if not tr:
            raise NotFoundError("TaxRate", str(rate_id))
        tr.is_active = False
        await session.flush()
        return tr
