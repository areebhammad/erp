# Frontend Architecture

This document describes the foundational architecture of the ERP frontend.

## Folder Structure

```
app/frontend/
├── src/
│   ├── components/
│   │   ├── app/      # Composed ERP components (e.g., Sidebar, TopBar, DataTable)
│   │   └── ui/       # Primitives (shadcn/ui locked components)
│   ├── lib/
│   │   ├── api/      # Axios client, circuit breaker, retry logic, endpoint modules
│   │   ├── query/    # TanStack Query keys and hooks
│   │   └── ws/       # WebSocket client, events, and context
│   ├── routeTree.gen.ts # Auto-generated TanStack Router tree
│   ├── router.tsx    # Router initialization
│   ├── routes/       # File-based routing (e.g., _auth.tsx, _auth.login.tsx)
│   ├── server/       # Nitro server-side middleware (CSRF, Security Headers)
│   ├── store/        # Zustand state slices (auth, permissions, tenant, ui)
│   ├── styles.css    # Central design tokens and Tailwind configuration
│   └── test/         # Setup for Vitest and generic integration tests
└── docs/             # You are here
```

## Auth Flow

We use an HTTP-only cookie-based authentication strategy. The access/refresh tokens are not accessible to JavaScript.
- **Login**: Submitting email/password -> `POST /api/v1/auth/login`. Returns `Set-Cookie` headers for session. If MFA is required, the next step involves providing TOTP.
- **MFA (TOTP)**: Following a standard auth challenge, user inputs 6-digit key -> session granted.
- **Refresh**: Axios interceptor silently calls `GET /api/v1/auth/refresh` upon 401 unauthorized. Retries origin request upon success.
- **Logout**: `clearAuth()` wipes local state and triggers `POST /api/v1/auth/logout` to revoke tokens.
- **Session Revoke**: Supported via WebSocket updates. Concurrent tabs synced via `sessionStorage` and `session_invalidated` events.

## State Ownership Decision

| State Category | Technology | Usage Example |
|---|---|---|
| Server State | TanStack Query | Data tables, fetched entity details, metrics |
| UI State | Zustand (`ui.ts`) | Sidebar toggle, Color mode (dark/light), Locale, Notifications |
| Local Auth / Session | Zustand (`auth.ts`) | `isAuthenticated`, current `User` |
| Tenant Metadata | Zustand (`tenant.ts`) | Current Company Name, Locale overrides |
| Permissions | Zustand (`permissions.ts`)| Roles, RBAC sets, Feature flags. Refreshed on focus. |

## API Client Architecture

All network requests are handled through an Axios client instance defined in `src/lib/api/client.ts`.
- **Interceptors**: Attaches CSRF token via `__Host-csrf`, adds unique `X-Request-ID`, attaches locale. Handles 401 silently.
- **Exponential Backoff Retry**: GET/PUT/DELETE requests retry automatically up to 3 times on 5xx or network errors.
- **Circuit Breaker**: `circuit-breaker.ts` manages consecutive failures. After 5 failures within 60s, breaks circuit to prevent overwhelming backend. Probes every 30s.

## How to add a new ERP module

1. Draft UX in `openspec` tracking. Add relevant route structures in `src/routes/`. E.g., `_app.finance.tsx`.
2. Define fetching logic: Map domain API endpoints in `src/lib/api/finance.ts`, define query keys in `src/lib/query/keys.ts`. Use TanStack Query to hook it.
3. Establish state: Rely heavily on `src/components/app/` like `DataTable` to fetch paginated resources. Provide `fetchFn` using API modules.
4. Permissions: Add specific resource constraints strings `<PermissionGate resource="invoice" action="create">`.
5. Translation: Wrap module-specific text with paraglide language strings `m.finance_invoice_label()`. Add to `en.json`.

## Accessibility (a11y)

- All UI components are verified via `@axe-core/react`.
- When modifying the UI, execute `pnpm test` as axe constraints are checked in development routing via `_dev/design.tsx`.
- CI strictly mandates 0 violations.

## i18n Workflow

1. In `messages/en.json`, add key-values:
```json
{
  "module.page.button_submit": "Submit Details"
}
```
2. Build via `pnpm paraglide` to generate typings. Or let the Vite plugin auto-regenerate.
3. Import the generated code:
```tsx
import * as m from '@/paraglide/messages'
return <Button>{m.module_page_button_submit()}</Button>
```
4. Update other locales `hi.json`, `ta.json` with matching keys. Fallback guarantees English if missing.
