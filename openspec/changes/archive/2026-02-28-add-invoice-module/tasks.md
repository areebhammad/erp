# Tasks: add-invoice-module

> **Dependencies:** `add-finance-module` (archived). Requires `LedgerService`,
> `FiscalYearService`, `Account`, `TaxRate` models from `app/finance/`.

---

## 1. Database Schema & Migration

- [x] 1.1 Create `customers` table SQLAlchemy model in `app/backend/app/invoices/models.py`
  Fields: `legal_name`, `display_name`, `gstin` (nullable), `pan` (nullable),
  `billing_address` (JSONB), `shipping_address` (JSONB, nullable), `currency_code`,
  `payment_terms_days`, `receivable_account_id` (FK `accounts.id`), `is_active`
  Indexes: `(tenant_id, gstin)`, `(tenant_id, is_active)`

- [x] 1.2 Create `vendors` table SQLAlchemy model in same file
  Fields: mirrors `customers` but with `payable_account_id` instead of `receivable_account_id`
  Indexes: `(tenant_id, gstin)`, `(tenant_id, is_active)`

- [x] 1.3 Create `invoices` table SQLAlchemy model
  Fields: `invoice_number` (int), `invoice_type` (String 20: `sales|purchase|credit_note|debit_note`),
  `party_id` (UUID, not FK — polymorphic ref), `party_type` (String 20: `customer|vendor`),
  `invoice_date` (Date), `due_date` (Date), `status` (String 20: `draft|submitted|cancelled`),
  `currency_code` (String 3), `exchange_rate` (Numeric 12,6 default 1),
  `subtotal` (Numeric 18,4), `total_tax` (Numeric 18,4), `total` (Numeric 18,4),
  `journal_entry_id` (FK `journal_entries.id`, nullable, SET NULL),
  `reversal_of` (FK `invoices.id`, nullable, SET NULL),
  `notes` (Text, nullable), `terms` (Text, nullable)
  Indexes: `(tenant_id, invoice_date)`, `(tenant_id, status, due_date)`,
  `(tenant_id, party_id, party_type)`
  UniqueConstraint: `(tenant_id, invoice_number)`

- [x] 1.4 Create `invoice_lines` table SQLAlchemy model
  Fields: `invoice_id` (FK `invoices.id`, CASCADE), `line_number` (int),
  `description` (Text), `quantity` (Numeric 12,4), `unit_price` (Numeric 18,4),
  `discount_percent` (Numeric 5,2 default 0), `line_total` (Numeric 18,4),
  `account_id` (FK `accounts.id`, RESTRICT), `tax_rate_id` (FK `tax_rates.id`, nullable),
  `tax_amount` (Numeric 18,4 default 0)
  Indexes: `(invoice_id)`, `(tenant_id, account_id)`

- [x] 1.5 Register all four models in `app/backend/app/models/__init__.py`

- [x] 1.6 Generate Alembic migration: `alembic revision --autogenerate -m "add_invoice_module"`
  Verify the migration creates all tables, FK constraints, and indexes correctly

- [x] 1.7 Run the migration against the local dev database: `alembic upgrade head`
  Confirm no errors and all tables exist via `psql` or SQLAlchemy introspection

---

## 2. Pydantic Schemas

- [x] 2.1 Create `app/backend/app/invoices/schemas.py`

  **Customer schemas:**
  - `CustomerCreate`: `legal_name` (required), `display_name`, `gstin` (optional, regex-validated),
    `pan` (optional, regex-validated), `billing_address` (dict), `shipping_address` (optional dict),
    `currency_code` (default `INR`), `payment_terms_days` (default 30),
    `receivable_account_id` (UUID)
  - `CustomerUpdate`: all fields optional; at least one required (validator)
  - `CustomerResponse`: all fields + `id`, `tenant_id`, `is_active`, `created_at`

  **Vendor schemas:** mirror Customer with `payable_account_id` instead

  **Invoice line schemas:**
  - `InvoiceLineCreate`: `description`, `quantity` (>0), `unit_price` (≥0),
    `discount_percent` (0–100, default 0), `account_id` (UUID), `tax_rate_id` (optional UUID)
  - `InvoiceLineResponse`: + `line_number`, `line_total`, `tax_amount`, `id`

  **Invoice schemas:**
  - `InvoiceCreate`: `invoice_type`, `party_id` (UUID), `party_type`, `invoice_date`,
    `due_date` (must be ≥ `invoice_date`), `currency_code` (default `INR`),
    `lines` (list[InvoiceLineCreate], min length 1), `notes`, `terms`
  - `InvoiceUpdate`: `invoice_date`, `due_date`, `notes`, `terms`, `lines` — all optional
    (update replaces full lines list if provided)
  - `InvoiceResponse`: full header + nested `lines: list[InvoiceLineResponse]`,
    `journal_entry_id`, `reversal_of`
  - `InvoiceSummary`: header only, no lines (for list endpoints)

  **AR/AP Aging schemas:**
  - `AgingBucket`: `current`, `days_1_30`, `days_31_60`, `days_61_90`, `days_91_plus`, `total`
  - `AgingRow`: `party_id`, `party_name`, `gstin`, buckets
  - `AgingReport`: `as_of`, `rows: list[AgingRow]`, `totals: AgingBucket`

