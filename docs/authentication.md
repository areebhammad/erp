# Authentication & Authorization

## JWT Tokens
The system uses asymmetric RS256 JWT tokens.

### Access Token
Short-lived (15 minutes). Contains `sub` (user_id), `tenant_id`, and roles.

### Refresh Token
Long-lived (7 days). Used to rotate access tokens.

## RBAC
Permissions are structured as `(resource, action)`.
Example: `(invoices, read)`. Users are granted Roles, which map locally per-tenant to Permissions.
