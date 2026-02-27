# Proposal: Establish Core Architecture

## Change ID
`establish-core-architecture`

## Status
🔴 **DRAFT** - Awaiting Review

## Type
Foundation / Enterprise Architecture

## Why

We need foundational enterprise architecture to build a production-ready AI-First ERP system. Currently, we have strategy documents but no actual codebase or infrastructure. This proposal establishes the technical foundation that enables all future feature development.

Without this core architecture:
- Business modules (Accounts, Inventory, CRM) have nowhere to run
- Multi-tenant SaaS cannot function without proper data isolation
- AI services cannot integrate without standardized interfaces
- Development team cannot build features in a coordinated, consistent manner

This is the **bedrock change** - no value is delivered to end users directly, but all future value depends on this foundation being built correctly.

## Overview

Establish the foundational enterprise architecture for the AI-First ERP platform. This change defines the core infrastructure, multi-tenant architecture, database schema patterns, API framework, authentication/authorization, and event-driven messaging that all future modules will build upon.

This is the **bedrock proposal** - no features are implemented here, only the architectural foundation that enables rapid development of business modules (Accounts, Inventory, CRM, HR, etc.).


## Problem Statement

We need to build a modern, AI-native ERP platform from scratch that:

1. **Supports Multi-Tenancy** - Serve 1,000+ companies on shared infrastructure with complete data isolation
2. **Enables AI Integration** - Provide hooks for AI services to augment every business process
3. **Ensures Scalability** - Handle growing transaction volumes and concurrent users
4. **Maintains Data Integrity** - ACID compliance for financial data, immutable audit logs
5. **Allows Rapid Extension** - New modules should integrate seamlessly without core changes
6. **Provides Security** - Row-level tenant isolation, encrypted data, secure API access

Without a well-designed core architecture, we risk:
- **Technical debt** from inconsistent patterns across modules
- **Performance issues** from poor database design
- **Security vulnerabilities** from inadequate tenant isolation
- **Development bottlenecks** from tight coupling between components

## Goals

### Primary Goals
1. **Multi-Tenant Data Architecture** - Define tenant isolation strategy (shared tables with tenant_id)
2. **Core Domain Models** - Establish base entities (Tenant, User, Permission, AuditLog)
3. **API Framework** - FastAPI application structure with middleware, authentication, error handling
4. **Event System** - Pub/sub infrastructure for cross-module communication
5. **Database Foundation** - PostgreSQL schema design, migrations, connection pooling
6. **Security Framework** - JWT authentication, RBAC, row-level security
7. **AI Service Integration Layer** - Standardized interface for AI capabilities
8. **Background Job Infrastructure** - Redis Queue setup for async processing

### Non-Goals (Future Proposals)
- ❌ Business module implementations (Accounts, Inventory, etc.)
- ❌ Frontend application architecture (separate proposal)
- ❌ Deployment infrastructure (Kubernetes, CI/CD - separate proposal)
- ❌ Specific AI features/workflows (separate proposal per module)
- ❌ External integrations (payment gateways, GST portal - separate proposals)

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                        │
│  - FastAPI application                                       │
│  - Rate limiting middleware                                  │
│  - Tenant context middleware                                 │
│  - Authentication/Authorization                              │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Identity   │    │  Permissions │    │    Events    │
│   Service    │    │    Engine    │    │   Service    │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Core Data Layer                            │
│  - PostgreSQL (multi-tenant with tenant_id)                 │
│  - SQLAlchemy ORM + Alembic migrations                      │
│  - Connection pooling (PgBouncer)                           │
│  - Tenant-scoped queries (automatic filtering)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Supporting Services                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Redis    │  │  MinIO     │  │  Qdrant    │            │
│  │  (Cache+   │  │  (Object   │  │  (Vectors) │            │
│  │   Queue)   │  │  Storage)  │  │            │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### 1. Multi-Tenancy Strategy: Shared Tables with tenant_id

**Decision:** Use a shared database with `tenant_id` column on all tenant-scoped tables.

**Alternatives Considered:**
- ❌ **Database per tenant** - Too expensive, hard to manage at scale
- ❌ **Schema per tenant** - Better than DB-per-tenant but still management overhead
- ✅ **Shared tables with tenant_id** - Most efficient, proven at scale

**Implementation:**
- Every business entity table has `tenant_id UUID NOT NULL`
- Composite indexes: `CREATE INDEX idx_entity_tenant ON table(tenant_id, id)`
- SQLAlchemy filters automatically inject tenant context
- Row-level security (RLS) as defense-in-depth

#### 2. Base Entity Pattern

All domain entities inherit from common base models:

```python
class TenantScopedBase:
    """Base for all tenant-scoped entities"""
    id: UUID (primary key)
    tenant_id: UUID (foreign key to tenants)
    created_at: datetime
    updated_at: datetime
    created_by: UUID (foreign key to users)
    updated_by: UUID (foreign key to users)
    
class GlobalBase:
    """Base for global entities (tenants, users, etc.)"""
    id: UUID (primary key)
    created_at: datetime
    updated_at: datetime
```

#### 3. Event-Driven Architecture

Use Redis pub/sub for cross-module communication:

