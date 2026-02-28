# Change: Add Invoice Module

## Why

The Finance Module (`add-finance-module`, now archived) established the double-entry ledger
engine, Chart of Accounts, and fiscal year management. The next logical step is Accounts
Receivable and Accounts Payable: the ability to raise **Sales Invoices** to customers,
record **Purchase Invoices** from vendors, and issue **Credit Notes / Debit Notes** as
corrections. Without invoicing, no revenue or expense ever flows through the ledger — the
CoA and journal engine exist but produce no business value.

This proposal introduces a self-contained `app/backend/app/invoices/` module that posts
every invoice transaction to the ledger via `LedgerService.post_journal()`, exactly as
designed in the finance module architecture.

## What Changes

- **NEW:** `app/backend/app/invoices/` — self-contained invoice module package with models,
  schemas, services, and API router following the same structure as `app/finance/`.
- **NEW:** `customers` table — party record for companies that are billed (B2B and B2C).
  Fields: `legal_name`, `display_name`, `gstin`, `pan`, `billing_address`, `shipping_address`,
  `currency_code`, `payment_terms_days`, `receivable_account_id` (FK to `accounts`),
  `is_active`.
- **NEW:** `vendors` table — party record for companies from which goods/services are
  purchased. Fields: same shape as customers, plus `payable_account_id` (FK to `accounts`).
- **NEW:** `invoices` table — Sales Invoice header. Fields: `invoice_number` (tenant-scoped
  auto-sequence), `invoice_type` (`sales` | `purchase` | `credit_note` | `debit_note`),
  `party_id` (customer or vendor UUID), `party_type` (`customer` | `vendor`),
  `invoice_date`, `due_date`, `status` (`draft` | `submitted` | `cancelled`),
  `currency_code`, `exchange_rate`, `journal_entry_id` (FK set on submission),
  `reversal_of` (FK for credit/debit notes), `notes`, `terms`.
- **NEW:** `invoice_lines` table — Line items. Fields: `invoice_id`, `description`,
  `quantity`, `unit_price`, `discount_percent`, `line_total` (computed: qty * price * (1 - discount)),
  `tax_rate_id` (FK to `tax_rates`), `tax_amount`, `account_id` (income/expense account, FK).
- **NEW:** `InvoiceService` — core service that:
  - Creates draft invoices with line items
  - Submits invoices: validates data, computes totals + tax, calls `LedgerService.post_journal()`
    to record the accounting entries, transitions status to `submitted`
  - Cancels invoices: calls `LedgerService.reverse_journal()` on the linked entry, transitions
    status to `cancelled`
  - Creates Credit Notes / Debit Notes as reversal invoices
- **NEW:** `PartyService` — CRUD for Customers and Vendors, including GSTIN validation (format
  check only in this proposal — network verification is deferred to `add-gst-compliance-module`).
- **NEW:** API endpoints under `/api/v1/invoices/`:
  - Customer CRUD: `GET /customers`, `POST /customers`, `GET /customers/{id}`,
    `PATCH /customers/{id}`, `DELETE /customers/{id}`
  - Vendor CRUD: `GET /vendors`, `POST /vendors`, `GET /vendors/{id}`,
    `PATCH /vendors/{id}`, `DELETE /vendors/{id}`
  - Invoice CRUD + lifecycle: `POST /invoices`, `GET /invoices`, `GET /invoices/{id}`,
    `PATCH /invoices/{id}` (draft only), `POST /invoices/{id}/submit`,
    `POST /invoices/{id}/cancel`, `POST /invoices/{id}/credit-note`,
    `GET /invoices/{id}/pdf` (HTML-to-PDF via WeasyPrint)
  - AR/AP Aging report: `GET /reports/ar-aging`, `GET /reports/ap-aging`
- **MODIFIED:** `app/backend/app/core/constants.py` — add `ResourceType` values
  (`CUSTOMERS`, `VENDORS`, `INVOICES`) and `EventType` values
  (`invoice.submitted`, `invoice.cancelled`, `invoice.credit_note_issued`).
- **MODIFIED:** `finance-module` spec — add requirement documenting the ledger postings
  made by the invoice module (which accounts are debited/credited for each invoice type).

## Accounting Model

### Sales Invoice (submitted)
```
DR  Accounts Receivable (customer's receivable_account)   ← total_with_tax
CR  Sales Revenue (line's account_id)                     ← line_total per line
CR  Output Tax Payable – CGST/SGST/IGST                  ← tax_amount per tax line
```

### Purchase Invoice (submitted)
```
DR  Expense / Asset account (line's account_id)           ← line_total per line
DR  Input Tax Credit – CGST/SGST/IGST                    ← tax_amount per tax line
CR  Accounts Payable (vendor's payable_account)           ← total_with_tax
```

### Credit Note (issued against Sales Invoice)
```
Reversal of original Sales Invoice journal entry via LedgerService.reverse_journal()
```

## Impact

- **Affected specs (new):**
  - `invoice-module` — Sales/Purchase invoice lifecycle, CR/DR notes, AR/AP aging
  - `party-management` — Customer and Vendor master data
- **Affected specs (modified):**
  - `finance-module` — documents which CoA accounts the invoice module posts to
- **Affected code (new):**
  - `app/backend/app/invoices/` — models, schemas, services, router
  - `app/backend/alembic/versions/<stamp>_add_invoice_module.py` — migration
  - `app/backend/tests/invoices/` — test module
- **Affected code (modified):**
  - `app/backend/app/core/constants.py` — new enum values
  - `app/backend/app/api/v1/__init__.py` — register invoices router
  - `app/backend/app/models/__init__.py` — import new models

## Strategic Context

This module directly enables:
1. **Revenue recognition** — the first time real money flows through the ledger
2. **AR/AP aging** — the most-requested accounting report after trial balance
3. **GST compliance** — invoice-level GSTIN and tax rate data is what GSTR-1 is built on
4. **Payment matching** — `add-payments-module` links Payments → Invoices (settled/outstanding)
5. **AI Finance Analyst** — can now answer "show me overdue invoices" with real data
