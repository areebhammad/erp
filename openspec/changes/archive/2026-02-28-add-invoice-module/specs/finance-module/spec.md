## ADDED Requirements

### Requirement: LedgerService Usage by External Modules

The system SHALL document the canonical ledger posting patterns that modules
outside the finance package use when calling `LedgerService.post_journal()`.
External modules SHALL NEVER write directly to `journal_entries` or `journal_lines`
tables. They SHALL pass all journal lines as a single balanced batch.

Canonical posting patterns (to be extended by future modules):

**Sales Invoice posting (invoice module):**
```
DR  customer.receivable_account  ← invoice.total
CR  line.account_id              ← line.line_total  (per line)
CR  tax_rate.linked_account_id   ← line.tax_amount  (per taxed line)
```

**Purchase Invoice posting (invoice module):**
```
DR  line.account_id              ← line.line_total  (per line)
DR  tax_rate.linked_account_id   ← line.tax_amount  (per taxed line — Input Tax Credit)
CR  vendor.payable_account       ← invoice.total
```

#### Scenario: Invoice module calls LedgerService on submission
- **WHEN** `InvoiceService.submit()` is called for a valid sales invoice
- **THEN** exactly one call to `LedgerService.post_journal()` is made
- **AND** the resulting `JournalEntry.id` is saved on `invoices.journal_entry_id`
- **AND** no direct writes to `journal_entries` or `journal_lines` occur outside `LedgerService`
