# Design: AI-Configured Declarative Workflow Engine

## Context

The ERP needs a workflow system that orchestrates pre-built module actions into
business-process sequences configured per tenant. The system must:
- Store workflow definitions as tenant-scoped database records (SaaS multi-tenant,
  one codebase, N clients — no per-tenant Git repos or deployments)
- Execute those definitions durably (survive worker crashes)
- Allow AI to generate valid definitions from plain English in under 10 seconds
- Integrate with the existing FastAPI backend, PostgreSQL, Redis event bus, Tambo AI

**Analogues:** SAP Business Workflow (power ceiling) + ERPNext Workflow (simplicity
spirit) — but AI-authored and YAML-readable instead of ABAP/GUI-only.

---

## Goals / Non-Goals

**Goals:**
- YAML workflow definitions stored in `workflow_definitions` table (tenant_id scoped)
- Action registry: each module registers its capabilities at startup
- Durable async execution engine (Celery + PostgreSQL state)
- Human approval gate with timeout + escalation (durable across restarts)
- AI generates valid YAML from plain English using live tenant context
- In-app admin UI: create via AI chat or direct YAML editor, list, enable/disable, view history
- Approval Inbox: real-time pending approvals routed per role

**Non-Goals (Phase 1):**
- Visual drag-and-drop canvas (read-only diagram may follow in Phase 2)
- Cross-tenant workflow template marketplace (Phase 2)
- Live migration of in-flight executions when a definition is updated (Phase 2)
- Per-tenant Git repo or file-based workflow storage (never needed — SaaS DB is canonical)

---

## Architecture

### Layer Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Admin Browser                                               │
│  ┌──────────────────────────┐  ┌────────────────────────┐   │
│  │  AI Assistant Chat Panel │  │  YAML Editor / Preview │   │
│  │  (Tambo → GPT-4)         │  │  (Monaco, read + edit) │   │
│  └──────────────────────────┘  └────────────────────────┘   │
│  ┌──────────────────────────┐  ┌────────────────────────┐   │
│  │  Workflow List / Mgmt    │  │  Approval Inbox (rt)   │   │
│  └──────────────────────────┘  └────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API + SSE
┌─────────────────────▼───────────────────────────────────────┐
│  FastAPI Backend                                             │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │  Workflow API    │  │  AI Generate   │  │  Approval   │  │
│  │  (CRUD + val.)  │  │  Endpoint      │  │  Endpoints  │  │
│  └──────────────────┘  └────────────────┘  └─────────────┘  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Action Registry (in-memory, populated at startup)   │    │
│  │  erp.approval.* | erp.ledger.* | erp.inventory.* …  │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────────┘
                      │
      ┌───────────────┴────────────────┐
      │                                │
┌─────▼────────┐              ┌────────▼────────┐
│  PostgreSQL  │              │  Redis           │
│  - workflow_ │              │  - Event bus     │
│    definitions│             │    (triggers)    │
│  - workflow_ │              │  - SSE pub/sub   │
│    executions │             │    (approvals)   │
│  - step_     │              └─────────────────┘
│    results   │                       ▲
│  - approval_ │              ┌────────┴────────┐
│    requests  │              │  Celery Workers  │
└──────────────┘              │  (runtime exec)  │
        ▲                     └─────────────────┘
        └──────────────────────────────┘
```

### YAML Schema Design

A workflow definition has four top-level sections:

```yaml
workflow:
  name: string          # unique per tenant, kebab-case
  version: integer      # auto-incremented on update
  enabled: boolean

  trigger:
    event: string       # e.g. "purchase_order.created"
    condition: string   # optional Jinja2 expression on trigger payload
    # OR:
    schedule: string    # cron expression (e.g. "0 9 * * 1-5")
    # OR:
    manual: true        # triggered via API call

  steps:
    - id: string                        # unique within workflow
      action: string                    # e.g. "erp.approval.request"
      depends_on: string | string[]     # step id(s) to wait for
      condition: string                 # run this step only if expression is true
      config: object                    # action-specific config (validated by registry)
      on_timeout:                       # optional — only for approval steps
        after: string                   # e.g. "24h"
        action: string
        config: object
      on_error:                         # optional fallback step
        action: string
        config: object
```

**Template expressions** (`{{ }}`) use Jinja2 syntax and can reference:
- `trigger.*` — the payload of the trigger event
- `steps.<id>.output.*` — the output of a previously completed step
- `tenant.*` — tenant metadata (slug, plan, timezone)

### Action Registry Design

Each module registers its actions at application startup:

```python
# In app/backend/finance/actions.py
from app.backend.workflow.registry import register_action

@register_action("erp.ledger.journal_entry")
class JournalEntryAction:
    config_schema = JournalEntryConfig   # Pydantic model for config validation
    async def execute(self, config: JournalEntryConfig, context: StepContext):
        # calls existing ledger service
        return await ledger_service.post_journal_entry(...)
