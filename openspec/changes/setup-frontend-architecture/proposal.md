# Proposal: Setup Frontend Architecture

## Change ID
`setup-frontend-architecture`

## Status
🔴 **DRAFT** - Awaiting Review

## Type
Foundation / Frontend Architecture

## Why

The frontend codebase (`app/frontend/`) is currently a TanStack Start starter
template — it has the correct tech stack installed but no ERP-specific structure.
There is no authentication flow, no secure session management, no permission-aware
UI, no API client, no design system, no state management conventions, and no
module routing. Without this foundation every future ERP module (Accounts,
Inventory, CRM, HR, etc.) would have nowhere to land and developers would build
inconsistently.

This proposal establishes the enterprise-grade frontend architectural foundation
the same way `establish-core-architecture` did for the backend — a production-ready
bedrock that all feature modules build upon from day one.

## What Changes

- **App structure** — Canonical folder layout, route hierarchy (auth layout vs. app
  layout vs. admin layout), permission-aware route guards, and code conventions for
  all future ERP modules.
- **Authentication UI** — Login (with MFA/TOTP), register, forgot-password, and
  password-reset flows; sessions managed via HTTP-only cookies; CSRF protection;
  multi-device session management.
- **Permission-aware UI** — Frontend mirrors the backend RBAC model; components
  render or hide based on the current user's permissions; route-level guards prevent
  unauthorised navigation with full audit events.
- **API client** — Typed Axios client with automatic cookie-based auth, CSRF token
  injection, exponential-backoff retry, circuit breaker, request tracing, and full
  error normalisation. TanStack Query wrappers with optimistic updates for all common
  CRUD patterns.
- **Design system** — Enterprise-grade colour palette with semantic tokens,
  typography, spacing, WCAG 2.1 AA-compliant components, shadcn/ui primitive
  conventions, command palette, and app shell (sidebar + topbar + breadcrumbs).
  Light and dark mode from day one.
- **State management** — Zustand store slices for `auth`, `tenant`, `permissions`,
  and `ui`. Clear, enforced conventions separating server state (TanStack Query)
  from client state (Zustand).
- **Observability** — Sentry for error tracking and performance monitoring; PostHog
  for product analytics; structured client-side logging; request-ID propagation for
  distributed tracing.
- **Real-time** — WebSocket client integrated with the backend event bus; powers
  live notifications, presence indicators, and reactive dashboard data.
- **Internationalisation** — Full English + Hindi delivery from day one using
  Paraglide; translation infrastructure ready for all 6 priority Indian languages.
- **Security headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-
  Policy enforced via Nitro server middleware.

No business-module features (Accounts, Inventory, etc.) are implemented here.

## Impact

- **Affected specs:**
  - `frontend-app-structure` (new)
  - `frontend-auth-ui` (new)
  - `frontend-api-client` (new)
  - `frontend-design-system` (new)
  - `frontend-state-management` (new)
- **Affected code:**
  - `app/frontend/src/` — entirely restructured from starter template
  - `app/frontend/src/routes/` — auth, app, and admin layout routes
  - `app/frontend/src/lib/` — API client, WebSocket client, query hooks
  - `app/frontend/src/store/` — Zustand stores
  - `app/frontend/src/components/` — design system, app shell, permission wrappers
  - `app/frontend/src/styles.css` — design token system
  - `app/frontend/nitro.config.ts` — security header middleware
- **Blocked by:** `establish-core-architecture` (backend auth endpoints,
  RBAC APIs, WebSocket event bus must be operational)
- **Blocks:** All future ERP module UI proposals

## Non-Goals

- ❌ Business module implementations (Accounts, Inventory, CRM, etc.)
- ❌ Deployment / Docker / Kubernetes configuration (separate proposal)
- ❌ AI / Tambo integration (separate proposal — `implement-ai-service-layer`)
- ❌ React Native mobile app (separate project)
- ❌ E2E tests with Playwright (separate proposal)
- ❌ Super-admin cross-tenant portal (separate proposal)

## Proposed Solution

### Route Hierarchy

```
src/routes/
├── __root.tsx                        # Global shell: providers, security init, head tags
├── _auth/                            # Auth layout — redirect to /dashboard if authed
│   ├── _auth.tsx
│   ├── _auth.login.tsx
│   ├── _auth.register.tsx
│   ├── _auth.forgot-password.tsx
│   └── _auth.reset-password.tsx
└── _app/                             # App layout — requires authentication
    ├── _app.tsx                      # App shell + permission context + WebSocket init
    ├── _app.dashboard.tsx
    └── [module]/                     # Future module routes inherit shell + auth + perms
```

