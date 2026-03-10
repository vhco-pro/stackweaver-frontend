<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_variable_set

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/variable_set

**Status**: Implemented (with some mapping differences)

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `name` | string (Required) | `name` | Implemented | |
| `description` | string (Optional) | `description` | Implemented | |
| `global` | bool (Optional) | `scope` / org-wide | Implemented | TFE default: false. We use `scope` ("organization" vs "workspace") |
| `priority` | bool (Optional) | `priority` | Implemented | Override by more specific scopes / CLI. TFE default: false |
| `organization` | string (Optional) | `organization_id` | Implemented | Omit if set in provider |
| `workspace_ids` | list (Optional) | **Deprecated** | Implemented | TFE deprecated. Use `tfe_workspace_variable_set`. Mutually exclusive with `global` |
| `parent_project_id` | string (Optional) | `project_id` | Implemented | Project-owned varset. TFE: `global` must be false |

## Attributes Reference (Computed)

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `id` | Implemented | `varset-` prefixed |

## Scope / Global Mapping

- **TFE `global = true`**: Variable set applies to all workspaces in the org. StackWeaver: `scope = "organization"` and no workspace/project assignments (or org-wide project assignments).
- **TFE `global = false`**: Variable set applies to specific workspaces (via `tfe_workspace_variable_set`) or project (via `tfe_project_variable_set`). StackWeaver: `scope = "workspace"` + `VariableSetWorkspace` rows, or project-owned + `VariableSetProject` rows.

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/organizations/:org/varsets` | GET | Implemented | List |
| `/api/v2/organizations/:org/varsets` | POST | Implemented | Create |
| `/api/v2/varsets/:id` | GET | Implemented | Get by ID |
| `/api/v2/varsets/:id` | PATCH | Implemented | Update |
| `/api/v2/varsets/:id` | DELETE | Implemented | Delete |
| Varset–workspace association | `POST/DELETE /varsets/:id/relationships/workspaces` | `tfe_workspace_variable_set` | Implemented |
| Varset–project association | `POST/DELETE /varsets/:id/relationships/projects` | `tfe_project_variable_set` | Implemented (AssignProject/UnassignProject) |

## Example TFE Usage

```hcl
# Global (org-wide) variable set
resource "tfe_variable_set" "global" {
  name         = "global-env"
  description  = "Shared env vars"
  global       = true
  organization = "my-org"
  priority     = false
}

# Workspace-scoped variable set (preferred over deprecated workspace_ids)
resource "tfe_variable_set" "project" {
  name                = "project-vars"
  description         = "Project vars"
  global              = false
  organization        = "my-org"
  parent_project_id   = tfe_project.example.id
}

resource "tfe_workspace_variable_set" "project" {
  variable_set_id = tfe_variable_set.project.id
  workspace_id    = tfe_workspace.example.id
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/variable_set.go`
**Handler**: Variable set handlers (varsets API)
**Repository**: `backend/internal/repository/variable_set.go`

**Note**: We use `VariableSetWorkspace` and `VariableSetProject` for workspace/project associations. `workspace_ids` on the variable set itself is deprecated in TFE; we support association via `tfe_workspace_variable_set` and project association via `relationships/projects`.

## Missing / Different

1. **`workspace_ids`**: Deprecated in TFE; we track via `tfe_workspace_variable_set` (relationships/workspaces) instead.
2. **`tfe_project_variable_set`**: TFE provider resource for project–varset link; we implement the same via `relationships/projects` (AssignProject/UnassignProject). Provider parity may vary.

## Testing

Test file: `stackweaver-tests/tfe-tests/variables.tf` (variable sets and `tfe_workspace_variable_set`).
