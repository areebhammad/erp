# frontend-design-system Specification

## Purpose
TBD - created by archiving change setup-frontend-architecture. Update Purpose after archive.
## Requirements
### Requirement: Design Token System
The frontend MUST define a comprehensive, semantic design token system as CSS
custom properties. All components MUST consume tokens — never raw colour values
or arbitrary spacing numbers.

#### Scenario: Semantic colour token usage
- **WHEN** any component renders a primary action button
- **THEN** it MUST use `--color-brand-primary` not a raw Tailwind class like `bg-indigo-600`
- **AND** in dark mode, `--color-brand-primary` MUST resolve to a different value automatically
  via the `.dark` class token overrides with no changes to component code

#### Scenario: Full token catalogue
- **WHEN** a developer needs to reference any design value
- **THEN** the token system MUST provide:
  - **Brand tokens:** `--color-brand-primary`, `--color-brand-secondary`, `--color-brand-accent`
  - **Semantic tokens:** `--color-success`, `--color-warning`, `--color-error`, `--color-info`
    (each with `-subtle`, `-foreground`, `-border` variants for background / text / outline use)
  - **Neutral scale:** `--color-surface`, `--color-surface-raised`, `--color-surface-overlay`,
    `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-subtle`,
    `--color-text-disabled`
  - **Typography:** `--font-sans` (Inter), `--font-mono` (JetBrains Mono), full type scale
    (`--text-xs` through `--text-4xl`) with matching line heights and letter spacings
  - **Spacing:** 4 px base grid; `--space-1` through `--space-24` (4 px to 96 px)
  - **Radii:** `--radius-sm` (4 px), `--radius-md` (6 px, default), `--radius-lg` (12 px), `--radius-full` (9999 px)
  - **Shadows:** `--shadow-sm`, `--shadow-md`, `--shadow-lg` (light and dark mode aware)
  - **Z-index scale:** named layers (`--z-base`, `--z-dropdown`, `--z-modal`, `--z-toast`, `--z-overlay`)

#### Scenario: Dark mode token resolution
- **WHEN** the `dark` class is present on `<html>`
- **THEN** every `--color-*`, `--shadow-*`, and `--color-surface-*` token MUST resolve
  to its dark-mode variant as defined in `:root.dark {}` overrides
- **AND** no component MUST have separate dark-mode conditional rendering — only CSS resolves the difference

---

### Requirement: WCAG 2.1 AA Accessibility
Every UI component in the design system MUST meet WCAG 2.1 Level AA accessibility
standards. Accessibility is a first-class, non-negotiable requirement.

#### Scenario: Colour contrast compliance
- **WHEN** any text is rendered over a background colour
- **THEN** the contrast ratio MUST be ≥ 4.5:1 for normal text and ≥ 3:1 for large text (≥ 18 pt or 14 pt bold)
- **AND** the CI pipeline MUST run `axe-core` contrast checks on the design showcase route
- **AND** any contrast failure MUST block the PR merge with the same severity as a failing test

#### Scenario: Keyboard navigation
- **WHEN** a user operates any interactive component (Button, Input, Select, Dialog, DataTable row, Sidebar link) using only a keyboard
- **THEN** all interactive elements MUST be reachable via Tab / Shift+Tab
- **AND** activation MUST work via Enter and Space where appropriate
- **AND** Dialogs and Drawers MUST trap focus within themselves when open
- **AND** pressing Escape MUST dismiss Dialogs, Drawers, Dropdowns, and the Command Palette

#### Scenario: Screen reader support
- **WHEN** a screen reader user interacts with the application
- **THEN** all images MUST have descriptive `alt` text (decorative images: `alt=""`)
- **AND** all icon-only buttons MUST have `aria-label` or `<VisuallyHidden>` text
- **AND** form fields MUST have associated `<label>` elements (not placeholder-only)
- **AND** loading states MUST be announced via `aria-live="polite"` regions
- **AND** error messages MUST be announced via `role="alert"`
- **AND** page title changes on route navigation MUST be announced via a visually-hidden `aria-live` heading

#### Scenario: Reduced motion respect
- **WHEN** the user has set `prefers-reduced-motion: reduce` in their OS accessibility settings
- **THEN** all animations and transitions MUST be disabled or reduced to instantaneous
- **AND** no component MUST rely on animation to convey information (animation is enhancement only)

---

### Requirement: App Shell
The authenticated application MUST have a consistent app shell that provides
navigation, context, and real-time status to all ERP modules.

#### Scenario: Sidebar navigation with permission filtering
- **WHEN** the app shell renders for a user with Accountant role
- **THEN** the sidebar MUST display only module groups the user has `read` permission for
- **AND** modules without permission MUST NOT appear in the sidebar (not greyed out — absent)
- **AND** the active route link MUST have `aria-current="page"` for screen readers
- **AND** the sidebar MUST be fully keyboard and screen-reader accessible

