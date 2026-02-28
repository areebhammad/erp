## Context

The `add-finance-module` change established the accounting core: double-entry ledger, Chart
of Accounts, Fiscal Year management, and `LedgerService`. This design document covers the
engineering decisions for the **invoice module** — the first module that actually *uses* the
ledger engine by calling `LedgerService.post_journal()` to produce real financial impact.

The invoice module introduces two new concepts beyond pure accounting: **Parties** (Customers
and Vendors as first-class business entities) and **transactional documents** (Invoices that
carry commercial terms and produce ledger postings on submission).

## Goals / Non-Goals

**Goals:**
- Sales Invoice and Purchase Invoice full lifecycle: draft → submitted → (cancelled)
- Credit Note and Debit Note as corrections to submitted invoices
- Customer and Vendor master data (party management)
- Automatic ledger posting on invoice submission via `LedgerService.post_journal()`
- Ledger reversal on cancellation via `LedgerService.reverse_journal()`
- GST tax line computation using configured `tax_rates` from the finance module
- AR Aging and AP Aging reports
- PDF generation for Sales Invoices (via WeasyPrint — server-side, no JS renderer)
- 90%+ test coverage on InvoiceService and PartyService (accounting critical path)

**Non-Goals (deferred):**
- Payment Entry / Payment Request (→ `add-payments-module`)
- Bank Reconciliation (→ `add-bank-reconciliation-module`)
- GSTIN network verification against GSTN portal (→ `add-gst-compliance-module`)
- GSTR-1 / GSTR-3B return filing (→ `add-gst-compliance-module`)
- E-Invoice / IRP signing (→ `add-gst-compliance-module`)
- E-Way Bill (→ `add-gst-compliance-module`)
- TDS deduction on invoices (→ `add-gst-compliance-module`)
- Multi-currency conversion / exchange gain-loss (→ future multi-currency module)
- POS invoices (→ `add-pos-module`)
- Deferred revenue / revenue recognition schedules (→ future)
- Customer portal / external invoice sharing (→ future)

## Decisions

### Decision 1: Unified `invoices` table with `invoice_type` discriminator

**Choice:** A single `invoices` table with a `invoice_type` enum column
(`sales` | `purchase` | `credit_note` | `debit_note`).

**Rationale:** Sales invoices and purchase invoices share 90% of their schema
(party, date, due date, lines, status, journal link). A discriminator column keeps
queries simple and avoids table proliferation. The ledger posting logic differs
by type but is handled in a single `InvoiceService.submit()` method via branching.

**Alternatives considered:**
- Separate `sales_invoices` and `purchase_invoices` tables: Doubles migration
  surface and schema maintenance with marginal query simplification.
- SQLAlchemy joined-table inheritance: Adds complexity (extra JOIN on every query)
  without clear benefit at this scale.

### Decision 2: Parties as a shared `customers` / `vendors` split (not a unified `parties` table)

**Choice:** Separate `customers` and `vendors` tables. A party can be both simultaneously
(a company that is both a customer and a vendor has one row in each table).

**Rationale:** In Indian accounting practice, AR and AP payable accounts are always separate,
and GSTIN / payment terms can differ per relationship direction. A unified `parties` table
with `party_type` would require nullable columns (e.g., `receivable_account_id` is N/A for
pure vendors). Keeping them separate gives clean schemas and simpler service code.

**Alternatives considered:**
- Single `parties` table with `party_type` enum: Cleaner for "contact" management but
  creates optional column groups — bad for accounting clarity.

### Decision 3: Immutable submitted invoices — cancellation via dedicated endpoint

**Choice:** Once `status = submitted`, an invoice CANNOT be edited via `PATCH`. The only
mutations allowed are via `POST /invoices/{id}/cancel` and
`POST /invoices/{id}/credit-note`. This mirrors the finance module's immutability
pattern for journal entries.

**Rationale:** Accounting immutability is a regulatory requirement in India (Finance Act).
Editing an already-posted invoice would silently create an inconsistency between the
invoice document and its linked journal entry.

### Decision 4: PDF generation via WeasyPrint (server-side Python)

