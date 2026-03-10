<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_team

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team

**Status**: Implemented - apart from SSO.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `name` | string | `name` | Implemented | Team name |
| `organization` | string | `organization_id` | Implemented | |
| `visibility` | string | `visibility` | Implemented | "organization" or "secret" |
| `sso_team_id` | string | - | Not Implemented | SSO integration |
| `organization_access` | block | See below | Implemented | Org-level permissions |
| `allow_member_token_management` | string | See below | todo?| team scoped tokens management - not sure we have this |

### Organization Access Block

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `read_workspaces` | bool | `read_workspaces` | Implemented | |
| `read_projects` | bool | `read_projects` | Implemented | |
| `manage_policies` | bool | `manage_policies` | Implemented | |
| `manage_policy_overrides` | bool | `manage_policy_overrides` | Implemented | |
| `manage_workspaces` | bool | `manage_workspaces` | Implemented | |
| `manage_vcs_settings` | bool | `manage_vcs_settings` | Implemented | |
| `manage_providers` | bool | `manage_providers` | Implemented | |
| `manage_modules` | bool | `manage_modules` | Implemented | |
| `manage_run_tasks` | bool | `manage_run_tasks` | Implemented | |
| `manage_projects` | bool | `manage_projects` | Implemented | |
| `manage_membership` | bool | `manage_membership` | Implemented | |
| `manage_teams` | bool | - | Not Implemented | |
| `manage_organization_access` | bool | - | Not Implemented | |
| `access_secret_teams` | bool | - | Not Implemented | |
| `manage_agent_pools` | bool | `manage_agent_pools` | Implemented | |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `id` (UUID) | Implemented | |
| `users_count` | int | computed | Implemented | |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/organizations/:org/teams` | GET | Implemented | List |
| `/api/v2/organizations/:org/teams` | POST | Implemented | Create |
| `/api/v2/organizations/:org/teams/:name` | GET | Implemented | Get by name |
| `/api/v2/teams/:id` | GET | Implemented | Get by ID |
| `/api/v2/teams/:id` | PATCH | Implemented | Update |
| `/api/v2/teams/:id` | DELETE | Implemented | Delete |

## Related Resources

### tfe_team_access (Workspace Access)

| Attribute | Status | Notes |
|-----------|--------|-------|
| `team_id` | Implemented | |
| `workspace_id` | Implemented | |
| `access` | Implemented | "read", "plan", "write", "admin", "custom" |
| `permissions` | Implemented | Custom permission block |

### tfe_team_project_access

| Attribute | Status | Notes |
|-----------|--------|-------|
| `team_id` | Implemented | |
| `project_id` | Implemented | |
| `access` | Implemented | "read", "maintain", "admin", "custom" |

### tfe_team_organization_member(s)

| Attribute | Status | Notes |
|-----------|--------|-------|
| `team_id` | Implemented | |
| `organization_membership_id` | Implemented | |

## Example TFE Usage

```hcl
resource "tfe_team" "developers" {
  name         = "developers"
  organization = "my-org"
  visibility   = "organization"
  
  organization_access {
    read_workspaces = true
    read_projects   = true
  }
}

resource "tfe_team_access" "dev_access" {
  team_id      = tfe_team.developers.id
  workspace_id = tfe_workspace.dev.id
  access       = "write"
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/team.go`
**Handler**: `backend/internal/api/v2/handlers/teams.go`
**Repository**: `backend/internal/repository/team.go`

## Testing

Test file: `stackweaver-tests/tfe-tests/teams.tf`
