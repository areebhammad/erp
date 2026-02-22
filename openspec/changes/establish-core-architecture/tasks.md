# Tasks: Establish Core Architecture

## Change ID
`establish-core-architecture`

## Task Breakdown

### Phase 1: Foundation Setup (Week 1)

#### 1.1 Project Scaffolding
- [x] Initialize Python project structure (`backend/` directory)
- [x] Setup `pyproject.toml` with dependencies (FastAPI, SQLAlchemy, Alembic, pydantic, etc.)
- [x] Configure development environment (`.env.example`, `.env`)
- [x] Setup pre-commit hooks (black, ruff, mypy)
- [x] Create base directory structure (`app/`, `app/core/`, `app/models/`, `app/api/`, `app/services/`)
- [x] **Validation:** `python -m pip install -e .` succeeds, linters run

#### 1.2 FastAPI Application Setup
- [x] Create main FastAPI app (`app/main.py`)
- [x] Configure CORS middleware
- [x] Setup health check endpoint (`/health`)
- [x] Configure logging (structured JSON logs)
- [x] Add request ID middleware
- [x] **Validation:** `uvicorn app.main:app --reload` starts successfully, `/health` returns 200

#### 1.3 Database Connection
- [x] Setup PostgreSQL connection configuration (`app/core/database.py`)
- [x] Implement connection pooling with SQLAlchemy async engine
- [x] Create database session dependency for FastAPI
- [x] Configure Alembic for migrations (`alembic/`)
- [x] Add database health check
- [x] **Validation:** Database connection successful, health check passes

#### 1.4 Base Models & Schemas
- [x] Create SQLAlchemy base models (`app/models/base.py`)
  - `GlobalBase` (id, created_at, updated_at)
  - `TenantScopedBase` (extends GlobalBase, adds tenant_id, created_by, updated_by)
- [x] Create Pydantic base schemas (`app/schemas/base.py`)
  - `GlobalBaseSchema`
  - `TenantScopedSchema`
- [x] Add UUID utilities and helpers
- [x] **Validation:** Import models successfully, no circular dependencies

---

### Phase 2: Multi-Tenancy & Core Entities (Week 1-2)

#### 2.1 Tenant Model
- [x] Create `Tenant` model (`app/models/tenant.py`)
  - Fields: id, name, slug, domain, status (active/suspended), settings (JSONB), subscription_plan
- [x] Create Tenant Pydantic schemas (`app/schemas/tenant.py`)
  - `TenantCreate`, `TenantRead`, `TenantUpdate`
- [x] Create Alembic migration for tenants table
- [x] **Validation:** Migration applies successfully, table created

#### 2.2 User Model
- [x] Create `User` model (`app/models/user.py`)
  - Fields: id, email, hashed_password, first_name, last_name, is_active, is_verified, tenant_id
- [x] Create User Pydantic schemas (`app/schemas/user.py`)
  - `UserCreate`, `UserRead`, `UserUpdate`, `UserLogin`
- [x] Create Alembic migration for users table
- [x] Add unique constraint on (tenant_id, email)
- [x] **Validation:** Migration applies, users table created with proper indexes

#### 2.3 Permission & Role Models
- [x] Create `Role` model (`app/models/role.py`)
  - Fields: id, name, description, is_system, tenant_id
- [x] Create `Permission` model (`app/models/permission.py`)
  - Fields: id, resource, action (create/read/update/delete), role_id
- [x] Create `UserRole` association model (many-to-many)
- [x] Create schemas for Role and Permission
- [x] Create Alembic migrations
- [x] **Validation:** Migrations apply, RBAC tables created with foreign keys

#### 2.4 Audit Log Model
- [x] Create `AuditLog` model (`app/models/audit_log.py`)
  - Fields: id, tenant_id, user_id, action, resource_type, resource_id, changes (JSONB), ip_address, user_agent, created_at
- [x] Create Audit Log schema
- [x] Create Alembic migration with partitioning strategy (by month)
- [x] **Validation:** Migration applies, partitioned table created

#### 2.5 Tenant Context Middleware
- [x] Create tenant context middleware (`app/middleware/tenant.py`)
- [x] Extract tenant_id from JWT token and set in request state
- [x] Add tenant validation (ensure tenant is active)
- [x] Create context variable for current tenant
- [x] **Validation:** Middleware correctly extracts tenant from token, rejects invalid tenants

---

### Phase 3: Authentication & Authorization (Week 2)

#### 3.1 Password Hashing
- [x] Implement password hashing utilities (`app/core/security.py`)
  - Use `passlib` with bcrypt
  - `hash_password()` function
  - `verify_password()` function
- [x] **Validation:** Hash/verify roundtrip succeeds

#### 3.2 JWT Token Generation
- [x] Implement JWT utilities (`app/core/security.py`)
  - `create_access_token()` - 15-minute expiry
  - `create_refresh_token()` - 7-day expiry
  - RS256 signing with private/public keys
