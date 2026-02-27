<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Tech Stack & Standards

### Frontend
- **Framework**: TanStack Start (React 19) + TypeScript
- **Routing**: TanStack Router (File-based routing, Type-safe)
- **State Management**: TanStack Query (Server state), Zustand (Client state)
- **Styling**: Tailwind CSS v4, Shadcn/ui (Components), Hugeicons
- **Forms**: TanStack Form + Zod
- **Testing**: Vitest, React Testing Library, Playwright
- **Tooling**: Biome (Linting/Formatting), Vite

### Backend
- **Framework**: FastAPI (Python 3.13+)
- **Database**: PostgreSQL (Structured), Qdrant Cloud (Vector)
- **ORM/Schema**: SQLAlchemy (ORM), Alembic (Migrations), Pydantic (Validation)
- **Cache/Queue**: Redis, Redis Queue (RQ)
- **Storage**: SeaweedFS (S3-compatible, Apache 2.0 licensed)
- **Auth**: (refer to specific implementation)

### Infrastructure & Services
- **Containerization**: Docker, Kubernetes (Phase 2)
- **Maps**: Ola Krutrim Maps
- **AI/LLM**: Tambo AI, Google Gemini, Azure OpenAI
- **CI/CD**: GitHub Actions