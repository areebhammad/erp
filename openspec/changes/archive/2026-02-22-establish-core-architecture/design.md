# Design Document: Core Architecture

## Change ID
`establish-core-architecture`

## Purpose

This document captures the architectural decisions, trade-offs, and technical design patterns for the foundational ERP platform infrastructure. It serves as the technical blueprint for all future development.

---

## System Context

### Business Requirements
- Multi-tenant SaaS ERP serving 1,000+ companies
- AI-native capabilities integrated throughout
- Indian compliance (GST, TDS, E-invoice) from day 1
- 7-day implementation cycles (vs 6-month traditional ERP)
- 10x cost reduction vs SAP/Oracle

### Technical Requirements
- ACID compliance for financial transactions
- Row-level tenant data isolation
- p95 API response time < 500ms
- Support 100+ concurrent users per tenant
- Scale to 10M+ transactions per tenant
- 7-year audit log retention

---

## Architecture Decisions

### ADR-001: Multi-Tenancy Model

#### Context
We need to serve 1,000+ companies (tenants) on shared infrastructure with complete data isolation while maintaining cost efficiency.

#### Options Evaluated

**Option 1: Database Per Tenant**
- **Pros:** Complete isolation, easy tenant-specific backups, simple scaling
- **Cons:** High cost (1000 databases), management overhead, complex migrations
- **Verdict:** ❌ Too expensive at scale

**Option 2: Schema Per Tenant (PostgreSQL Schemas)**
- **Pros:** Better than DB-per-tenant, easier management
- **Cons:** Still management overhead, connection pooling complexity
- **Verdict:** ❌ Not optimal for our scale

**Option 3: Shared Tables with tenant_id Column**
- **Pros:** Cost-efficient, proven at scale (Salesforce, Shopify use this), simple
- **Cons:** Requires disciplined query filtering, risk of data leaks if buggy
- **Verdict:** ✅ **SELECTED**

#### Decision
Use **shared tables with tenant_id** column on all tenant-scoped entities.

#### Implementation Details

```sql
-- Every tenant-scoped table follows this pattern
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    invoice_number TEXT NOT NULL,
    customer_id UUID NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Enforce uniqueness per tenant
    UNIQUE (tenant_id, invoice_number)
);

-- Composite index for efficient tenant-filtered queries
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id, id);
CREATE INDEX idx_invoices_tenant_created ON invoices(tenant_id, created_at DESC);
```

**Defense-in-Depth with Row-Level Security:**

```sql
-- Enable RLS as backup protection
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's data
CREATE POLICY tenant_isolation ON invoices
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**SQLAlchemy Automatic Filtering:**

```python
# Base model with automatic tenant filtering
class TenantScopedModel(Base):
    __abstract__ = True
    
    tenant_id = Column(UUID, nullable=False, index=True)
    
    @classmethod
    def query(cls, session, tenant_id):
        """Always filter by tenant_id"""
        return session.query(cls).filter(cls.tenant_id == tenant_id)
```

#### Consequences
- ✅ Cost-effective scaling
- ✅ Simple migrations (single schema)
- ✅ Efficient resource utilization
- ⚠️ Must ensure tenant_id filtering in ALL queries (unit test enforcement)
- ⚠️ Requires RLS as safety net

---

### ADR-002: API Framework Selection

#### Context
Need a modern Python web framework with async support, good performance, and excellent developer experience.

#### Options Evaluated

| Framework | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **Django** | Batteries-included, mature, ORM | Sync by default, heavier, template engine not needed | ❌ Too heavy for API-only |
| **Flask** | Lightweight, flexible | Sync, manual setup, aging | ❌ Lacks modern features |
| **FastAPI** | Async, fast, auto docs, type hints, Pydantic | Newer (less mature) | ✅ **SELECTED** |
| **Starlette** | Fast, minimal | Too low-level, manual setup | ❌ Need higher-level abstractions |

#### Decision
Use **FastAPI** with async/await throughout.

#### Rationale
- Native async/await - critical for I/O-heavy ERP operations
- Automatic OpenAPI/Swagger documentation
- Pydantic integration for validation
- Type hints for better IDE support
- Dependency injection system
- WebSocket support for real-time features
- Excellent performance (comparable to Node.js)

#### Implementation Pattern

```python
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

