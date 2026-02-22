# Multi-Tenancy Strategy

## Design
We use a **shared-database, shared-schema** model.

## Tenant Isolation
Every business record MUST have a `tenant_id` column.
For queries, the system extracts the `tenant_id` from the JWT API request context and adds filters to all queries.

## Row-Level Security
PostgreSQL RLS ensures defense-in-depth data isolation by strictly permitting access based on current tenant context.
