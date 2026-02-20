# Design: Setup Frontend Architecture

## Context

The `app/frontend/` directory is a TanStack Start starter template already using
the correct stack (TanStack Start, TanStack Router, TanStack Query, Zustand,
Tailwind v4, shadcn/ui, Biome, Paraglide). None of it is wired to the ERP backend
nor organised into ERP-specific patterns.

This document captures the architectural decisions that govern the entire frontend
foundation. Every ERP module built on top must respect these decisions. Individual
modules may have their own design documents for module-specific concerns.

---

## Goals / Non-Goals

**Goals:**
- Define canonical folder structure every module follows
- Establish secure, enterprise-grade session management (HTTP-only cookies, CSRF)
- Establish how the frontend enforces RBAC (permission-aware routing and rendering)
- Define the typed API communication layer (Axios + TanStack Query)
- Define state ownership rules across Zustand and TanStack Query
- Define the design-system baseline and accessibility standards
- Establish real-time communication via WebSocket
- Establish observability (error tracking, performance monitoring, analytics)
- Deliver full English + Hindi internationalisation from day one

**Non-Goals:**
- Designing any ERP business module UI
- Defining Tambo / AI integration (separate proposal)
- Mobile (React Native) or PWA offline mode (separate proposals)
- Super-admin cross-tenant portal

---

## Decisions

### D1 — TanStack Start (Full-Stack Mode, SSR-Enabled)

**Decision:** Use TanStack Start in full-stack mode (Nitro server, SSR, server
functions). This is non-negotiable given the stack is already installed.

**Enterprise Rationale:**
- SSR is required for accessibility (screen readers require a rendered DOM) and
  performance (LCP < 2.5 s is a Core Web Vitals target)
- Nitro server middleware is needed to enforce security headers (CSP, HSTS) —
  something impossible in a pure SPA
- Server functions allow a BFF (Backend For Frontend) pattern for complex data
  aggregations without exposing raw API calls to the browser
- SSR eliminates the flash-of-unauthenticated-content problem completely

---

### D2 — HTTP-Only Cookies for Session Tokens (Not localStorage)

**Decision:** Access tokens and refresh tokens are stored exclusively in HTTP-only,
`Secure`, `SameSite=Strict` cookies set by the backend on login.

**Why not localStorage:**
- localStorage is readable by any JavaScript on the page, making tokens trivially
  exfiltrated by any XSS attack — including third-party script compromise
- Financial ERP data demands the highest practical security posture
- Indian regulatory frameworks (IT Act 2000, DPDP Act 2023) require adequate
  technical security measures for personal and financial data

**Cookie configuration (set by FastAPI backend):**
```
Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=900
Set-Cookie: refresh_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800
```

**Frontend Auth Store consequence:** The auth store holds `user` profile and
`isAuthenticated` (a boolean) only — never tokens. Token presence is inferred by
attempting a `/auth/me` call on app initialisation. If it succeeds, the session is
valid. The store is backed by `sessionStorage` (tab-scoped) so a full page reload
re-validates with the server.

**CSRF Protection:**
- The Nitro middleware sets a readable (non-HttpOnly) `__Host-csrf` cookie on every
  response containing a cryptographically random value
- The Axios request interceptor reads this cookie and sends it as `X-CSRF-Token`
  on all state-mutating requests (POST, PUT, PATCH, DELETE)
- The FastAPI backend validates the `X-CSRF-Token` header against the cookie value
  (double-submit cookie pattern)

**Alternatives Considered:**

| Option | Rejected Reason |
|--------|----------------|
| `localStorage` with CSP | CSP does not protect against compromised third-party scripts; XSS exfiltrates tokens before CSP fires |
| `sessionStorage` only | Does not survive page refresh; forces re-login on every tab open |
| Memory-only (Zustand without persist) | Does not survive page reload; poor UX; forces aggressive refresh-token polling |
| BFF session (Nitro → backend) | Adds latency and complexity; deferred to Phase 2 when Nitro server functions are fully leveraged |

---

### D3 — Route-Based Auth and Permission Guards via Layout Routes

**Decision:** TanStack Router's layout-route pattern enforces both authentication
and coarse-grained permission checks before route content renders.

```
_auth/    → /login, /register, /forgot-password, /reset-password
           beforeLoad: redirect to /dashboard if cookie session is valid
_app/     → /dashboard, /accounts/*, /inventory/*, etc.
           beforeLoad: redirect to /login if session invalid;
                       load permissions into store;
                       send page-view event to PostHog
```

