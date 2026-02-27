# Project Context

## Purpose

Building an **AI-First Enterprise Resource Planning (ERP)** platform specifically designed for the Indian market. The platform aims to:

- Provide 100% feature parity with existing ERP solutions (SAP, Oracle, ERPNext, Zoho)
- Deliver AI-native capabilities throughout (not bolt-on features)
- Enable 7-day implementation cycles (vs 6-month traditional ERP deployments)
- Offer 10x cost reduction compared to enterprise ERPs
- Provide deep Indian compliance (GST, TDS, E-invoice, E-way bill)
- Support multi-tenant SaaS architecture serving 1,000+ companies

## Tech Stack

### Backend
- Python 3.11+ (FastAPI framework)
- SQLAlchemy ORM with Alembic migrations
- Pydantic for data validation
- asyncio for async operations

### Frontend
- React 18 with TypeScript
- Vite build tool
- TanStack Query for data fetching
- Zustand for state management
- shadcn/ui component library
- Tailwind CSS

### Data Layer
- PostgreSQL 15+ (primary database with JSONB support)
- Redis 7+ (caching, sessions, pub/sub)
- Qdrant Cloud (vector database for AI/semantic search)
- SeaweedFS (S3-compatible object storage, Apache 2.0 licensed)

### AI/ML
- **Tambo** (frontend AI agent - tools, MCP, generative UI, conversation management)
- **Azure OpenAI** (LLM API - GPT-4, GPT-3.5-turbo via Tambo)
- **Qdrant Cloud** (vector database for semantic search, RAG)
- **LangChain** (optional - complex backend AI workflows if needed)
- Python ML stack (scikit-learn, pandas, numpy)

### Infrastructure
- Docker containerization
- Docker Compose (development)
- Kubernetes (production scaling)
- GitHub Actions (CI/CD)

### Queue & Workers
- Redis Queue (RQ) initially
- Celery for background jobs
- Kafka (future event streaming)

## Project Conventions

### Code Style

**Python:**
- Black formatter (line length: 88)
- Pylint + Ruff for linting
- mypy for type checking
- Google-style docstrings
- Type hints mandatory

**TypeScript/React:**
- ESLint + Prettier
- Functional components with hooks
- Named exports preferred
- Strict TypeScript mode

### Architecture Patterns

**Core Principles:**
- **API-First:** All functionality exposed via REST APIs
- **Event-Driven:** Pub/sub for cross-module communication
- **Multi-Tenant:** Shared database with tenant isolation (tenant_id column)
- **Modular Monolith:** Start as monolith, extract services as needed
- **Metadata-Driven:** Schema and workflows configurable without code changes

**Key Patterns:**
- Repository pattern for data access
- Service layer for business logic
- Domain-driven design (DDD) for module boundaries
- CQRS for read-heavy operations
- Event sourcing for audit trails

### Testing Strategy

**Coverage Requirements:**
- Core modules: 80%+ coverage
- Critical paths (accounting, inventory): 90%+ coverage
- AI features: Integration tests with mocked LLMs

**Test Pyramid:**
- Unit tests (pytest) - 70%
- Integration tests (pytest with TestClient) - 20%
- E2E tests (Playwright) - 10%

**CI/CD:**
- All tests run on PR
- Type checking enforced
- Linting must pass
- No merge without approval + passing tests

### Git Workflow

- **Main branch:** Production-ready code
- **Feature branches:** `feature/<change-id>`
- **Hotfix branches:** `hotfix/<issue>`
- **Commit convention:** Semantic commits (feat:, fix:, docs:, refactor:)
- **Squash merge** to main
- **Semantic versioning:** Major.Minor.Patch

## Domain Context

### ERP Fundamentals
- **Double-entry accounting** is the foundation of all financial transactions
- **Multi-currency** support required for global operations
- **Fiscal year** can differ from calendar year
- **Chart of Accounts** structure varies by country/industry
- **Inventory valuation:** FIFO, LIFO, Moving Average methods
- **Manufacturing:** BOM (Bill of Materials) drives production

