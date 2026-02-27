## Context

The Finance Module is the accounting core of the AI-First ERP. Every other business
module (procurement, inventory, HR, GST invoicing) produces financial transactions that
must be recorded in a double-entry ledger. This design doc captures the key technical
decisions before spec deltas and tasks are authored.

## Goals / Non-Goals

**Goals:**
- Double-entry bookkeeping enforced at the database and service layer (debit = credit invariant)
- Hierarchical Chart of Accounts supporting Indian GAAP account types
- Immutable journal entries — once posted, a JournalEntry cannot be edited or deleted;
  corrections are made via reversal entries
- Indian fiscal year (April 1 – March 31) as the default, but configurable
- GST tax rate configuration as foundation for future invoicing
- Trial Balance report as the first financial report
- Clean `LedgerService` interface other modules call — they never write to ledger tables directly
- Full audit trail on all accounting operations (using existing `AuditLog` model)

**Non-Goals (deferred to future proposals):**
- Sales invoices, purchase invoices (belong in `add-invoice-module`)
- Bank reconciliation
- TDS compliance
- E-invoicing / IRP integration
- Financial statements (P&L, Balance Sheet) — those are complex reports built on top of
  the ledger and belong in a dedicated reporting module
- Multi-currency conversion (currency codes are stored but rate conversion is deferred)

## Decisions

### Decision 1: Module as a Python package within the monolith

**Choice:** `app/backend/app/finance/` package, not a separate service.

Having its own router, models, schemas, and services as a package within the FastAPI app.

**Alternatives considered:**
- Separate microservice: Too early — the monolith is the correct starting point per
  `openspec/project.md` ("Modular Monolith: Start as monolith, extract services as needed")
- Flat files in `app/models/`: Doesn't scale; finance has 4+ models, services, and complex logic

### Decision 2: Immutable journal entries via application-layer enforcement

**Choice:** `JournalEntry.status` has states `draft` → `posted`. Once `posted`, any
update or delete attempt raises `ForbiddenError`. No database-level triggers (adds
complexity and is harder to unit-test). Reversals create a new `JournalEntry` with
negated amounts and a `reversal_of` FK back to the original.

**Alternatives considered:**
- PostgreSQL row-level security to block UPDATEs: Adds ops complexity, harder to test
- Soft-delete with `deleted_at`: Inadequate — a "deleted" journal entry would break trial balance

### Decision 3: Account hierarchy via adjacency list (parent_id self-reference)

**Choice:** `accounts.parent_id` → `accounts.id` self-referential FK. Groups
(`is_group=True`) cannot receive direct postings. Leaf accounts (`is_group=False`) are
the only valid targets in `journal_lines`.

**Alternatives considered:**
- Nested sets / materialized paths: More complex, overkill for ERP CoA trees which are
  shallow (3–5 levels). Adjacency list is simpler and fast enough with recursive CTEs.

### Decision 4: Trial Balance as a database VIEW or service query

**Choice:** Service-layer query (not a DB view). The `TrialBalanceService.get()` method
runs a `GROUP BY account_id` aggregation over `journal_lines` filtered by fiscal year
and as-of date. This keeps the database schema clean and allows per-request date filtering
without materialized view refresh complexity.

### Decision 5: Indian GAAP seed CoA structure

**Choice:** Seed a standard 5-group CoA on tenant creation:
```
1000 - Assets (group)
  1100 - Current Assets (group)
    1110 - Cash and Cash Equivalents (leaf)
    1120 - Accounts Receivable (leaf)
    1130 - Inventory (leaf)
    1140 - Input Tax Credit - CGST (leaf)
    1141 - Input Tax Credit - SGST (leaf)
    1142 - Input Tax Credit - IGST (leaf)
  1200 - Fixed Assets (group)
    1210 - Plant & Machinery (leaf)
    1220 - Accumulated Depreciation (leaf)
2000 - Liabilities (group)
  2100 - Current Liabilities (group)
    2110 - Accounts Payable (leaf)
    2120 - Output Tax Payable - CGST (leaf)
    2121 - Output Tax Payable - SGST (leaf)
    2122 - Output Tax Payable - IGST (leaf)
    2130 - TDS Payable (leaf)
  2200 - Long-term Liabilities (group)
    2210 - Bank Loans (leaf)
3000 - Equity (group)
  3100 - Owner's Capital (leaf)
  3200 - Retained Earnings (leaf)
4000 - Revenue (group)
  4100 - Sales Revenue (leaf)
  4200 - Other Income (leaf)
5000 - Expenses (group)
  5100 - Cost of Goods Sold (leaf)
  5200 - Operating Expenses (group)
    5210 - Salaries and Wages (leaf)
    5220 - Rent (leaf)
    5230 - Utilities (leaf)
    5240 - Marketing Expenses (leaf)
  5300 - Financial Expenses (group)
    5310 - Bank Charges (leaf)
    5320 - Interest Expense (leaf)
```
Tenants can add, rename, or deactivate accounts but cannot delete seeded accounts that
have postings.

### Decision 6: GST tax rates as a separate `tax_rates` table

**Choice:** A `tax_rates` table with columns: `tenant_id`, `name`, `tax_type`
(`CGST` | `SGST` | `IGST` | `CESS`), `rate` (Numeric 5,4), `is_active`, and
`linked_account_id` (FK to accounts). This separates GST configuration from CoA and
allows the invoicing module to look up rates at invoice creation time.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Trial balance query slow at scale (millions of lines) | Composite index on `(tenant_id, account_id, posted_at)`; cursor pagination |
| Seeds CoA conflicts with tenant's existing Tally/SAP CoA | Tenants can rename or deactivate seeded accounts; import tool is a future proposal |
| Immutability enforcement is application-layer only | Service test asserts `ForbiddenError` on update attempt; wrap in try-except in API |

## Migration Plan

1. New Alembic migration creates all four tables (`fiscal_years`, `accounts`, `journal_entries`,
   `journal_lines`, `tax_rates`).
2. Data migration: **none** — new tables, no existing data to transform.
3. Tenant provisioning event handler seeds CoA and fiscal year for **new tenants only**.
   Existing tenants (from previous migrations) are left as-is; a one-time backfill script
   will be a separate future change.

## Open Questions

- None currently blocking — all major decisions are made above.
