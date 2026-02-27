## ADDED Requirements

### Requirement: Workflow YAML Schema

The system SHALL define a canonical YAML schema for workflow definitions. Every saved
workflow MUST conform to this schema. The schema MUST support:

- `workflow.name` — unique per tenant, kebab-case identifier
- `workflow.trigger` — exactly one of: `event` (ERP event name + optional Jinja2 condition),
  `schedule` (cron expression in tenant timezone), or `manual: true`
- `workflow.steps[]` — ordered list of step definitions, each containing:
  - `id` — unique within the workflow
  - `action` — dot-namespaced action name from the action registry (e.g. `erp.approval.request`)
  - `depends_on` — zero or more step IDs that must complete before this step runs
  - `condition` — optional Jinja2 boolean expression; step is skipped if false
  - `config` — action-specific config object (validated by the action's Pydantic schema)
  - `on_timeout` — optional: `{ after, action, config }` for approval steps
  - `on_error` — optional: `{ action, config }` fallback on step failure

Template expressions in `config` values MUST use `{{ }}` Jinja2 syntax and MUST only
reference `trigger.*`, `steps.<id>.output.*`, or `tenant.*` variables.

#### Scenario: Valid definition is accepted

- **GIVEN** an admin submits a YAML definition with a valid trigger, valid action names,
  and config blocks matching each action's schema
- **WHEN** the system validates it
- **THEN** validation MUST pass and the definition MUST be saved to `workflow_definitions`

#### Scenario: Unknown action name is rejected

- **GIVEN** a YAML definition references `action: erp.payroll.run_payslip`
- **WHEN** that action is not registered in the action registry for this tenant's modules
- **THEN** validation MUST fail with an error identifying the unknown action name
- **AND** the definition MUST NOT be saved

#### Scenario: Invalid config block is rejected

- **GIVEN** a step uses `action: erp.approval.request` but `config.role` is missing
- **WHEN** the system validates the config against the action's Pydantic schema
- **THEN** validation MUST fail with a field-level error: `steps[0].config.role: required`
- **AND** the definition MUST NOT be saved

---

### Requirement: Action Registry

The system SHALL maintain an in-memory Action Registry populated at application startup.
Each ERP module MUST register its available workflow actions. Only actions from
modules enabled for the tenant's plan SHALL appear as valid in that tenant's context.

**Phase 1 built-in actions:**

| Action name | Module | Description |
|---|---|---|
| `erp.approval.request` | Core | Create a human approval task for a role |
| `erp.approval.escalate` | Core | Re-route pending approval to a different role |
| `erp.approval.auto_approve` | Core | Automatically mark as approved |
| `erp.notification.send` | Core | Send email / WhatsApp / in-app notification |
| `erp.webhook.post` | Core | Call an external HTTP endpoint |
| `erp.ledger.journal_entry` | Finance | Post a double-entry journal entry |
| `erp.ledger.create_payment` | Finance | Record an outbound payment |
| `erp.purchase_order.lock` | Procurement | Lock a PO from further edits |
| `erp.purchase_order.cancel` | Procurement | Cancel a purchase order |
| `erp.inventory.adjust_stock` | Inventory | Adjust stock level for a SKU/warehouse |
| `erp.inventory.trigger_reorder` | Inventory | Create a reorder purchase requisition |
| `erp.gst.generate_invoice` | Finance | Generate a GST-compliant invoice |
| `erp.gst.submit_to_irp` | Finance | Submit invoice to India's IRP portal |

#### Scenario: Module-aware action filtering

- **GIVEN** Tenant A has Finance and Procurement modules enabled
- **AND** Tenant A does NOT have the Inventory module
- **WHEN** the AI generation endpoint fetches the action catalogue for Tenant A
- **THEN** `erp.inventory.*` actions MUST NOT be included in the catalogue
- **AND** a definition referencing `erp.inventory.adjust_stock` MUST fail validation for Tenant A

#### Scenario: New module auto-registers actions

- **GIVEN** the Payroll module is added and registers `erp.payroll.run_payslip`
- **WHEN** the application restarts
- **THEN** `erp.payroll.run_payslip` MUST be available in the registry
- **AND** tenants with the Payroll module enabled MUST be able to use it in workflows
  without any registry migration step