#### Scenario: Sidebar collapse with animation
- **WHEN** a user clicks the collapse toggle
- **THEN** the sidebar MUST animate from 240 px to 64 px (icon-only mode) using a CSS transition
- **AND** in collapsed mode, icon buttons MUST have `title` and `aria-label` attributes for accessibility
- **AND** hovering an icon in collapsed mode MUST show a tooltip with the item label
- **AND** the collapsed preference MUST persist in `useUIStore` (localStorage-backed)
- **AND** the animation MUST be suppressed when `prefers-reduced-motion: reduce` is set

#### Scenario: Topbar contents
- **WHEN** the app shell renders
- **THEN** the topbar MUST display:
  - Tenant logo (falls back to company initials if no `logo_url`)
  - Active module breadcrumb trail (linked, screen-reader accessible)
  - Real-time connection status indicator (green dot = connected; amber = reconnecting; red = disconnected)
  - Global command palette trigger (`⌘K` / `Ctrl+K`, also a search button)
  - Notification bell with unread count badge; badge MUST update via WebSocket without a page refresh
  - User avatar dropdown: "Profile", "Settings", "Switch Theme", "Logout"

#### Scenario: Command palette
- **WHEN** a user presses `⌘K` (macOS) or `Ctrl+K` (Windows/Linux)
- **THEN** the command palette MUST open as a modal overlay
- **AND** it MUST support:
  - Navigation to any route the user has access to
  - Recent and frequently visited pages
  - Global search across records (calls `GET /api/v1/search?q=<query>` via TanStack Query)
- **AND** keyboard navigation (arrow keys, Enter to confirm, Escape to close) MUST work
- **AND** the palette MUST announce results count to screen readers: "5 results for 'GST'"

#### Scenario: Real-time notification panel
- **WHEN** the WebSocket delivers a `{ type: 'notification' }` event
- **THEN** the notification bell badge count MUST increment immediately (no page refresh)
- **AND** clicking the bell MUST open a notification drawer with the full list
- **AND** each notification MUST have a timestamp, title, body, and an optional "View" deep link
- **AND** notifications MUST be persisted in `useUIStore.notifications` (capped at 100 items; older items evicted)

---

### Requirement: ERP Data Display Components
The design system MUST provide specialised components for ERP data presentation
that handle high-density information common in financial and operational contexts.

#### Scenario: DataTable for high-volume records
- **WHEN** a module renders a list of records (invoices, items, employees)
- **THEN** it MUST use the `<DataTable>` component which provides:
  - Server-side pagination with cursor-based navigation (not page numbers)
  - Column-level sorting (single and multi-column)
  - Advanced inline filters (DateRange, MultiSelect, NumberRange)
  - Column visibility toggling and width persistence (stored in localStorage per table ID)
  - Row selection with bulk-action support
  - Virtual scrolling for lists > 200 rows (using TanStack Virtual)
  - Keyboard navigation within the table (arrow keys, Enter to open row)
  - Full `aria-*` table semantics for screen readers

#### Scenario: StatCard for KPI dashboards
- **WHEN** a dashboard renders key metrics (revenue, open invoices, stock value)
- **THEN** it MUST use `<StatCard>` which renders:
  - Primary value formatted with `Intl.NumberFormat` using the user's locale
  - Currency values displayed with the organisation's functional currency symbol
  - Trend indicator: percentage change vs. previous period with a green ↑ or red ↓ arrow
  - Sparkline chart for the last 7 / 30 / 90 day trend (configurable)
  - Loading skeleton that matches the final layout exactly

#### Scenario: Currency and number formatting
- **WHEN** any monetary value is rendered in the UI
- **THEN** it MUST use the `<Money>` component which formats via `Intl.NumberFormat`
  with the tenant's `currency_code` and `locale` settings
- **AND** large numbers MUST use Indian number formatting (lakh, crore) when `locale = 'en-IN'` or `hi-IN`
  (e.g., ₹12,50,000 not ₹1,250,000)

---

### Requirement: Component Showcase Route (Development Tool)
The system MUST provide a developer-only route (`/dev/design`) that renders a
live showcase of all design-system primitives and composed ERP components.

#### Scenario: Showcase renders the full design system
- **WHEN** a developer navigates to `/dev/design` in a non-production environment
- **THEN** the page MUST render a fully interactive catalogue of:
  - All colour tokens with hex values and contrast ratios
  - Typography scale samples
  - All shadcn/ui primitives configured with the ERP theme
  - All custom ERP components (`DataTable`, `StatCard`, `PageHeader`, `EmptyState`, `PermissionGate`, `Money`, `CommandPalette`)
  - Interactive state variations (loading, empty, error, disabled)
  - Dark and light mode toggle to compare both themes simultaneously

#### Scenario: Showcase excluded from production bundle
- **WHEN** `NODE_ENV=production`
- **THEN** the `/dev/design` route MUST not exist in the route tree
- **AND** its module MUST be excluded from the production bundle (Vite `import.meta.env.DEV` guard)
- **AND** any direct navigation to `/dev/design` in production MUST return a 404

