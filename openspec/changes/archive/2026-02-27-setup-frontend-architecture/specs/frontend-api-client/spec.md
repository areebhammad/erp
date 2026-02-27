## ADDED Requirements

### Requirement: Typed Axios API Client with Security Middleware
The frontend MUST use a single shared Axios instance for all HTTP communication
with the FastAPI backend. The client MUST enforce authentication, CSRF protection,
request tracing, and no component SHALL call `fetch()` or `XMLHttpRequest` directly.

#### Scenario: Cookie-based authenticated request
- **WHEN** any TanStack Query hook or mutation function calls an API endpoint
- **THEN** the Axios instance MUST have `withCredentials: true` so HTTP-only auth
  cookies are sent automatically on every request
- **AND** no token value MUST ever appear in request headers or body (cookies only)

#### Scenario: CSRF token attachment
- **WHEN** any state-mutating request is made (POST, PUT, PATCH, DELETE)
- **THEN** the request interceptor MUST read the `__Host-csrf` cookie value
- **AND** attach it as `X-CSRF-Token: <value>` in the request header
- **AND** if the CSRF cookie is absent (first load before server sets it), the request
  MUST be deferred until a `GET /api/v1/auth/csrf` preflight call succeeds

#### Scenario: Distributed request tracing
- **WHEN** any API request is made
- **THEN** the request interceptor MUST attach `X-Request-ID: <uuid-v4>` (generated per request)
- **AND** the same UUID MUST be stored in a Sentry custom tag `request_id` for the active span
- **AND** when the backend echoes `X-Request-ID` in the response, the value MUST be logged at INFO level
- **AND** this tracing MUST enable support teams to correlate a user complaint with backend logs

#### Scenario: Locale header
- **WHEN** any API request is made
- **THEN** the request interceptor MUST attach `Accept-Language: <current-locale>` derived from `useUIStore.locale`
- **AND** the backend MUST use this header to return localised error messages

#### Scenario: Raw fetch forbidden
- **WHEN** a developer uses `fetch()`, `XMLHttpRequest`, or `axios.create()` directly in `src/`
- **THEN** the Biome `no-restricted-globals` rule MUST flag all three as errors
- **AND** the CI lint step MUST fail, blocking the PR merge

---

### Requirement: Exponential Backoff Retry and Circuit Breaker
The API client MUST automatically retry transient failures and open a circuit
breaker to prevent cascading load during an outage.

#### Scenario: 5xx retry with exponential backoff
- **WHEN** a backend response has status 500, 502, 503, or 504, OR when a network
  error occurs (no response)
- **THEN** the client MUST retry the request up to 3 times with backoff intervals
  of 500 ms, 1 s, and 2 s (plus ±100 ms random jitter)
- **AND** the retry MUST apply only to idempotent HTTP methods (GET, PUT, DELETE);
  POST and PATCH MUST NOT be automatically retried to prevent duplicate mutations
- **AND** if all retries fail, the error MUST be surfaced to the caller as `ApiError`
  with `status: 503` and `code: 'service_unavailable'`

#### Scenario: Circuit breaker opens after repeated failures
- **WHEN** 5 consecutive API calls fail (after all retries exhausted) within a 60-second window
- **THEN** the circuit breaker MUST open and subsequent requests MUST fail immediately
  without hitting the network, returning `ApiError` with `code: 'circuit_open'`
- **AND** a persistent, dismissible banner MUST appear in the app shell:
  "We're having trouble reaching the server. Retrying automatically…"
- **AND** the circuit breaker MUST attempt a probe request every 30 seconds
- **AND** on a successful probe, the circuit breaker MUST close and the banner MUST disappear

#### Scenario: Circuit breaker does not affect auth flows
- **WHEN** the circuit breaker is open
- **THEN** calls to `/api/v1/auth/logout` and `/api/v1/auth/refresh` MUST bypass the
  circuit breaker and attempt the network regardless
- **AND** the user MUST always be able to log out even during an outage

---

### Requirement: Consistent Error Normalisation
The API client MUST normalise all HTTP and network errors into a typed `ApiError`
that UI components consume without parsing raw Axios internals.

#### Scenario: RFC 7807 error mapping
- **WHEN** the backend returns any 4xx or 5xx response with a `Problem Details` JSON body
- **THEN** the API client MUST parse the body and construct `ApiError` with:
  - `status: number` (HTTP status code)
  - `code: string` (from the `type` field, e.g., `validation_error`, `not_found`)
  - `message: string` (from the `detail` field, localised per `Accept-Language`)
  - `details?: Record<string, string[]>` (field-level errors from `errors` array)
  - `requestId: string` (from `X-Request-ID` response header)
  - `traceId?: string` (from `X-Trace-ID` response header if present)

#### Scenario: 422 field errors surfaced in TanStack Form
- **WHEN** a mutation returns 422 Unprocessable Entity with field-level errors
- **THEN** the mutation's `onError` handler MUST call `form.setFieldError(field, messages[0])`
  for each field in `ApiError.details`