```python
# Event types
domain_events = [
    "user.created",
    "user.updated", 
    "user.deleted",
    "tenant.created",
    "tenant.provisioned",
    # Future: invoice.created, payment.received, etc.
]

# Publishers publish events
event_bus.publish("user.created", {"user_id": "...", "tenant_id": "..."})

# Subscribers listen
@event_bus.subscribe("user.created")
async def on_user_created(event_data):
    # Trigger welcome email, create default permissions, etc.
```

#### 4. Authentication & Authorization

**Authentication:**
- JWT tokens with RS256 signing
- Access token (15 min expiry) + Refresh token (7 days)
- Token payload includes: user_id, tenant_id, roles

**Authorization:**
- Role-Based Access Control (RBAC)
- Permissions stored in database
- Middleware validates permissions on every request

#### 5. API Design Principles

- **RESTful routes:** `/api/v1/resources`
- **Tenant context:** Extracted from JWT token (not URL)
- **Pagination:** Cursor-based for large datasets
- **Error handling:** Consistent error response format
- **Versioning:** `/api/v1/`, `/api/v2/` for breaking changes

#### 6. Database Migration Strategy

- **Alembic** for schema migrations
- **Idempotent migrations** - can be re-run safely
- **Zero-downtime deployments** - use expand-contract pattern
- **Tenant-aware migrations** - some migrations may need tenant_id context

## Impact Assessment

### Components Affected
- ✅ **New:** Core application framework (FastAPI app)
- ✅ **New:** Database schema foundation
- ✅ **New:** Authentication/authorization system
- ✅ **New:** Event bus infrastructure
- ✅ **New:** Background job processing
- ✅ **New:** Multi-tenant data access layer

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tenant isolation bugs | Medium | **CRITICAL** | Extensive testing, RLS as backup, automated security audits |
| Performance degradation at scale | Medium | High | Load testing, connection pooling, caching strategy |
| Migration complexity | Low | Medium | Use proven migration patterns, test on staging |
| JWT token security | Low | High | Short expiry, secure key rotation, token blacklisting |

### Dependencies
- PostgreSQL 15+
- Redis 7+
- Python 3.11+
- FastAPI 0.100+

## Success Criteria

### Functional Requirements
- ✅ Multi-tenant data isolation working (no cross-tenant data leaks)
- ✅ User authentication via JWT tokens
- ✅ Role-based permission checks enforced
- ✅ Event pub/sub functional (publish + subscribe)
- ✅ Background jobs can be enqueued and processed
- ✅ Database migrations can be applied/rolled back
- ✅ API responds with proper error handling

### Non-Functional Requirements
- ✅ API response time p95 < 500ms (simple queries)
- ✅ Support 100+ concurrent requests
- ✅ Database connection pool manages 1000+ connections
- ✅ 0 cross-tenant data leaks in security audit
- ✅ All core components have 80%+ test coverage

### Validation Tests
1. **Tenant Isolation Test:** Create 100 tenants, verify queries return only tenant-scoped data
2. **Authentication Test:** Valid/invalid JWT tokens, expiry handling, refresh flow
3. **Permission Test:** RBAC rules correctly allow/deny API access
4. **Event Test:** Published events received by all subscribers
5. **Load Test:** 1000 concurrent requests with no errors
6. **Migration Test:** Apply/rollback migrations successfully

## Timeline Estimate

**Total:** 3-4 weeks

### Week 1: Foundation (40 hours)
- FastAPI app structure
- Database models (Tenant, User, Permission, AuditLog)
- Alembic migration setup
- Multi-tenant middleware
- Basic CRUD APIs for core entities

### Week 2: Auth & Permissions (40 hours)
- JWT authentication implementation
- Refresh token flow
- RBAC permission engine
- Middleware for permission checks
- Security tests

### Week 3: Events & Background Jobs (40 hours)
- Redis pub/sub event bus
- Event schema definitions
- Redis Queue (RQ) setup
- Sample background job workers
- Event delivery tests

### Week 4: Testing & Documentation (40 hours)
- Integration tests
- Load/performance tests
- Security audit tests
- API documentation (OpenAPI)
- Architecture documentation

## Open Questions

1. **Tenant onboarding:** Should tenant provisioning be synchronous or async?
   - **Proposed:** Async via background job (provision DB resources, seed data)

2. **Session management:** Redis-based sessions or stateless JWT only?
   - **Proposed:** Stateless JWT for API, Redis sessions for web app

3. **Audit log retention:** How long to keep audit logs? Archival strategy?
   - **Proposed:** 7 years (regulatory requirement), archive to S3 after 1 year

4. **Multi-region:** Single region initially or design for multi-region from day 1?
   - **Proposed:** Single region (India) initially, design extensible

##Related Changes
- **Depends on:** None (foundational change)
- **Blocks:** All future feature modules (accounts, inventory, CRM, etc.)
- **Related:** 
  - Future: `setup-frontend-architecture`
  - Future: `setup-deployment-pipeline`
  - Future: `implement-ai-service-layer`

## References
- [FastAPI Multi-Tenancy Best Practices](https://fastapi.tiangolo.com/)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Multi-Tenant Data Architecture](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
- [Event-Driven Architecture Patterns](https://martinfowler.com/articles/201701-event-driven.html)