app = FastAPI(
    title="AI-First ERP API",
    version="1.0.0",
    docs_url="/api/docs"
)

# Dependency for database session
async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

# Dependency for current user (from JWT)
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    # Decode JWT, fetch user
    pass

# Dependency for tenant context
async def get_tenant_context(
    user: User = Depends(get_current_user)
) -> TenantContext:
    return TenantContext(tenant_id=user.tenant_id)

# Endpoint with all dependencies injected
@app.get("/api/v1/invoices")
async def list_invoices(
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
    user: User = Depends(get_current_user)
):
    # Automatic tenant filtering
    invoices = await InvoiceService.get_multi(db, ctx.tenant_id)
    return invoices
```

---

### ADR-003: ORM vs Query Builder

#### Decision
Use **SQLAlchemy ORM** with async support.

#### Rationale
- Type-safe models
- Relationship mapping
- Lazy loading control
- Migration support (Alembic)
- Better than raw SQL for complex queries
- Async support (asyncpg driver)

#### Implementation

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncAttrs
from uuid import UUID, uuid4
from datetime import datetime

class Base(AsyncAttrs, DeclarativeBase):
    pass

class TenantScopedBase(Base):
    __abstract__ = True
    
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

class Invoice(TenantScopedBase):
    __tablename__ = "invoices"
    
    invoice_number: Mapped[str]
    customer_id: Mapped[UUID]
    total_amount: Mapped[Decimal]
```

---

### ADR-004: Authentication Strategy

#### Context
Need secure, scalable authentication for multi-tenant SaaS.

#### Decision
**JWT (JSON Web Tokens)** with RS256 signing.

#### Token Structure

```python
# Access Token (15 min expiry)
{
    "sub": "user_id_uuid",
    "tenant_id": "tenant_uuid",
    "email": "user@example.com",
    "roles": ["admin", "user"],
    "exp": 1234567890,
    "iat": 1234567800,
    "type": "access"
}

# Refresh Token (7 days expiry)
{
    "sub": "user_id_uuid",
    "tenant_id": "tenant_uuid",
    "exp": 1234567890,
    "iat": 1234567800,
    "type": "refresh"
}
```

#### Security Considerations

1. **Short-lived access tokens** (15 min) - limits damage if stolen
2. **RS256 signing** - public key can verify, only server can sign
3. **Refresh token rotation** - each refresh generates new refresh token
4. **Token blacklisting** (optional) - Redis-based invalidation for logout
5. **HTTPS only** - tokens only transmitted over TLS

#### Implementation

```python
from jose import jwt, JWTError
from datetime import datetime, timedelta

PRIVATE_KEY = load_private_key()  # RSA private key
PUBLIC_KEY = load_public_key()    # RSA public key

def create_access_token(user_id: UUID, tenant_id: UUID, roles: List[str]):
    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "roles": roles,
        "exp": datetime.utcnow() + timedelta(minutes=15),
        "iat": datetime.utcnow(),
        "type": "access"
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
        return payload
    except JWTError:
        raise UnauthorizedException("Invalid token")
```

---

### ADR-005: Authorization Model

#### Decision
**Role-Based Access Control (RBAC)** with resource-level permissions.

#### Permission Model

```
Permission = (Resource, Action)
Resource = "invoices" | "customers" | "users" | etc.
Action = "create" | "read" | "update" | "delete"

Role = Set of Permissions
User = Set of Roles (per tenant)

Example:
- Role: "Accountant"
  - Permissions:
    - (invoices, create)
    - (invoices, read)
    - (invoices, update)
    - (payments, create)
    - (payments, read)

- Role: "Sales Rep"
  - Permissions:
    - (customers, create)
    - (customers, read)
    - (customers, update)
    - (quotations, create)
    - (quotations, read)
```

#### Database Schema

