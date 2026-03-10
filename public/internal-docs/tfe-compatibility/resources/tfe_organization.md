<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_organization

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/organization

**Status**: Core Implementation Complete - some features left todo -> check: `Not Implemented (Returns Defaults)`

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `name` | string (Required) | `name` | Implemented | Primary identifier; used as `id` in JSON:API responses |
| `email` | string (Required) | `email` | Implemented | Admin email address; stored on org model |
| `session_timeout_minutes` | int (Optional) | - | Not Implemented | Session timeout after inactivity. TFE default: 20160. Using Zitadel for auth. |
| `session_remember_minutes` | int (Optional) | - | Not Implemented | Session expiration. TFE default: 20160. Using Zitadel for auth. |
| `collaborator_auth_policy` | string (Optional) | `collaborator_auth_policy` | Implemented | `password` or `two_factor_mandatory`. Stored on org model, defaults to `password` |
| `enforce_hyok` | bool (Optional) | - | Not Implemented | (HCP Terraform) HYOK for new workspaces. Default: false |
| `owners_team_saml_role_id` | string (Optional) | - | Not Implemented | Name of "owners" team (SAML integration) |
| `cost_estimation_enabled` | bool (Optional) | `cost_estimation_enabled` | Implemented | Stored on org model, defaults to true |
| `send_passing_statuses_for_untriggered_speculative_plans` | bool (Optional) | - | Not Implemented | VCS status for untriggered speculative plans. Returns false. |
| `aggregated_commit_status_enabled` | bool (Optional) | - | Not Implemented | Aggregated status checks (monorepos). Returns false. |
| `speculative_plan_management_enabled` | bool (Optional) | - | Not Implemented | Cancel outdated speculative plans. Returns true (hardcoded). |
| `assessments_enforced` | bool (Optional) | - | Not Implemented | (HCP Terraform) Force drift/health assessments. Returns false. |
| `allow_force_delete_workspaces` | bool (Optional) | - | Not Implemented | Allow admins to delete workspaces with resources. Returns false. |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `name` | Implemented | TFE uses org name as ID (not UUID) |
| `external-id` | string | `id` (UUID) | Implemented | Internal UUID exposed as external-id |
| `created_at` | timestamp | `created_at` | Implemented | |
| `updated_at` | timestamp | `updated_at` | Implemented | |
| `permissions` | object | - | Implemented | Full permissions object returned with sensible defaults |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/organizations` | GET | Implemented | List organizations |
| `/api/v2/organizations` | POST | Implemented | Create organization (accepts JSON:API format with email, collaborator-auth-policy) |
| `/api/v2/organizations/:name` | GET | Implemented | Get by name (returns TFE-compatible JSON:API) |
| `/api/v2/organizations/:name` | PATCH | Implemented | Update organization (accepts JSON:API format) |
| `/api/v2/organizations/:name` | DELETE | Implemented | Delete organization |

## Example TFE Usage

```hcl
resource "tfe_organization" "test" {
  name  = "my-org-name"
  email = "admin@company.com"
  collaborator_auth_policy = "password"  # or "two_factor_mandatory"
  cost_estimation_enabled  = true
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/organization.go`

```go
type Organization struct {
    ID                     uuid.UUID
    Name                   string
    Description            string
    Email                  string  // TFE-compatible
    CollaboratorAuthPolicy string  // "password" or "two_factor_mandatory"
    CostEstimationEnabled  bool    // defaults to true
    CreatedAt              time.Time
    UpdatedAt              time.Time
}
```

**Handler**: `backend/internal/api/v2/handlers/organizations.go`
- `buildTFEOrganizationResponse()` helper for consistent JSON:API responses
- Supports both simple JSON and JSON:API format for create/update

**Repository**: `backend/internal/repository/organization.go`

## What's Implemented

1. **Email**: Stored on Organization model, returned in JSON:API responses
2. **Collaborator Auth Policy**: `password` (default) or `two_factor_mandatory` - stored and returned
3. **Cost Estimation**: Boolean flag stored on org model
4. **JSON:API Response**: Full TFE-compatible response with `id` = org name, `external-id` = UUID, permissions object

## Not Implemented (Returns Defaults)

1. **Session settings**: Using Zitadel for auth, not org-level session config
2. **SAML / HYOK**: Enterprise features not implemented
3. **VCS status / speculative plan management**: Returns hardcoded values
4. **Assessments enforced**: Org-level drift policy returns false
5. **Force delete policy**: Returns false, behavior not gated by org setting

## Testing

Test file: `stackweaver-tests/tfe-tests/agent-pools.tf`

```hcl
resource "tfe_organization" "test-organization" {
  name  = "stackweaver-tests-tfe-provider"
  email = "admin@example.com"
  collaborator_auth_policy = "password"
}
```
