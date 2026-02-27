## ADDED Requirements

### Requirement: Workflow Definition Registry API

The system SHALL provide REST API endpoints to manage workflow definitions per tenant.
All definitions MUST be scoped to the authenticated tenant via JWT.

**Endpoints:**
- `POST /api/v1/workflows/` — create a new workflow (or new version of an existing name)
- `GET /api/v1/workflows/` — list all definitions for the tenant (name, version, enabled, last run)
- `GET /api/v1/workflows/{id}` — retrieve full definition including YAML
- `PUT /api/v1/workflows/{id}` — update definition (saves as new version, old version deprecated)
- `PATCH /api/v1/workflows/{id}/toggle` — enable or disable a workflow
- `DELETE /api/v1/workflows/{id}` — soft-delete (disable + mark deleted; does not affect in-flight executions)

On `POST` or `PUT`, the backend MUST:
1. Parse the submitted YAML
2. Validate against the canonical schema
3. Validate each action name exists in the registry (for this tenant's modules)
4. Validate each config block against the action's Pydantic schema
5. Persist `definition_yaml` (raw) and `definition_json` (parsed) to `workflow_definitions`

#### Scenario: Creating a valid workflow

- **WHEN** `POST /api/v1/workflows/` is called with valid YAML and a valid tenant JWT
- **THEN** the system MUST persist the definition with `tenant_id` from the JWT
- **AND** MUST return `201 Created` with the assigned `id`, `name`, and `version: 1`

#### Scenario: Updating creates a new version

- **GIVEN** a workflow named `po-approval` at version 2 exists for a tenant
- **WHEN** `PUT /api/v1/workflows/{id}` is called with updated YAML
- **THEN** the existing record MUST be set to `status = deprecated`
- **AND** a new record MUST be created with `version: 3` and `status = active`

#### Scenario: Cross-tenant isolation

- **GIVEN** Tenant A has a workflow with id `abc-123`
- **WHEN** Tenant B calls `GET /api/v1/workflows/abc-123` using Tenant B's JWT
- **THEN** the response MUST be `404 Not Found`

---

### Requirement: Durable Workflow Execution Engine

The system SHALL execute active workflow definitions in response to trigger events.
The engine MUST use Celery workers for async execution and MUST persist step state
to PostgreSQL after each step so that worker crashes are recoverable.

**Execution lifecycle:**
1. Trigger event received on Redis event bus → matching enabled definitions for tenant resolved
2. `workflow_executions` row created (`status = running`)
3. Steps with no `depends_on` are dispatched to Celery immediately (in parallel if multiple)
4. Each step result (`status`, `output`, `error`) is persisted to `workflow_step_results`
5. Steps with `depends_on` are dispatched only after all their dependencies are complete
6. `condition` expressions are evaluated before running each step; false → `status = skipped`
7. All steps complete → execution `status = completed`
8. Any step fails beyond retry limit → execution `status = failed`

Template expressions in config are resolved at execution time using the live `StepContext`
(trigger payload + outputs of completed steps + tenant metadata).

**Hard limits:**
- Max steps per execution: 500
- Max execution duration: 24 hours
- Default step retry: 3 attempts with exponential backoff

#### Scenario: Successful linear execution

- **GIVEN** a workflow with steps A → B → C (B depends on A, C depends on B)
- **WHEN** the trigger event fires
- **THEN** A MUST execute first, then B, then C
- **AND** B MUST receive A's output in its `StepContext`
- **AND** a `workflow.completed` event MUST be published on the Redis event bus

#### Scenario: Parallel step execution

- **GIVEN** a workflow where steps B and C both depend only on A (no dependency on each other)
- **WHEN** A completes
- **THEN** B and C MUST be dispatched simultaneously to Celery
- **AND** execution MUST wait for both to complete before proceeding to any step that depends on either

#### Scenario: Step condition skipping

- **GIVEN** a step has `condition: "steps.check_amount.output.approved == true"`
- **AND** the `check_amount` step output has `approved: false`
- **WHEN** the engine evaluates whether to run the step
- **THEN** the step MUST be recorded as `status = skipped` in `workflow_step_results`
- **AND** execution MUST continue to subsequent steps that have no dependency on the skipped step

#### Scenario: Worker crash recovery

- **GIVEN** step 2 of a 4-step workflow is in progress when the Celery worker crashes
- **WHEN** the worker restarts
- **THEN** execution MUST resume from step 2 (re-dispatch)
- **AND** steps 1 MUST NOT be re-executed
- **AND** the execution `status` MUST NOT revert to `running` from scratch

---

### Requirement: Human Approval Gate

The runtime MUST support steps of type `erp.approval.request` that suspend execution
until a human makes a decision. Approval state MUST survive worker restarts.

#### Scenario: Approval requested and granted

- **GIVEN** a workflow step calls `erp.approval.request` for the "Finance Head" role
- **WHEN** the step executes
- **THEN** an `approval_requests` record MUST be created with `status = pending`
- **AND** the execution MUST pause at this step (`status = awaiting_approval`)
- **AND** a `workflow.awaiting_approval` event MUST be published (for real-time inbox update)
- **WHEN** a Finance Head user calls `POST /api/v1/workflows/approvals/{id}/approve`
- **THEN** the approval record MUST update to `status = approved`
- **AND** the execution MUST resume at the next step

#### Scenario: Timeout triggers escalation

- **GIVEN** an approval step has `on_timeout: { after: "24h", action: erp.approval.escalate, config: { to_role: CFO } }`
- **WHEN** 24 hours elapse without a decision
- **THEN** the original `approval_requests` record MUST be set to `status = expired`
- **AND** a new approval request MUST be created for the "CFO" role
- **AND** a `workflow.escalated` event MUST be published

#### Scenario: Rejection follows on_error branch

- **GIVEN** a step has a defined `on_error` branch and the approval is rejected
- **WHEN** the approver calls `POST /api/v1/workflows/approvals/{id}/reject`
- **THEN** execution MUST follow the `on_error` branch steps
- **AND** the rejection reason MUST be stored in `workflow_step_results`

---

### Requirement: Workflow Execution Audit

All execution state transitions MUST be written to the existing audit log system with
full context, satisfying the 7-year immutable audit trail requirement.

#### Scenario: Audit entry on execution start

- **WHEN** a workflow execution begins
- **THEN** an audit entry MUST be created with `action = workflow.started`,
  `resource_type = workflow_execution`, `tenant_id`, `trigger_event`, and `definition_id`

#### Scenario: Audit entry on approval decision

- **WHEN** an approver approves or rejects a request
- **THEN** an audit entry MUST record the approver's `user_id`, their decision,
  the reason (if provided), and the `approval_request_id`
- **AND** this entry MUST be immutable (no UPDATE/DELETE on audit_logs)