- **AND** the form MUST display inline error messages under the relevant fields WITHOUT
  showing a toast notification (toast is reserved for non-field errors only)

#### Scenario: Sentry capture on 5xx
- **WHEN** any API request results in an `ApiError` with `status >= 500` after all retries
- **THEN** `Sentry.captureException(apiError, { tags: { request_id: apiError.requestId } })` MUST be called
- **AND** the user MUST see a toast: "Something went wrong on our end. Our team has been notified." with the `requestId` displayed for reference

#### Scenario: Network error (no response)
- **WHEN** an API call fails with no HTTP response (DNS failure, timeout, offline)
- **THEN** the `ApiError` MUST have `status: 0` and `code: 'network_error'`
- **AND** the toast MUST read: "Unable to connect to the server. Please check your internet connection."

---

### Requirement: TanStack Query Conventions
All server-state data fetching MUST go through typed TanStack Query hooks following
a consistent, documented pattern. Optimistic updates MUST be used for user-initiated
mutations to ensure a responsive, low-latency feel.

#### Scenario: List query hook structure
- **WHEN** a developer needs to fetch a paginated list (e.g., invoices)
- **THEN** they MUST use a hook `useInvoices(params: InvoiceListParams)` in `src/lib/query/hooks/accounts/`
- **AND** the hook MUST use `useQuery({ queryKey: keys.accounts.invoices.list(params), queryFn: ... })`
- **AND** the hook MUST return `{ data: PaginatedResponse<Invoice>, isLoading, isFetching, isError, error: ApiError | null }`

#### Scenario: Mutation with optimistic update
- **WHEN** a user changes an invoice status from "Draft" to "Submitted"
- **THEN** the UI MUST update the displayed status immediately (optimistic update via `onMutate`)
- **AND** simultaneously call the API in the background
- **AND** on API success, confirm the optimistic update (no visible flicker)
- **AND** on API failure, roll back to "Draft", display an `ApiError` toast, and log the rollback

#### Scenario: Mutation with pessimistic update (destructive only)
- **WHEN** a user deletes an invoice
- **THEN** the UI MUST show a confirmation dialog BEFORE making the API call
- **AND** only after the API returns 200 MUST the item be removed from the list
  (`queryClient.invalidateQueries` or `queryClient.setQueryData` removing the item)
- **AND** optimistic removal MUST NOT be used for delete operations

#### Scenario: Query key factory namespace collision prevention
- **WHEN** two different modules both needed to cache data keyed to "items"
- **THEN** the key factory at `src/lib/query/keys.ts` MUST produce:
  - Inventory: `['inventory', 'items', { filters }]`
  - Selling: `['selling', 'product-catalogue', { filters }]`
- **AND** invalidating inventory items MUST NOT affect selling catalogue cache
- **AND** the key factory MUST be the single source of truth — no inline string arrays in hooks

#### Scenario: Stale-while-revalidate for non-critical data
- **WHEN** a TanStack Query hook fetches relatively static data (e.g., currency list, UOM list)
- **THEN** `staleTime` MUST be set to at least 5 minutes so repeated navigations
  do not generate redundant network requests
- **AND** `gcTime` MUST be set to at least 10 minutes so the data survives tab switches

---

### Requirement: WebSocket Client Integration
The frontend MUST maintain a persistent WebSocket connection for real-time events
from the backend event bus.

#### Scenario: Connection initialisation
- **WHEN** the `_app.tsx` layout mounts (user is authenticated)
- **THEN** the WebSocket client MUST connect to `wss://<api-domain>/ws/events`
- **AND** the connection MUST authenticate automatically via the HTTP-only session cookie
  (cookie is sent automatically by the browser on same-origin WebSocket upgrade)
- **AND** the connection MUST be shared via React Context — only one connection per browser tab

#### Scenario: Automatic reconnection
- **WHEN** the WebSocket connection drops (network interruption, server restart)
- **THEN** the client MUST attempt reconnection with exponential backoff starting at 1 s,
  doubling each attempt, capped at 30 s, with ±500 ms random jitter
- **AND** a subtle connection-status indicator (dot) in the top bar MUST reflect
  connecting / connected / disconnected state
- **AND** after 3 consecutive failed reconnect attempts, a dismissible banner MUST appear:
  "Live updates are temporarily unavailable. Reconnecting…"

#### Scenario: Data-changed event triggers cache invalidation
- **WHEN** the WebSocket receives `{ type: 'data_changed', module: 'accounts', resource: 'invoice' }`
- **THEN** the client MUST call `queryClient.invalidateQueries({ queryKey: ['accounts', 'invoices'] })`
- **AND** TanStack Query MUST refetch in the background and update the UI reactively
- **AND** the user MUST see a subtle "Updated just now" indicator on the list

#### Scenario: Session invalidation via WebSocket
- **WHEN** the WebSocket receives `{ type: 'session_invalidated' }`
- **THEN** the auth store MUST be cleared immediately
- **AND** the WebSocket MUST be closed
- **AND** ALL open tabs MUST redirect to `/login` with a banner: "Your session was terminated. Please log in again."
