import uuid
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import EventType
from app.core.events import event_bus
from app.finance.models import Account, TaxRate
from app.invoices.models import Customer, Invoice, InvoiceLine, Vendor
from app.invoices.schemas import (
    CustomerCreate,
    CustomerUpdate,
    VendorCreate,
    VendorUpdate,
)


class PartyService:
    """Service to manage Customers and Vendors."""

    async def _validate_account(
        self, session: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID, expected_type: str
    ) -> None:
        """Validate an account is a leaf account of the expected type."""
        stmt = select(Account).where(
            Account.id == account_id,
            Account.tenant_id == tenant_id,
            Account.is_active.is_(True),
        )
        result = await session.execute(stmt)
        account = result.scalar_one_or_none()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        if account.is_group:
            raise HTTPException(status_code=422, detail="Cannot link to a group account")
        if account.account_type != expected_type:
            raise HTTPException(
                status_code=422,
                detail=f"Account must be of type {expected_type}, but got {account.account_type}",
            )

    async def create_customer(
        self, session: AsyncSession, tenant_id: uuid.UUID, data: CustomerCreate
    ) -> Customer:
        await self._validate_account(session, tenant_id, data.receivable_account_id, "asset")

        customer = Customer(tenant_id=tenant_id, **data.model_dump())
        session.add(customer)
        await session.flush()
        return customer

    async def list_customers(
        self,
        session: AsyncSession,
        tenant_id: uuid.UUID,
        active_only: bool = True,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Customer], int]:
        stmt = select(Customer).where(Customer.tenant_id == tenant_id)
        if active_only:
            stmt = stmt.where(Customer.is_active.is_(True))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await session.scalar(count_stmt)

        stmt = stmt.order_by(Customer.legal_name).offset(skip).limit(limit)
        result = await session.execute(stmt)
        customers = list(result.scalars().all())

        return customers, total or 0

    async def get_customer(
        self, session: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID
    ) -> Customer:
        stmt = select(Customer).where(
            Customer.id == customer_id,
            Customer.tenant_id == tenant_id,
        )
        result = await session.execute(stmt)
        customer = result.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer

    async def update_customer(
        self,
        session: AsyncSession,
        tenant_id: uuid.UUID,
        customer_id: uuid.UUID,
        data: CustomerUpdate,
    ) -> Customer:
        customer = await self.get_customer(session, tenant_id, customer_id)

        update_data = data.model_dump(exclude_unset=True)
        if "receivable_account_id" in update_data:
            await self._validate_account(
                session, tenant_id, update_data["receivable_account_id"], "asset"
            )

        for key, value in update_data.items():
            setattr(customer, key, value)

        await session.flush()
        return customer

    async def deactivate_customer(
        self, session: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID
    ) -> None:
        customer = await self.get_customer(session, tenant_id, customer_id)
        customer.is_active = False
        await session.flush()

    # Vendor methods
    async def create_vendor(
        self, session: AsyncSession, tenant_id: uuid.UUID, data: VendorCreate
    ) -> Vendor:
        await self._validate_account(session, tenant_id, data.payable_account_id, "liability")

        vendor = Vendor(tenant_id=tenant_id, **data.model_dump())
        session.add(vendor)
        await session.flush()
        return vendor

    async def list_vendors(
        self,
        session: AsyncSession,
        tenant_id: uuid.UUID,
        active_only: bool = True,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Vendor], int]:
        stmt = select(Vendor).where(Vendor.tenant_id == tenant_id)
        if active_only:
            stmt = stmt.where(Vendor.is_active.is_(True))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await session.scalar(count_stmt)

        stmt = stmt.order_by(Vendor.legal_name).offset(skip).limit(limit)
        result = await session.execute(stmt)
        vendors = list(result.scalars().all())

        return vendors, total or 0

    async def get_vendor(
        self, session: AsyncSession, tenant_id: uuid.UUID, vendor_id: uuid.UUID
    ) -> Vendor:
        stmt = select(Vendor).where(
            Vendor.id == vendor_id,
            Vendor.tenant_id == tenant_id,
        )
        result = await session.execute(stmt)
        vendor = result.scalar_one_or_none()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        return vendor

    async def update_vendor(
        self,
        session: AsyncSession,
        tenant_id: uuid.UUID,
        vendor_id: uuid.UUID,
        data: VendorUpdate,
    ) -> Vendor:
        vendor = await self.get_vendor(session, tenant_id, vendor_id)

        update_data = data.model_dump(exclude_unset=True)
        if "payable_account_id" in update_data:
            await self._validate_account(
                session, tenant_id, update_data["payable_account_id"], "liability"
            )

        for key, value in update_data.items():
            setattr(vendor, key, value)

        await session.flush()
        return vendor

    async def deactivate_vendor(
        self, session: AsyncSession, tenant_id: uuid.UUID, vendor_id: uuid.UUID
    ) -> None:
        vendor = await self.get_vendor(session, tenant_id, vendor_id)
        vendor.is_active = False
        await session.flush()

