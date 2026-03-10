<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_team_project_access

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_project_access

**Status**: Implemented

Team-level access to a **project**. Controls project settings, project teams, variable sets, and workspace-level permissions for all workspaces in the project.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `team_id` | string (Required) | `team_id` | Implemented | |
| `project_id` | string (Required) | `project_id` | Implemented | |
| `access` | string (Optional) | `access` | Implemented | `admin`, `maintain`, `read`, `write`, or `custom` |
| `project_access` | block (Optional) | See below | Implemented | When `access = "custom"` |
| `workspace_access` | block (Optional) | See below | Implemented | When `access = "custom"`; applies to all workspaces in project |

### project_access Block (when access = "custom")

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `project_settings` | string | `project_settings` | Implemented | `read`, `update`, or `delete` |
| `project_teams` | string | `project_teams` | Implemented | `none`, `read`, or `manage` |
| `project_variable_sets` | string | `project_variable_sets` | Implemented | `none`, `read`, or `write` |

### workspace_access Block (when access = "custom")

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `workspace_runs` | string | `workspace_runs` | Implemented | `read`, `plan`, or `apply` |
| `workspace_sentinel_mocks` | string | `workspace_sentinel_mocks` | Implemented | `none` or `read` |
| `workspace_state_versions` | string | `workspace_state_versions` | Implemented | `none`, `read-outputs`, `read`, or `write` |
| `workspace_variables` | string | `workspace_variables` | Implemented | `none`, `read`, or `write` |
| `workspace_create` | bool | `workspace_create` | Implemented | Create workspaces in project |
| `workspace_locking` | bool | `workspace_locking` | Implemented | Lock/unlock workspaces |
| `workspace_move` | bool | `workspace_move` | Implemented | Move workspaces |
| `workspace_delete` | bool | `workspace_delete` | Implemented | Delete workspaces |
| `workspace_run_tasks` | bool | `workspace_run_tasks` | Implemented | Manage run tasks |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /api/v2/team-projects?filter[project][id]=...` | GET | Implemented | List by project |
| `POST /api/v2/team-projects` | POST | Implemented | Create |
| `GET /api/v2/team-projects/:id` | GET | Implemented | Read |
| `PATCH /api/v2/team-projects/:id` | PATCH | Implemented | Update |
| `DELETE /api/v2/team-projects/:id` | DELETE | Implemented | Delete |

## Example TFE Usage

```hcl
# Fixed access
resource "tfe_team_project_access" "dev_maintain" {
  team_id    = tfe_team.developers.id
  project_id = tfe_project.main.id
  access     = "maintain"
}

# Custom access
resource "tfe_team_project_access" "dev_custom" {
  team_id    = tfe_team.developers.id
  project_id = tfe_project.main.id
  access     = "custom"

  project_access {
    project_settings     = "update"
    project_teams        = "read"
    project_variable_sets = "read"
  }

  workspace_access {
    workspace_runs          = "apply"
    workspace_state_versions = "read-outputs"
    workspace_variables     = "write"
    workspace_create        = true
    workspace_locking       = true
  }
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/team_project_access.go`
**Handler**: `backend/internal/api/v2/handlers/team_project_access.go`
**Repository**: `backend/internal/repository/team_project_access.go`

## References

- [Team Project Access Research](../../research/TEAM_PROJECT_ACCESS_RESEARCH.md)
