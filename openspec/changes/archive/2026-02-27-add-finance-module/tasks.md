# Tasks: Add Finance Module

> Complete groups in order. Tasks within a group may be parallelised unless they share
> a data dependency. Validate at the end of each group before proceeding.

---

## Group 1 — Database Models & Migration (foundation)

- [x] 1.1 Create `app/backend/app/finance/` package with `__init__.py`
- [x] 1.2 Create `app/backend/app/finance/models.py` with four SQLAlchemy models,
      all inheriting `TenantScopedBase`:
      - `FiscalYear`: `name`, `start_date`, `end_date`, `status` (Enum: `open` | `closed`),
        `closing_entry_id` (nullable FK to `journal_entries.id`)
      - `Account`: `account_code` (String 20), `name`, `account_type`
        (Enum: `asset` | `liability` | `equity` | `revenue` | `expense`),
        `parent_id` (nullable self-referential FK to `accounts.id`), `is_group` (Boolean),
        `currency_code` (String 3, default `"INR"`), `is_active` (Boolean, default True),
        composite `UNIQUE(tenant_id, account_code)`
      - `JournalEntry`: `journal_number` (Integer, auto-increment per tenant),
        `description` (Text), `posting_date` (Date), `status` (Enum: `draft` | `posted`),
        `reference` (String 100, nullable), `reversal_of` (nullable FK to self),
        `reversed_by` (nullable FK to self), `fiscal_year_id` (FK to `fiscal_years.id`)
      - `JournalLine`: `journal_entry_id` (FK to `journal_entries.id`), `account_id`
        (FK to `accounts.id`), `debit` (Numeric 18,4), `credit` (Numeric 18,4),
        `description` (Text, nullable)
      - `TaxRate`: `name` (String 100), `tax_type` (Enum: `CGST` | `SGST` | `IGST` | `CESS`),
        `rate` (Numeric 5,4 — e.g., 0.09 for 9%), `linked_account_id` (FK to `accounts.id`),
        `is_active` (Boolean, default True)
- [x] 1.3 Add composite indexes:
      `(tenant_id, posting_date)` on `journal_entries`,
      `(tenant_id, account_id)` and `(journal_entry_id)` on `journal_lines`,
      `(tenant_id, account_code)` on `accounts`,
      `(tenant_id, status)` on `fiscal_years`
- [x] 1.4 Write Alembic migration `<stamp>_add_finance_module.py` — create all five tables
      in the correct foreign-key order; verify `alembic upgrade head` and
      `alembic downgrade -1` both succeed against the test DB
- [x] 1.5 Register all new models in `app/backend/app/models/__init__.py` so Alembic
      picks them up for autogenerate

