<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_team_access

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_access

**Status**: Implemented

Team-level access to a **workspace**. TFE uses `team-workspaces` API; the provider resource is `tfe_team_access`.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `team_id` | string (Required) | `team_id` | Implemented | |
| `workspace_id` | string (Required) | `workspace_id` | Implemented | `ws-` prefixed |
| `access` | string (Optional) | `access` | Implemented | One of: `admin`, `read`, `plan`, `write` |
| `permissions` | block (Optional) | See below | Implemented | Custom permissions; use when not using fixed `access` |

### permissions Block (Custom)

When `access` is not set, use `permissions` for granular control. Mutually exclusive with `access`.

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `runs` | string | `runs` | Implemented | `read`, `plan`, or `apply` |
| `variables` | string | `variables` | Implemented | `none`, `read`, or `write` |
| `state_versions` | string | `state_versions` | Implemented | `none`, `read`, `read-outputs`, or `write` |
| `sentinel_mocks` | string | `sentinel_mocks` | Implemented | `none` or `read` |
| `workspace_locking` | bool | `workspace_locking` | Implemented | Lock/unlock workspace |
| `run_tasks` | bool | `run_tasks` | Implemented | Manage run tasks |

## API Endpoints

TFE uses `team-workspaces` (not `team-access`). StackWeaver implements:

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /api/v2/team-workspaces?filter[workspace][id]=ws-...` | GET | Implemented | List by workspace |
| `POST /api/v2/team-workspaces` | POST | Implemented | Create |
| `GET /api/v2/team-workspaces/:id` | GET | Implemented | Read |
| `PATCH /api/v2/team-workspaces/:id` | PATCH | Implemented | Update |
| `DELETE /api/v2/team-workspaces/:id` | DELETE | Implemented | Delete |

## Example TFE Usage

```hcl
# Fixed access level
resource "tfe_team_access" "dev_write" {
  team_id      = tfe_team.developers.id
  workspace_id = tfe_workspace.example.id
  access       = "write"
}

# Custom permissions
resource "tfe_team_access" "dev_custom" {
  team_id      = tfe_team.developers.id
  workspace_id = tfe_workspace.example.id

  permissions {
    runs            = "apply"
    variables       = "write"
    state_versions  = "read-outputs"
    sentinel_mocks  = "none"
    workspace_locking = true
    run_tasks       = false
  }
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/team_workspace_access.go`
**Handler**: `backend/internal/api/v2/handlers/team_workspace_access.go` (team-workspaces routes)
**Repository**: `backend/internal/repository/team_workspace_access.go`

## References

- [TFE Endpoint Compatibility Sitrep](../../status/TFE_ENDPOINT_COMPATIBILITY_SITREP.md) — team-workspaces endpoints
- [Team Workspace Access Research](../../research/TEAM_WORKSPACE_ACCESS_RESEARCH.md)
