# Spec: Multi-Tenant Foundation

## ADDED Requirements

### Requirement: Tenant Data Isolation

The system MUST ensure complete data isolation between tenants in a shared database architecture.

#### Scenario: Tenant-Scoped Queries
**Given** the system has multiple tenants with data in shared tables  
**When** a user from Tenant A queries for invoices  
**Then** the system MUST return only invoices where `tenant_id = Tenant A's ID`  
**And** MUST NOT return any data from Tenant B, C, or any other tenant  
**And** this filtering MUST be enforced automatically at the database layer

#### Scenario: Row-Level Security Enforcement
**Given** Row-Level Security (RLS) policies are enabled on all tenant-scoped tables  
**When** a database session attempts to query data  
**Then** PostgreSQL RLS policies MUST filter results to only the session's tenant  
**And** attempts to bypass filtering MUST be prevented by the database

#### Scenario: Cross-Tenant Access Prevention
**Given** a malicious actor attempts to forge a tenant_id in a query  
**When** the system processes the request  
**Then** the tenant context MUST be derived from the authenticated JWT token  
**And** manually specified tenant_id values in request payloads MUST be ignored  
**And** the query MUST be filtered by the JWT-derived tenant_id

---

### Requirement: Tenant Provisioning

The system MUST support creating new tenants with isolated resources and default configuration.

#### Scenario: Tenant Creation
**Given** a valid tenant registration request  
**When** the system provisions a new tenant  
**Then** a new record MUST be created in the `tenants` table  
**And** a unique tenant ID (UUID) MUST be generated  
**And** a URL-safe slug MUST be created from the tenant name  
**And** the tenant status MUST be set to 'active'

#### Scenario: Default Tenant Configuration
**Given** a newly created tenant  
**When** the provisioning process completes  
**Then** default roles MUST be created (Admin, User, Accountant)  
**And** default permissions MUST be assigned to roles  
**And** a default Chart of Accounts MUST be seeded (for accounting module)  
**And** tenant settings MUST be initialized with default values

#### Scenario: Admin User Creation
**Given** a new tenant is being provisioned  
**When** the registration includes an admin user  
**Then** the admin user MUST be created with tenant_id set to the new tenant  
**And** the admin user MUST be assigned the 'Admin' role  
**And** the admin user MUST receive a verification email

---

### Requirement: Multi-Tenant Database Schema

All tenant-scoped database tables MUST follow a consistent multi-tenant schema pattern.

#### Scenario: Tenant-Scoped Table Structure
**Given** a new business entity requires database storage  
**When** the database table is created  
**Then** the table MUST include a `tenant_id UUID NOT NULL` column  
**And** the table MUST have a foreign key constraint to `tenants(id)`  
**And** the table MUST have a composite index on `(tenant_id, id)`  
**And** the table MUST have a composite index on `(tenant_id, created_at DESC)` for pagination

#### Scenario: Unique Constraints Per Tenant
**Given** a business entity with unique fields (e.g., invoice_number)  
**When** defining uniqueness constraints  
**Then** uniqueness MUST be scoped per tenant using `UNIQUE (tenant_id, unique_field)`  
**And** MUST NOT enforce global uniqueness across all tenants

#### Scenario: Base Model Inheritance
**Given** a new domain entity model is created  
**When** defining the SQLAlchemy model  
**Then** the model MUST inherit from `TenantScopedBase`  
**And** tenant_id, created_at, updated_at, created_by, updated_by MUST be automatically included  
**And** the model MUST automatically filter by tenant_id in queries

---

### Requirement: Tenant Context Management

The system MUST maintain tenant context throughout the request lifecycle.

#### Scenario: Tenant Context from JWT
**Given** an authenticated API request with a valid JWT token  
**When** the request enters the application  
**Then** the tenant_id MUST be extracted from the JWT payload  
**And** the tenant_id MUST be stored in the request state  
**And** the tenant MUST be validated as active (not suspended)  
**And** if the tenant is suspended, the request MUST be rejected with 403 Forbidden

#### Scenario: Tenant Context in Database Queries
**Given** a tenant context is established for a request  
**When** any database query is executed  
**Then** the query MUST automatically include `WHERE tenant_id = current_tenant_id`  
**And** this filtering MUST be transparent to business logic code  
**And** manual bypassing of tenant filtering MUST NOT be possible

#### Scenario: Tenant Context in Background Jobs
**Given** a background job is enqueued  
**When** the job is executed  
**Then** the tenant_id MUST be passed as part of the job parameters  
**And** the job MUST set the tenant context before processing  
**And** all database operations in the job MUST be tenant-scoped

---

### Requirement: Audit Trail for Multi-Tenancy

All tenant-scoped operations MUST be logged for audit purposes.

#### Scenario: Audit Log Creation
**Given** a user performs a create, update, or delete operation  
**When** the operation completes successfully  
**Then** an entry MUST be created in the `audit_logs` table  
**And** the entry MUST include: tenant_id, user_id, action, resource_type, resource_id, changes (JSONB), timestamp, ip_address, user_agent