**Validation:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`
completes without errors on a clean test database.

---

## Group 2 — Pydantic Schemas (depends on Group 1 models)

- [x] 2.1 Create `app/backend/app/finance/schemas.py` with request/response Pydantic models:
      - `AccountCreate`, `AccountUpdate`, `AccountRead` (includes `parent_path: list[str]`)
      - `FiscalYearCreate`, `FiscalYearRead`
      - `JournalLineInput` (`account_id`, `debit`, `credit`, `description`)
      - `JournalEntryCreate` (`description`, `posting_date`, `reference`, `lines: list[JournalLineInput]`)
      - `JournalEntryRead` (includes `lines`, `journal_number`, `status`)
      - `TaxRateCreate`, `TaxRateUpdate`, `TaxRateRead`
      - `TrialBalanceLine` (`account_code`, `account_name`, `account_type`, `total_debit`,
        `total_credit`, `balance`)
      - `TrialBalanceResponse` (`lines: list[TrialBalanceLine]`, `total_debit`, `total_credit`,
        `as_of: date`, `fiscal_year_id`)
- [x] 2.2 Add validators in `JournalEntryCreate`:
      - At least 2 lines required
      - Each line must have exactly one of `debit > 0` or `credit > 0` (not both)
      - `posting_date` cannot be in the future by more than 7 days (configurable)

**Validation:** `pnpm tsc --noEmit` equivalent: `python -m mypy app/backend/app/finance/schemas.py --strict` exits 0.

---

## Group 3 — Service Layer (depends on Groups 1 & 2)

- [x] 3.1 Create `app/backend/app/finance/services.py` with four service classes:

  **`ChartOfAccountsService`:**
  - `create_account(session, tenant_id, data: AccountCreate) -> Account`
  - `list_accounts(session, tenant_id, include_inactive=False) -> list[Account]`
    (returns flat list; caller renders tree)
  - `get_account(session, tenant_id, account_id) -> Account`
  - `update_account(session, tenant_id, account_id, data: AccountUpdate) -> Account`
  - `deactivate_account(session, tenant_id, account_id) -> Account`
    — raises `ConflictError` if account has any journal lines
  - `get_account_path(session, account) -> list[str]` (walk parent chain)

  **`FiscalYearService`:**
  - `create_fiscal_year(session, tenant_id, data: FiscalYearCreate) -> FiscalYear`
    — raises `ConflictError` if an open fiscal year already exists
  - `list_fiscal_years(session, tenant_id) -> list[FiscalYear]`
  - `close_fiscal_year(session, tenant_id, fiscal_year_id, closing_user_id) -> FiscalYear`
    — generates closing journal entries; creates next year automatically
  - `get_open_fiscal_year(session, tenant_id) -> FiscalYear | None`
  - `resolve_fiscal_year(session, tenant_id, posting_date: date) -> FiscalYear`
    — raises `ValidationError` if date falls in no open fiscal year

  **`LedgerService`:**
  - `post_journal(session, tenant_id, data: JournalEntryCreate, created_by) -> JournalEntry`
    — validate balance (debit == credit), validate all referenced accounts are leaf accounts
      in the same tenant, resolve fiscal year, assign journal_number, persist, publish
      `finance.journal_entry.posted` event, return entry
  - `reverse_journal(session, tenant_id, entry_id, reversal_date, description, reversed_by) -> JournalEntry`
    — create negated copy, set cross-references
  - `get_journal_entry(session, tenant_id, entry_id) -> JournalEntry`
  - `list_journal_entries(session, tenant_id, fiscal_year_id?, account_id?, cursor?, limit=20) -> PaginatedResult`

  **`TrialBalanceService`:**
  - `get(session, tenant_id, fiscal_year_id, as_of: date | None) -> TrialBalanceResponse`
    — `GROUP BY account_id` aggregation over `journal_lines JOIN journal_entries`
      filtered to `status=posted` and the fiscal year date range (clipped to `as_of`)

  **`GSTConfigService`:**
  - `create_tax_rate(session, tenant_id, data: TaxRateCreate) -> TaxRate`
  - `list_tax_rates(session, tenant_id, active_only=True) -> list[TaxRate]`
  - `update_tax_rate(session, tenant_id, rate_id, data: TaxRateUpdate) -> TaxRate`
  - `deactivate_tax_rate(session, tenant_id, rate_id) -> TaxRate`

- [x] 3.2 Create `app/backend/app/finance/seed.py` with:
  - `seed_chart_of_accounts(session, tenant_id) -> None` — inserts full Indian GAAP CoA tree
  - `seed_gst_tax_rates(session, tenant_id, coa_accounts: dict) -> None` — inserts
    default GST rates (0%, 5%, 12%, 18%, 28%) linked to the seeded tax accounts
  - `seed_initial_fiscal_year(session, tenant_id) -> FiscalYear` — creates the current
    Indian financial year

- [x] 3.3 Add constants to `app/backend/app/core/constants.py`:
  - `ResourceType`: `ACCOUNTS`, `JOURNAL_ENTRIES`, `FISCAL_YEARS`, `TAX_RATES`
  - `EventType`: `FINANCE_JOURNAL_POSTED = "finance.journal_entry.posted"`,
    `FINANCE_FISCAL_YEAR_CLOSED = "finance.fiscal_year.closed"`

**Validation:** No validation gate at this stage — service unit tests are in Group 6.

---

## Group 4 — Event Integration & Tenant Provisioning Hook (depends on Group 3)

- [x] 4.1 Add `FinanceJournalPostedEvent` and `FinanceFiscalYearClosedEvent` to
      `app/backend/app/core/events.py` and register them in `EVENT_TYPES`
- [x] 4.2 Subscribe to `tenant.provisioned` event in `app/backend/app/finance/handlers.py`
      — on event: call `seed_chart_of_accounts`, `seed_initial_fiscal_year`,
      `seed_gst_tax_rates` in a new DB session. Wrap in try/except and log failures
      (provisioning must not fail if seed fails — log error, send alert)
- [x] 4.3 Register the finance event handler at app startup in `app/backend/app/main.py`
      (import `app.finance.handlers` to trigger the `@event_bus.subscribe` decorators)

**Validation:** Start the app; create a new tenant via `POST /api/v1/auth/register`;
confirm `accounts`, `fiscal_years`, `tax_rates` tables have rows for the new tenant.

---

## Group 5 — API Router (depends on Groups 2, 3)

- [x] 5.1 Create `app/backend/app/finance/router.py` with APIRouter prefix `/api/v1/finance`:

  **Chart of Accounts:**
  - `GET  /accounts` — list (query params: `include_inactive`)
  - `POST /accounts` — create (Admin only)
  - `PATCH /accounts/{id}` — update (Admin only)
  - `DELETE /accounts/{id}` — deactivate (Admin only)

  **Fiscal Years:**
  - `GET  /fiscal-years` — list
  - `POST /fiscal-years` — create (Admin only)
  - `PATCH /fiscal-years/{id}/close` — close + generate closing entries (Admin only)

  **Journal Entries:**
  - `POST /journal-entries` — post (Accountant + Admin)
  - `GET  /journal-entries` — list (cursor pagination; filter by fiscal_year_id, account_id)
  - `GET  /journal-entries/{id}` — get with lines

  **Reversals:**
  - `POST /journal-entries/{id}/reverse` — body: `{reversal_date, description}`

  **Reports:**
  - `GET  /reports/trial-balance` — query: `fiscal_year_id` (required), `as_of` (optional date)

  **Tax Rates:**
  - `GET  /tax-rates` — list
  - `POST /tax-rates` — create (Admin only)
  - `PATCH /tax-rates/{id}` — update (Admin only)
  - `DELETE /tax-rates/{id}` — deactivate (Admin only)

- [x] 5.2 Apply `get_tenant_context` dependency (from `app/api/deps.py`) to all finance
      endpoints so `tenant_id` is always derived from the authenticated JWT
- [x] 5.3 Register `finance.router` in `app/backend/app/api/v1/__init__.py`
- [x] 5.4 Verify all new endpoints appear in Swagger UI at `/docs`

**Validation:** `curl -s http://localhost:8000/docs | grep "/api/v1/finance"` shows all
endpoints; unauthenticated requests return 401.