from decimal import Decimal
from app.finance.services import LedgerService
from app.finance.schemas import JournalEntryCreate, JournalLineCreate

class InvoiceService:
    """Service to manage Invoices."""

    def __init__(self, ledger_service: LedgerService):
        self.ledger_service = ledger_service

    async def get_invoice(self, session: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> Invoice:
        stmt = select(Invoice).options(selectinload(Invoice.lines)).where(
            Invoice.id == invoice_id,
            Invoice.tenant_id == tenant_id,
        )
        result = await session.execute(stmt)
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice

    async def list_invoices(
        self,
        session: AsyncSession,
        tenant_id: uuid.UUID,
        invoice_type: Optional[str] = None,
        party_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Invoice], int]:
        stmt = select(Invoice).where(Invoice.tenant_id == tenant_id)
        if invoice_type:
            stmt = stmt.where(Invoice.invoice_type == invoice_type)
        if party_id:
            stmt = stmt.where(Invoice.party_id == party_id)
        if status:
            stmt = stmt.where(Invoice.status == status)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await session.scalar(count_stmt)

        stmt = stmt.order_by(Invoice.invoice_date.desc(), Invoice.invoice_number.desc()).offset(skip).limit(limit)
        result = await session.execute(stmt)
        invoices = list(result.scalars().all())

        return invoices, total or 0

    async def _validate_party(self, session: AsyncSession, tenant_id: uuid.UUID, party_id: uuid.UUID, party_type: str) -> None:
        if party_type == "customer":
            stmt = select(Customer).where(Customer.id == party_id, Customer.tenant_id == tenant_id, Customer.is_active.is_(True))
        elif party_type == "vendor":
            stmt = select(Vendor).where(Vendor.id == party_id, Vendor.tenant_id == tenant_id, Vendor.is_active.is_(True))
        else:
            raise HTTPException(status_code=422, detail="Invalid party_type")

        result = await session.execute(stmt)
        party = result.scalar_one_or_none()
        if not party:
            raise HTTPException(status_code=404, detail=f"{party_type.capitalize()} not found or inactive")
        return party

    async def _validate_accounts_and_tax(self, session: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID, tax_rate_id: Optional[uuid.UUID]) -> TaxRate | None:
        # Validate account is leaf
        stmt_acc = select(Account).where(Account.id == account_id, Account.tenant_id == tenant_id, Account.is_active.is_(True))
        acc = (await session.execute(stmt_acc)).scalar_one_or_none()
        if not acc or acc.is_group:
            raise HTTPException(status_code=422, detail=f"Line account {account_id} must be an active leaf account")
        
        tax_rate = None
        if tax_rate_id:
            stmt_tax = select(TaxRate).where(TaxRate.id == tax_rate_id, TaxRate.tenant_id == tenant_id, TaxRate.is_active.is_(True))
            tax_rate = (await session.execute(stmt_tax)).scalar_one_or_none()
            if not tax_rate:
                raise HTTPException(status_code=422, detail=f"Tax rate {tax_rate_id} not found or inactive")
        return tax_rate

    async def create_invoice(self, session: AsyncSession, tenant_id: uuid.UUID, data: Any, created_by: Optional[uuid.UUID]) -> Invoice:
        party = await self._validate_party(session, tenant_id, data.party_id, data.party_type)
        
        # Determine next invoice number
        stmt = select(func.max(Invoice.invoice_number)).where(Invoice.tenant_id == tenant_id)
        max_num = await session.scalar(stmt)
        invoice_number = (max_num or 1000) + 1

        invoice = Invoice(
            tenant_id=tenant_id,
            invoice_number=invoice_number,
            status="draft",
            created_by=created_by,
            updated_by=created_by,
            **data.model_dump(exclude={"lines", "reversal_of"}),
        )
        if hasattr(data, "reversal_of") and data.reversal_of:
            invoice.reversal_of = data.reversal_of

        session.add(invoice)
        await session.flush()

        subtotal = Decimal('0.0')
        lines_data = data.lines
        for idx, line_data in enumerate(lines_data, start=1):
            await self._validate_accounts_and_tax(session, tenant_id, line_data.account_id, line_data.tax_rate_id)
            
            qty = Decimal(str(line_data.quantity))
            price = Decimal(str(line_data.unit_price))
            disc = Decimal(str(line_data.discount_percent))
            
            line_total = qty * price * (Decimal('1.0') - disc / Decimal('100.0'))
            subtotal += line_total
            
            line = InvoiceLine(
                tenant_id=tenant_id,
                invoice_id=invoice.id,
                line_number=idx,
                line_total=line_total,
                **line_data.model_dump()
            )
            session.add(line)
        
        invoice.subtotal = subtotal
        invoice.total = subtotal # Update total tax later on submit
        await session.flush()
        
        # Eager load lines
        await session.refresh(invoice, ["lines"])
        return invoice

    async def update_invoice(self, session: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID, data: Any, updated_by: Optional[uuid.UUID]) -> Invoice:
        invoice = await self.get_invoice(session, tenant_id, invoice_id)
        if invoice.status != "draft":
            raise HTTPException(status_code=403, detail="Invoice is immutable after submission")

        update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
        for key, value in update_data.items():
            setattr(invoice, key, value)
        
        invoice.updated_by = updated_by

        if data.lines is not None:
            # Recreate lines
            for line in invoice.lines:
                await session.delete(line)
            await session.flush()

            subtotal = Decimal('0.0')
            for idx, line_data in enumerate(data.lines, start=1):
                await self._validate_accounts_and_tax(session, tenant_id, line_data.account_id, line_data.tax_rate_id)
                qty = Decimal(str(line_data.quantity))
                price = Decimal(str(line_data.unit_price))
                disc = Decimal(str(line_data.discount_percent))
                line_total = qty * price * (Decimal('1.0') - disc / Decimal('100.0'))
                subtotal += line_total
                
                line = InvoiceLine(
                    tenant_id=tenant_id,
                    invoice_id=invoice.id,
                    line_number=idx,
                    line_total=line_total,
                    **line_data.model_dump()
                )
                session.add(line)
            
            invoice.subtotal = subtotal
            invoice.total = subtotal

        await session.flush()
        await session.refresh(invoice, ["lines"])
        return invoice

    async def submit_invoice(self, session: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID, submitted_by: Optional[uuid.UUID]) -> Invoice:
        invoice = await self.get_invoice(session, tenant_id, invoice_id)
        if invoice.status != "draft":
            raise HTTPException(status_code=422, detail="Only draft invoices can be submitted")
        if not invoice.lines:
            raise HTTPException(status_code=422, detail="Cannot submit an invoice with no lines")

        party = await self._validate_party(session, tenant_id, invoice.party_id, invoice.party_type)

        subtotal = Decimal('0.0')
        total_tax = Decimal('0.0')
        
        journal_lines_create = []

        is_sales = invoice.invoice_type in ("sales", "debit_note") and invoice.party_type == "customer"
        is_purchase = invoice.invoice_type in ("purchase", "credit_note") and invoice.party_type == "vendor"
        
        # Credit Note against Sales is inverse of Sales
        is_credit_note_sales = invoice.invoice_type == "credit_note" and invoice.party_type == "customer"
        is_debit_note_purchase = invoice.invoice_type == "debit_note" and invoice.party_type == "vendor"

        for line in invoice.lines:
            tax_rate = await self._validate_accounts_and_tax(session, tenant_id, line.account_id, line.tax_rate_id)
            tax_amount = Decimal('0.0')
            if tax_rate:
                tax_amount = line.line_total * tax_rate.rate
                line.tax_amount = tax_amount
            
            subtotal += line.line_total
            total_tax += tax_amount
            
            # Sub-account entries
            if is_sales or is_debit_note_purchase:
                # Normal sales: CR Income, CR Tax
                journal_lines_create.append(JournalLineCreate(account_id=line.account_id, debit=Decimal('0'), credit=line.line_total))
                if tax_rate:
                    journal_lines_create.append(JournalLineCreate(account_id=tax_rate.linked_account_id, debit=Decimal('0'), credit=tax_amount))
            elif is_purchase or is_credit_note_sales:
                # Normal purchase: DR Expense, DR Tax
                journal_lines_create.append(JournalLineCreate(account_id=line.account_id, debit=line.line_total, credit=Decimal('0')))
                if tax_rate:
                    journal_lines_create.append(JournalLineCreate(account_id=tax_rate.linked_account_id, debit=tax_amount, credit=Decimal('0')))

        total = subtotal + total_tax
        invoice.subtotal = subtotal
        invoice.total_tax = total_tax
        invoice.total = total
        
        # Party Control Account entry
        if is_sales or is_debit_note_purchase:
            if invoice.party_type == "customer":
                party_account_id = party.receivable_account_id
            else:
                party_account_id = party.payable_account_id
            journal_lines_create.append(JournalLineCreate(account_id=party_account_id, debit=total, credit=Decimal('0')))
        
        elif is_purchase or is_credit_note_sales:
            if invoice.party_type == "vendor":
                party_account_id = party.payable_account_id
            else:
                party_account_id = party.receivable_account_id
            journal_lines_create.append(JournalLineCreate(account_id=party_account_id, debit=Decimal('0'), credit=total))

        # Handle reversals - wait, standard Credit Note is just inverted lines like we did above.
        # But for Journal entry, let's let LedgerService.post_journal handle it
        journal_data = JournalEntryCreate(
            description=f"{invoice.invoice_type.replace('_', ' ').capitalize()} {invoice.invoice_number}",
            posting_date=invoice.invoice_date,
            reference=f"INV-{invoice.invoice_number}",
            lines=journal_lines_create
        )

        journal_entry = await self.ledger_service.post_journal(
            session=session,
            tenant_id=tenant_id,
            data=journal_data,
            created_by=submitted_by
        )

        invoice.journal_entry_id = journal_entry.id
        invoice.status = "submitted"
        invoice.updated_by = submitted_by

        await session.flush()
        await event_bus.publish_event(EventType.INVOICE_SUBMITTED, {"tenant_id": str(tenant_id), "invoice_id": str(invoice.id)})
        
        return invoice

    async def cancel_invoice(self, session: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID, cancelled_by: Optional[uuid.UUID]) -> Invoice:
        invoice = await self.get_invoice(session, tenant_id, invoice_id)
        if invoice.status != "submitted":
            raise HTTPException(status_code=422, detail="Only submitted invoices can be cancelled")
            
        await self.ledger_service.reverse_journal(
            session=session,
            tenant_id=tenant_id,
            entry_id=invoice.journal_entry_id,
            reversal_date=date.today(),
            description=f"Cancellation of invoice {invoice.invoice_number}",
            reversed_by=cancelled_by
        )
        
        invoice.status = "cancelled"
        invoice.updated_by = cancelled_by
        
        await session.flush()
        await event_bus.publish_event(EventType.INVOICE_CANCELLED, {"tenant_id": str(tenant_id), "invoice_id": str(invoice.id)})
        return invoice

    async def create_credit_note(self, session: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID, created_by: Optional[uuid.UUID]) -> Invoice:
        original = await self.get_invoice(session, tenant_id, invoice_id)
        if original.status == "cancelled":
            raise HTTPException(status_code=422, detail="Cannot issue credit note against a cancelled invoice")
        if original.status != "submitted":
            raise HTTPException(status_code=422, detail="Can only issue credit note against submitted invoice")
        if original.invoice_type != "sales":
            raise HTTPException(status_code=422, detail="Credit notes can only be issued against sales invoices")

        # Determine next invoice number
        stmt = select(func.max(Invoice.invoice_number)).where(Invoice.tenant_id == tenant_id)
        max_num = await session.scalar(stmt)
        invoice_number = (max_num or 1000) + 1

        cn = Invoice(
            tenant_id=tenant_id,
            invoice_number=invoice_number,
            invoice_type="credit_note",
            party_id=original.party_id,
            party_type=original.party_type,
            invoice_date=date.today(),
            due_date=date.today(),
            status="draft",
            currency_code=original.currency_code,
            exchange_rate=original.exchange_rate,
            reversal_of=original.id,
            created_by=created_by,
            updated_by=created_by,
        )
        session.add(cn)
        await session.flush()

        for line in original.lines:
            new_line = InvoiceLine(
                tenant_id=tenant_id,
                invoice_id=cn.id,
                line_number=line.line_number,
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                discount_percent=line.discount_percent,
                line_total=line.line_total,
                account_id=line.account_id,
                tax_rate_id=line.tax_rate_id,
            )
            session.add(new_line)

        cn.subtotal = original.subtotal
        cn.total = original.subtotal  # Will compute tax on submit
        await session.flush()
        await session.refresh(cn, ["lines"])
        
        await event_bus.publish_event(EventType.INVOICE_CREDIT_NOTE_ISSUED, {"tenant_id": str(tenant_id), "invoice_id": str(cn.id), "reversal_of": str(original.id)})
        return cn

    async def create_debit_note(self, session: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID, created_by: Optional[uuid.UUID]) -> Invoice:
        original = await self.get_invoice(session, tenant_id, invoice_id)
        if original.status == "cancelled":
            raise HTTPException(status_code=422, detail="Cannot issue debit note against a cancelled invoice")
        if original.status != "submitted":
            raise HTTPException(status_code=422, detail="Can only issue debit note against submitted invoice")
        if original.invoice_type != "purchase":
            raise HTTPException(status_code=422, detail="Debit notes can only be issued against purchase invoices")

        stmt = select(func.max(Invoice.invoice_number)).where(Invoice.tenant_id == tenant_id)
        max_num = await session.scalar(stmt)
        invoice_number = (max_num or 1000) + 1

        dn = Invoice(
            tenant_id=tenant_id,
            invoice_number=invoice_number,
            invoice_type="debit_note",
            party_id=original.party_id,
            party_type=original.party_type,
            invoice_date=date.today(),
            due_date=date.today(),
            status="draft",
            currency_code=original.currency_code,
            exchange_rate=original.exchange_rate,
            reversal_of=original.id,
            created_by=created_by,
            updated_by=created_by,
        )
        session.add(dn)
        await session.flush()

        for line in original.lines:
            new_line = InvoiceLine(
                tenant_id=tenant_id,
                invoice_id=dn.id,
                line_number=line.line_number,
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                discount_percent=line.discount_percent,
                line_total=line.line_total,
                account_id=line.account_id,
                tax_rate_id=line.tax_rate_id,
            )
            session.add(new_line)

        dn.subtotal = original.subtotal
        dn.total = original.subtotal
        await session.flush()
        await session.refresh(dn, ["lines"])
        return dn