```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,  -- System roles can't be deleted
    UNIQUE (tenant_id, name)
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    role_id UUID REFERENCES roles(id),
    resource TEXT NOT NULL,  -- 'invoices', 'customers', etc.
    action TEXT NOT NULL,    -- 'create', 'read', 'update', 'delete'
    UNIQUE (role_id, resource, action)
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);
```

#### Permission Checking

```python
async def has_permission(
    db: AsyncSession,
    user: User,
    resource: str,
    action: str
) -> bool:
    """Check if user has permission for resource.action"""
    query = select(Permission).join(Role).join(UserRole).where(
        UserRole.user_id == user.id,
        Permission.resource == resource,
        Permission.action == action
    )
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None

# FastAPI dependency
def require_permission(resource: str, action: str):
    async def permission_checker(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ):
        if not await has_permission(db, user, resource, action):
            raise HTTPException(status_code=403, detail="Permission denied")
    return Depends(permission_checker)

# Usage in endpoint
@app.post("/api/v1/invoices")
async def create_invoice(
    invoice: InvoiceCreate,
    _= Depends(require_permission("invoices", "create")),
    db: AsyncSession = Depends(get_db)
):
    # User has permission, proceed
    pass
```

---

### ADR-006: Event-Driven Architecture

#### Context
Modules need to react to events in other modules without tight coupling.

#### Decision
Use **Redis Pub/Sub** for event messaging.

#### Event Schema

```python
class BaseEvent(BaseModel):
    """Base for all events"""
    event_id: UUID = Field(default_factory=uuid4)
    event_type: str  # "user.created", "invoice.paid", etc.
    tenant_id: UUID
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: dict

class UserCreatedEvent(BaseEvent):
    event_type: Literal["user.created"] = "user.created"
    payload: dict  # {"user_id": "...", "email": "..."}

class InvoicePaidEvent(BaseEvent):
    event_type: Literal["invoice.paid"] = "invoice.paid"
    payload: dict  # {"invoice_id": "...", "amount": 1000.00}
```

#### Event Bus Implementation

```python
class EventBus:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.handlers: Dict[str, List[Callable]] = {}
    
    async def publish(self, event: BaseEvent):
        """Publish event to Redis channel"""
        channel = f"events:{event.event_type}"
        await self.redis.publish(
            channel,
            event.model_dump_json()
        )
    
    def subscribe(self, event_type: str, handler: Callable):
        """Register event handler"""
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)
    
    async def start_listening(self):
        """Start event subscriber worker"""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("events:*")
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                await self._handle_event(message["data"])
    
    async def _handle_event(self, event_data: str):
        """Route event to handlers"""
        event = BaseEvent.model_validate_json(event_data)
        handlers = self.handlers.get(event.event_type, [])
        for handler in handlers:
            try:
                await handler(event)
            except Exception as e:
                logger.error(f"Event handler failed: {e}")

# Usage
event_bus = EventBus(redis_client)

# Register handlers
@event_bus.subscribe("user.created")
async def on_user_created(event: UserCreatedEvent):
    # Send welcome email
    await send_email(event.payload["email"], "Welcome!")

# Publish events
await event_bus.publish(UserCreatedEvent(
    tenant_id=tenant_id,
    payload={"user_id": str(user.id), "email": user.email}
))
```

---

### ADR-007: Background Job Processing

#### Decision
Use **Redis Queue (RQ)** for background jobs.

#### Rationale
- Simple, battle-tested
- Uses existing Redis infrastructure
- Scales with workers
- Failed job handling
- Can migrate to Celery/Kafka later if needed

#### Implementation

```python
from rq import Queue
from redis import Redis

redis_conn = Redis()
job_queue = Queue(connection=redis_conn)

# Define jobs
def send_welcome_email(user_id: str):
    user = get_user(user_id)
    send_email(user.email, "Welcome to ERP!")

# Enqueue jobs
job = job_queue.enqueue(
    send_welcome_email,
    args=[str(user.id)],
    job_timeout="5m"
)

# Worker process (separate process/container)
# $ rq worker --url redis://localhost:6379
```

