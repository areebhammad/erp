# Tasks: Establish Core Architecture

## Change ID
`establish-core-architecture`

## Task Breakdown

### Phase 1: Foundation Setup (Week 1)

#### 1.1 Project Scaffolding
- [ ] Initialize Python project structure (`backend/` directory)
- [ ] Setup `pyproject.toml` with dependencies (FastAPI, SQLAlchemy, Alembic, pydantic, etc.)
- [ ] Configure development environment (`.env.example`, `.env`)
- [ ] Setup pre-commit hooks (black, ruff, mypy)
- [ ] Create base directory structure (`app/`, `app/core/`, `app/models/`, `app/api/`, `app/services/`)
- [ ] **Validation:** `python -m pip install -e .` succeeds, linters run

#### 1.2 FastAPI Application Setup
- [ ] Create main FastAPI app (`app/main.py`)
- [ ] Configure CORS middleware
- [ ] Setup health check endpoint (`/health`)
- [ ] Configure logging (structured JSON logs)
- [ ] Add request ID middleware
- [ ] **Validation:** `uvicorn app.main:app --reload` starts successfully, `/health` returns 200

#### 1.3 Database Connection
- [ ] Setup PostgreSQL connection configuration (`app/core/database.py`)
- [ ] Implement connection pooling with SQLAlchemy async engine
- [ ] Create database session dependency for FastAPI
- [ ] Configure Alembic for migrations (`alembic/`)
- [ ] Add database health check
- [ ] **Validation:** Database connection successful, health check passes

#### 1.4 Base Models & Schemas
- [ ] Create SQLAlchemy base models (`app/models/base.py`)
  - `GlobalBase` (id, created_at, updated_at)
  - `TenantScopedBase` (extends GlobalBase, adds tenant_id, created_by, updated_by)
- [ ] Create Pydantic base schemas (`app/schemas/base.py`)
  - `GlobalBaseSchema`
  - `TenantScopedSchema`
- [ ] Add UUID utilities and helpers
- [ ] **Validation:** Import models successfully, no circular dependencies

---

### Phase 2: Multi-Tenancy & Core Entities (Week 1-2)

#### 2.1 Tenant Model
- [ ] Create `Tenant` model (`app/models/tenant.py`)
  - Fields: id, name, slug, domain, status (active/suspended), settings (JSONB), subscription_plan
- [ ] Create Tenant Pydantic schemas (`app/schemas/tenant.py`)
  - `TenantCreate`, `TenantRead`, `TenantUpdate`
- [ ] Create Alembic migration for tenants table
- [ ] **Validation:** Migration applies successfully, table created

#### 2.2 User Model
- [ ] Create `User` model (`app/models/user.py`)
  - Fields: id, email, hashed_password, first_name, last_name, is_active, is_verified, tenant_id
- [ ] Create User Pydantic schemas (`app/schemas/user.py`)
  - `UserCreate`, `UserRead`, `UserUpdate`, `UserLogin`
- [ ] Create Alembic migration for users table
- [ ] Add unique constraint on (tenant_id, email)
- [ ] **Validation:** Migration applies, users table created with proper indexes

#### 2.3 Permission & Role Models
- [ ] Create `Role` model (`app/models/role.py`)
  - Fields: id, name, description, is_system, tenant_id
- [ ] Create `Permission` model (`app/models/permission.py`)
  - Fields: id, resource, action (create/read/update/delete), role_id
- [ ] Create `UserRole` association model (many-to-many)
- [ ] Create schemas for Role and Permission
- [ ] Create Alembic migrations
- [ ] **Validation:** Migrations apply, RBAC tables created with foreign keys

#### 2.4 Audit Log Model
- [ ] Create `AuditLog` model (`app/models/audit_log.py`)
  - Fields: id, tenant_id, user_id, action, resource_type, resource_id, changes (JSONB), ip_address, user_agent, created_at
- [ ] Create Audit Log schema
- [ ] Create Alembic migration with partitioning strategy (by month)
- [ ] **Validation:** Migration applies, partitioned table created

