# Tasks: Setup Frontend Architecture

## Change ID
`setup-frontend-architecture`

## Overview
Ordered implementation tasks for establishing the enterprise-grade frontend
foundation. Phases are sequential; tasks within a phase may be parallelised
across engineers. Each task includes a concrete validation criterion.

---

## Phase 1: Project Structure & Build Configuration (Week 1)

### 1.1 Directory Layout
- [x] Create `src/components/app/` for composed ERP components
- [x] Create `src/components/ui/` and move existing shadcn primitives here (treat as locked)
- [x] Create `src/lib/api/` for typed API endpoint modules
- [x] Create `src/lib/query/` with subdirectories `hooks/` and `keys.ts`
- [x] Create `src/lib/ws/` for WebSocket client (`client.ts`, `events.ts`, `useWebSocket.ts`)
- [x] Create `src/lib/logger.ts` for structured client logging
- [x] Create `src/store/` for Zustand slices (`auth.ts`, `permissions.ts`, `tenant.ts`, `ui.ts`)
- [x] Update `tsconfig.json` path aliases: `@/` → `src/`, `@components/` → `src/components/`, `@lib/` → `src/lib/`, `@store/` → `src/store/`
- [x] Configure `vite.config.ts` with matching path aliases
- [x] Add `vite-plugin-bundle-analyzer` and configure bundle size budget: initial chunk ≤ 150 KB gzip
- [x] **Validation:** `pnpm check` (Biome) and `pnpm tsc --noEmit` pass with zero errors

### 1.2 Environment Validation
- [x] Add `VITE_API_URL`, `VITE_WS_URL`, `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` to `.env.example`
- [x] Extend `src/env.ts` (using `@t3-oss/env-core`) to validate and type all env variables
  - `VITE_API_URL`: required URL string
  - `VITE_WS_URL`: required URL string (`wss://...`)
  - `VITE_SENTRY_DSN`: required string
  - `VITE_POSTHOG_KEY`: required string
  - `VITE_POSTHOG_HOST`: required URL string (defaults to `https://app.posthog.com`)
- [x] **Validation:** Starting `pnpm dev` with a missing required env var throws a descriptive error and exits

