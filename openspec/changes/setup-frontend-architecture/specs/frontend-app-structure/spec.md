## ADDED Requirements

### Requirement: Canonical Folder Structure
The frontend MUST follow a canonical, enforced folder layout so all ERP module
developers have a consistent, predictable location for every artefact type.

#### Scenario: New module developer locates artefacts
- **WHEN** a developer starts implementing a new ERP module (e.g., Accounts)
- **THEN** they SHALL find:
  - `src/routes/_app/[module]/` for file-based route files
  - `src/components/[module]/` for module-specific composed components
  - `src/lib/query/hooks/[module]/` for TanStack Query hooks
  - `src/lib/api/[module].ts` for typed API endpoint functions
  - `src/store/[module].ts` only if the module has legitimate client-side state
- **AND** the project `docs/frontend-architecture.md` MUST document this layout
  with examples and anti-patterns

#### Scenario: Biome lint prevents wrong file placement
- **WHEN** a developer imports a route file from inside `src/components/`
- **THEN** the Biome `no-restricted-imports` rule MUST flag the import as an error
- **AND** the CI pipeline MUST fail the lint step, blocking the PR merge

---

### Requirement: Layout Route Hierarchy
The application MUST use TanStack Router's layout-route pattern to enforce
authentication, permissions, and observability concerns for all route groups.

#### Scenario: Unauthenticated access to protected route
- **WHEN** a user navigates to any `_app/` route without a valid cookie session
- **THEN** `_app.tsx`'s `beforeLoad` MUST redirect to `/login?redirect=<original-path>`
- **AND** NO protected component code MUST execute before the redirect
- **AND** the redirect MUST happen with zero flash of protected content (SSR enforces this)

#### Scenario: Authenticated access to auth route is blocked
- **WHEN** an already-authenticated user navigates to `/login` or `/register`
- **THEN** `_auth.tsx`'s `beforeLoad` MUST redirect to `/dashboard`
- **AND** the login form MUST NOT render at all

#### Scenario: Session validation on every `_app` navigation
- **WHEN** a user navigates to any `_app/` route
- **THEN** `beforeLoad` MUST call `GET /api/v1/auth/me` (cookie credential)
- **AND** if the server returns 401, redirect to `/login?redirect=<path>`
- **AND** if the server returns 200, populate `useAuthStore` and `usePermissionsStore`
  before rendering any content

#### Scenario: Coarse route permission check
- **WHEN** `beforeLoad` resolves successfully for `/accounts/invoices`
- **THEN** the router MUST verify `usePermissionsStore.can('accounts', 'read')`
- **AND** if the permission is absent, redirect to `/403` (Forbidden page)
- **AND** a structured log event MUST be emitted: `{ event: 'unauthorized_navigation', route: '/accounts/invoices', user_id }`

---

### Requirement: Permission-Aware Route Guards
All authenticated routes MUST enforce RBAC at the layout level before rendering.

#### Scenario: Module-level permission guard
- **WHEN** a user without `inventory:read` permission navigates to `/inventory`
- **THEN** the route MUST redirect to `/403`
- **AND** the `/403` page MUST display the user's current roles and a CTA to contact their administrator

#### Scenario: Action-level guard via PermissionGate
- **WHEN** a user without `accounts:create` permission lands on the invoice list
- **THEN** the "New Invoice" button MUST NOT render (hidden by `<PermissionGate resource="accounts" action="create">`)
- **AND** the page itself MUST still render (read access is permitted)
- **AND** attempting to navigate directly to `/accounts/invoices/new` MUST redirect to `/403`

---

### Requirement: Route-Level Code Splitting
Every `_app/` route MUST be lazily loaded to keep the initial bundle small.

#### Scenario: First navigation to a module
- **WHEN** a user clicks a module link in the sidebar for the first time
- **THEN** the module's route chunk MUST be fetched on demand
- **AND** an animated skeleton screen MUST display during the fetch
- **AND** the skeleton MUST match the target page layout (not a generic spinner)

#### Scenario: Initial bundle size constraint
- **WHEN** the application is built (`vite build`)
- **THEN** the JS chunk loaded for `/login` MUST be ≤ 150 KB gzipped
- **AND** the CI build step MUST fail if this threshold is exceeded (enforced via
  `vite-plugin-bundle-analyzer` with a size budget config)

---

### Requirement: Security Headers via Nitro Middleware
All HTTP responses MUST include enterprise-grade security headers.

#### Scenario: CSP header on every response
- **WHEN** any page or API route responds
- **THEN** the `Content-Security-Policy` header MUST be present with at minimum:
  - `default-src 'self'`
  - `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`)
  - `style-src 'self' 'unsafe-inline'` (Tailwind inline styles require this; tightened in Phase 2)
  - `connect-src 'self' wss://<api-domain> https://sentry.io https://app.posthog.com`
  - `img-src 'self' data: https:`
  - `frame-ancestors 'none'`

#### Scenario: HSTS on every response
- **WHEN** the app responds over HTTPS
- **THEN** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` MUST be present

#### Scenario: Clickjacking prevention
- **WHEN** any page responds
- **THEN** `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` MUST both be present
- **AND** loading the app in an iframe MUST be blocked by the browser