#### 2.5 Tenant Context Middleware
- [ ] Create tenant context middleware (`app/middleware/tenant.py`)
- [ ] Extract tenant_id from JWT token and set in request state
- [ ] Add tenant validation (ensure tenant is active)
- [ ] Create context variable for current tenant
- [ ] **Validation:** Middleware correctly extracts tenant from token, rejects invalid tenants

---

### Phase 3: Authentication & Authorization (Week 2)

#### 3.1 Password Hashing
- [ ] Implement password hashing utilities (`app/core/security.py`)
  - Use `passlib` with bcrypt
  - `hash_password()` function
  - `verify_password()` function
- [ ] **Validation:** Hash/verify roundtrip succeeds

#### 3.2 JWT Token Generation
- [ ] Implement JWT utilities (`app/core/security.py`)
  - `create_access_token()` - 15-minute expiry
  - `create_refresh_token()` - 7-day expiry
  - RS256 signing with private/public keys
- [ ] Generate RSA key pair for JWT signing (store in environment)
- [ ] **Validation:** Token generation succeeds, payload is decodable

#### 3.3 JWT Token Validation
- [ ] Implement `decode_token()` function
- [ ] Create JWT dependency for FastAPI (`get_current_user`)
  - Extracts and validates JWT from Authorization header
  - Decodes tenant_id, user_id, roles
  - Fetches user from database
- [ ] Handle expired tokens, invalid signatures
- [ ] **Validation:** Valid tokens accepted, invalid tokens rejected with 401

#### 3.4 Authentication Endpoints
- [ ] Create auth router (`app/api/v1/auth.py`)
- [ ] Implement `/auth/register` endpoint (email, password, tenant creation)
- [ ] Implement `/auth/login` endpoint (email, password → access + refresh tokens)
- [ ] Implement `/auth/refresh` endpoint (refresh token → new access token)
- [ ] Implement `/auth/logout` endpoint (optional token blacklisting)
- [ ] **Validation:** Can register user, login, receive tokens, refresh tokens

#### 3.5 Permission Checking
- [ ] Create permission checker (`app/core/permissions.py`)
  - `has_permission(user, resource, action)` function
  - Queries user's roles and permissions
- [ ] Create FastAPI dependency `require_permission(resource, action)`
- [ ] Add permission checks to protected endpoints
- [ ] **Validation:** Unauthorized users get 403, authorized users succeed

---

### Phase 4: Event System (Week 3)

#### 4.1 Redis Connection Setup
- [ ] Configure Redis connection (`app/core/redis.py`)
- [ ] Create Redis client singleton
- [ ] Add Redis health check
- [ ] **Validation:** Redis connection successful, health check passes

#### 4.2 Event Bus Implementation
- [ ] Create event bus (`app/core/events.py`)
  - `publish(event_type, payload)` - publishes to Redis channel
  - `subscribe(event_type, handler)` - registers handler
  - Event schema validation with Pydantic
- [ ] Define base event schema (`app/schemas/events.py`)
- [ ] **Validation:** Publish event to Redis, verify it's stored

#### 4.3 Event Subscriber Workers
- [ ] Create event subscriber worker (`app/workers/event_subscriber.py`)
  - Listens on Redis pub/sub channels
  - Routes events to registered handlers
  - Error handling and retries
- [ ] Create sample event handlers (`app/events/handlers/`)
  - `on_user_created` - log to audit
  - `on_tenant_created` - provision defaults
- [ ] **Validation:** Published events are received and processed by handlers

#### 4.4 Core Domain Events
- [ ] Define core events in schemas:
  - `UserCreatedEvent`
  - `UserUpdatedEvent`
  - `TenantCreatedEvent`
  - `TenantProvisionedEvent`
- [ ] Integrate event publishing into User/Tenant services
- [ ] **Validation:** Creating user/tenant triggers events, handlers execute

---

### Phase 5: Background Jobs (Week 3)