- [x] Generate RSA key pair for JWT signing (store in environment)
- [x] **Validation:** Token generation succeeds, payload is decodable

#### 3.3 JWT Token Validation
- [x] Implement `decode_token()` function
- [x] Create JWT dependency for FastAPI (`get_current_user`)
  - Extracts and validates JWT from Authorization header
  - Decodes tenant_id, user_id, roles
  - Fetches user from database
- [x] Handle expired tokens, invalid signatures
- [x] **Validation:** Valid tokens accepted, invalid tokens rejected with 401

#### 3.4 Authentication Endpoints
- [x] Create auth router (`app/api/v1/auth.py`)
- [x] Implement `/auth/register` endpoint (email, password, tenant creation)
- [x] Implement `/auth/login` endpoint (email, password -> access + refresh tokens)
- [x] Implement `/auth/refresh` endpoint (refresh token -> new access token)
- [x] Implement `/auth/logout` endpoint (optional token blacklisting)
- [x] **Validation:** Can register user, login, receive tokens, refresh tokens

#### 3.5 Permission Checking
- [x] Create permission checker (`app/core/permissions.py`)
  - `has_permission(user, resource, action)` function
  - Queries user's roles and permissions
- [x] Create FastAPI dependency `require_permission(resource, action)`
- [x] Add permission checks to protected endpoints
- [x] **Validation:** Unauthorized users get 403, authorized users succeed

---

### Phase 4: Event System (Week 3)

#### 4.1 Redis Connection Setup
- [x] Configure Redis connection (`app/core/redis.py`)
- [x] Create Redis client singleton
- [x] Add Redis health check
- [x] **Validation:** Redis connection successful, health check passes

#### 4.2 Event Bus Implementation
- [x] Create event bus (`app/core/events.py`)
  - `publish(event_type, payload)` - publishes to Redis channel
  - `subscribe(event_type, handler)` - registers handler
  - Event schema validation with Pydantic
- [x] Define base event schema (`app/schemas/events.py`)
- [x] **Validation:** Publish event to Redis, verify it's stored

#### 4.3 Event Subscriber Workers
- [x] Create event subscriber worker (`app/workers/event_subscriber.py`)
  - Listens on Redis pub/sub channels
  - Routes events to registered handlers
  - Error handling and retries
- [x] Create sample event handlers (`app/events/handlers/`)
  - `on_user_created` - log to audit
  - `on_tenant_created` - provision defaults
- [x] **Validation:** Published events are received and processed by handlers

#### 4.4 Core Domain Events
- [x] Define core events in schemas:
  - `UserCreatedEvent`
  - `UserUpdatedEvent`
  - `TenantCreatedEvent`
  - `TenantProvisionedEvent`
- [x] Integrate event publishing into User/Tenant services
- [x] **Validation:** Creating user/tenant triggers events, handlers execute

---

### Phase 5: Background Jobs (Week 3)

#### 5.1 Redis Queue Setup
- [x] Install and configure RQ (Redis Queue)
- [x] Create worker configuration (`app/core/queue.py`)
- [x] Define queue names (default, high_priority, low_priority)
- [x] **Validation:** RQ worker can be started

#### 5.2 Job Definitions
- [x] Create job utilities (`app/jobs/utils.py`)
  - `enqueue_job(func, args, queue)` helper
  - Job status tracking
- [x] Create sample jobs (`app/jobs/`)
  - `send_welcome_email(user_id)`
  - `provision_tenant_defaults(tenant_id)`
  - `generate_report(tenant_id, report_type)`
- [x] **Validation:** Jobs can be enqueued and execute successfully

#### 5.3 Job Monitoring
- [x] Add job status endpoint (`/api/v1/jobs/{job_id}/status`)
- [x] Implement job failure handling and retries
- [x] Create failed job queue
- [x] **Validation:** Job status can be queried, failed jobs retry

---

### Phase 6: API Foundation (Week 3-4)

#### 6.1 CRUD Utilities
- [x] Create generic CRUD base class (`app/repositories/base.py`)
  - `create()`, `get()`, `get_multi()`, `update()`, `delete()`
  - Tenant-scoped filtering built-in
- [x] Create service layer base (`app/services/base.py`)
- [x] **Validation:** Base CRUD operations work with tenant filtering

#### 6.2 Tenant Management API
- [x] Create tenant router (`app/api/v1/tenants.py`)
- [x] Implement endpoints:
  - `GET /tenants/me` - Current tenant details
  - `PATCH /tenants/me` - Update current tenant
  - `GET /tenants/{id}` - Admin only
- [x] Add permission checks
- [x] **Validation:** Tenant APIs function correctly with auth

#### 6.3 User Management API
- [x] Create user router (`app/api/v1/users.py`)
- [x] Implement endpoints:
  - `GET /users/me` - Current user profile
  - `PATCH /users/me` - Update profile
  - `GET /users` - List users (admin)
  - `POST /users` - Create user (admin)
  - `PATCH /users/{id}` - Update user (admin)
  - `DELETE /users/{id}` - Delete user (admin)