### Security Architecture

```
Browser
  │
  ├─ HTTP-only Cookies (accessToken, refreshToken)   ← XSS-safe
  ├─ CSRF Token (X-CSRF-Token header, double-submit) ← CSRF-safe
  ├─ CSP, HSTS, X-Frame-Options (Nitro middleware)   ← clickjacking-safe
  └─ Biome lint: no-unsafe-innerHTML                 ← injection-safe

API Client (Axios)
  ├─ Cookie credential: 'include'
  ├─ X-CSRF-Token header from __Host-csrf cookie
  ├─ X-Request-ID (UUID, correlates to Sentry traces)
  ├─ Exponential backoff retry (5xx, network errors)
  └─ Circuit breaker (opens after 5 consecutive failures)
```

### State Management Slices

| Store | Responsibility | Persistence |
|-------|---------------|-------------|
| `useAuthStore` | `user`, `isAuthenticated`, `sessionId` | sessionStorage |
| `usePermissionsStore` | `permissions: Set<string>`, `roles: string[]`, `can(resource, action)` | None — refetched on mount |
| `useTenantStore` | `tenant`, `subscriptionPlan`, `featureFlags` | None — refetched on mount |
| `useUIStore` | `sidebarCollapsed`, `colorMode`, `notifications[]`, `commandPaletteOpen` | localStorage (partial) |

### Design System Architecture

```
src/styles.css          ← CSS custom properties (design tokens)
src/components/
  ui/                   ← shadcn/ui primitives (DO NOT modify)
  app/                  ← Composed ERP components: AppShell, Sidebar, TopBar,
  │                        Breadcrumbs, CommandPalette, DataTable, StatCard,
  │                        PageHeader, EmptyState, PermissionGate, SkeletonPage
  └── [module]/         ← Added per feature proposal
```

### Internationalisation

- English (`en`) and Hindi (`hi`) delivered as first-class locales from day one
- Paraglide compile-time i18n (zero runtime overhead)
- Translation keys use namespaced dot-notation: `auth.login.title`, `accounts.invoice.status`
- UI locale switching persisted in `useUIStore`
- All six priority Indian languages (`hi`, `ta`, `te`, `bn`, `mr`, `gu`) scaffolded with English fallback; translations backfilled per content sprint

### WebSocket Architecture

```
src/lib/ws/
├── client.ts           ← Managed WebSocket with auto-reconnect, exponential backoff
├── events.ts           ← Typed event union (NotificationEvent, DataChangedEvent, etc.)
└── useWebSocket.ts     ← React hook; subscribes to channels, cleans up on unmount
```

WebSocket authenticates via the same HTTP-only cookie session. Connection is
established once on `_app.tsx` mount and shared across all modules via React Context.

## Success Criteria

- Auth flows (register → login with MFA → cookie session → refresh → logout) work
  end-to-end and pass OWASP Top-10 review
- All `_app` routes redirect unauthenticated users to `/login`
- `PermissionGate` correctly hides / shows UI based on current user's RBAC permissions
- CSRF token is attached to all state-mutating requests
- Security headers (CSP, HSTS, X-Frame-Options) are present on all responses
- Sentry captures all unhandled errors with correct release tags
- WebSocket reconnects automatically after transient failure
- WCAG 2.1 AA audit passes (axe-core in CI)
- Initial JS bundle (login page) is ≤ 150 KB gzipped
- Core Web Vitals in green: LCP < 2.5 s, CLS < 0.1, INP < 200 ms
- Biome lint and strict TypeScript checks pass with zero errors
- English + Hindi UI strings complete; other languages have English fallback
- All stores have 90%+ unit-test coverage

## Timeline Estimate

**Total:** 3–4 weeks

| Week | Focus |
|------|-------|
| 1 | App structure, security headers, design tokens, app shell |
| 2 | Auth UI (login + MFA + register + reset), cookie session, CSRF, API client |
| 3 | Permissions store + PermissionGate, WebSocket client, real-time notifications, i18n |
| 4 | Observability (Sentry + PostHog), performance, accessibility audit, tests |

## Related Changes

- **Depends on:** `establish-core-architecture` (backend auth, RBAC, WebSocket APIs)
- **Blocks:** All ERP module UI proposals
- **Related:**
  - Future: `setup-deployment-pipeline`
  - Future: `implement-ai-service-layer` (Tambo integration)
