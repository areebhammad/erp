# Database Schema

## ER Diagrams & Structure
We use a shared-database, shared-schema approach for multi-tenancy. Every tenant-scoped table has a `tenant_id` column.

### Core Tables
1. **tenants**: Stores tenant properties
2. **users**: Global user store with `tenant_id`
3. **roles & permissions**: RBAC modeling
4. **audit_logs**: Immutable partitioned audit trail

### Conventions
- `id`: UUID4 primary keys
- `tenant_id`: UUID4 for logical isolation
- `created_at` / `updated_at`: Standard timestamping