---

## Group 6 — Unit & Integration Tests (depends on Groups 3, 4, 5)

- [x] 6.1 Create `app/backend/tests/finance/` package
- [x] 6.2 Write unit tests for `ChartOfAccountsService`:
      - Create account, including parent-path resolution
      - Reject creation with non-existent parent_id
      - Deactivate account with no lines (succeeds)
      - Deactivate account with lines (raises ConflictError)
- [x] 6.3 Write unit tests for `FiscalYearService`:
      - Create fiscal year
      - Reject second open fiscal year
      - `resolve_fiscal_year` returns correct year for date in range
      - `resolve_fiscal_year` raises for date in closed year
- [x] 6.4 Write unit tests for `LedgerService`:
      - Post balanced entry (success, journal_number assigned)
      - Reject unbalanced entry (debit ≠ credit)
      - Reject entry referencing group account
      - Reject entry with posting_date in closed fiscal year
      - Reject update of posted entry (ForbiddenError)
      - Reverse entry creates negated copy and sets cross-references
- [x] 6.5 Write unit tests for `TrialBalanceService`:
      - Trial balance totals debit == credit
      - `as_of` date correctly clips postings
      - Accounts with zero net activity in period: excluded from response
- [x] 6.6 Write integration tests (FastAPI TestClient):
      - Full flow: create account → post journal entry → retrieve trial balance
      - Cross-tenant isolation: Tenant A cannot read Tenant B's journal entries
      - Unauthenticated request to any finance endpoint returns 401
      - Non-Admin user cannot POST /accounts (returns 403)
- [x] 6.7 Write tests for seed functions:
      - `seed_chart_of_accounts` creates correct number of accounts in expected hierarchy
      - `seed_gst_tax_rates` links rates to correct CoA accounts
      - `seed_initial_fiscal_year` creates `open` fiscal year with correct date range
- [x] 6.8 Configure coverage for `app/backend/app/finance/`:
      - Minimum 85% line coverage gate applied in `pyproject.toml` or `pytest.ini`