---

## 3. Service Layer

- [x] 3.1 Create `app/backend/app/invoices/__init__.py` (empty, marks package)

- [x] 3.2 Create `app/backend/app/invoices/services.py` — `PartyService`
  - `create_customer(session, tenant_id, data)` → validates `receivable_account_id` is a
    leaf account of type `asset`, persists Customer, returns CustomerResponse
  - `list_customers(session, tenant_id, active_only=True, skip, limit)` → paginated list
  - `get_customer(session, tenant_id, customer_id)` → or raise 404
  - `update_customer(session, tenant_id, customer_id, data)` → patch fields
  - `deactivate_customer(session, tenant_id, customer_id)` → set `is_active=False`
  - Mirror all five methods for Vendor (`payable_account_id` must be `liability` type)

- [x] 3.3 Create `InvoiceService` in same file

  **`create_invoice(session, tenant_id, data, created_by)` → InvoiceResponse**
  - Validates party exists and is active
  - Validates all `account_id` references are leaf accounts
  - Validates all `tax_rate_id` references are active tax rates
  - Computes `line_total` per line: `quantity * unit_price * (1 - discount_percent / 100)`
  - Saves invoice with `status=draft` and auto-assigned `invoice_number`
    (use `SELECT MAX(invoice_number) + 1` scoped per tenant, default 1001)
  - Saves line items with `line_number` assigned sequentially

  **`update_invoice(session, tenant_id, invoice_id, data, updated_by)` → InvoiceResponse**
  - Raises 403 if `status != draft`
  - Replaces lines if `data.lines` is provided (delete existing, re-insert)
  - Recomputes line totals

  **`submit_invoice(session, tenant_id, invoice_id, submitted_by)` → InvoiceResponse**
  - Raises 422 if `status != draft`
  - For each line with `tax_rate_id`: computes `tax_amount = line_total * tax_rate.rate`
  - Computes `subtotal = sum(line_total)`, `total_tax = sum(tax_amount)`, `total = subtotal + total_tax`
  - Calls `LedgerService.post_journal()` with correct debit/credit lines (see design.md)
  - Sets `journal_entry_id` and `status=submitted`, commits
  - Publishes `invoice.submitted` event

  **`cancel_invoice(session, tenant_id, invoice_id, cancelled_by)` → InvoiceResponse**
  - Raises 422 if `status != submitted`
  - Calls `LedgerService.reverse_journal(entry_id, reversal_date=today, ...)`
  - Sets `status=cancelled`, commits
  - Publishes `invoice.cancelled` event

  **`create_credit_note(session, tenant_id, invoice_id, data, created_by)` → InvoiceResponse**
  - Validates source invoice is `submitted` and `invoice_type=sales`
  - Creates a new draft invoice with `invoice_type=credit_note`, `reversal_of=invoice_id`,
    copies lines from original
  - Returns the new draft (user calls `submit` on it next)

  **`create_debit_note(...)` → InvoiceResponse** — mirror for purchase invoices

  **`get_invoice(session, tenant_id, invoice_id)` → InvoiceResponse** or 404

  **`list_invoices(session, tenant_id, invoice_type, party_id, status, skip, limit)` → list[InvoiceSummary]**

- [x] 3.4 Create `AgingService` in same file
  - `ar_aging(session, tenant_id, as_of: date)` → AgingReport
    Query: `SELECT party_id, SUM(total), due_date FROM invoices WHERE tenant_id=... AND invoice_type='sales' AND status='submitted' GROUP BY party_id, due_date` then bucket by `(as_of - due_date).days`
  - `ap_aging(session, tenant_id, as_of: date)` → AgingReport — mirrors AR for purchase invoices

---

## 4. API Router

- [x] 4.1 Create `app/backend/app/invoices/router.py`

  **Customer endpoints:**
  - `POST /api/v1/invoices/customers` → `PartyService.create_customer`
  - `GET /api/v1/invoices/customers` → paginated list (query params: `active_only`, `skip`, `limit`)
  - `GET /api/v1/invoices/customers/{id}` → single customer
  - `PATCH /api/v1/invoices/customers/{id}` → update
  - `DELETE /api/v1/invoices/customers/{id}` → deactivate (soft delete)

  **Vendor endpoints:** mirror customer endpoints at `/api/v1/invoices/vendors/`

  **Invoice endpoints:**
  - `POST /api/v1/invoices/invoices` → create draft
  - `GET /api/v1/invoices/invoices` → list (filters: `invoice_type`, `party_id`, `status`)
  - `GET /api/v1/invoices/invoices/{id}` → single invoice with lines
  - `PATCH /api/v1/invoices/invoices/{id}` → update draft
  - `POST /api/v1/invoices/invoices/{id}/submit` → submit
  - `POST /api/v1/invoices/invoices/{id}/cancel` → cancel
  - `POST /api/v1/invoices/invoices/{id}/credit-note` → create credit note draft
  - `POST /api/v1/invoices/invoices/{id}/debit-note` → create debit note draft
  - `GET /api/v1/invoices/invoices/{id}/pdf` → stream PDF

  **Report endpoints:**
  - `GET /api/v1/invoices/reports/ar-aging` → AR aging (query: `as_of`)
  - `GET /api/v1/invoices/reports/ap-aging` → AP aging (query: `as_of`)

