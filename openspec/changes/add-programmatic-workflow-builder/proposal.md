# Change: Add AI-Configured Declarative Workflow Engine

## Why

ERP functionality (approvals, journal entries, inventory updates, GST invoices,
notifications) is pre-built in our modules. The painful part is configuring how those
capabilities connect for each specific company's business process. Today this requires
a consultant and months of work. This proposal introduces an AI-powered declarative
workflow engine — identical in concept to SAP and ERPNext's workflow systems but with
AI as the configuration author instead of a consultant. A business owner describes
their process in plain English; AI generates a human-readable YAML definition stored
in the tenant's database row; a runtime engine executes it against the existing ERP
actions. Configuration time: minutes, not months.

## What Changes

- **NEW:** Workflow YAML schema — a declarative format (triggers, steps, conditions,
  dependencies, timeouts, escalations, template expressions) stored per-tenant in
  PostgreSQL. This is the "source of truth" for a business process.
- **NEW:** Action Registry — each ERP module registers its capabilities
  (e.g., `erp.approval.request`, `erp.ledger.journal_entry`) as typed, versioned
  action definitions. Workflows reference actions by name.
- **NEW:** Workflow Runtime Engine — a FastAPI + Celery backend service that listens
  for trigger events on the event bus, resolves the matching workflow definition for
  the tenant, and executes each step in order against the action registry. Execution
  state is persisted to PostgreSQL after every step (durable).
- **NEW:** AI Workflow Assistant — an in-app Tambo-powered chat panel where the admin
  types a plain-English requirement. The backend enriches the prompt with the tenant's
  live context (active modules, roles, chart of accounts, action catalogue) and calls
  Azure OpenAI GPT-4 to generate valid YAML. The admin reviews and saves with one click.
- **NEW:** Workflow Management UI — list, create, edit (YAML editor), enable/disable,
  and view execution history and approval inbox per tenant.

## Impact

- **Affected specs (new):**
  - `workflow-schema` — YAML format and validation rules
  - `workflow-runtime` — execution engine, durable state, approval gates
  - `workflow-ai-assistant` — AI YAML generation, in-app chat panel
  - `workflow-management-ui` — CRUD UI, approval inbox, execution history
- **Affected specs (modified):**
  - `multi-tenant-foundation` — workflow_definitions and execution tables are
    tenant-scoped; all execution records carry `tenant_id`
- **Affected code (new):**
  - `app/backend/workflow/` — schema validator, action registry, runtime engine, API
  - `app/frontend/src/features/workflow-builder/` — AI assistant panel + YAML editor
  - `app/frontend/src/routes/_app/workflows/` — management routes (list, builder, approvals)
- **Affected code (modified):**
  - Each ERP module's `__init__.py` — registers its actions with the action registry on startup
  - `app/backend/events/` — runtime subscribes to trigger events
  - `docker-compose.yml` — workflow runtime Celery worker added

## Strategic Context

See `docs/AI-First-ERP-Strategy.md` §7.9 for the full product rationale and
comparison with SAP and ERPNext.
