# frontend-state-management Specification

## Purpose
TBD - created by archiving change setup-frontend-architecture. Update Purpose after archive.
## Requirements
### Requirement: Auth Zustand Store (Session Profile Only — No Tokens)
The frontend MUST maintain authentication state in a typed Zustand store that holds
the user's profile and session identity. Tokens MUST NOT be stored in JavaScript
state; they live exclusively in HTTP-only cookies managed by the browser.

#### Scenario: Session validation on app mount
- **WHEN** the application bootstraps (any `_app/` route resolves)
- **THEN** the app MUST call `GET /api/v1/auth/me` (cookie credential) to validate the session
- **AND** on 200, populate the auth store with the user profile from the response body
- **AND** on 401, redirect to `/login`
- **AND** the store MUST be populated before any guarded route component renders
  (enforced by `_app.tsx` `beforeLoad` — SSR-safe)

#### Scenario: Auth store shape
- **WHEN** the auth store is initialised after a successful `/auth/me` call
- **THEN** it MUST expose the following typed fields and actions:
  - `user: User | null` — full profile (id, name, email, avatar_url, preferred_locale)
  - `sessionId: string | null` — current session identifier for the session management UI
  - `isAuthenticated: boolean` — computed: `user !== null`
  - `setUser(user: User, sessionId: string): void`
  - `clearAuth(): void` — called on logout or session invalidation
- **AND** `accessToken` and `refreshToken` MUST NOT appear in the store type at all

#### Scenario: Cross-tab logout via WebSocket
- **WHEN** the WebSocket receives `{ type: 'session_invalidated' }`
- **THEN** `clearAuth()` MUST be called, TanStack Query cache MUST be cleared,
  the WebSocket MUST be closed, and the tab MUST redirect to `/login` immediately
- **AND** if WebSocket is unavailable, a `storage` event listener on a dedicated
  `__session_clear` key MUST serve as a fallback synchronisation mechanism

---

### Requirement: Permissions Zustand Store
The frontend MUST maintain the current user's effective RBAC permissions in a typed
Zustand store so that any component can query permissions without prop-drilling or
redundant API calls.

#### Scenario: Permissions store shape
- **WHEN** permissions are loaded after login
- **THEN** the store MUST expose:
  - `roles: string[]` — list of role names (e.g., `['Accountant', 'Inventory Manager']`)
  - `permissions: Set<string>` — flat set of `'resource:action'` strings (e.g., `'accounts:create'`)
  - `featureFlags: Record<string, boolean>` — PostHog / backend feature flags
  - `can(resource: string, action: string): boolean` — returns `permissions.has(`${resource}:${action}`)`
  - `hasRole(role: string): boolean` — returns `roles.includes(role)`
  - `setPermissions(roles, permissions, featureFlags): void`
  - `clearPermissions(): void`

#### Scenario: Permission-based component rendering via PermissionGate
- **WHEN** a component wraps children in `<PermissionGate resource="accounts" action="delete">`
- **THEN** if `can('accounts', 'delete')` is true, children MUST render
- **AND** if the permission is absent, the `fallback` prop content MUST render (defaults to `null`)
- **AND** this check MUST be purely client-side (cosmetic); the backend MUST independently
  enforce the same permission on every API request