#### 5.1 Redis Queue Setup
- [ ] Install and configure RQ (Redis Queue)
- [ ] Create worker configuration (`app/core/queue.py`)
- [ ] Define queue names (default, high_priority, low_priority)
- [ ] **Validation:** RQ worker can be started

#### 5.2 Job Definitions
- [ ] Create job utilities (`app/jobs/utils.py`)
  - `enqueue_job(func, args, queue)` helper
  - Job status tracking
- [ ] Create sample jobs (`app/jobs/`)
  - `send_welcome_email(user_id)
`
  - `provision_tenant_defaults(tenant_id)`
  - `generate_report(tenant_id, report_type)`
- [ ] **Validation:** Jobs can be enqueued and execute successfully

#### 5.3 Job Monitoring
- [ ] Add job status endpoint (`/api/v1/jobs/{job_id}/status`)
- [ ] Implement job failure handling and retries
- [ ] Create failed job queue
- [ ] **Validation:** Job status can be queried, failed jobs retry

---

### Phase 6: API Foundation (Week 3-4)

#### 6.1 CRUD Utilities
- [ ] Create generic CRUD base class (`app/repositories/base.py`)
  - `create()`, `get()`, `get_multi()`, `update()`, `delete()`
  - Tenant-scoped filtering built-in
- [ ] Create service layer base (`app/services/base.py`)
- [ ] **Validation:** Base CRUD operations work with tenant filtering

#### 6.2 Tenant Management API
- [ ] Create tenant router (`app/api/v1/tenants.py`)
- [ ] Implement endpoints:
  - `GET /tenants/me` - Current tenant details
  - `PATCH /tenants/me` - Update current tenant
  - `GET /tenants/{id}` - Admin only
- [ ] Add permission checks
- [ ] **Validation:** Tenant APIs function correctly with auth

#### 6.3 User Management API
- [ ] Create user router (`app/api/v1/users.py`)
- [ ] Implement endpoints:
  - `GET /users/me` - Current user profile
  - `PATCH /users/me` - Update profile
  - `GET /users` - List users (admin)
  - `POST /users` - Create user (admin)
  - `PATCH /users/{id}` - Update user (admin)
  - `DELETE /users/{id}` - Delete user (admin)
- [ ] Add permission checks (admin only for management)
- [ ] **Validation:** User APIs work, tenant isolation enforced

#### 6.4 Role & Permission API
- [ ] Create roles router (`app/api/v1/roles.py`)
- [ ] Implement endpoints:
  - `GET /roles` - List roles
  - `POST /roles` - Create role
  - `GET /roles/{id}` - Get role
  - `PATCH /roles/{id}` - Update role
  - `DELETE /roles/{id}` - Delete role
- [ ] Create permissions router (`app/api/v1/permissions.py`)
- [ ] Add permissions management endpoints
- [ ] **Validation:** RBAC management APIs functional

---

### Phase 7: Error Handling & Utilities (Week 4)

#### 7.1 Exception Handling
- [ ] Create custom exceptions (`app/core/exceptions.py`)
  - `TenantNotFoundException`
  - `UnauthorizedException`
  - `PermissionDeniedException`
  - `ResourceNotFoundException`
- [ ] Create global exception handlers
- [ ] Standardize error response format (RFC 7807 Problem Details)
- [ ] **Validation:** Errors return consistent JSON format

#### 7.2 Pagination
- [ ] Implement cursor-based pagination (`app/utils/pagination.py`)
- [ ] Create pagination dependencies for FastAPI
- [ ] **Validation:** Paginated endpoints return correct format

#### 7.3 Filtering & Sorting
- [ ] Create query parameter parsing (`app/utils/filters.py`)
- [ ] Support operators (eq, ne, gt, lt, in, like)
- [ ] Sorting by multiple fields
- [ ] **Validation:** Filtering and sorting work correctly

---

### Phase 8: Testing (Week 4)

#### 8.1 Test Infrastructure
- [ ] Setup pytest configuration (`pytest.ini`, `conftest.py`)
- [ ] Create test database fixtures
- [ ] Create test client fixture (FastAPI TestClient)
- [ ] Create factory fixtures (tenant, user, role)
- [ ] **Validation:** Test suite runs successfully