- [x] 4.2 Register invoices router in `app/backend/app/api/v1/__init__.py`
  ```python
  from app.invoices.router import router as invoice_router
  api_router.include_router(invoice_router, prefix="/invoices", tags=["Invoices"])
  ```

---

## 5. Constants & Events

- [x] 5.1 Add to `app/backend/app/core/constants.py`:
  - `ResourceType.CUSTOMERS = "customers"`
  - `ResourceType.VENDORS = "vendors"`
  - `ResourceType.INVOICES = "invoices"`
  - `EventType.INVOICE_SUBMITTED = "invoice.submitted"`
  - `EventType.INVOICE_CANCELLED = "invoice.cancelled"`
  - `EventType.INVOICE_CREDIT_NOTE_ISSUED = "invoice.credit_note_issued"`

---

## 6. PDF Generation

- [x] 6.1 Add `weasyprint` to `app/backend/requirements.txt` (or `pyproject.toml`)

- [x] 6.2 Create `app/backend/app/invoices/pdf.py`
  - `render_invoice_pdf(invoice: InvoiceResponse, tenant_name: str) → bytes`
  - Uses a Jinja2 template (`app/invoices/templates/invoice.html`) to render HTML
  - Converts HTML to PDF via `weasyprint.HTML(string=html_str).write_pdf()`

- [x] 6.3 Create `app/backend/app/invoices/templates/invoice.html`
  - Professional GST invoice layout (letter size)
  - Sections: header (tenant info, logo placeholder), customer info, invoice meta,
    line items table, GST summary (CGST/SGST/IGST rows), totals, terms

- [x] 6.4 Wire PDF endpoint in router: stream `bytes` response as `application/pdf`

---

## 7. Tests

- [x] 7.1 Create `app/backend/tests/invoices/__init__.py`

- [x] 7.2 Create `app/backend/tests/invoices/test_party_service.py`
  - Test customer create with valid GSTIN
  - Test customer create with invalid GSTIN (expect 422)
  - Test customer deactivation
  - Test cross-tenant isolation (Customer A not visible to Tenant B)
  - Mirror all for Vendor

- [x] 7.3 Create `app/backend/tests/invoices/test_invoice_service.py`
  - Test draft creation: invoice and all lines persisted, no journal entry
  - Test draft update: lines replaced, totals recomputed
  - Test submit (sales): journal entry created via LedgerService mock,
    correct debit on AR account, correct credits on income + tax accounts
  - Test submit (purchase): journal entry inverse shape
  - Test submit prevents posting to closed fiscal year
  - Test cancel: `LedgerService.reverse_journal` called, status=cancelled
  - Test edit of submitted invoice returns 403
  - Test credit note creation: new invoice with `reversal_of` set, status=draft
  - Test credit note on cancelled invoice returns 422

- [x] 7.4 Create `app/backend/tests/invoices/test_aging_service.py`
  - Test AR aging with invoices in multiple buckets
  - Test AP aging as-of historical date
  - Test aging totals balance: `sum(all_buckets) == total column`

- [x] 7.5 Create `app/backend/tests/invoices/test_router.py` (integration tests via `TestClient`)
  - Test full Sales Invoice create → submit → PDF flow (end-to-end)
  - Test authentication required on all endpoints
  - Test tenant isolation on list endpoints

- [x] 7.6 Run tests and confirm ≥ 90% coverage on `app/invoices/services.py`:
  `pytest app/backend/tests/invoices/ --cov=app/backend/app/invoices --cov-report=term-missing`

---

## 8. Validation

- [x] 8.1 Run `openspec validate add-invoice-module --strict` and resolve any issues

- [x] 8.2 Confirm all API endpoints are reachable in dev:
  - `POST /api/v1/invoices/customers` → 201
  - `POST /api/v1/invoices/invoices` → 201
  - `POST /api/v1/invoices/invoices/{id}/submit` → 200 with `status=submitted`
  - `GET /api/v1/invoices/reports/ar-aging` → 200 with aging data
  - `GET /api/v1/invoices/invoices/{id}/pdf` → 200 binary PDF

- [x] 8.3 Verify Alembic migrations apply cleanly on a fresh database:
  `alembic downgrade base && alembic upgrade head`

- [x] 8.4 Run full test suite and confirm no regressions in `tests/finance/`:
  `pytest app/backend/tests/ --tb=short`