#### Scenario: Permissions refresh on window focus
- **WHEN** the user returns to the browser window after being away (window `focus` event)
- **THEN** a background call to `GET /api/v1/users/me/permissions` MUST be issued
  (via TanStack Query's `refetchOnWindowFocus` setting on the permissions query)
- **AND** if permissions have changed (e.g., an admin changed the user's roles),
  the store MUST update immediately
- **AND** any `<PermissionGate>` that re-evaluates after the update MUST show or hide
  accordingly without a page reload

#### Scenario: Feature flag gating
- **WHEN** a developer wraps a feature in `<PermissionGate flag="ai_assistant">`
- **THEN** the component MUST render only if `featureFlags['ai_assistant'] === true`
- **AND** feature flags can gate sections of the UI for gradual rollouts without
  requiring re-deployment

---

### Requirement: Tenant Zustand Store
The frontend MUST maintain the current tenant's context in a typed Zustand store
so all components can access tenant configuration without repeated API calls.

#### Scenario: Tenant store shape and data
- **WHEN** a user successfully authenticates
- **THEN** the frontend MUST call `GET /api/v1/tenants/me` and store the response
- **AND** the store MUST expose:
  - `tenant: Tenant | null` (id, name, slug, logo_url, settings)
  - `subscriptionPlan: 'starter' | 'growth' | 'enterprise'`
  - `currency_code: string` (e.g., `'INR'`)
  - `locale: string` (e.g., `'en-IN'`)
  - `fiscal_year_start: string` (e.g., `'04-01'` for Indian FY)
  - `gstin: string | null`
  - `setTenant(tenant): void`

#### Scenario: Currency and locale in all formatters
- **WHEN** any component formats a monetary value
- **THEN** it MUST read `useTenantStore.currency_code` and `useTenantStore.locale`
  to format via `Intl.NumberFormat`
- **AND** no component MUST hardcode `'INR'` or `'en-IN'` — always from the store

#### Scenario: Tenant logo in app shell
- **WHEN** the app shell renders
- **THEN** the topbar MUST display `tenant.logo_url` as an `<img>` with `alt={tenant.name}`
- **AND** if `logo_url` is null, the topbar MUST display a coloured avatar with the
  first two characters of the company name (consistent colour derived from `tenant.id`)

---

### Requirement: UI Zustand Store
The frontend MUST maintain ephemeral UI state in a typed Zustand store. UI preferences
that should persist across sessions MUST be backed by `localStorage` via Zustand `persist`
with a fine-grained `partialize` selector.

#### Scenario: UI store shape
- **WHEN** the UI store is initialised
- **THEN** it MUST expose:
  - `sidebarCollapsed: boolean` (persisted)
  - `colorMode: 'light' | 'dark' | 'system'` (persisted)
  - `locale: string` (e.g., `'en'`, `'hi'`) (persisted)
  - `commandPaletteOpen: boolean` (not persisted)
  - `notifications: Notification[]` (not persisted; sourced from WebSocket)
  - `connectionStatus: 'connected' | 'connecting' | 'disconnected'` (not persisted)
  - `toggleSidebar(): void`
  - `setColorMode(mode): void` — also applies `dark` class to `<html>`
  - `setLocale(locale): void` — calls Paraglide `setLocale()`
  - `addNotification(n: Notification): void` — caps at 100 items (FIFO eviction)
  - `dismissNotification(id: string): void`
  - `markAllNotificationsRead(): void`
  - `setConnectionStatus(status): void`

#### Scenario: Color mode applied to document
- **WHEN** `setColorMode('dark')` is called
- **THEN** `document.documentElement.classList.add('dark')` MUST be called synchronously
- **AND** `setColorMode('system')` MUST observe `prefers-color-scheme` via `matchMedia`
  and apply the appropriate class dynamically as the OS theme changes
- **AND** this MUST be initialised before the first render (in the Zustand store initialiser,
  not in a React effect) to prevent a flash of wrong theme

#### Scenario: Locale switch triggers Paraglide re-render
- **WHEN** `setLocale('hi')` is called
- **THEN** `paraglide.setLocale('hi')` MUST be called
- **AND** all Paraglide i18n message calls throughout the UI MUST re-evaluate
- **AND** the browser URL MUST update to reflect the new locale prefix if URL-based
  locale routing is configured

---

### Requirement: Server State Ownership Rule (Enforced)
All data originating from the backend MUST be owned by TanStack Query. Storing
server data in Zustand is an architectural violation that MUST be prevented.

#### Scenario: Architectural lint rule
- **WHEN** a developer imports any backend-entity type (e.g., `Invoice`, `Item`, `Employee`)
  into a Zustand store file in `src/store/`
- **THEN** the Biome `no-restricted-imports` rule MUST flag this as an error
- **AND** CI MUST fail

#### Scenario: Zustand state in useQuery (forbidden)
- **WHEN** a developer passes a Zustand store value as a `queryFn` (fetching UI state from the server)
- **THEN** a CI code-quality lint check MUST flag this pattern
- **AND** the documented rule MUST state: "If it comes from the database, it belongs in TanStack Query. If it is UI or session state, it belongs in Zustand."

