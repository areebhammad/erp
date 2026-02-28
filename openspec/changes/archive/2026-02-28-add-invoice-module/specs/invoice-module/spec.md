## ADDED Requirements

### Requirement: Customer Management

The system SHALL provide full CRUD management for Customer master records per tenant.
Each customer SHALL have a `legal_name`, `display_name`, optional `gstin` (15-character
alphanumeric, format-validated), optional `pan` (10-character format-validated),
`billing_address` and optional `shipping_address` stored as JSONB,
`currency_code` (default `INR`), `payment_terms_days` (default 30),
and a `receivable_account_id` linking to the tenant's Accounts Receivable leaf account.

#### Scenario: Create a customer with GSTIN
- **WHEN** an admin creates a customer with a valid `gstin` (e.g., `27AAPFU0939F1ZV`)
- **THEN** the customer record is persisted with `is_active=true`
- **AND** the system validates the GSTIN matches the 15-character alphanumeric pattern
- **AND** the customer is returned in `GET /api/v1/invoices/customers`

#### Scenario: GSTIN format validation failure
- **WHEN** an admin submits a customer with a malformed `gstin` (e.g., `INVALID`)
- **THEN** the system MUST reject with a 422 error indicating the GSTIN format is invalid
- **AND** no customer record is created

#### Scenario: Deactivate a customer with open invoices
- **WHEN** an admin deactivates a customer that has open (submitted, unpaid) invoices
- **THEN** the customer is deactivated (`is_active=false`)
- **AND** existing submitted invoices remain valid and visible
- **AND** the customer can no longer be selected for new invoices

#### Scenario: Cross-tenant isolation
- **WHEN** user from Tenant A queries customers
- **THEN** ONLY customers where `tenant_id = Tenant A` are returned

---

### Requirement: Vendor Management

The system SHALL provide full CRUD management for Vendor master records per tenant.
Each vendor SHALL have the same fields as a Customer, except it links to a
`payable_account_id` (Accounts Payable) instead of a receivable account.
A party MAY exist as both a Customer and a Vendor simultaneously (separate rows).

#### Scenario: Create a vendor
- **WHEN** an admin creates a vendor record with `legal_name`, `payable_account_id`
  pointing to a valid Accounts Payable leaf account, and optional `gstin`
- **THEN** the vendor is persisted and returned in `GET /api/v1/invoices/vendors`

#### Scenario: Same entity as customer and vendor
- **WHEN** a vendor is created with the same `legal_name` as an existing customer
- **THEN** both records coexist independently (separate IDs)
- **AND** no constraint prevents this — the business may buy from and sell to the same entity

---

### Requirement: Sales Invoice Lifecycle

The system SHALL support creating, editing, submitting, and cancelling Sales Invoices.
A Sales Invoice is a commercial document raised against a Customer for goods or services
provided. The status lifecycle is: `draft` → `submitted` → `cancelled`.

A Sales Invoice SHALL contain a header (customer, invoice date, due date, currency, notes)
and one or more line items (description, quantity, unit price, discount, account, optional
tax rate). Tax amounts SHALL be computed at submission time.

#### Scenario: Create a draft sales invoice
- **WHEN** a user creates a sales invoice via `POST /api/v1/invoices/invoices` with
  `invoice_type=sales`, a valid `customer_id`, `invoice_date`, `due_date`, and at least
  one line item
- **THEN** a draft invoice is saved with `status=draft` and an auto-assigned
  `invoice_number` (tenant-scoped sequence)
- **AND** no journal entry is created yet

#### Scenario: Update a draft invoice
- **WHEN** a user updates line items on a draft invoice via `PATCH /api/v1/invoices/invoices/{id}`
- **THEN** the changes are saved and totals recomputed
- **AND** the invoice remains in `draft` status