class AgingService:
    """Service to generate AR/AP aging reports."""
    
    async def ar_aging(self, session: AsyncSession, tenant_id: uuid.UUID, as_of: date) -> dict[str, Any]:
        stmt = select(
            Invoice.party_id,
            Customer.legal_name,
            Customer.gstin,
            func.sum(Invoice.total).label('total'),
            Invoice.due_date
        ).join(
            Customer, Invoice.party_id == Customer.id
        ).where(
            Invoice.tenant_id == tenant_id,
            Invoice.invoice_type == 'sales',
            Invoice.status == 'submitted',
            Invoice.invoice_date <= as_of
        ).group_by(
            Invoice.party_id, Customer.legal_name, Customer.gstin, Invoice.due_date
        )
        
        result = await session.execute(stmt)
        rows = result.all()
        
        aging_by_party = {}
        for r in rows:
            party_id = r.party_id
            if party_id not in aging_by_party:
                aging_by_party[party_id] = {
                    "party_id": party_id,
                    "party_name": r.legal_name,
                    "gstin": r.gstin,
                    "buckets": {
                        "current": Decimal('0'),
                        "days_1_30": Decimal('0'),
                        "days_31_60": Decimal('0'),
                        "days_61_90": Decimal('0'),
                        "days_91_plus": Decimal('0'),
                        "total": Decimal('0')
                    }
                }
            
            days_overdue = (as_of - r.due_date).days
            total = r.total
            
            buckets = aging_by_party[party_id]['buckets']
            buckets['total'] += total
            
            if days_overdue <= 0:
                buckets['current'] += total
            elif 1 <= days_overdue <= 30:
                buckets['days_1_30'] += total
            elif 31 <= days_overdue <= 60:
                buckets['days_31_60'] += total
            elif 61 <= days_overdue <= 90:
                buckets['days_61_90'] += total
            else:
                buckets['days_91_plus'] += total
                
        # Calculate totals
        totals = {
            "current": Decimal('0'),
            "days_1_30": Decimal('0'),
            "days_31_60": Decimal('0'),
            "days_61_90": Decimal('0'),
            "days_91_plus": Decimal('0'),
            "total": Decimal('0')
        }
        for party in aging_by_party.values():
            for k in totals:
                totals[k] += party['buckets'][k]
                
        return {
            "as_of": as_of,
            "rows": list(aging_by_party.values()),
            "totals": totals
        }

    async def ap_aging(self, session: AsyncSession, tenant_id: uuid.UUID, as_of: date) -> dict[str, Any]:
        stmt = select(
            Invoice.party_id,
            Vendor.legal_name,
            Vendor.gstin,
            func.sum(Invoice.total).label('total'),
            Invoice.due_date
        ).join(
            Vendor, Invoice.party_id == Vendor.id
        ).where(
            Invoice.tenant_id == tenant_id,
            Invoice.invoice_type == 'purchase',
            Invoice.status == 'submitted',
            Invoice.invoice_date <= as_of
        ).group_by(
            Invoice.party_id, Vendor.legal_name, Vendor.gstin, Invoice.due_date
        )
        
        result = await session.execute(stmt)
        rows = result.all()
        
        aging_by_party = {}
        for r in rows:
            party_id = r.party_id
            if party_id not in aging_by_party:
                aging_by_party[party_id] = {
                    "party_id": party_id,
                    "party_name": r.legal_name,
                    "gstin": r.gstin,
                    "buckets": {
                        "current": Decimal('0'),
                        "days_1_30": Decimal('0'),
                        "days_31_60": Decimal('0'),
                        "days_61_90": Decimal('0'),
                        "days_91_plus": Decimal('0'),
                        "total": Decimal('0')
                    }
                }
            
            days_overdue = (as_of - r.due_date).days
            total = r.total
            
            buckets = aging_by_party[party_id]['buckets']
            buckets['total'] += total
            
            if days_overdue <= 0:
                buckets['current'] += total
            elif 1 <= days_overdue <= 30:
                buckets['days_1_30'] += total
            elif 31 <= days_overdue <= 60:
                buckets['days_31_60'] += total
            elif 61 <= days_overdue <= 90:
                buckets['days_61_90'] += total
            else:
                buckets['days_91_plus'] += total
                
        totals = {
            "current": Decimal('0'),
            "days_1_30": Decimal('0'),
            "days_31_60": Decimal('0'),
            "days_61_90": Decimal('0'),
            "days_91_plus": Decimal('0'),
            "total": Decimal('0')
        }
        for party in aging_by_party.values():
            for k in totals:
                totals[k] += party['buckets'][k]
                
        return {
            "as_of": as_of,
            "rows": list(aging_by_party.values()),
            "totals": totals
        }
