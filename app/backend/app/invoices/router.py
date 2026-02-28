import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import (
    get_async_session,
    get_current_active_user,
    get_tenant_id,
)
from app.finance.services import LedgerService, FiscalYearService
from app.invoices.schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceSummary,
    AgingReport,
)
from app.invoices.services import PartyService, InvoiceService, AgingService
from app.core.exceptions import PermissionDeniedError
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

party_service = PartyService()

# Need to instantiate the services
def get_invoice_service() -> InvoiceService:
    fiscal_year_service = FiscalYearService()
    ledger_service = LedgerService(fiscal_year_service=fiscal_year_service)
    return InvoiceService(ledger_service=ledger_service)


aging_service = AgingService()


# --- Customers ---
@router.post("/customers", response_model=CustomerResponse, status_code=201)
async def create_customer(
    data: CustomerCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    return await party_service.create_customer(session, tenant_id, data)


@router.get("/customers", response_model=list[CustomerResponse])
async def list_customers(
    active_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    customers, _ = await party_service.list_customers(
        session, tenant_id, active_only=active_only, skip=skip, limit=limit
    )
    return customers


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    return await party_service.get_customer(session, tenant_id, customer_id)


@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: uuid.UUID,
    data: CustomerUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    return await party_service.update_customer(session, tenant_id, customer_id, data)


@router.delete("/customers/{customer_id}", status_code=204)
async def deactivate_customer(
    customer_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    await party_service.deactivate_customer(session, tenant_id, customer_id)


# --- Vendors ---
@router.post("/vendors", response_model=VendorResponse, status_code=201)
async def create_vendor(
    data: VendorCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    return await party_service.create_vendor(session, tenant_id, data)


@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(
    active_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    vendors, _ = await party_service.list_vendors(
        session, tenant_id, active_only=active_only, skip=skip, limit=limit
    )
    return vendors


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    return await party_service.get_vendor(session, tenant_id, vendor_id)


@router.patch("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: uuid.UUID,
    data: VendorUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    return await party_service.update_vendor(session, tenant_id, vendor_id, data)


@router.delete("/vendors/{vendor_id}", status_code=204)
async def deactivate_vendor(
    vendor_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    await party_service.deactivate_vendor(session, tenant_id, vendor_id)


# --- Invoices ---
@router.post("/invoices", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    return await invoice_service.create_invoice(
        session, tenant_id, data, created_by=current_user.id
    )


@router.get("/invoices", response_model=list[InvoiceSummary])
async def list_invoices(
    invoice_type: Optional[str] = None,
    party_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    invoices, _ = await invoice_service.list_invoices(
        session, tenant_id, invoice_type, party_id, status, skip, limit
    )
    return invoices


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    return await invoice_service.get_invoice(session, tenant_id, invoice_id)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    return await invoice_service.update_invoice(
        session, tenant_id, invoice_id, data, updated_by=current_user.id
    )


@router.post("/invoices/{invoice_id}/submit", response_model=InvoiceResponse)
async def submit_invoice(
    invoice_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    return await invoice_service.submit_invoice(
        session, tenant_id, invoice_id, submitted_by=current_user.id
    )


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    return await invoice_service.cancel_invoice(
        session, tenant_id, invoice_id, cancelled_by=current_user.id
    )


@router.post("/invoices/{invoice_id}/credit-note", response_model=InvoiceResponse)
async def create_credit_note(
    invoice_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    return await invoice_service.create_credit_note(
        session, tenant_id, invoice_id, created_by=current_user.id
    )


@router.post("/invoices/{invoice_id}/debit-note", response_model=InvoiceResponse)
async def create_debit_note(
    invoice_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    return await invoice_service.create_debit_note(
        session, tenant_id, invoice_id, created_by=current_user.id
    )


@router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    # This will be implemented in the next step
    from app.invoices.pdf import render_invoice_pdf
    
    # We might need the tenant info. The dependencies just give tenant_id. 
    # For now, pass a dummy name or fetch it.
    from app.models.tenant import Tenant
    from sqlalchemy import select
    tenant = (await session.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one()

    invoice = await invoice_service.get_invoice(session, tenant_id, invoice_id)
    if invoice.status == "draft":
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="PDF is only available for submitted invoices")
    
    pdf_bytes = render_invoice_pdf(invoice, tenant.name)
    return Response(content=pdf_bytes, media_type="application/pdf")


# --- Reports ---
@router.get("/reports/ar-aging", response_model=AgingReport)
async def ar_aging_report(
    as_of: Optional[date] = None,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    as_of = as_of or date.today()
    return await aging_service.ar_aging(session, tenant_id, as_of)


@router.get("/reports/ap-aging", response_model=AgingReport)
async def ap_aging_report(
    as_of: Optional[date] = None,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
):
    as_of = as_of or date.today()
    return await aging_service.ap_aging(session, tenant_id, as_of)