```

---

### ADR-008: AI/ML Integration Strategy

#### Context
Need to integrate AI capabilities throughout the ERP (document processing, semantic search, intelligent suggestions, conversational UI) while maintaining clean architecture and avoiding vendor lock-in.

#### Options Evaluated

**Option 1: Backend-Heavy (Python LangChain)**
- **Pros:** Full control, complex pipelines, heavy processing capabilities
- **Cons:** Frontend needs separate AI integration, duplicate LLM calls, complex state management
- **Verdict:** ⚠️ Overkill for MVP, adds complexity

**Option 2: Frontend-Native (Tambo)**
- **Pros:** Complete AI agent platform, handles tools/MCP/LLM/conversation, React-native, rapid development
- **Cons:** Limited for complex backend pipelines (document extraction)
- **Verdict:** ✅ **SELECTED for MVP**

**Option 3: Hybrid (Tambo + LangChain)**
- **Pros:** Best of both worlds, frontend AI UX + backend heavy processing
- **Cons:** More complex architecture, higher cost
- **Verdict:** ⏳ Defer to Phase 2

#### Decision
Use **Tambo (frontend AI agent platform)** for MVP, add **LangChain (backend)** only when complex AI workflows are needed.

#### MVP Architecture (Phase 1)

```
┌─────────────────────────────────────┐
│   User Browser (React + Tambo)     │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Tambo AI Agent              │  │
│  │  - LLM orchestration         │  │
│  │  - Tool calling              │  │
│  │  - Generative UI             │  │
│  │  - Conversation mgmt         │  │
│  └──────────────────────────────┘  │
│              │                      │
│              │ (tools = API calls)  │
│              ▼                      │
│  ┌──────────────────────────────┐  │
│  │  fetch('/api/invoices')      │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
              │ HTTPS
              ▼
┌─────────────────────────────────────┐
│   FastAPI Backend                   │
│                                     │
│  Simple REST endpoints:             │
│  - GET /api/invoices                │
│  - POST /api/invoices               │
│  - POST /api/search/semantic        │
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │ PostgreSQL   │  │   Qdrant    │ │
│  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────┘
              ▲
              │ (LLM calls via Tambo)
              │
┌─────────────────────────────────────┐
│   Azure OpenAI                      │
│   - GPT-4 (reasoning)               │
│   - GPT-3.5 (fast queries)          │
│   - text-embedding-3 (vectors)      │
└─────────────────────────────────────┘
```

#### Tambo Configuration

```typescript
// Frontend: src/config/tambo.ts
import { TamboProvider } from '@tambo-ai/react'
import { z } from 'zod'

// Define tools (functions Tambo can call)
const erpTools: TamboTool[] = [
  {
    name: 'search_invoices',
    description: 'Search invoices by customer, amount, date range, or natural language query',
    tool: async (query: string) => {
      const res = await fetch('/api/search/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      return await res.json()
    },
    inputSchema: z.string().describe('Search query (natural language or specific criteria)'),
    outputSchema: z.array(InvoiceSchema)
  },
  {
    name: 'create_invoice',
    description: 'Create a new invoice',
    tool: async (invoiceData: InvoiceCreate) => {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      })
      return await res.json()
    },
    inputSchema: InvoiceCreateSchema,
    outputSchema: InvoiceSchema
  },
  {
    name: 'get_customer_context',
    description: 'Get customer details and history for context',
    tool: async (customerId: string) => {
      const res = await fetch(`/api/customers/${customerId}/context`)
      return await res.json()
    },
    inputSchema: z.string().uuid().describe('Customer ID'),
    outputSchema: CustomerContextSchema
  }
]

