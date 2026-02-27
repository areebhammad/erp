# Tasks: Add AI-Configured Declarative Workflow Engine

> Complete groups in order. Tasks within a group can be parallelised internally.
> Validate at the end of each group before starting the next.

---

## Group 1 — Schema Validator & Action Registry (foundation)

- [ ] 1.1 Define the canonical workflow YAML schema as a JSON Schema document
      (`app/backend/workflow/schema.json`) — covers trigger, steps, action, depends_on,
      condition, on_timeout, on_error, template expressions
- [ ] 1.2 Implement `WorkflowValidator` service: parse YAML → validate against JSON Schema
      → validate action names against registry → validate config blocks against action
      Pydantic schemas → return list of field-level errors
- [ ] 1.3 Implement `ActionRegistry`: in-memory singleton, `register_action()` decorator,
      `get_action(name, tenant_modules)` with module-aware filtering
- [ ] 1.4 Register all Phase 1 built-in actions (approval, notification, webhook, ledger,
      purchase order, inventory, GST) by wiring decorator to existing service methods
- [ ] 1.5 Write pytest unit tests for `WorkflowValidator`: valid definition passes,
      unknown action fails, invalid config block fails, template expression in config passes
- [ ] 1.6 Write pytest unit tests for `ActionRegistry`: module-aware filtering, new
      registration visible immediately

**Validation:** `pytest app/backend/tests/workflow/test_schema.py -v` — all pass

---

## Group 2 — Database & Runtime Engine (depends on Group 1)

- [ ] 2.1 Write Alembic migration: create `workflow_definitions`, `workflow_executions`,
      `workflow_step_results`, `approval_requests` tables (all with `tenant_id`,
      composite indexes on `(tenant_id, id)`)
- [ ] 2.2 Create SQLAlchemy models for all 4 tables inheriting `TenantScopedBase`
- [ ] 2.3 Implement `WorkflowRegistry` CRUD service: create (with validation), list, get,
      update (new version + deprecate old), toggle enable, soft-delete
- [ ] 2.4 Implement Jinja2 `TemplateResolver`: evaluate `{{ }}` expressions against
      `StepContext` in a restricted sandbox (no builtins, no file system access)
- [ ] 2.5 Implement `WorkflowExecutor` Celery task: resolve step order (DAG topological sort),
      dispatch steps with no pending dependencies, persist result after each step,
      dispatch dependent steps on completion
- [ ] 2.6 Implement parallel step dispatch: steps with the same dependency set MUST be
      dispatched as concurrent Celery tasks
- [ ] 2.7 Implement step condition evaluation: call `TemplateResolver` on `condition` field;
      if false, set step to `skipped` and continue
- [ ] 2.8 Implement approval gate: `erp.approval.request` creates `approval_requests` row,
      halts execution, publishes `workflow.awaiting_approval` to Redis
- [ ] 2.9 Implement approval resume: `POST /api/v1/workflows/approvals/{id}/approve|reject`
      updates approval record, resumes execution from next step via Celery
- [ ] 2.10 Implement timeout handling: Celery Beat periodic task checks `approval_requests`
       where `expires_at < now AND status = pending`, triggers escalation step
- [ ] 2.11 Implement event bus subscription: on app startup, subscribe to all trigger
       event names for enabled workflow definitions; on event received, resolve matching
       tenant definitions and dispatch executions
- [ ] 2.12 Implement scheduled trigger: on workflow enable with `trigger.schedule`,
       register a Celery Beat periodic task; deregister on disable
- [ ] 2.13 Publish lifecycle events: `workflow.started`, `workflow.step_completed`,
       `workflow.awaiting_approval`, `workflow.approval_granted`, `workflow.escalated`,
       `workflow.completed`, `workflow.failed` to Redis pub/sub
- [ ] 2.14 Write audit log entries at all state transitions (use existing `AuditLogService`)
- [ ] 2.15 Write pytest integration tests: linear execution, parallel execution, condition
       skip, approval grant, approval timeout + escalation, worker crash recovery
       (kill worker mid-execution, restart, verify resume from correct step),
       cross-tenant isolation

**Validation:** `pytest app/backend/tests/workflow/ -v` — all pass; Alembic migration
runs cleanly on test DB

---

## Group 3 — Workflow API Endpoints (depends on Group 2)

