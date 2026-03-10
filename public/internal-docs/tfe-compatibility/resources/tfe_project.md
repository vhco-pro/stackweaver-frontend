<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_project

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/project

**Status**: Implemented

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `name` | string (Required) | `name` | Implemented | |
| `organization` | string (Required) | `organization_id` | Implemented | |
| `description` | string (Optional) | `description` | Implemented | |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `id` (UUID) | Implemented | StackWeaver uses UUID; TFE may use `prj-` prefix |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /api/v2/organizations/:org/projects` | GET | Implemented | List |
| `POST /api/v2/organizations/:org/projects` | POST | Implemented | Create |
| `GET /api/v2/organizations/:org/projects/:name` | GET | Implemented | Get by name |
| `PATCH /api/v2/organizations/:org/projects/:name` | PATCH | Implemented | Update |
| `GET /api/v2/projects/:id` | GET | Implemented | Get by ID |
| `DELETE /api/v2/projects/:id` | DELETE | Implemented | Delete |

## Example TFE Usage

```hcl
resource "tfe_project" "main" {
  name         = "main"
  organization = "my-org"
  description  = "Default project"
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/project.go`
**Handler**: `backend/internal/api/v2/handlers/projects.go`
**Repository**: `backend/internal/repository/project.go`

## References

- [tfe_workspace](./tfe_workspace.md) — workspaces belong to projects via `project_id`
- [tfe_variable_set](./tfe_variable_set.md) — project-owned variable sets via `parent_project_id`