### 1.3 Security Headers via Nitro Middleware
- [x] Create `src/server/middleware/security-headers.ts` with Nitro H3 event handler
- [x] Apply headers: `Content-Security-Policy` (strict; allow `'self'`, Sentry, PostHog, WSS origin), `Strict-Transport-Security` (1 year + preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- [x] Create `src/server/middleware/csrf.ts` — sets `__Host-csrf` cookie on every response via `Set-Cookie` with `Path=/; Secure; SameSite=Strict` (readable, NOT HttpOnly so JS can read it)
- [x] Register both middleware in `vite.config.ts` under `nitro.handlers`
- [x] **Validation:** `curl -I https://localhost:3000` shows all security headers; browser DevTools confirms CSP

### 1.4 Biome Lint Rules
- [x] Add `no-restricted-globals` rule: disallow `fetch`, `XMLHttpRequest`
- [x] Add `no-restricted-imports` rule: disallow importing entity types (`Invoice`, `User`, etc.) in `src/store/` files
- [x] Add `no-restricted-syntax` rule: disallow `axios.create()` outside `src/lib/api/client.ts`
- [x] **Validation:** A test file with a bare `fetch()` call causes `pnpm lint` to fail

---

## Phase 2: Design Token System (Week 1)

### 2.1 CSS Design Tokens
- [ ] Define all CSS custom properties in `src/styles.css` under `:root {}` and `:root.dark {}`:
  - Brand colours (primary, secondary, accent with multiple shades)
  - Semantic colours (success, warning, error, info each with `-subtle`, `-foreground`, `-border` variants)
  - Neutral surface scale (`--color-surface`, `--color-surface-raised`, `--color-surface-overlay`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-subtle`, `--color-text-disabled`)
  - Typography variables (`--font-sans`, `--font-mono`, `--text-xs` through `--text-4xl` with `--leading-*`)
  - Spacing scale (`--space-0` through `--space-24`, 4 px base)
  - Radius scale (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`)
  - Shadow scale (light and dark mode aware)
  - Z-index named layers
- [ ] Load Inter and JetBrains Mono from Google Fonts in `__root.tsx` `head()` handler with `preload` link tags
- [ ] Map all tokens to Tailwind v4 CSS variable utilities in `vite.config.ts`
- [ ] Add `axe-core` colour contrast check to Vitest (run against the design showcase HTML)
- [ ] **Validation:** Dark mode toggle applies visually; `axe-core` passes 0 contrast violations

### 2.2 System Color Mode Initialisation (No Flash)
- [ ] Create `src/lib/color-mode.ts` with `initColorMode()` function that:
  1. Reads `localStorage['ui-store']` for persisted `colorMode` preference
  2. Falls back to `window.matchMedia('(prefers-color-scheme: dark)')` if preference is `'system'`
  3. Synchronously applies `dark` class to `<html>` before first paint
- [ ] Inject `initColorMode()` as an inline `<script>` in `__root.tsx` `head()` (before CSS loads)
- [ ] **Validation:** Set OS to dark mode; load page; no flash of light mode content at any point

---

## Phase 3: Zustand Store Slices (Week 1–2)

### 3.1 Auth Store
- [ ] Implement `src/store/auth.ts` (Zustand, sessionStorage-backed via `persist`)
  - State: `user: User | null`, `sessionId: string | null`, `isAuthenticated: boolean` (computed)
  - Actions: `setUser(user, sessionId)`, `clearAuth()`
  - `clearAuth()` MUST also: call `queryClient.clear()`, dispatch `__session_clear` in `localStorage`
  - Explicitly exclude any token fields — TypeScript types should not allow them
- [ ] **Validation:** Login → session stored; logout → store cleared; reload → store re-validated from `/auth/me`

### 3.2 Permissions Store
- [ ] Implement `src/store/permissions.ts` (Zustand, no persistence)
  - State: `roles: string[]`, `permissions: Set<string>`, `featureFlags: Record<string, boolean>`
  - Actions: `setPermissions(roles, permissions, featureFlags)`, `clearPermissions()`
  - Methods: `can(resource, action): boolean`, `hasRole(role): boolean`
- [ ] Implement `<PermissionGate resource action fallback?>` component in `src/components/app/PermissionGate.tsx`
- [ ] Implement `<PermissionGate flag="feature_name">` variant for feature-flag gating
- [ ] Add `window.focus` listener in `_app.tsx` to re-fetch and refresh permissions store
- [ ] **Validation:** Admin changes user role in the backend; user focuses the tab → UI updates within 2 s without reload

### 3.3 Tenant Store
- [ ] Implement `src/store/tenant.ts` (Zustand, no persistence — fresh fetch on each session init)
  - State: `tenant: Tenant | null`, `subscriptionPlan`, `currency_code`, `locale`, `fiscal_year_start`, `gstin`
  - Actions: `setTenant(tenant)`, `clearTenant()`
- [ ] **Validation:** Topbar displays correct company name and logo after login

### 3.4 UI Store
- [ ] Implement `src/store/ui.ts` (Zustand with `persist`, `partialize` to only persist `sidebarCollapsed`, `colorMode`, `locale`)
  - State: `sidebarCollapsed`, `colorMode: 'light' | 'dark' | 'system'`, `locale`, `commandPaletteOpen`, `notifications: Notification[]` (max 100), `connectionStatus`
  - Actions: `toggleSidebar`, `setColorMode`, `setLocale`, `addNotification`, `dismissNotification`, `markAllNotificationsRead`, `setConnectionStatus`
  - `setColorMode` MUST call `initColorMode()` to apply `dark` class immediately
  - `setLocale` MUST call `paraglide.setLocale(locale)`
- [ ] **Validation:** Toggle sidebar; reload → preference preserved; switch to Hindi → UI strings change; dark mode → no flash

### 3.5 Store Unit Tests
- [ ] Test auth store: `setUser`, `clearAuth`, sessionStorage persistence, cross-tab sync via `storage` event
- [ ] Test permissions store: `can()`, `hasRole()`, `setPermissions/clearPermissions`
- [ ] Test UI store: `addNotification` caps at 100 with FIFO eviction, `setColorMode` applies class
- [ ] **Target:** 90%+ coverage for all store files

---

## Phase 4: API Client (Week 2)

### 4.1 Axios Instance
- [ ] Create `src/lib/api/client.ts` with a single Axios instance:
  - `baseURL: env.VITE_API_URL`
  - `withCredentials: true`
  - `timeout: 30000`
  - Request interceptor: attach `X-CSRF-Token` (read from `__Host-csrf` cookie), `X-Request-ID` (UUID v4), `Accept-Language` (from `useUIStore.locale`)
  - Response interceptor: 401 → silent refresh via `GET /api/v1/auth/refresh`, retry; second 401 → `clearAuth()` + redirect to `/login?session_expired=true`
- [ ] **Validation:** Expired access token cookie → interceptor refreshes silently; expired refresh cookie → redirected

### 4.2 Exponential Backoff Retry
- [ ] Implement retry logic in the response interceptor:
  - Retry on 5xx and network errors (Axios error with no response)
  - 3 attempts max, delays: 500 ms, 1000 ms, 2000 ms (+100 ms jitter each)
  - ONLY retry GET, PUT, DELETE — never POST or PATCH
  - Increment a retry counter in the request config to prevent infinite loops
- [ ] **Validation:** Mock a 503 backend → client retries 3 times then surfaces `ApiError`

### 4.3 Circuit Breaker
- [ ] Implement `src/lib/api/circuit-breaker.ts`:
  - Counts consecutive API failures (all retries exhausted)
  - Opens after 5 consecutive failures within 60 s
  - In OPEN state: requests fail immediately with `ApiError { code: 'circuit_open' }`
  - Probe request every 30 s (GET a lightweight `/health` endpoint)
  - On successful probe: circuit CLOSES, `useUIStore.setConnectionStatus('connected')`
  - Auth endpoints (`/auth/*`) bypass the circuit breaker
- [ ] Wire `connectionStatus` into `useUIStore`; display banner in AppShell when disconnected
- [ ] **Validation:** Mock 5 consecutive failures → circuit opens, banner appears, banner dismisses after probe succeeds

### 4.4 ApiError Class
- [ ] Create `src/lib/api/errors.ts` with `ApiError` class:
  - Properties: `status`, `code`, `message`, `details?: Record<string, string[]>`, `requestId`, `traceId?`
  - Static `fromAxiosError(e: AxiosError): ApiError` factory method
  - Sentry capture: `if (status >= 500) Sentry.captureException(this, { tags: { request_id } })`
- [ ] **Validation:** 422 response maps field errors correctly; 500 triggers Sentry breadcrumb with request_id

### 4.5 API Endpoint Modules
- [ ] Create `src/lib/api/auth.ts`: `loginApi`, `registerApi`, `refreshApi`, `logoutApi`, `forgotPasswordApi`, `resetPasswordApi`, `getMeApi`, `verifyMfaApi`, `getSessionsApi`, `revokeSessionApi`, `revokeAllSessionsApi`, `getCsrfApi`
- [ ] Create `src/lib/api/tenant.ts`: `getCurrentTenantApi`, `updateTenantApi`
- [ ] Create `src/lib/api/permissions.ts`: `getMyPermissionsApi`
- [ ] **Validation:** All functions are properly typed; `pnpm tsc --noEmit` passes

### 4.6 Query Key Factory
- [ ] Implement `src/lib/query/keys.ts` with hierarchical namespacing:
  ```ts
  export const keys = {
    auth: { me: ['auth', 'me'] as const, sessions: ['auth', 'sessions'] as const },
    tenant: { current: ['tenant', 'current'] as const },
    permissions: { mine: ['permissions', 'mine'] as const },
    // Modules add their namespaces here as their proposals are implemented
  }
  ```
- [ ] **Validation:** Key factory is fully typed (no `string[]` widening); TypeScript strict mode passes

### 4.7 Client Logger
- [ ] Create `src/lib/logger.ts` with `createLogger(module: string)` factory:
  - Levels: `debug`, `info`, `warn`, `error`
  - Production: only `warn` and `error` output
  - Development: all levels, formatted with module tag and timestamp
  - Each log includes `X-Request-ID` of the in-flight request (from AsyncLocalStorage equivalent via React context)
- [ ] **Validation:** In dev mode, API requests log with module tag; in production build, debug/info logs are stripped

### 4.8 API Client Unit Tests
- [ ] Test CSRF token injection (mock `__Host-csrf` cookie)
- [ ] Test 401 → refresh → retry flow (mock backend with msw)
- [ ] Test retry logic with 503 (3 attempts, correct backoff timings)
- [ ] Test circuit breaker state transitions (closed → open → half-open → closed)
- [ ] Test `ApiError` construction from 422, 500, network error
- [ ] **Target:** 90%+ coverage for `src/lib/api/`

---

## Phase 5: WebSocket Client (Week 2)

### 5.1 Managed WebSocket
- [ ] Implement `src/lib/ws/client.ts` as a class `WSClient`:
  - Constructor: `url`, `onMessage` callback, `onStatusChange` callback
  - `connect()`: creates WebSocket, listens to `onopen`, `onmessage`, `onclose`, `onerror`
  - `disconnect()`: graceful close
  - Reconnection: exponential backoff from 1 s to 30 s with ±500 ms jitter
  - On `onopen`: `onStatusChange('connected')` → calls `useUIStore.setConnectionStatus('connected')`
  - On `onclose/onerror`: `onStatusChange('disconnected')` → schedules reconnect attempt
- [ ] Implement `src/lib/ws/events.ts` as a typed discriminated union of all event types
- [ ] Implement `src/lib/ws/useWebSocket.ts` React hook that wraps `WSClient` and returns event subscription API

### 5.2 WebSocket Context
- [ ] Create `WSContext` in `src/lib/ws/context.ts` that holds the singleton `WSClient`
- [ ] Mount the `WSClient` in `_app.tsx` (on layout mount) and expose via `WSContext.Provider`
- [ ] On `session_invalidated` event → call `clearAuth()` and redirect
- [ ] On `data_changed` event → call `queryClient.invalidateQueries` with the correct module keys

### 5.3 Connection Status Indicator
- [ ] Add a connection status dot to `TopBar.tsx` using `useUIStore.connectionStatus`
- [ ] Green = connected; Amber = connecting/reconnecting; Red = disconnected for > 30 s
- [ ] Show the "Unable to reach server" banner (from AppShell) when `disconnected` for > 30 s

### 5.4 WebSocket Unit Tests
- [ ] Test reconnection backoff timing (mock WebSocket close events)
- [ ] Test `session_invalidated` triggers `clearAuth` and redirect
- [ ] Test `data_changed` triggers `queryClient.invalidateQueries`
- [ ] **Target:** 90%+ coverage for `src/lib/ws/`

---

## Phase 6: App Shell & Design Components (Week 2–3)

### 6.1 AppShell Layout
- [ ] Implement `src/components/app/AppShell.tsx`: CSS grid layout (sidebar | [topbar / main])
- [ ] Wire into `_app.tsx` as the layout wrapper

### 6.2 Sidebar
- [ ] Implement `src/components/app/Sidebar.tsx`:
  - Navigation groups from a static `navigation.ts` config (groups, items, required permission)
  - Filter items using `usePermissionsStore.can(resource, 'read')` — absent items not rendered
  - Active link detection via `useMatch` from TanStack Router → `aria-current="page"`
  - Collapse toggle → `useUIStore.toggleSidebar()` with smooth CSS transition
  - Collapsed mode: icon-only with Radix Tooltip on hover (accessible via `aria-label`)
  - Fully keyboard navigable (Tab / Shift+Tab through links, Escape to collapse focus trap)

### 6.3 TopBar
- [ ] Implement `src/components/app/TopBar.tsx`:
  - Tenant logo with company-name fallback avatar (deterministic colour from `tenant.id`)
  - Breadcrumbs component (see below)
  - Connection status dot (from `useUIStore.connectionStatus`)
  - Command palette trigger button + `⌘K` / `Ctrl+K` global keyboard listener
  - Notification bell: badge count from `useUIStore.notifications` unread count; click opens `NotificationDrawer`
  - User avatar dropdown: "Profile", "Settings", "Theme", "Language", "Logout"

### 6.4 Breadcrumbs
- [ ] Implement `src/components/app/Breadcrumbs.tsx` using `useMatches` from TanStack Router
- [ ] Each match contributes a `breadcrumb` property (defined in route's `meta` object)
- [ ] Last breadcrumb is non-linked (current page); all others are `<Link>`
- [ ] `aria-label="breadcrumb"` on `<nav>`, `aria-current="page"` on last item

### 6.5 Command Palette
- [ ] Implement `src/components/app/CommandPalette.tsx` using Radix Dialog + CMDK
- [ ] Navigation commands: all routes the user has access to (filtered by permissions store)
- [ ] Recent pages: last 10 visited (stored in `useUIStore`, session only)
- [ ] Search: debounced 300 ms → `GET /api/v1/search?q=<query>`, results show module + icon
- [ ] Keyboard: Arrow up/down, Enter to navigate, Escape to close
- [ ] Accessible: results count announced via `aria-live="polite"`

### 6.6 Notification Drawer
- [ ] Implement `src/components/app/NotificationDrawer.tsx` using Radix Dialog/Sheet
- [ ] Lists `useUIStore.notifications` sorted by timestamp desc
- [ ] "Mark all as read" button → `useUIStore.markAllNotificationsRead()`
- [ ] Each notification: icon (by type), title, body, relative timestamp (`timeago`), optional deep link

### 6.7 ERP Primitive Components
- [ ] Implement `src/components/app/PageHeader.tsx` with title, breadcrumbs, subtitle slot, actions slot
- [ ] Implement `src/components/app/StatCard.tsx` with value, label, trend (+ sparkline using Recharts)
- [ ] Implement `src/components/app/DataTable.tsx` wrapping TanStack Table:
  - Props: `columns`, `queryKey`, `fetchFn` (returns `PaginatedResponse<T>`)
  - Server-side pagination (cursor-based), sorting, filtering
  - Column visibility, width persistence (localStorage keyed by `tableId`)
  - Row selection, bulk actions slot
  - Virtual scrolling via `@tanstack/react-virtual` for > 200 rows
  - Full ARIA table semantics; keyboard row navigation
- [ ] Implement `src/components/app/EmptyState.tsx` with SVG illustration, title, body, CTA button
- [ ] Implement `src/components/app/Money.tsx` with `Intl.NumberFormat` using `useTenantStore` locale and currency

### 6.8 Accessibility Audit Tooling
- [ ] Install `@axe-core/react` and add to Vitest `setupFiles` (reports violations in development)
- [ ] Install `axe-core` CLI in CI to run against the design showcase route build
- [ ] Require 0 WCAG 2.1 AA violations in CI — any violation fails the build

---

## Phase 7: Auth UI (Week 3)

### 7.1 Login Page
- [ ] Implement `src/routes/login.tsx` with TanStack Form + Zod schema
  - Fields: email (type=email), password (type=password with toggle show/hide)
  - Show session-expired banner if `?session_expired=true` in URL
  - Single-factor success → `setUser` + fetch tenant + fetch permissions → navigate to `/dashboard`
  - MFA required → transition to TOTP step (same page, no navigation)
  - TOTP step: 6-digit OTP input (auto-focus, auto-submit on 6 digits entered)
  - Failed login: non-specific error, password cleared, focus on password field
  - [ ] 5 consecutive failures → show CAPTCHA (hCaptcha)
  - 429/423 → lockout banner with countdown
  - `aria-live="polite"` on error region; all labels explicit; keyboard-only operable
  - `posthog.capture('user_logged_in', { method: 'password' })` on success

### 7.2 Register Page
- [ ] Implement `src/routes/register.tsx` with TanStack Form + Zod schema
  - Fields: company_name, full_name, email, gstin (optional), password, confirm_password
  - Live password strength meter (12+ chars, complexity)
  - [ ] HIBP common-password bloom filter check
  - GST format validation: inline regex before submit
  - Submit → navigate to `/onboarding` on success
  - `posthog.capture('tenant_registered')` on success

### 7.3 Forgot Password Page
- [ ] Implement `src/routes/forgot-password.tsx`
  - Email input; submit → show generic success copy regardless of email existence
  - Submit button disabled for 60 s after submission (countdown displayed)

### 7.4 Reset Password Page
- [ ] Implement `src/routes/reset-password.tsx`
  - Read `token` from URL search params
  - New password + confirm password fields with same strength meter as register
  - On 400/410 from backend → display "Link expired" message with link to /forgot-password
  - On success → redirect to `/login` with success toast

### 7.5 Session Management Page
- [ ] Implement Session Management section in a Settings route `_app/settings/security.tsx`
  - List active sessions (device, IP geo, last active, "Current" badge)
  - "Revoke" button on each non-current session → confirm dialog → `revokeSessionApi`
  - "Sign out all other devices" → confirm dialog → `revokeAllSessionsApi`
  - Real-time update: when a session is revoked, the other tab's WebSocket emits `session_invalidated`

---

## Phase 8: Internationalisation (Week 3)

### 8.1 English Message Completion
- [ ] Audit all JSX in `src/` and extract every hardcoded string to `messages/en.json`
- [ ] Use namespaced dot-notation keys: `auth.login.title`, `auth.login.email_label`, etc.
- [ ] **Validation:** Running `pnpm paraglide` generates typed message functions; `grep -r "\"[A-Z]"` finds zero hardcoded UI strings in non-demo components

### 8.2 Hindi Translation
- [ ] Translate all keys in `messages/en.json` to `messages/hi.json` (use professional translation, not machine-only)
- [ ] **Validation:** Switch locale to `hi` in the UI; all labels, buttons, errors, and toasts appear in Hindi

### 8.3 Locale Switcher
- [ ] Add "Language" option in user dropdown menu and the `useUIStore.setLocale()` action
- [ ] Scaffold locale files for `ta`, `te`, `bn`, `mr`, `gu` with English fallback (no missing key warnings)
- [ ] **Validation:** Switching to Hindi works end-to-end; switching to Tamil falls back gracefully to English

---

## Phase 9: Observability (Week 3–4)

### 9.1 Sentry Integration
- [ ] Configure Sentry in `__root.tsx` with `Sentry.init()`:
  - DSN from `env.VITE_SENTRY_DSN`
  - `environment`: `'production' | 'staging' | 'development'` (from env)
  - `release`: git SHA (injected by CI via `VITE_RELEASE=<sha>`)
  - Trace sample rate: 10% production, 100% staging, 0% development
  - PII scrubbing: email → UUID in breadcrumbs
  - Source maps: uploaded in CI via `@sentry/vite-plugin`
- [ ] Wrap `__root.tsx` shell component with `Sentry.ErrorBoundary` (fallback: full-page error UI with request-id)
- [ ] **Validation:** Trigger an unhandled error in dev → Sentry event appears in dashboard with source map resolved

### 9.2 PostHog Integration
- [ ] Configure PostHog in `__root.tsx` (already in `package.json`)
  - Identify user after login: `posthog.identify(user.id, { plan: tenant.subscriptionPlan })`  — no PII beyond UUID
  - Reset on logout: `posthog.reset()`
  - Page-view events: automated via `posthog.capture('$pageview')` in `_app.tsx` navigation handler
  - Feature flags: `posthog.isFeatureEnabled('flag_name')` — sync to `usePermissionsStore.featureFlags`
- [ ] **Validation:** Login → PostHog People tab shows identified user; navigate between pages → pageview events logged

### 9.3 Core Web Vitals Monitoring
- [ ] Install `web-vitals` package; report LCP, CLS, INP, FID, TTFB to PostHog on page load
- [ ] CI check: `pnpm build && pnpm dlx @unlighthouse/cli --site http://localhost:3000 --budget '{"performance": 90}'`
- [ ] **Validation:** Lighthouse performance score ≥ 90 in CI; LCP < 2.5 s, CLS < 0.1, INP < 200 ms

---

## Phase 10: Tests & Quality Sign-Off (Week 4)

### 10.1 Component Showcase Route
- [ ] Implement `src/routes/_dev/design.tsx` with full component catalogue:
  - All colour tokens with hex and contrast ratios
  - Typography scale
  - All shadcn/ui primitives in ERP theme
  - All custom ERP components in all states (loading, empty, error, populated, dark)
  - Interactive theme toggle (light/dark side-by-side comparison)
- [ ] Guard with `import.meta.env.DEV` → 404 in production
- [ ] **Validation:** `axe-core` passes on this route with 0 WCAG 2.1 AA violations

### 10.2 Integration Test Suite
- [ ] Auth flow: stub backend with MSW → register → login (single-factor) → token refresh → logout
- [ ] MFA flow: MSW mock `mfa_required` response → TOTP entry → successful session
- [ ] Permission gate: mock permissions store → verify components show/hide correctly
- [ ] Route guard: unauthenticated navigation → redirect to `/login`; forbidden route → redirect to `/403`
- [ ] Cross-tab session: mock `storage` event + WebSocket `session_invalidated` → tab redirects

### 10.3 Coverage Gate
- [ ] Configure Vitest coverage thresholds in `vitest.config.ts`:
  - `src/store/**`: 90%
  - `src/lib/api/**`: 90%
  - `src/lib/ws/**`: 90%
  - Global: 80%
- [ ] CI step fails if any threshold is not met
- [ ] **Validation:** `pnpm test --coverage` exits 0

### 10.4 Architecture Documentation
- [ ] Create `docs/frontend-architecture.md` covering:
  - Folder structure diagram with what goes where
  - Auth flow diagram (cookie-based, MFA, refresh)
  - State ownership decision table (Zustand vs TanStack Query)
  - API client architecture (interceptors, circuit breaker, retry)
  - How to add a new ERP module (step-by-step with code examples)
  - Accessibility requirements and how to run axe checks locally
  - i18n workflow (adding a new string, adding a new locale)

### 10.5 Definition of Done Checklist
- [ ] All Phase 1–9 tasks complete with green CI
- [ ] `pnpm check` (Biome lint + format) exits 0
- [ ] `pnpm tsc --noEmit` exits 0 (strict mode)
- [ ] `pnpm test --coverage` exits 0, all coverage thresholds met
- [ ] SecurityHeaders: `curl -I` confirms CSP, HSTS, X-Frame-Options present
- [ ] Auth flows (register, login, MFA, forgot/reset, logout) pass end-to-end against the backend
- [ ] PermissionGate verified: UI elements hidden for unauthorised users; backend still rejects forbidden API calls
- [ ] WebSocket: reconnects after server restart; session_invalidated redirects all tabs
- [ ] Sentry: unhandled error creates event with resolved source map
- [ ] PostHog: page views and user identification events appearing in dashboard
- [ ] WCAG 2.1 AA: axe-core CI check passes on design showcase with 0 violations
- [ ] Initial JS bundle (login page) ≤ 150 KB gzipped (bundle analyzer check in CI)
- [ ] LCP < 2.5 s, CLS < 0.1, INP < 200 ms (Lighthouse CI budget)
- [ ] English + Hindi UI strings complete; other locales fall back gracefully
- [ ] `openspec validate setup-frontend-architecture --strict` passes

---

## Dependencies

### Blocked By
- `establish-core-architecture`: backend `/api/v1/auth/*`, `/api/v1/tenants/me`, `/api/v1/users/me/permissions`, `/api/v1/users/me/sessions`, `/ws/events`, CSRF endpoint must be operational

### Blocks
- All ERP module UI proposals (accounts, inventory, CRM, HR, manufacturing, etc.)

### Parallelisable Within This Change
- Phase 2 (Design tokens) ∥ Phase 3 (Zustand stores)
- Phase 4 (API client) ∥ Phase 5 (WebSocket) ∥ Phase 6 (App shell components)

---

## Estimated Effort

| Phase | Focus | Hours |
|-------|-------|-------|
| 1 | Project structure, build config, security headers, lint rules | 12 |
| 2 | Design token system, dark mode init | 12 |
| 3 | Zustand stores + unit tests | 16 |
| 4 | API client (Axios, retry, circuit breaker, error, query hooks) | 24 |
| 5 | WebSocket client | 12 |
| 6 | App shell, sidebar, topbar, command palette, ERP components | 32 |
| 7 | Auth UI (login + MFA, register, forgot/reset, sessions) | 24 |
| 8 | i18n (en + hi completion, locale scaffolding) | 12 |
| 9 | Sentry, PostHog, Core Web Vitals | 10 |
| 10 | Tests, showcase, docs, DoD checklist | 20 |
| **Total** | | **~174 hours (4 weeks with 2 engineers)** |