// Define component registry for generative UI
const erpComponents: TamboComponent[] = [
  {
    name: 'InvoiceList',
    description: 'Displays a list of invoices with optional filtering',
    component: InvoiceList,
    propsSchema: z.object({
      invoices: z.array(InvoiceSchema),
      status: z.enum(['pending', 'paid', 'overdue']).optional(),
      sortBy: z.enum(['date', 'amount', 'customer']).optional()
    })
  },
  {
    name: 'CustomerCard',
    description: 'Shows customer details, outstanding balance, recent activity',
    component: CustomerCard,
    propsSchema: z.object({
      customer: CustomerSchema,
      showActivity: z.boolean().optional()
    })
  },
  {
    name: 'PaymentForm',
    description: 'Form to record a payment against an invoice',
    component: PaymentForm,
    propsSchema: z.object({
      invoiceId: z.string().uuid(),
      suggestedAmount: z.number().optional()
    })
  }
]

// App root with Tambo provider
export const App = () => (
  <TamboProvider
    tools={erpTools}
    components={erpComponents}
    llm={{
      provider: 'azure-openai',
      apiKey: import.meta.env.VITE_AZURE_OPENAI_KEY,
      endpoint: import.meta.env.VITE_AZURE_OPENAI_ENDPOINT,
      model: 'gpt-4',
      temperature: 0.7
    }}
    systemPrompt={`You are an AI assistant for an ERP system. 
      Help users manage invoices, customers, payments,  and inventory.
      When users ask for data, use the search tools.
      When showing data, render the appropriate components.
      Be concise and action-oriented.`}
  >
    <ERPLayout />
  </TamboProvider>
)
```

#### Backend Endpoints (Simple)

```python
# Backend: app/api/endpoints/search.py
from fastapi import APIRouter, Depends
from app.ai.embeddings import get_embedding
from app.db.qdrant import qdrant_client

router = APIRouter()

@router.post("/search/invoices")
async def semantic_search_invoices(
    query: str,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context)
):
    """
    Semantic search over invoices using Qdrant.
    Called by Tambo 'search_invoices' tool.
    """
    # Generate embedding for query
    embedding = await get_embedding(query)  # Calls Azure OpenAI
    
    # Search Qdrant
    results = qdrant_client.search(
        collection_name=f"invoices_{ctx.tenant_id}",
        query_vector=embedding,
        limit=20
    )
    
    # Fetch full invoice data from PostgreSQL
    invoice_ids = [r.id for r in results]
    invoices = await InvoiceService.get_by_ids(db, invoice_ids, ctx.tenant_id)
    
    return invoices
```

#### Azure OpenAI Integration

```python
# Backend: app/ai/embeddings.py
from openai import AzureOpenAI
from app.core.config import settings

client = AzureOpenAI(
    api_key=settings.AZURE_OPENAI_API_KEY,
    api_version="2024-02-01",
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT
)

async def get_embedding(text: str) -> List[float]:
    """Generate embedding vector for text using Azure OpenAI"""
    response = await client.embeddings.create(
        input=text,
        model="text-embedding-3-small"  # Or text-embedding-3-large
    )
    return response.data[0].embedding
```

#### Qdrant Cloud Setup

```python
# Backend: app/db/qdrant.py
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

qdrant_client = QdrantClient(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY
)

async def create_invoice_collection(tenant_id: UUID):
    """Create Qdrant collection for tenant invoices"""
    collection_name = f"invoices_{tenant_id}"
    
    qdrant_client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=1536,  # text-embedding-3-small dimension
            distance=Distance.COSINE
        )
    )

async def index_invoice(tenant_id: UUID, invoice: Invoice):
    """Index invoice in Qdrant for semantic search"""
    # Create searchable text
    invoice_text = f"""
    Invoice {invoice.invoice_number}
    Customer: {invoice.customer_name}
    Amount: ${invoice.total_amount}
    Date: {invoice.invoice_date}
    Items: {', '.join(invoice.line_items)}
    """
    
    # Generate embedding
    embedding = await get_embedding(invoice_text)
    
    # Upsert to Qdrant
    qdrant_client.upsert(
        collection_name=f"invoices_{tenant_id}",
        points=[PointStruct(
            id=str(invoice.id),
            vector=embedding,
            payload={
                "invoice_number": invoice.invoice_number,
                "customer_id": str(invoice.customer_id),
                "total_amount": float(invoice.total_amount),
                "invoice_date": invoice.invoice_date.isoformat()
            }
        )]
    )