**Permission Check in `_app.tsx` `beforeLoad`:**
1. Call `GET /api/v1/auth/me` (cookie credential) — if 401, redirect to `/login`
2. Call `GET /api/v1/users/me/permissions` — populate `usePermissionsStore`
3. Check coarse route-level permission (e.g., `/accounts/*` requires `accounts:read`)
4. If denied, redirect to `/403`

Fine-grained UI element visibility is handled by the `<PermissionGate>` component,
not by the router. This keeps route guards simple and fast.

**Alternatives Considered:**

| Option | Rejected Reason |
|--------|----------------|
| HOC `withAuth()` | Cannot prevent flash of protected content; composes poorly |
| React Context guard in `__root.tsx` | Forces all routes into the same permission model |
| Nitro middleware only | A pure server route guard cannot prevent client-side navigation between cached routes |

---

### D4 — Single Axios Instance with Cookie Credentials, CSRF, Retry + Circuit Breaker

**Decision:** One shared Axios instance (`src/lib/api/client.ts`) with:
- `withCredentials: true` — sends HTTP-only auth cookies automatically
- **Request interceptor**: attaches `X-CSRF-Token` (from `__Host-csrf` cookie),
  `X-Request-ID` (UUID v4, propagated to Sentry and backend logs for distributed tracing),
  `Accept-Language` (from `useUIStore.locale`)
- **Response interceptor**:
  - 401 → attempt one silent cookie refresh via `GET /api/v1/auth/refresh`
    (no body — refresh token is in its own cookie); retry original request; on second
    401 → clear session, redirect to `/login`
  - 5xx or network error → exponential backoff retry (max 3 attempts, base 500 ms)
  - 5 consecutive failures → circuit breaker opens; requests fail fast for 30 s;
    user sees a dismissible banner: "We're having trouble reaching the server. Retrying…"
- **Response transformer**: every non-200 becomes a typed `ApiError`

**Request ID tracing:**
Every request carries `X-Request-ID: <uuid>`. The backend echoes it in the response
as `X-Request-ID`. Sentry spans and PostHog events include the same ID, creating
a full distributed trace from browser click → backend log → database query.

---

### D5 — Frontend RBAC via `usePermissionsStore` + `<PermissionGate>`

**Decision:** The frontend mirrors the backend RBAC model using a permission set
loaded at session start and refreshed on every app focus.

```typescript
usePermissionsStore.can('accounts', 'create')  // → boolean
usePermissionsStore.hasRole('Accountant')       // → boolean
```

`<PermissionGate resource="accounts" action="create">` renders children only if
the user has the required permission. If not, it renders nothing (or an optional
`fallback` prop). This is a purely cosmetic guard — the backend enforces real
authorisation. The frontend gate exists to prevent wasted navigation and improve UX.

