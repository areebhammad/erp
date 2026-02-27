# Change: Add Finance Module

## Why

Every downstream ERP module — procurement, inventory, HR payroll, GST invoicing — ultimately
posts financial transactions to a ledger. Without a double-entry ledger engine, Chart of
Accounts, and fiscal-year awareness, we cannot build any of the business modules or the
AI workflow actions (`erp.ledger.*`) that the workflow engine expects. The Finance Module is
the accounting core that makes everything else possible.

## What Changes

- **NEW:** `app/backend/app/finance/` — self-contained finance module package with models,
  schemas, services, and API router. Follows the same structure conventions as the existing
  `app/api/v1/` router pattern.
- **NEW:** `fiscal_years` table — tenant-scoped fiscal year definitions (default: April–March,
  Indian GAAP). Stores start/end dates, status (`open` | `closed`), and closing entry reference.
- **NEW:** `accounts` table — Chart of Accounts (CoA). Hierarchical tree: each account has a
  `parent_id`, `account_type` (Asset, Liability, Equity, Revenue, Expense), `account_code`,
  `currency_code`, and `is_group` flag. Leaf accounts are `is_group=false` and are the only
  ones that accept direct journal postings.
- **NEW:** `journal_entries` table + `journal_lines` table — the double-entry ledger. A
  `JournalEntry` is immutable once posted. Posting validates debit total = credit total.
  Each `JournalLine` references a single leaf `Account`.
- **NEW:** `LedgerService` — `post_journal(tenant_id, lines, description, reference, date)`.
  Validates balance, checks account types, creates immutable entry, fires
  `finance.journal_entry.posted` event. Used by other modules to record financial impact.
- **NEW:** `FiscalYearService` — open/close fiscal years, validate a posting date falls within
  an open fiscal year, generate year-end closing entries.
- **NEW:** `ChartOfAccountsService` — CRUD for accounts, seed default Indian GAAP CoA on
  tenant provisioning, validate account hierarchy rules.
- **NEW:** `GSTConfigService` — tenant-level GST registration: `gstin` (already on Tenant
  model), GST tax rates (CGST/SGST/IGST/CESS) persisted in a new `tax_rates` table.
  This is configuration only — no invoicing in this change.
- **NEW:** API endpoints under `/api/v1/finance/`:
  - Fiscal years CRUD (`GET`, `POST /fiscal-years`, `PATCH /fiscal-years/{id}/close`)
  - Chart of Accounts CRUD (`GET`, `POST`, `PATCH`, `DELETE /accounts`)
  - Journal Entries (`POST /journal-entries`, `GET /journal-entries`, `GET /journal-entries/{id}`)
  - Trial Balance report (`GET /reports/trial-balance?fiscal_year_id=&as_of=`)
  - Tax Rates CRUD (`GET`, `POST`, `PATCH /tax-rates`)
- **MODIFIED:** `app/backend/app/core/constants.py` — add finance-related `ResourceType` values
  (`ACCOUNTS`, `JOURNAL_ENTRIES`, `FISCAL_YEARS`, `TAX_RATES`) and `EventType` values
  (`finance.journal_entry.posted`, `finance.fiscal_year.closed`).
- **MODIFIED:** `app/backend/app/models/tenant.py` — no schema changes. `Tenant.settings`
  JSONB field gains documented keys: `default_currency`, `fiscal_year_start_month`
  (default `4` for April), `accounting_method` (`cash` | `accrual`).
- **MODIFIED:** Tenant provisioning flow — when a new tenant is created, seed the default Indian
  GAAP Chart of Accounts and create the first fiscal year (current April–March period).

## Impact

- **Affected specs (new):**
  - `finance-module` — ledger, CoA, fiscal year, GST config, trial balance
- **Affected specs (modified):**
  - `multi-tenant-foundation` — tenant provisioning now includes CoA seeding and fiscal year creation
- **Affected code (new):**
  - `app/backend/app/finance/` — models, schemas, services, router
  - `app/backend/alembic/versions/<stamp>_add_finance_module.py` — migration
- **Affected code (modified):**
  - `app/backend/app/core/constants.py` — new enum values
  - `app/backend/app/api/v1/__init__.py` — register finance router
  - `app/backend/app/models/__init__.py` — import new models
  - `app/backend/tests/` — new test module `tests/finance/`

## Strategic Context

The Finance Module directly unblocks:
1. **Workflow builder** — `erp.ledger.journal_entry` action can now be implemented
2. **Procurement module** — purchase orders need a payables account
3. **Inventory module** — stock valuation posts to inventory asset accounts
4. **GST invoicing** — tax ledger accounts are pre-created here
5. **AI Finance Analyst** (§7.3 of the strategy doc) — needs a real ledger to query
