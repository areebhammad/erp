# finance-module Specification

## Purpose
TBD - created by archiving change add-finance-module. Update Purpose after archive.
## Requirements
### Requirement: Chart of Accounts Management

The system SHALL provide a hierarchical Chart of Accounts (CoA) per tenant where accounts
are organised into a tree structure using a self-referential parent relationship. Group
accounts aggregate balances from child accounts. Only leaf accounts (non-group) SHALL
accept direct journal postings. Each account SHALL have a unique `account_code` scoped per
tenant, an `account_type` (Asset, Liability, Equity, Revenue, Expense), a `currency_code`,
and an `is_group` flag.

#### Scenario: Create a leaf account under a group
- **WHEN** an authenticated admin creates an account with `parent_id` pointing to a group
  account and `is_group=false`
- **THEN** the account is created and visible in the tenant's CoA tree immediately
- **AND** the response includes the full parent path for display

#### Scenario: Prevent posting to group accounts
- **WHEN** a journal line references an account where `is_group=true`
- **THEN** the system MUST reject the journal entry with a 422 error indicating the account
  does not accept direct postings

#### Scenario: Delete account with no postings
- **WHEN** an admin deletes a leaf account that has zero journal lines
- **THEN** the account is soft-deleted (deactivated) and no longer appears in posting dropdowns
- **AND** the account remains in historical journal lines for audit purposes

#### Scenario: Prevent deletion of account with postings
- **WHEN** an admin attempts to delete an account that has one or more journal lines
- **THEN** the system MUST reject the request with a 409 error

---

### Requirement: Default Indian GAAP Chart of Accounts Seeding

The system SHALL automatically seed a default Indian GAAP-aligned Chart of Accounts for
every newly provisioned tenant. The seed data SHALL include the five root groups (Assets,
Liabilities, Equity, Revenue, Expenses) with standard sub-accounts including GST input
credit and output tax payable accounts.

#### Scenario: New tenant receives default CoA
- **WHEN** a new tenant provisioning completes (triggered by `tenant.provisioned` event)
- **THEN** the tenant's `accounts` table SHALL contain at minimum: root groups for all
  five account types, leaf accounts for Cash, Accounts Receivable, Accounts Payable,
  Sales Revenue, COGS, CGST Input, SGST Input, IGST Input, CGST Payable, SGST Payable,
  IGST Payable

#### Scenario: Tenant can customise seeded CoA
- **WHEN** an admin renames or deactivates a seeded account with no postings
- **THEN** the change is saved and the new name/status appears in all subsequent CoA queries

---

### Requirement: Fiscal Year Management

The system SHALL support multiple named fiscal years per tenant. Each fiscal year has a
start date, end date, and status (`open` | `closed`). Only one fiscal year MAY be `open`
at a time. Journal entries may only be posted against an `open` fiscal year. The system
SHALL default to the Indian fiscal year (April 1 – March 31).

#### Scenario: Create the first fiscal year
- **WHEN** a new tenant is provisioned
- **THEN** the system SHALL automatically create a fiscal year for the current Indian
  financial year (e.g., 2025-04-01 to 2026-03-31) with status `open`

#### Scenario: Close a fiscal year
- **WHEN** an admin closes the current fiscal year
- **THEN** the fiscal year status changes to `closed`
- **AND** the system MUST automatically generate closing journal entries transferring
  all Revenue and Expense account balances to Retained Earnings
- **AND** a new fiscal year for the next period MUST be created with status `open`

#### Scenario: Reject posting to closed fiscal year
- **WHEN** a journal entry is submitted with a `posting_date` that falls within a `closed`
  fiscal year
- **THEN** the system MUST reject the request with a 422 error

---

### Requirement: Double-Entry Journal Ledger

The system SHALL provide an immutable double-entry general ledger. Every `JournalEntry`
contains two or more `JournalLine` records. The sum of debit amounts on all lines MUST
equal the sum of credit amounts. Once posted, a `JournalEntry` SHALL NOT be editable
or deletable. Corrections SHALL be made by creating a reversal entry.

#### Scenario: Post a balanced journal entry
- **WHEN** a caller submits a journal entry where the sum of debits equals the sum of
  credits, all referenced accounts are leaf accounts in the correct tenant's CoA,
  and the posting date falls within an open fiscal year