- [ ] 3.1 Implement `POST /api/v1/workflows/` — validate YAML, persist, return 201 with id + version
- [ ] 3.2 Implement `GET /api/v1/workflows/` — list active definitions for tenant
- [ ] 3.3 Implement `GET /api/v1/workflows/{id}` — return full definition including YAML
- [ ] 3.4 Implement `PUT /api/v1/workflows/{id}` — update (new version + deprecate old)
- [ ] 3.5 Implement `PATCH /api/v1/workflows/{id}/toggle` — enable / disable
- [ ] 3.6 Implement `DELETE /api/v1/workflows/{id}` — soft-delete
- [ ] 3.7 Implement `GET /api/v1/workflows/{id}/executions` — paginated execution history
- [ ] 3.8 Implement `GET /api/v1/workflows/approvals/pending` — list pending approvals
      for the current user's roles
- [ ] 3.9 Implement `POST /api/v1/workflows/approvals/{id}/approve` and `.../reject`
- [ ] 3.10 Implement `POST /api/v1/workflows/ai/generate` — fetch tenant context,
       build enriched prompt, call Azure OpenAI GPT-4, validate output, retry up to 2x,
       return `{ yaml, explanation }` or 422

**Validation:** All endpoints return correct status codes; cross-tenant isolation verified
with two test tenants; Swagger UI shows all endpoints with correct schemas

---

## Group 4 — Frontend UI (depends on Group 3)

- [ ] 4.1 Create `GET /api/v1/workflows/` TanStack Query hook: `useWorkflows()`
- [ ] 4.2 Create hooks: `useWorkflow(id)`, `useWorkflowExecutions(id)`,
      `usePendingApprovals()`, `useGenerateWorkflow()`
- [ ] 4.3 Create route `_app/workflows/index.tsx` — Workflow Management list page:
      table with name, version, status badge, trigger type, last run, action buttons
      (Edit, Enable/Disable, History, Delete)
- [ ] 4.4 Create route `_app/workflows/builder.tsx` — split-pane builder:
      left = Tambo chat panel, right = Monaco YAML editor
- [ ] 4.5 Wire Tambo chat to `POST /api/v1/workflows/ai/generate`; display explanation
      lines below the chat message; populate Monaco editor with returned YAML
- [ ] 4.6 Implement iterative refinement: pass current YAML + follow-up message to
      generate endpoint; update Monaco editor with diff-highlighted changes
- [ ] 4.7 Implement "Validate" button: call schema validation endpoint, display
      field-level errors as inline Monaco markers
- [ ] 4.8 Implement "Enable" / "Save as Draft" buttons: call `POST /api/v1/workflows/`,
      redirect to list on success with toast showing name + version
- [ ] 4.9 Create route `_app/workflows/[id]/history.tsx` — execution history:
      list of executions, expandable step timeline, failed step error details, Retry button
- [ ] 4.10 Create route `_app/workflows/approvals.tsx` — Approval Inbox:
       subscribe to `workflow.awaiting_approval` SSE stream, render approval cards
       (entity, amount, requester, time remaining), Approve / Reject buttons with
       optional comment input, optimistic removal on action
- [ ] 4.11 Add "Workflows" nav item to app sidebar with a badge showing pending approval count
- [ ] 4.12 Write Playwright E2E test: generate a workflow via AI chat, enable it,
       verify it appears in the list, trigger it manually, verify execution history

**Validation:** `pnpm dev` — all routes load; AI generates valid YAML; approve flow
works end-to-end; real-time inbox updates on approval request

---

## Group 5 — Built-in Templates & Polish (depends on Group 4)

- [ ] 5.1 Write 5 built-in workflow YAML templates and add them to the tenant seed data
      in `app/backend/tenants/seed.py`:
      - `purchase-order-approval`
      - `three-way-invoice-matching`
      - `low-stock-reorder-alert`
      - `key-account-sales-order-approval`
      - `gst-reconciliation-reminder`
- [ ] 5.2 Write tests verifying seed templates pass schema + registry validation for a
      standard tenant with Finance + Inventory + Procurement modules
- [ ] 5.3 Add rate limiting on `POST /api/v1/workflows/ai/generate`:
      10 calls/minute per tenant (via existing rate limit middleware)
- [ ] 5.4 Add `WORKFLOW_BUILDER_ENABLED` feature flag to allow gradual rollout per tenant plan
- [ ] 5.5 Verify all new endpoints appear in the auto-generated Swagger UI (`/docs`)
- [ ] 5.6 Update `docker-compose.yml`: add `workflow-worker` Celery service