**Choice:** `GET /invoices/{id}/pdf` renders an HTML Jinja2 template and converts it
to PDF using WeasyPrint. The PDF is streamed as a response, not stored by default.

**Rationale:** WeasyPrint is pure Python, runs in the same FastAPI process, requires no
extra service, and supports the CSS needed for professional invoice layouts. Storing PDFs
in SeaweedFS is deferred to a future "document storage" proposal.

**Alternatives considered:**
- Puppeteer / headless Chrome: Requires Node.js sidecar — not acceptable in a Python monolith.
- ReportLab: Code-driven PDF, not template-based — harder to customise by future designers.
- External service (e.g., PDFShift): External dependency, cost, data privacy concern.

### Decision 5: Tax computation at submission time (not at draft save)

**Choice:** Tax amounts (`tax_amount` per line) are computed and stored at
`POST /invoices/{id}/submit`, not when the draft is saved. Drafts store `unit_price`,
`quantity`, and the `tax_rate_id` reference. The final computed amounts are frozen at
submission alongside the journal entry creation.

**Rationale:** Tax rates can change between draft creation and submission. Freezing the
amounts at submission ensures the journal entry and the invoice document are always in sync.

### Decision 6: AR/AP Aging as a service-layer query (same pattern as Trial Balance)

**Choice:** `InvoiceService.ar_aging(tenant_id, as_of_date)` runs a single SQL query
grouping overdue invoices into buckets: Current, 1–30 days, 31–60 days, 61–90 days, 90+
days. No materialized view.

**Rationale:** Consistent with `TrialBalanceService` design decision. Simple queries on
indexed columns (`due_date`, `status`, `party_id`) are fast enough for the expected data
volumes.

## Data Model

```
customers
  id, tenant_id, legal_name, display_name, gstin, pan
  billing_address (JSONB), shipping_address (JSONB)
  currency_code, payment_terms_days, receivable_account_id (FK accounts)
  is_active, created_at, updated_at

vendors
  id, tenant_id, legal_name, display_name, gstin, pan
  billing_address (JSONB), shipping_address (JSONB)
  currency_code, payment_terms_days, payable_account_id (FK accounts)
  is_active, created_at, updated_at

invoices
  id, tenant_id, invoice_number (int, scoped per tenant), invoice_type
  party_id (UUID), party_type (customer | vendor)
  invoice_date, due_date, status (draft | submitted | cancelled)
  currency_code, exchange_rate (default 1.0)
  subtotal (Numeric 18,4), total_tax (Numeric 18,4), total (Numeric 18,4)
  journal_entry_id (FK journal_entries, nullable, set on submit)
  reversal_of (FK invoices, nullable — for credit/debit notes)
  notes (Text), terms (Text)
  created_at, updated_at, created_by, updated_by

invoice_lines
  id, tenant_id, invoice_id (FK), line_number (int, order)
  description, quantity (Numeric 12,4), unit_price (Numeric 18,4)
  discount_percent (Numeric 5,2, default 0)
  line_total (Numeric 18,4)  ← stored on save, qty * price * (1 - disc/100)
  account_id (FK accounts)   ← income / expense account for this line
  tax_rate_id (FK tax_rates, nullable)
  tax_amount (Numeric 18,4, default 0)  ← computed & frozen at submit
  created_at
```

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Tax rate changes between draft save and submit | Tax amounts computed & frozen at submit only |
| WeasyPrint dependency adds ~20MB to Docker image | Acceptable — already a known Python PDF solution; can be moved to async job if latency matters |
| `invoice_number` sequence gaps on draft deletion | Use DB sequence per tenant; gaps are acceptable (not a legal requirement in India for drafts) |
| AR/AP aging slow with millions of invoices | Index on `(tenant_id, status, due_date)`; cursor pagination on aging endpoint |
| Credit note linked to cancelled invoice | Service validates original invoice is `submitted` before allowing credit note creation |

## Migration Plan

1. New Alembic migration creates `customers`, `vendors`, `invoices`, `invoice_lines` tables.
2. No data migration — all new tables.
3. Tenant provisioning: no changes needed. Customers and Vendors are created by users, not seeded.

## Open Questions

- None currently blocking. All major decisions are made above.