#### Scenario: Submit a sales invoice
- **WHEN** a user calls `POST /api/v1/invoices/invoices/{id}/submit` on a `draft` invoice
- **THEN** the system computes `tax_amount` per line using the linked `tax_rate_id`
- **AND** `subtotal`, `total_tax`, and `total` are frozen on the invoice header
- **AND** the system calls `LedgerService.post_journal()` with:
  - DR Accounts Receivable (customer's `receivable_account_id`) for `total`
  - CR each line's `account_id` for `line_total`
  - CR each tax rate's `linked_account_id` (Output Tax Payable) for `tax_amount`
- **AND** the invoice `status` transitions to `submitted`
- **AND** `journal_entry_id` is set to the returned `JournalEntry.id`
- **AND** event `invoice.submitted` is published to the event bus

#### Scenario: Prevent editing a submitted invoice
- **WHEN** a user attempts `PATCH` on an invoice with `status=submitted`
- **THEN** the system MUST return 403 Forbidden with message "Invoice is immutable after submission"

#### Scenario: Cancel a submitted invoice
- **WHEN** a user calls `POST /api/v1/invoices/invoices/{id}/cancel` on a `submitted` invoice
- **THEN** the system calls `LedgerService.reverse_journal()` to negate the original posting
- **AND** the invoice `status` transitions to `cancelled`
- **AND** event `invoice.cancelled` is published

#### Scenario: Reject submission of zero-line invoice
- **WHEN** a user submits an invoice that has no line items
- **THEN** the system MUST return 422 Unprocessable Entity

---

### Requirement: Purchase Invoice Lifecycle

The system SHALL support creating, submitting, and cancelling Purchase Invoices.
A Purchase Invoice is raised by a Vendor and recorded by the tenant. The lifecycle mirrors
Sales Invoice (`draft` → `submitted` → `cancelled`) but the ledger posting is inverted:
expense accounts are debited and Accounts Payable is credited.

#### Scenario: Submit a purchase invoice
- **WHEN** a user submits a purchase invoice with `invoice_type=purchase`, a valid
  `vendor_id`, and line items referencing expense or asset accounts
- **THEN** `LedgerService.post_journal()` is called with:
  - DR each line's `account_id` (Expense/Asset) for `line_total`
  - DR each tax rate's `linked_account_id` (Input Tax Credit) for `tax_amount`
  - CR Accounts Payable (vendor's `payable_account_id`) for `total`
- **AND** the invoice `status` transitions to `submitted`

#### Scenario: Purchase invoice inherits fiscal year validation
- **WHEN** a user submits a purchase invoice with `invoice_date` in a closed fiscal year
- **THEN** the system MUST return 422 because `LedgerService` rejects the posting date

---

### Requirement: Credit Notes and Debit Notes

The system SHALL support issuing Credit Notes (against Sales Invoices) and
Debit Notes (against Purchase Invoices) as formal corrections or returns.
Credit/Debit notes SHALL reference the original invoice via `reversal_of` FK and produce
a reversal journal entry.

#### Scenario: Issue a credit note against a sales invoice
- **WHEN** a user calls `POST /api/v1/invoices/invoices/{id}/credit-note`
  on a `submitted` sales invoice
- **THEN** a new invoice record is created with `invoice_type=credit_note`,
  `reversal_of=<original_invoice_id>`, line items copied (negated amounts)
- **AND** on submission of the credit note, `LedgerService.post_journal()` is called
  with the inverse posting of the original (CR Accounts Receivable, DR Revenue, DR Tax)
- **AND** event `invoice.credit_note_issued` is published

#### Scenario: Cannot credit-note a cancelled invoice
- **WHEN** a user attempts to create a credit note against an invoice with `status=cancelled`
- **THEN** the system MUST return 422 with message "Cannot issue credit note against a cancelled invoice"

---

### Requirement: AR and AP Aging Report

The system SHALL provide Accounts Receivable (AR) and Accounts Payable (AP) aging reports
that group outstanding submitted invoices by how many days past their due date they are.
Buckets SHALL be: Current (not yet due), 1–30 days overdue, 31–60 days, 61–90 days, 91+ days.

#### Scenario: View AR aging as of today
- **WHEN** an admin requests `GET /api/v1/invoices/reports/ar-aging`
- **THEN** the response lists all customers with outstanding submitted sales invoices
- **AND** each customer row shows totals broken down by the five overdue buckets
- **AND** the report only includes invoices with `status=submitted` and no linked payment
  marking them as fully settled (payment is future — in this module outstanding = all submitted)

#### Scenario: View AP aging as of a historical date
- **WHEN** an admin requests `GET /api/v1/invoices/reports/ap-aging?as_of=2025-12-31`
- **THEN** only invoices with `invoice_date <= 2025-12-31` and `status=submitted` are included
- **AND** overdue calculation uses the `as_of` date instead of today

---

### Requirement: Sales Invoice PDF Generation

The system SHALL generate a printable PDF for any submitted Sales Invoice via
`GET /api/v1/invoices/invoices/{id}/pdf`. The PDF SHALL include: tenant name and address,
customer name and billing address, invoice number and date, line items table, GST breakdown
(CGST/SGST/IGST per rate), subtotal, total tax, and grand total. The PDF SHALL be returned
as `application/pdf` with a `Content-Disposition: attachment` header.

#### Scenario: Download invoice PDF
- **WHEN** an authenticated user requests `GET /api/v1/invoices/invoices/{id}/pdf`
  for a `submitted` sales invoice
- **THEN** the server responds with a binary PDF stream
- **AND** the PDF includes the correct invoice number, customer name, and line items

#### Scenario: Reject PDF for draft invoice
- **WHEN** a user requests the PDF for an invoice with `status=draft`
- **THEN** the system MUST return 422 with message "PDF is only available for submitted invoices"