### Indian Market Specifics
- **GST:** 5 slabs (0%, 5%, 12%, 18%, 28%) + Cess
- **CGST + SGST** for intra-state, **IGST** for inter-state
- **TDS:** Tax Deducted at Source (various sections: 194J, 194C, etc.)
- **E-Invoice:** Mandatory for B2B transactions >₹5L turnover
- **E-Way Bill:** Required for goods movement >₹50K
- **Compliance:** Monthly GSTR-1, GSTR-3B; Annual GSTR-9
- **Financial Year:** April 1 to March 31

### Multi-Tenancy
- Each company/organization is a **tenant**
- Tenants share infrastructure but isolated data
- Tenant-aware caching and queries
- Row-level security with tenant_id

## Important Constraints

### Business Constraints
- **Bootstrap/Early Stage:** Cost-sensitive infrastructure
- **India-First:** Must support Indian compliance from day 1
- **Speed to Market:** Ship MVP in 3-6 months
- **Hiring Pool:** Must use tech stack easy to hire for in India

### Technical Constraints
- **Multi-Tenant SaaS:** Must support 1,000+ tenants on shared infrastructure
- **Data Isolation:** Complete tenant data separation (regulatory requirement)
- **Audit Trail:** Financial transactions must be immutable with full history
- **ACID Compliance:** Financial data integrity is non-negotiable (PostgreSQL required)
- **Offline Support:** POS must work offline (eventual consistency)
- **Mobile-First:** Full functionality on mobile devices

### Regulatory Constraints
- **Data Residency:** Customer data must stay in India (GDPR-equivalent)
- **Financial Compliance:** Audit logs required for 7 years
- **GST Portal Integration:** Real-time sync with government systems
- **E-Invoice Schema:** Must match government prescribed JSON schema
- **PF/ESI:** HR must comply with Indian labor laws

### Performance Constraints
- **API Response Time:** p95 < 500ms for read operations
- **Report Generation:** < 30 seconds for standard reports
- **Concurrent Users:** Support 100+ concurrent users per tenant
- **Data Volume:** Scale to 10M+ transactions per tenant

## External Dependencies

### Payment Gateways
- **Razorpay** (primary for India)
- **PayU** (fallback)
- **Cashfree** (alternative)

### Communication
- **Fast2SMS** (SMS/OTP in India)
- **Twilio** (international SMS)
- **SendGrid** (transactional email)

### AI/ML Services
- **Tambo** (AI agent platform - frontend, handles LLM orchestration, tools, MCP)
- **Azure OpenAI** (LLM provider - GPT-4, GPT-3.5-turbo, embeddings)
- **Qdrant Cloud** (vector database for semantic search)
- **OpenAI API** (alternative/fallback to Azure OpenAI)

### Government Portals (India)
- **GST Network (GSTN)** - GST filing
- **E-Invoice Portal** - IRP integration
- **E-Way Bill Portal** - Transport documentation
- **Income Tax Portal** - TDS filing

### Banking
- **ICICI Bank API** (payment collections)
- **HDFC Bank API** (alternative)
- **UPI Integration** (via Razorpay)
- **NACH** (auto-debit mandates)

### Logistics (India)
- **Delhivery API** (shipping)
- **BlueDart API** (courier)
- **India Post API** (postal services)

### Storage & Infrastructure
- **SeaweedFS** (self-hosted S3-compatible object storage, Apache 2.0)
- **AWS S3** (fallback/production)
- **Cloudflare CDN** (static assets)


### Monitoring & Observability
- **Sentry** (error tracking)
- **Grafana + Prometheus** (metrics)
- **LogRocket** (frontend monitoring)

### Future Considerations (Not in MVP)

**Backend AI Workflows (Phase 2+):**
- **LangChain** - Python AI framework for complex backend workflows
  - Use for: Complex document extraction pipelines, advanced RAG, multi-agent systems
  - MVP uses Tambo (frontend) calling FastAPI endpoints directly
  - Add LangChain when backend AI workflows become too complex to manage manually
  - Phasing: MVP (Tambo only) → Phase 2 (add LangChain for specific heavy workflows)

**Authentication Alternatives:**
- **Better Auth** - TypeScript authentication framework (multi-tenant, OAuth, 2FA)
  - Note: TypeScript/Node.js only - NOT compatible with Python/FastAPI
  - Only relevant if switching to Next.js backend