```

#### What Tambo Handles (MVP)

✅ **LLM Orchestration**
- Calls Azure OpenAI directly from frontend
- Manages conversation context
- Streaming responses

✅ **Tool Calling**
- Decides which tools to call based on user query
- Handles tool execution (API calls to your backend)
- Processes tool results

✅ **Generative UI**
- Renders appropriate React components based on context
- Updates component state across conversation
- Persists interactable components (shopping cart pattern)

✅ **MCP Support (Optional)**
- Can connect to MCP servers for database/API access
- Alternative to REST tools

#### What Your FastAPI Backend Handles (MVP)

✅ **Business Logic**
- Data validation, authorization
- Database operations (PostgreSQL)
- Vector search (Qdrant)

✅ **Embeddings Generation**
- Calls Azure OpenAI for embeddings
- Indexes documents in Qdrant

✅ **API Endpoints**
- Simple REST endpoints that Tambo calls as tools

❌ **NOT AI orchestration** - Tambo handles that!

#### When to Add LangChain (Phase 2+)

Add LangChain to **backend** when you need:

1. **Complex Document Extraction Pipelines**
   ```python
   # Multi-step PDF → structured data
   from langchain.document_loaders import PDFLoader
   from langchain.text_splitter import RecursiveCharacterTextSplitter
   from langchain.chains import create_extraction_chain
   
   loader = PDFLoader("invoice.pdf")
   docs = loader.load()
   splitter = RecursiveCharacterTextSplitter()
   chunks = splitter.split_documents(docs)
   chain = create_extraction_chain(schema=InvoiceSchema)
   extracted = chain.run(chunks)
   ```

2. **Advanced RAG**
   - Multiple retriever strategies
   - Re-ranking
   - Context compression

3. **Multi-Agent Systems**
   - Multiple specialized AI agents collaborating

**For MVP:** Skip LangChain. Tambo + simple FastAPI endpoints is enough.

#### Cost Estimates (MVP)

**Tambo:** $25/mo (Growth plan, 200K messages)
**Azure OpenAI:** ~$100-500/mo (depends on usage)
  - GPT-4: $0.03/1K tokens (input), $0.06/1K tokens (output)
  - Embeddings: $0.0001/1K tokens
**Qdrant Cloud:** Free tier (1GB) → $25/mo (Starter)

**Total MVP:** ~$150-550/mo

#### Migration Path

**Phase 1 (MVP):** Tambo → FastAPI → Azure OpenAI + Qdrant
**Phase 2 (Advanced):** Add LangChain for complex backend workflows
**Phase 3 (Scale):** Consider self-hosted LLM for cost optimization

#### Consequences

✅ **Pros:**
- Rapid MVP development (weeks not months)
- Clean separation (frontend AI Experience, backend business logic)
- Low complexity for MVP
- Can add LangChain later without rewriting frontend

⚠️ **Cons:**
- Tambo costs $25/mo (acceptable for SaaS)
- Limited backend AI pipelines in MVP (manual document processing)
- Adds frontend dependency (can self-host Tambo backend if needed)

#### Security Considerations

1. **API Keys:** Store Azure OpenAI keys server-side only (Tambo proxy pattern)
2. **Tenant Isolation:** All tools enforce tenant context from JWT
3. **Rate Limiting:** Limit Tambo API calls per tenant
4. **Audit:** Log all AI-generated actions for compliance

---

## Data Architecture

### Entity Relationship Diagram

```
┌──────────────┐           ┌──────────────┐
│   Tenants    │◄──────────│   Users      │
│              │ 1        * │              │
│ - id        │            │ - id        │
│ - name       │            │ - email      │
│ - slug       │            │ - tenant_id  │
│ - settings   │            │              │
└──────────────┘            └──────────────┘
                                   │
                                   │ *
                                   │
                                   ▼ *
                            ┌──────────────┐
                            │  UserRoles   │
                            │              │
                            │ - user_id    │
                            │ - role_id    │
                            └──────────────┘
                                   │
                                   │ *
                                   │
                                   ▼ 1
                            ┌──────────────┐
                            │    Roles     │
                            │              │
                            │ - id         │
                            │ - tenant_id  │
                            │ - name       │
                            └──────────────┘
                                   │
                                   │ *
                                   │
                                   ▼ *
                            ┌──────────────┐
                            │ Permissions  │
                            │              │
                            │ - role_id    │
                            │ - resource   │
                            │ - action     │
                            └──────────────┘