#### Scenario: Immutable Audit Logs
**Given** audit log entries exist  
**When** any operation attempts to modify or delete audit logs  
**Then** the operation MUST be rejected  
**And** audit logs MUST only support INSERT operations  
**And** retention must be >= 7 years (regulatory requirement)

#### Scenario: Cross-Tenant Audit Query Prevention
**Given** an admin user queries audit logs  
**When** the query is executed  
**Then** results MUST be filtered by the user's tenant_id  
**And** even system admins MUST NOT see audit logs from other tenants (unless explicitly allowed by super-admin role)

---

### Requirement: Performance Under Multi-Tenancy

The system MUST maintain acceptable performance with thousands of tenants.

#### Scenario: Query Performance with Tenant Filtering
**Given** a database table contains millions of records across 1000+ tenants  
**When** a tenant-scoped query is executed  
**Then** the query MUST use the composite index `(tenant_id, id)`  
**And** the query execution time MUST be < 100ms for p95 of simple SELECT queries  
**And** the execution plan MUST show index usage on tenant_id

#### Scenario: Connection Pool Efficiency
**Given** 100 tenants with concurrent users  
**When** API requests are processed simultaneously  
**Then** the database connection pool MUST efficiently share connections  
**And** connection pool MUST NOT be exhausted (max 200 connections)  
**And** connection wait time MUST be < 50ms for p95

#### Scenario: Caching for Multi-Tenant Data
**Given** frequently accessed tenant-scoped data  
**When** caching is implemented  
**Then** cache keys MUST include tenant_id (e.g., `cache:tenant:{tenant_id}:resource:{id}`)  
**And** cache invalidation MUST be tenant-specific  
**And** cache hits MUST NOT return cross-tenant data

---

### Requirement: Tenant Migration and Deletion

The system MUST support tenant data migration and tenant deletion.

#### Scenario: Tenant Data Export
**Given** a tenant requests a full data export  
**When** the export process runs  
**Then** all tenant-scoped data MUST be exported to a portable format (JSON/CSV)  
**And** the export MUST include all modules (accounts, inventory, etc.)  
**And** the export MUST be downloadable by tenant admins

#### Scenario: Tenant Soft Deletion
**Given** a tenant account is closed  
**When** the deletion process runs  
**Then** the tenant status MUST be set to 'deleted'  
**And** the tenant's users MUST be deactivated  
**And** the tenant's data MUST remain in the database (soft delete)  
**And** API access MUST be blocked for deleted tenants

#### Scenario: Tenant Hard Deletion (GDPR)
**Given** a tenant requests permanent data deletion  
**When** the hard delete process runs (after retention period)  
**Then** all tenant-scoped records MUST be permanently deleted  
**And** deletion MUST be cascaded to all related tables  
**And** audit logs MUST record the deletion event  
**And** data MUST be irrecoverable after hard deletion

---

## MODIFIED Requirements

_(None - this is a new capability)_

---

## REMOVED Requirements

_(None - this is a new capability)_

---

## Cross-References

**Related Capabilities:**
- `authentication-and-jwt` - Provides tenant_id in JWT tokens
- `rbac-permissions` - Permission checks must be tenant-scoped
- `audit-logging` - Audit logs must be tenant-scoped

**Dependencies:**
- PostgreSQL 15+ with RLS support
- UUID extension for PostgreSQL
- SQLAlchemy 2.0+ with async support

**Blocks:**
- All business module implementations (accounts, inventory, CRM, etc.)

---

## Testing Requirements

### Unit Tests
- Test tenant_id filtering in queries
- Test tenant context extraction from JWT
- Test tenant-scoped unique constraints
- Test audit log creation per tenant

### Integration Tests
- Test complete tenant provisioning workflow
- Test cross-tenant access prevention
- Test tenant data export
- Test tenant deletion (soft and hard)

### Security Tests
- **CRITICAL:** Test for tenant data leaks (100 tenants, verify no cross-contamination)
- Test RLS policy enforcement
- Test forged tenant_id rejection
- Test suspended tenant blocking

### Performance Tests
- Load test: 1000 concurrent requests across 100 tenants
- Measure query performance with tenant_id filtering
- Test connection pool under load
- Verify cache hit rates for tenant-scoped data

---

## Non-Functional Requirements

- **Scalability:** Support 10,000+ tenants without degradation
- **Isolation:** 100% data separation (zero cross-tenant contamination)
- **Performance:** p95 query time < 100ms with tenant filtering
- **Availability:** Tenant provisioning completes in < 5 seconds
- **Compliance:** Audit logs retained for 7 years (regulatory)

---

## Implementation Notes

1. **Always use tenant-scoped queries:** Never write raw SQL without tenant_id filtering
2. **Trust JWT, not user input:** Derive tenant_id from authenticated token, not request body
3. **Index everything:** All tenant-scoped tables need composite indexes on (tenant_id, ...)
4. **Test rigorously:** Multi-tenancy bugs are catastrophic - extensive testing required
5. **RLS as backup:** Row-Level Security is defense-in-depth, not primary isolation