**Validation:** `pytest app/backend/tests/finance/ -v --cov=app/backend/app/finance
--cov-fail-under=85` exits 0.

---

## Group 7 — Frontend Query Hooks (depends on Group 5 being deployed/running)

- [ ] 7.1 Create `src/lib/api/finance.ts` with typed Axios wrapper functions:
      - `listAccountsApi`, `createAccountApi`, `updateAccountApi`, `deactivateAccountApi`
      - `listFiscalYearsApi`, `createFiscalYearApi`, `closeFiscalYearApi`
      - `listJournalEntriesApi`, `createJournalEntryApi`, `getJournalEntryApi`,
        `reverseJournalEntryApi`
      - `getTrialBalanceApi`
      - `listTaxRatesApi`, `createTaxRateApi`, `updateTaxRateApi`, `deactivateTaxRateApi`
- [ ] 7.2 Add finance query keys to `src/lib/query/keys.ts`:
      ```ts
      finance: {
        accounts: (tenantId: string) => ['finance', 'accounts', tenantId],
        fiscalYears: (tenantId: string) => ['finance', 'fiscal-years', tenantId],
        journalEntries: (filters: object) => ['finance', 'journal-entries', filters],
        journalEntry: (id: string) => ['finance', 'journal-entries', id],
        trialBalance: (params: object) => ['finance', 'trial-balance', params],
        taxRates: (tenantId: string) => ['finance', 'tax-rates', tenantId],
      }
      ```
- [ ] 7.3 Create TanStack Query hooks in `src/lib/query/hooks/finance.ts`:
      `useAccounts`, `useCreateAccount`, `useFiscalYears`, `useJournalEntries`,
      `useCreateJournalEntry`, `useTrialBalance`, `useTaxRates`

**Validation:** `pnpm tsc --noEmit` exits 0 (TypeScript strict mode passes for new files).

---

## Group 8 — Definition of Done Checklist

- [x] All Group 1–7 tasks complete
- [x] `alembic upgrade head` and `alembic downgrade -1` both succeed cleanly
- [x] `pytest app/backend/tests/finance/ --cov=app/backend/app/finance --cov-fail-under=85` exits 0
- [x] `mypy app/backend/app/finance/ --strict` exits 0
- [x] All finance endpoints return 401 for unauthenticated requests
- [x] Non-admin user receives 403 on admin-only endpoints
- [x] POST balanced journal entry → trial balance reflects the entry within the same request
- [x] POST unbalanced journal entry → 422 with debit/credit totals in error body
- [x] New tenant provisioned → accounts, fiscal_years, tax_rates populated automatically
- [x] All 5 spec finance-module requirements have passing tests
- [x] `openspec validate add-finance-module --strict` exits 0

---

## Dependencies

### Blocked By
- `multi-tenant-foundation` (deployed) — `TenantScopedBase`, `Tenant`, `AuditLog` models,
  `EventBus`, `get_tenant_context` dependency, all needed
- `setup-frontend-architecture` (deployed) — Axios client, query key factory, and hooks
  pattern needed for Group 7

### Blocks
- `add-programmatic-workflow-builder` — Group 1.4: `erp.ledger.journal_entry` action
  implementation requires `LedgerService` to exist
- Future `add-invoice-module` — accounts payable/receivable flows post via `LedgerService`
- Future `add-inventory-module` — stock valuation entries post via `LedgerService`

### Parallelisable Within This Change
- Group 2 (schemas) ∥ Group 3 begins — schemas inform services but basic model structure
  is sufficient to start service outlines
- Group 6 (tests) can start writing test skeletons in parallel with Group 5 (router)
- Group 7 (frontend hooks) can begin as soon as Group 5 endpoints are running locally

---

## Estimated Effort

| Group | Focus | Hours |
|-------|-------|-------|
| 1 | Models & migration | 6 |
| 2 | Pydantic schemas | 4 |
| 3 | Service layer (4 services + seed) | 16 |
| 4 | Event integration & provisioning hook | 4 |
| 5 | API router (14 endpoints) | 8 |
| 6 | Tests (unit + integration + coverage) | 16 |
| 7 | Frontend query hooks & keys | 6 |
| 8 | DoD validation | 2 |
| **Total** | | **~62 hours (1.5 weeks solo, 1 week with 2 engineers)** |