```

### Indexing Strategy

**All tenant-scoped tables:**
```sql
CREATE INDEX idx_{table}_tenant ON {table}(tenant_id, id);
CREATE INDEX idx_{table}_tenant_created ON {table}(tenant_id, created_at DESC);
```

**Foreign key indexes:**
```sql
CREATE INDEX idx_{table}_{fk_column} ON {table}({fk_column});
```

**Unique constraints per tenant:**
```sql
-- Ensure uniqueness within tenant, not globally
UNIQUE (tenant_id, unique_field)
```

---

## Security Architecture

### Defense-in-Depth Layers

1. **Network:** HTTPS only, rate limiting
2. **Authentication:** JWT tokens with short expiry
3. **Authorization:** RBAC permission checks
4. **Data Access:** Tenant-scoped queries + RLS
5. **Audit:** All actions logged to audit_logs
6. **Encryption:** Data at rest (PostgreSQL encryption), data in transit (TLS)

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Cross-tenant data leak** | tenant_id filtering + RLS + unit tests |
| **SQL injection** | Parameterized queries (SQLAlchemy) |
| **JWT tampering** | RS256 signature verification |
| **Brute force** | Rate limiting + account lockout |
| **CSRF** | SameSite cookies + CSRF tokens |
| **XSS** | Input sanitization + CSP headers |

---

## Performance Optimizations

### Database Connection Pooling

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connection before use
    echo=settings.DEBUG
)

async_session_maker = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession
)
```

### Caching Strategy

1. **API Response Cache** (Redis) - 1-5 min TTL
2. **Database Query Cache** - SELECT results for read-heavy tables
3. **Tenant Settings Cache** - Per-tenant configuration
4. **Permission Cache** - User roles/permissions

### Query Optimization

- Eager load relationships when needed (`selectinload()`)
- Use indexes on filtered/sorted columns
- Pagination with cursors (not offset)
- Avoid N+1 queries

---

## Observability

### Logging

- Structured JSON logs
- Request ID correlation
- Log levels: DEBUG, INFO, WARN, ERROR
- Tenant context in all logs

### Metrics

- API response times (p50, p95, p99)
- Database query times
- Cache hit rates
- Background job queue depth
- Error rates

### Tracing

- Distributed tracing (optional later)
- Request flow visualization

---

## Migration Strategy

### Alembic Migrations

```python
# alembic/versions/001_create_tenants.py
def upgrade():
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tenants_slug'), 'tenants', ['slug'], unique=True)

def downgrade():
    op.drop_index(op.f('ix_tenants_slug'), table_name='tenants')
    op.drop_table('tenants')
```

### Zero-Downtime Deployments

Use expand-contract pattern:
1. **Expand:** Add new column (nullable)
2. **Migrate:** Backfill data
3. **Contract:** Make non-nullable, remove old column

---

## Open Questions

1. **Session Management:** Redis sessions vs stateless JWT?
   - **Recommendation:** Stateless JWT for APIs

2. **Soft Deletes:** Use deleted_at column or hard delete?
   - **Recommendation:** Soft deletes for audit compliance

3. **File Storage:** MinIO vs S3 for production?
   - **Recommendation:** Start with MinIO, migrate to S3 at scale

4. **Multi-Region:** Design for it now or later?
   - **Recommendation:** Start single region, design extensible

---

## References

- [FastAPI Best Practices](https://fastapi.tiangolo.com/tutorial/best-practices/)
- [Multi-Tenant Architecture Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
