## ADDED Requirements

### Requirement: Workflow Management List

The system SHALL provide a Workflow Management page at `/workflows` that lists all
workflow definitions for the tenant. The list MUST show: name, version, enabled status,
trigger type, last execution time, last execution status, and action buttons.

#### Scenario: Workflow list displays all tenant workflows

- **WHEN** an admin navigates to `/workflows`
- **THEN** the page MUST call `GET /api/v1/workflows/` and render one row per active definition
- **AND** disabled and deprecated workflows MUST be filterable via a status toggle
- **AND** each row MUST have: Edit (opens builder with existing YAML), Enable/Disable toggle,
  View History, and Delete actions

#### Scenario: Enable/Disable toggle

- **GIVEN** a workflow is currently enabled
- **WHEN** an admin clicks the Disable toggle
- **THEN** `PATCH /api/v1/workflows/{id}/toggle` MUST be called
- **AND** the row MUST update immediately to show "Disabled" status
- **AND** no new executions MUST be triggered for this workflow until it is re-enabled

---

### Requirement: Workflow Execution History

The system SHALL provide an Execution History view for each workflow definition,
accessible from the workflow list. The view MUST show all past executions with their
status, trigger payload summary, step timeline, and any errors.

#### Scenario: Execution history shows step-by-step timeline

- **GIVEN** a workflow has completed executions
- **WHEN** an admin clicks "View History" on a workflow row
- **THEN** a list of past executions MUST be shown with: start time, duration, status,
  and trigger payload summary
- **WHEN** the admin expands an execution
- **THEN** a step-by-step timeline MUST be shown: each step's name, status (completed /
  skipped / failed), start time, duration, and output/error details

#### Scenario: Failed execution shows actionable error

- **GIVEN** an execution failed at a specific step
- **WHEN** the admin views the execution history
- **THEN** the failed step MUST be highlighted in red with the error message
- **AND** a "Retry" button MUST be shown that re-triggers the execution from the failed step

---

### Requirement: Built-in Workflow Templates

The system SHALL seed each new tenant with 5 pre-built workflow definitions at tenant
creation time. These templates MUST be versioned, named clearly, and enabled by default
but editable by the tenant admin.

**Required templates:**
1. `purchase-order-approval` — Amount threshold check → Finance Head approval → CFO escalation
2. `three-way-invoice-matching` — Match PO + GRN + invoice; flag mismatches for review
3. `low-stock-reorder-alert` — Inventory below reorder point → notify purchasing team
4. `key-account-sales-order-approval` — SO above threshold → Sales Head + Finance Head approval
5. `gst-reconciliation-reminder` — Monthly scheduled → notify accounts team to run GSTR-3B

#### Scenario: Templates are seeded on new tenant creation

- **WHEN** a new tenant is provisioned
- **THEN** all 5 template workflow definitions MUST be inserted into `workflow_definitions`
  with `tenant_id` set to the new tenant
- **AND** each template MUST be set to `enabled = true`
- **AND** template YAML MUST be valid (passes schema and registry validation)

#### Scenario: Admin can edit a template

- **GIVEN** the `purchase-order-approval` template exists for a tenant
- **WHEN** an admin opens it in the workflow builder and changes the approval threshold
- **THEN** `PUT /api/v1/workflows/{id}` MUST save it as a new version (e.g., version 2)
- **AND** the original template (version 1) MUST be retained as deprecated for audit purposes