#### 8.2 Unit Tests
- [ ] Test password hashing/verification
- [ ] Test JWT token creation/validation
- [ ] Test permission checking logic
- [ ] Test CRUD base classes
- [ ] Test event publishing/subscribing
- [ ] **Target:** 80%+ coverage for core modules

#### 8.3 Integration Tests
- [ ] Test authentication flow (register, login, refresh)
- [ ] Test tenant isolation (cross-tenant access blocked)
- [ ] Test RBAC (permission enforcement)
- [ ] Test API endpoints with auth
- [ ] Test event delivery
- [ ] Test background job execution
- [ ] **Validation:** All integration tests pass

#### 8.4 Security Tests
- [ ] Test tenant isolation (100 tenants, verify no leaks)
- [ ] Test SQL injection prevention
- [ ] Test JWT token tampering detection
- [ ] Test permission bypass attempts
- [ ] Test brute force protection (rate limiting)
- [ ] **Validation:** No security vulnerabilities found

#### 8.5 Performance Tests
- [ ] Load test: 1000 concurrent requests
- [ ] Measure API response times (p50, p95, p99)
- [ ] Test database connection pool under load
- [ ] **Target:** p95 < 500ms for read operations

---

### Phase 9: Documentation & Migration Support (Week 4)

#### 9.1 API Documentation
- [ ] Write docstrings for all endpoints
- [ ] Configure FastAPI OpenAPI/Swagger
- [ ] Add request/response examples
- [ ] **Validation:** `/docs` shows comprehensive API documentation

#### 9.2 Architecture Documentation
- [ ] Create `docs/architecture.md` (system overview)
- [ ] Create `docs/database-schema.md` (ER diagrams)
- [ ] Create `docs/authentication.md` (auth flows)
- [ ] Create `docs/multi-tenancy.md` (tenant isolation strategy)
- [ ] Create `docs/events.md` (event types and handlers)
- [ ] **Validation:** Documentation is clear and complete

#### 9.3 Developer Setup Guide
- [ ] Create `docs/getting-started.md`
  - Prerequisites
  - Environment setup
  - Running locally
  - Running tests
- [ ] Create `docs/contributing.md`
- [ ] **Validation:** New developer can follow docs and have working environment

#### 9.4 Database Migrations
- [ ] Document migration workflow
- [ ] Create rollback procedures
- [ ] Test migrations on fresh database
- [ ] **Validation:** Migrations are idempotent and reversible

---

## Dependencies

### Blocked By
- None (this is the foundational change)

### Blocks
- All future feature modules (accounts, inventory, CRM, HR, manufacturing, etc.)

### Parallel Work (Can Be Done Simultaneously)
- Frontend architecture setup (separate proposal)
- DevOps/deployment pipeline (separate proposal)

---

## Definition of Done

- [ ] All tasks completed and validated
- [ ] Test coverage >= 80% for core modules
- [ ] All integration tests passing
- [ ] Security audit tests passing (no tenant leaks)
- [ ] Performance tests passing (p95 < 500ms)
- [ ] API documentation complete
- [ ] Architecture documentation complete
- [ ] Code review completed
- [ ] No critical/high security vulnerabilities
- [ ] `openspec validate establish-core-architecture` passes

---

## Estimated Effort

- **Total:** 160 hours (4 weeks @ 40 hours/week)
- **Phase 1:** 40 hours
- **Phase 2:** 30 hours
- **Phase 3:** 30 hours
- **Phase 4:** 20 hours
- **Phase 5:** 10 hours
- **Phase 6:** 10 hours
- **Phase 7:** 5 hours
- **Phase 8:** 10 hours
- **Phase 9:** 5 hours

---

## Notes

- This is the most critical proposal - everything else builds on this
- Take time to get architecture right before rushing to features
- Security and multi-tenancy must be bulletproof
- Test thoroughly - fixing bugs later in production is expensive