```

The registry is an in-memory dict populated at startup. The YAML schema validator
queries the registry to verify that every `action:` in a definition exists and
that the `config:` block matches the action's Pydantic schema.

### Database Schema (new tables)

```sql
-- Per-tenant workflow definitions (the YAML stored as text + parsed JSON)
workflow_definitions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  definition_yaml TEXT NOT NULL,      -- raw YAML (for display/edit)
  definition_json JSONB NOT NULL,     -- parsed (for runtime)
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (tenant_id, name, version)
)

-- One row per triggered execution
workflow_executions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  definition_id UUID REFERENCES workflow_definitions(id),
  trigger_event TEXT,
  trigger_payload JSONB,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
)

-- One row per step per execution
workflow_step_results (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  execution_id UUID REFERENCES workflow_executions(id),
  step_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_config JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)

-- Human approval requests (durable)
approval_requests (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  execution_id UUID REFERENCES workflow_executions(id),
  step_id TEXT NOT NULL,
  required_role TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  decision TEXT,
  expires_at TIMESTAMPTZ
)
```

### AI Generation Design

**Endpoint:** `POST /api/v1/workflows/ai/generate`

The endpoint does NOT pass the user prompt straight to GPT-4. It:
1. Fetches the tenant's active modules, role list, chart of accounts summary
2. Queries the action registry for all available actions + their config schemas
3. Builds a system prompt: *"You are configuring an ERP workflow for [Tenant Name].
   Available actions: [...]. Available roles: [...]. Active modules: [...]."*
4. Appends the YAML schema as a JSON Schema in the system prompt
5. Calls Azure OpenAI GPT-4 with the enriched system prompt + user's NL description
6. Validates the returned YAML: parses it, checks every action exists in registry,
   validates all config blocks against action Pydantic schemas
7. Returns `{ yaml: string, explanation: string[] }` on success
8. Retries up to 2x on validation failure before returning a 422

This ensures the AI can only reference actions and roles that actually exist for
this tenant — it cannot hallucinate a role or action.

---

## Decisions

### Decision 1: YAML stored in DB, not files (SaaS-native)

**Chosen:** `workflow_definitions` table with `tenant_id`. One codebase, N tenants.

**Rationale:** SaaS ERP serves many clients from one platform. Per-tenant file
deployments are operationally impossible at scale. DB storage with tenant isolation
is the same pattern used by SAP Cloud, Salesforce Flow, ERPNext, and every other
SaaS workflow system.

**Alternative considered:** Per-tenant Git repos with CI/CD pipeline. Rejected:
operationally complex, doesn't scale past dozens of tenants, introduces deployment
fragility into what should be a config change.

### Decision 2: Celery for execution (not Temporal)

**Chosen:** Celery + PostgreSQL state persistence for durable step-by-step execution.

**Rationale:** Celery is already in the stack. Adding Temporal introduces a new
infrastructure dependency before the pattern is proven at scale.

**Alternative:** Temporal.io — deferred to Phase 2 if Celery's durability proves
insufficient under load.

### Decision 3: Jinja2 for template expressions (not a custom DSL)

**Chosen:** `{{ trigger.amount }}` style Jinja2 expressions for data flow between steps.

**Rationale:** Jinja2 is Python-native, widely understood, sandboxable, and already
in the FastAPI ecosystem. No custom parser needed.

**Security:** Expressions are evaluated in a restricted Jinja2 sandbox with no
access to Python builtins or file system.

---

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| GPT-4 generates YAML with invalid action names | Backend validates all actions against registry before accepting; returns field-level errors to UI |
| Celery worker restart loses approval wait state | Approval state is in PostgreSQL; Celery Beat polls for timed-out requests independently of the worker that started the execution |
| Jinja2 injection via malicious template expressions | Strict Jinja2 sandbox; no builtins; expressions only evaluated at execution time by backend, never in browser |
| Step creates cross-tenant side effects | All action implementations receive `tenant_id` from the execution context; no action can operate outside its tenant |
| YAML definition updated while execution is in flight | Phase 1: each execution locks to the `definition_id` at trigger time; updates create a new version; in-flight runs complete on the old version |

---

## Open Questions

- **Approval UI location:** Dedicated `/approvals` inbox route vs. notification bell
  dropdown. Recommendation: dedicated route for Phase 1 (clearer UX for batch approvals).
- **Built-in templates:** Ship 5 pre-seeded workflow definitions per tenant on creation
  (PO approval, 3-way matching, low stock alert, key account SO approval, GST recon
  notification). Decision: yes, include in Phase 1 seed data.
- **YAML editor:** Read-only preview vs. editable Monaco editor. Recommendation: editable
  for tech-savvy admins but clearly labelled "Advanced Mode" to discourage casual edits.
