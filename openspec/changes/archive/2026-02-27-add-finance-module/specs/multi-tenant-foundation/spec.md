## MODIFIED Requirements

### Requirement: Tenant Provisioning

The system MUST support creating new tenants with isolated resources and default
configuration.

#### Scenario: Tenant Creation
**Given** a valid tenant registration request
**When** the system provisions a new tenant
**Then** a new record MUST be created in the `tenants` table
**And** a unique tenant ID (UUID) MUST be generated
**And** a URL-safe slug MUST be created from the tenant name
**And** the tenant status MUST be set to 'active'

#### Scenario: Default Tenant Configuration
**Given** a newly created tenant
**When** the provisioning process completes
**Then** default roles MUST be created (Admin, User, Accountant)
**And** default permissions MUST be assigned to roles
**And** the default Indian GAAP Chart of Accounts MUST be seeded (five root groups
plus standard sub-accounts including GST tax accounts)
**And** the current fiscal year (April 1 – March 31) MUST be created with status `open`
**And** default GST tax rates (0%, 5%, 12%, 18%, 28%) MUST be seeded and linked to the
seeded GST CoA accounts
**And** tenant settings MUST be initialized with:
- `default_currency`: `"INR"`
- `fiscal_year_start_month`: `4` (April)
- `accounting_method`: `"accrual"`

#### Scenario: Admin User Creation
**Given** a new tenant is being provisioned
**When** the registration includes an admin user
**Then** the admin user MUST be created with tenant_id set to the new tenant
**And** the admin user MUST be assigned the 'Admin' role
**And** the admin user MUST receive a verification email
