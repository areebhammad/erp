## ADDED Requirements

### Requirement: Login Page with MFA Support
The system MUST provide a login page at `/login` that authenticates users via
cookie-based sessions with optional TOTP multi-factor authentication.

#### Scenario: Successful single-factor login
- **WHEN** a user submits valid email and password and MFA is not enabled on their account
- **THEN** the UI MUST call `POST /api/v1/auth/login` with `Content-Type: application/json`
- **AND** on a 200 response, the backend sets HTTP-only `access_token` and `refresh_token` cookies
- **AND** the auth store MUST be populated with the user profile from the response body
- **AND** the UI MUST redirect to `/dashboard` or the `redirect` query param
- **AND** a `posthog.capture('user_logged_in', { method: 'password' })` event MUST be emitted

#### Scenario: MFA challenge required
- **WHEN** a user submits valid credentials and MFA is enabled on their account
- **THEN** the backend returns 200 with `{ mfa_required: true, mfa_token: '<short-lived-token>' }`
- **AND** the UI MUST transition to the TOTP entry step within the same page (no navigation)
- **AND** the user MUST enter a 6-digit TOTP code within 5 minutes
- **THEN** the UI MUST call `POST /api/v1/auth/mfa/verify` with `{ mfa_token, totp_code }`
- **AND** on success, the backend sets session cookies and the UI proceeds to `/dashboard`

#### Scenario: Invalid credentials
- **WHEN** a user submits incorrect email or password
- **THEN** the backend returns 401
- **AND** the UI MUST display a non-specific error message: "The email or password you entered is incorrect."
- **AND** the password field MUST be cleared and focused
- **AND** the error MUST NOT reveal whether the email exists (prevents user enumeration)
- **AND** after 5 consecutive failed attempts from the same browser, the form MUST display a CAPTCHA

#### Scenario: Account locked after brute-force
- **WHEN** the backend returns 429 (rate limited) or 423 (account locked)
- **THEN** the UI MUST display: "Too many failed attempts. Your account has been temporarily locked. Please try again in 15 minutes or contact support."
- **AND** the submit button MUST be disabled for the lock duration (countdown displayed)

#### Scenario: Login form accessibility
- **WHEN** a screen reader user navigates the login form
- **THEN** all inputs MUST have associated `<label>` elements (not just placeholders)
- **AND** error messages MUST be announced via `role="alert"` with `aria-live="polite"`
- **AND** the form MUST be fully operable with keyboard only (Tab, Shift+Tab, Enter)
- **AND** focus MUST be set to the first error field after a failed submission

---

### Requirement: Registration Page
The system MUST provide a registration page at `/register` for creating new
tenant + admin user accounts with strong password enforcement.

#### Scenario: Successful registration
- **WHEN** a user submits valid registration details (company name, full name, email, password, GST number optional)
- **THEN** the UI MUST call `POST /api/v1/auth/register`
- **AND** on success (201), the backend sets session cookies
- **AND** the UI MUST redirect to a post-registration onboarding wizard at `/onboarding`
- **AND** `posthog.capture('tenant_registered', { plan })` MUST be emitted

#### Scenario: Password strength enforcement
- **WHEN** a user types a password in the registration form
- **THEN** a live password strength meter MUST update:
  - Minimum 12 characters
  - At least 1 uppercase, 1 lowercase, 1 digit, 1 special character
  - MUST NOT be in the HIBP (Have I Been Pwned) common passwords list (checked client-side against a local bloom filter)
- **AND** the submit button MUST be disabled until the password passes all criteria

#### Scenario: Email already registered
- **WHEN** a user registers with an email that already exists
- **THEN** the backend returns 409
- **AND** the UI MUST display: "This email is already registered. Please log in or reset your password."
- **AND** a link to `/login?email=<prefilled>` MUST be shown

#### Scenario: GST number validation
- **WHEN** a user enters an optional GST number during registration
- **THEN** the UI MUST validate the format inline (regex: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`)
- **AND** format errors MUST be shown before submission without requiring an API call

---

### Requirement: Forgot Password and Reset Flow
The system MUST provide a secure password reset flow accessible from the login page.

#### Scenario: Request password reset
- **WHEN** a user submits their email on `/forgot-password`
- **THEN** the UI MUST call `POST /api/v1/auth/forgot-password`
- **AND** regardless of whether the email exists, the UI MUST display: "If this email is registered, you will receive a reset link shortly."
- **AND** the submit button MUST be disabled for 60 seconds after submission to prevent spam

#### Scenario: Reset password with valid token
- **WHEN** a user clicks the reset link in their email and lands on `/reset-password?token=<token>`
- **THEN** the UI MUST display a form with new password and confirm password fields
- **AND** on successful submission, the backend invalidates all existing sessions for the user
- **AND** the UI MUST redirect to `/login` with a success toast: "Password reset successfully. Please log in."

#### Scenario: Expired or invalid reset token
- **WHEN** a user opens a reset link that has expired (> 30 minutes) or been used
- **THEN** the backend returns 400/410
- **AND** the UI MUST display: "This reset link has expired or already been used." with a link to request a new one

---

### Requirement: Session Management
The system MUST provide users visibility and control over their active sessions.

#### Scenario: View active sessions
- **WHEN** a user navigates to their profile settings under the "Security" tab
- **THEN** the UI MUST call `GET /api/v1/users/me/sessions`
- **AND** display a list of all active sessions with:
  - Device type and browser (derived from User-Agent)
  - IP geolocation (city, country)
  - Last active timestamp
  - "Current session" badge for the active one

#### Scenario: Revoke a specific session
- **WHEN** a user clicks "Revoke" on a session that is not their current one
- **THEN** the UI MUST call `DELETE /api/v1/users/me/sessions/<session_id>`
- **AND** display a success toast: "Session revoked."
- **AND** the revoked session's browser will be redirected to `/login` upon its next request (enforced via WebSocket `session_invalidated` event)

#### Scenario: Revoke all other sessions
- **WHEN** a user clicks "Sign out of all other devices"
- **THEN** the UI MUST show a confirmation dialog before proceeding
- **AND** call `DELETE /api/v1/users/me/sessions?except_current=true`
- **AND** all other active sessions MUST be invalidated immediately

---

### Requirement: Session Expiry and Auto-Renewal
The system MUST transparently renew sessions before expiry without user disruption.

#### Scenario: Silent token refresh via cookie
- **WHEN** the backend returns 401 on any request (expired access token cookie)
- **THEN** the Axios interceptor MUST issue `GET /api/v1/auth/refresh` (refresh cookie sent automatically)
- **AND** on 200, retry the original request — the user sees no interruption
- **AND** on 401 (refresh cookie also expired), clear the auth store, disconnect WebSocket, and redirect to `/login?session_expired=true`
- **AND** on `/login`, display a session-expired banner if `session_expired=true` is in the query

#### Scenario: Cross-tab session expiry
- **WHEN** a user's session is invalidated (logout, admin revoke, or expiry) in one tab
- **THEN** the WebSocket `session_invalidated` message MUST reach all open tabs
- **AND** all tabs MUST redirect to `/login` within 1 second with the session-expired banner
