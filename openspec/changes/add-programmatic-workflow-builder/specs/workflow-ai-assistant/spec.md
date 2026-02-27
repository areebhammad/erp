## ADDED Requirements

### Requirement: AI YAML Generation from Plain English

The system SHALL provide an in-app AI assistant that generates a valid workflow YAML
definition from a plain-English description typed by the admin. The assistant MUST be
powered by Tambo (frontend agent) calling a FastAPI backend endpoint that enriches
the prompt with live tenant context before querying Azure OpenAI GPT-4.

The generation endpoint (`POST /api/v1/workflows/ai/generate`) MUST:
1. Fetch the tenant's active modules, role catalogue, chart of accounts summary
2. Query the action registry for all actions available to this tenant
3. Build an enriched system prompt containing the YAML schema, action catalogue,
   and tenant context (roles, module list)
4. Call Azure OpenAI GPT-4 with the enriched system prompt and the admin's description
5. Parse and validate the returned YAML (action names, config schemas)
6. Retry up to 2 times if the output fails validation
7. Return `{ yaml: string, explanation: string[] }` on success or `422` after retries

The AI MUST only generate YAML that references actions and roles that exist for
this specific tenant. It MUST NOT hallucinate action names or role names.

#### Scenario: Basic workflow generation

- **GIVEN** an admin types: *"When a purchase order above ₹5 lakh is created,
  ask the Finance Head to approve it. If they don't respond in 24 hours, escalate to CFO."*
- **WHEN** the assistant submits the request to the generation endpoint
- **THEN** the endpoint MUST return valid YAML containing:
  - `trigger.event: purchase_order.created`
  - `trigger.condition: "trigger.total_amount > 500000"`
  - a step using `erp.approval.request` with `role: Finance Head`
  - `on_timeout.after: 24h` with `erp.approval.escalate` to CFO
- **AND** the YAML MUST pass schema and registry validation before being returned

#### Scenario: Context-aware role resolution

- **GIVEN** the tenant's role catalogue contains "Finance Head" and "CFO"
  but does NOT contain "Finance Manager"
- **WHEN** an admin asks for a workflow involving "Finance Manager" approval
- **THEN** the assistant MUST either map to the closest existing role ("Finance Head")
  or ask the admin to clarify — it MUST NOT generate YAML with a non-existent role name
- **AND** the resulting YAML MUST pass validation (non-existent roles fail validation)

#### Scenario: Iterative refinement

- **GIVEN** a workflow has been generated with a PO approval step
- **WHEN** the admin follows up: *"Also send a WhatsApp to the vendor when approved"*
- **THEN** the endpoint MUST be called with both the original YAML and the follow-up message
- **AND** the response MUST be updated YAML that adds the notification step
  while preserving all existing steps unchanged

#### Scenario: LLM validation failure is handled gracefully

- **GIVEN** GPT-4 returns YAML where an action name does not exist in the registry
- **WHEN** the endpoint validates the output
- **THEN** it MUST retry the call (up to 2 retries, passing the validation error as feedback)
- **AND** if all retries produce invalid YAML, it MUST return `422` with a user-legible error
- **AND** the frontend MUST display: *"I couldn't generate a valid workflow. Please try
  rephrasing or use the YAML editor directly."*

---

### Requirement: In-App AI Workflow Assistant Panel

The system SHALL provide a split-pane Workflow Builder UI at
`/workflows/builder` consisting of:
- **Left pane:** Tambo chat interface where the admin types requirements in plain English
- **Right pane:** Syntax-highlighted YAML preview (Monaco editor) showing the generated
  or manually edited definition
- **Action bar:** Save as Draft, Validate, Enable buttons

The chat panel MUST maintain conversation history within the session so that
follow-up refinements modify the existing YAML rather than generating from scratch.

#### Scenario: Workflow builder page loads correctly

- **WHEN** an admin navigates to `/workflows/builder`
- **THEN** the page MUST render with the split-pane layout
- **AND** the chat panel MUST show a prompt: *"Describe your business process in plain
  English and I'll configure it for you."*
- **AND** the YAML pane MUST be empty with a placeholder skeleton

#### Scenario: Save and enable from builder

- **GIVEN** a valid YAML has been generated and is shown in the YAML pane
- **WHEN** the admin clicks "Enable"
- **THEN** the frontend MUST call `POST /api/v1/workflows/` with the YAML
- **AND** on `201 Created`, MUST redirect to the workflow list with a success toast
  showing the workflow name and version number

---

### Requirement: Approval Inbox

The system SHALL provide a real-time Approval Inbox at `/workflows/approvals` that
shows all pending approval requests routed to the current user's roles.

The inbox MUST update in real time when new approval requests arrive (via SSE or
WebSocket subscribing to `workflow.awaiting_approval` events on the Redis pub/sub).

#### Scenario: Pending approval appears in inbox

- **GIVEN** a workflow execution creates an approval request for the "CFO" role
- **WHEN** a user with the CFO role has the Approval Inbox open
- **THEN** the new approval card MUST appear within 5 seconds without requiring a page refresh
- **AND** the card MUST show: workflow name, related entity (e.g. PO number and amount),
  requester, how long ago it was created, and time remaining before escalation

#### Scenario: Approving from inbox

- **GIVEN** a CFO has a pending approval card in their inbox
- **WHEN** they click "Approve" (with an optional comment)
- **THEN** `POST /api/v1/workflows/approvals/{id}/approve` MUST be called
- **AND** the card MUST be removed from the inbox immediately optimistically
- **AND** a success toast MUST confirm: *"Purchase Order #PO-2345 approved"*