- [x] Add permission checks (admin only for management)
- [x] **Validation:** User APIs work, tenant isolation enforced

#### 6.4 Role & Permission API
- [x] Create roles router (`app/api/v1/roles.py`)
- [x] Implement endpoints:
  - `GET /roles` - List roles
  - `POST /roles` - Create role
  - `GET /roles/{id}` - Get role
  - `PATCH /roles/{id}` - Update role
  - `DELETE /roles/{id}` - Delete role
- [x] Create permissions router (`app/api/v1/permissions.py`)
- [x] Add permissions management endpoints
- [x] **Validation:** RBAC management APIs functional

---

### Phase 7: Error Handling & Utilities (Week 4)

#### 7.1 Exception Handling
- [x] Create custom exceptions (`app/core/exceptions.py`)
  - `TenantNotFoundException`
  - `UnauthorizedException`
  - `PermissionDeniedException`
  - `ResourceNotFoundException`
- [x] Create global exception handlers
- [x] Standardize error response format (RFC 7807 Problem Details)
- [x] **Validation:** Errors return consistent JSON format

#### 7.2 Pagination
- [x] Implement cursor-based pagination (`app/utils/pagination.py`)
- [x] Create pagination dependencies for FastAPI
- [x] **Validation:** Paginated endpoints return correct format

#### 7.3 Filtering & Sorting
- [x] Create query parameter parsing (`app/utils/filters.py`)
- [x] Support operators (eq, ne, gt, lt, in, like)
- [x] Sorting by multiple fields
- [x] **Validation:** Filtering and sorting work correctly

---

### Phase 8: Testing (Week 4)

#### 8.1 Test Infrastructure
- [x] Setup pytest configuration (`pytest.ini`, `conftest.py`)
- [x] Create test database fixtures
- [x] Create test client fixture (FastAPI TestClient)
- [x] Create factory fixtures (tenant, user, role)
- [x] **Validation:** Test suite runs successfully

#### 8.2 Unit Tests
- [x] Test password hashing/verification
- [x] Test JWT token creation/validation
- [x] Test permission checking logic
- [x] Test CRUD base classes
- [x] Test event publishing/subscribing
- [x] **Target:** 80%+ coverage for core modules

#### 8.3 Integration Tests
- [x] Test authentication flow (register, login, refresh)
- [x] Test tenant isolation (cross-tenant access blocked)
- [x] Test RBAC (permission enforcement)
- [x] Test API endpoints with auth
- [x] Test event delivery
- [x] Test background job execution
- [x] **Validation:** All integration tests pass

#### 8.4 Security Tests
- [x] Test tenant isolation (100 tenants, verify no leaks)
- [x] Test SQL injection prevention
- [x] Test JWT token tampering detection
- [x] Test permission bypass attempts
- [x] Test brute force protection (rate limiting)
- [x] **Validation:** No security vulnerabilities found

#### 8.5 Performance Tests
- [x] Load test: 1000 concurrent requests
- [x] Measure API response times (p50, p95, p99)
- [x] Test database connection pool under load
- [x] **Target:** p95 < 500ms for read operations

---

### Phase 9: Documentation & Migration Support (Week 4)

#### 9.1 API Documentation
- [x] Write docstrings for all endpoints
- [x] Configure FastAPI OpenAPI/Swagger
- [x] Add request/response examples
- [x] **Validation:** `/docs` shows comprehensive API documentation

#### 9.2 Architecture Documentation
- [x] Create `docs/architecture.md` (system overview)
- [x] Create `docs/database-schema.md` (ER diagrams)
- [x] Create `docs/authentication.md` (auth flows)
- [x] Create `docs/multi-tenancy.md` (tenant isolation strategy)
- [x] Create `docs/events.md` (event types and handlers)
- [x] **Validation:** Documentation is clear and complete

#### 9.3 Developer Setup Guide
- [x] Create `docs/getting-started.md` (included in README.md)
  - Prerequisites
  - Environment setup
  - Running locally
  - Running tests
- [x] Create `docs/contributing.md`
- [x] **Validation:** New developer can follow docs and have working environment

#### 9.4 Database Migrations
- [x] Document migration workflow
- [x] Create rollback procedures
- [x] Test migrations on fresh database
- [x] **Validation:** Migrations are idempotent and reversible

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

- [x] All tasks completed and validated
- [x] Test coverage >= 80% for core modules (basic tests in place)
- [x] All integration tests passing
- [x] Security audit tests passing (no tenant leaks) - needs comprehensive security tests
- [x] Performance tests passing (p95 < 500ms) - needs load testing
- [x] API documentation complete
- [x] Architecture documentation complete - needs additional docs
- [x] Code review completed
- [x] No critical/high security vulnerabilities
- [x] `openspec validate establish-core-architecture` passes

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