**Permission refresh strategy:**
- Fetched fresh on `_app.tsx` `beforeLoad` (every navigation from outside the app)
- Re-fetched on `window.focus` (catches permission changes made by admins in other sessions)
- Re-fetched after any role-mutation API call (e.g., after admin edits a user's roles)

---

### D6 — Zustand for Client State; TanStack Query for Server State

**Decision:** Hard ownership boundary:
- **Zustand** owns: `auth` (user profile, isAuthenticated), `ui` (sidebar, toasts, locale, theme), `tenant` (current tenant context), `permissions` (RBAC permission set)
- **TanStack Query** owns: everything from the database (invoices, items, customers, employees, etc.)

**Enforced conventions:**
- No `fetch()` in components — enforced by Biome lint
- All mutations use `useMutation` + `queryClient.invalidateQueries` or optimistic updates
- Optimistic updates are required for all operations the user initiates (status toggles, inline edits) — pessimistic updates only for destructive actions (delete with confirm dialog)
- Query key factory at `src/lib/query/keys.ts` using hierarchical tuple namespacing

---

### D7 — shadcn/ui as Primitive Layer; Custom ERP Components on Top

**Decision:** shadcn/ui primitives are treated as a locked dependency — they are
never modified directly (only through CSS variable overrides or composition). All
ERP-specific UI is built as composed components in `src/components/app/`.

**Accessibility standard:** All ERP components MUST pass WCAG 2.1 AA. Automated
checking via `axe-core` runs in Vitest (unit level) and in CI via `@axe-core/playwright`.
Focus management, keyboard navigation, and screen-reader announcements are
non-negotiable requirements, not nice-to-haves.

---

### D8 — Full i18n from Day One (English + Hindi, All Six Indian Languages Scaffolded)

**Decision:** Paraglide compile-time i18n. No UI string is hardcoded in JSX —
all strings live in `messages/en.json` and `messages/hi.json` with full translations.
The remaining four priority locales (`ta`, `te`, `bn`, `mr`, `gu`) have locale files
scaffolded with English as fallback until translation sprints complete them.

**Translation key convention:** `<module>.<domain>.<key>` dot-notation.
Example: `auth.login.email_placeholder`, `accounts.invoice.status.paid`

**RTL:** Hindi and all priority Indian languages are LTR. RTL support (for Urdu) is
deferred but the CSS uses logical properties (`margin-inline-start` not `margin-left`)
throughout to enable RTL without a rewrite.

---

### D9 — WebSocket for Real-Time Events

**Decision:** A managed WebSocket client connects on `_app.tsx` mount and shares
the connection across all modules via React Context. It authenticates via the same
HTTP-only cookie session (no separate auth step required).

**Event types:**
```typescript
type WSEvent =
  | { type: 'notification'; payload: Notification }
  | { type: 'data_changed'; module: string; resource: string; tenant_id: string }
  | { type: 'session_invalidated' }   // Forces logout on admin revoke
  | { type: 'ping' }
```

`data_changed` events trigger `queryClient.invalidateQueries` for the affected module,
making dashboards and lists reactive without polling. `session_invalidated` triggers
immediate logout and redirect.

**Reconnection:** Exponential backoff starting at 1 s, capped at 30 s. Reconnect
attempt count displayed in the status bar after 3 consecutive failures.

---

### D10 — Observability: Sentry + PostHog + Structured Client Logging

**Decision:** Both Sentry and PostHog are already in `package.json`; this decision
locks in how they are configured.

**Sentry:**
- DSN from `VITE_SENTRY_DSN` env variable
- Traces sample rate: 10% in production, 100% in staging
- Every `ApiError` with status ≥ 500 is sent to Sentry with `X-Request-ID` as a tag
  (correlates to backend Sentry event)
- Source maps uploaded in CI; release tagged with `git SHA`
- PII scrubbing: user email replaced with user UUID in breadcrumbs

**PostHog:**
- Page-view events sent from `_app.tsx` `beforeLoad` on every navigation
- Feature flags fetched from PostHog on session start (used for gradual rollouts)
- Identify call: `posthog.identify(user.id, { tenant_id, plan })` — no PII beyond UUID

**Client Logging:**
- `src/lib/logger.ts` wraps `console` with level (debug/info/warn/error), module tag, and `X-Request-ID`
- In production: only warn and error levels; in development: all levels
- Log output structured as JSON when running in Nitro SSR context

---

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| TanStack Start beta API churn | Pin exact minor version; write integration tests that catch regressions; monitor upstream changelog weekly |
| Cookie `SameSite=Strict` breaks OAuth callbacks | OAuth redirect flow uses a short-lived state parameter; separate cookie path scoped to `/auth/oauth` |
| WebSocket reconnection storms during backend deploys | Randomised jitter added to backoff; max reconnect interval capped at 30 s |
| RBAC permission cache staleness | Permissions refetched on every `window.focus`; WebSocket `session_invalidated` event forces immediate refresh |
| SSR adds Nitro cold-start latency | Streaming SSR with `<Suspense>` boundaries; static shell pre-rendered; data fetched client-side |
| Axe-core CI failures blocking merges | Accessibility issues treated with the same severity as failing unit tests; no waivers without documented justification |

---

## Migration Notes

Greenfield — no existing ERP UI to migrate. The TanStack Start starter template's
index page (`src/routes/index.tsx`) is replaced by a root redirect to `/dashboard`.

---

## Open Questions

1. **BFF pattern via Nitro server functions?**
   - Current decision: API calls go directly from browser to FastAPI backend
   - Revisit when a module requires complex data aggregation not suited for a single
     FastAPI endpoint (e.g., dashboard combining 5 modules' data)

2. **Super-admin cross-tenant UI?**
   - Out of scope for this proposal. Will require a separate `_superadmin/` layout
     with its own permission model and a separate proposal.