- **THEN** the entry is saved with `status=posted` and a `journal_number` assigned
  (auto-incremented, unique per tenant)
- **AND** `finance.journal_entry.posted` event is published to the event bus

#### Scenario: Reject an unbalanced journal entry
- **WHEN** a journal entry is submitted where debit total ≠ credit total
- **THEN** the system MUST reject with a 422 error and include the debit and credit
  totals in the error details

#### Scenario: Prevent editing a posted journal entry
- **WHEN** any user attempts to modify the amount or accounts of a posted journal entry
- **THEN** the system MUST return 403 Forbidden
- **AND** an audit log entry SHALL be created for the failed attempt

#### Scenario: Reverse a posted journal entry
- **WHEN** an admin submits a reversal request for a posted journal entry
- **THEN** a new journal entry is created with all debit/credit amounts negated
- **AND** the new entry has `reversal_of` set to the original entry's ID
- **AND** the original entry gains a `reversed_by` reference to the new entry

#### Scenario: Cross-tenant isolation of journal entries
- **WHEN** a user from Tenant A queries journal entries
- **THEN** ONLY entries where `tenant_id = Tenant A's ID` SHALL be returned
- **AND** it is impossible to post a journal line referencing an account from another tenant

---

### Requirement: LedgerService Interface

The system SHALL expose a `LedgerService` class that is the ONLY way other modules post
financial transactions. Direct writes to `journal_entries` or `journal_lines` tables from
outside the finance module SHALL NOT be permitted by convention (enforced by code review
and linting rule). The interface SHALL be:

```python
await ledger_service.post_journal(
    tenant_id: UUID,
    description: str,
    posting_date: date,
    reference: str | None,
    lines: list[JournalLineInput],   # {account_id, debit, credit}
    created_by: UUID | None,
) -> JournalEntry
```

#### Scenario: Inventory module posts stock purchase journal
- **WHEN** the inventory module calls `LedgerService.post_journal` with lines debiting
  the Inventory asset account and crediting Accounts Payable
- **THEN** a balanced journal entry is persisted and the `finance.journal_entry.posted`
  event is fired
- **AND** the inventory module receives the `JournalEntry` object with its assigned
  `journal_number` for cross-referencing

---

### Requirement: Trial Balance Report

The system SHALL provide a Trial Balance report that aggregates all posted journal lines
within a given fiscal year (optionally up to a specified date). The report SHALL show,
for every account with at least one posting in the period, the account code, name, type,
total debits, total credits, and net balance. The report SHALL balance: total debits = total
credits across all rows.

#### Scenario: Generate trial balance for full fiscal year
- **WHEN** an admin requests `GET /api/v1/finance/reports/trial-balance?fiscal_year_id=<id>`
- **THEN** the response lists all accounts with postings in that fiscal year with their
  aggregated debit and credit totals
- **AND** the response includes footer totals where `total_debits == total_credits`

#### Scenario: Generate trial balance as-of a specific date
- **WHEN** an admin requests the trial balance with `as_of=2025-09-30`
- **THEN** only journal lines with `posting_date <= 2025-09-30` are included

---

### Requirement: GST Tax Rate Configuration

The system SHALL allow tenant admins to configure GST tax rates. Each rate SHALL specify
the `tax_type` (CGST, SGST, IGST, CESS), the percentage `rate`, a human-readable `name`
(e.g., "GST 18% CGST"), and the linked CoA account where tax amounts will be posted.
These rates will be referenced by the future invoicing module when creating tax lines.

#### Scenario: Configure standard GST rates
- **WHEN** an admin creates tax rates for "GST 18%" by adding CGST 9% and SGST 9% entries
  each linked to the appropriate output tax payable or input credit account
- **THEN** both rates are saved and returned in `GET /api/v1/finance/tax-rates`
- **AND** they appear as available options in invoice line tax dropdowns (future module)

#### Scenario: Default GST rates seeded on provisioning
- **WHEN** a new tenant is provisioned
- **THEN** standard Indian GST rate groups are seeded: 0%, 5%, 12%, 18%, 28% with correct
  CGST, SGST, and IGST sub-rates linked to the seeded CoA tax accounts

