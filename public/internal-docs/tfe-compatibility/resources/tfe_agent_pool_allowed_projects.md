<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_agent_pool_allowed_projects

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_pool_allowed_projects

**Status**: Implemented & Tested

## Description

Adds projects to the allowlist for an agent pool. When projects are added to the allowlist, all workspaces within those projects can use the agent pool. This provides a more scalable way to manage pool access than adding individual workspaces.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `agent_pool_id` | string | `agent_pool_id` | Implemented | Required. The ID of the agent pool |
| `allowed_project_ids` | list(string) | `allowed-projects` relationship | Implemented | Required. List of project IDs to allow |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | composite | Implemented | Same as `agent_pool_id` |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/agent-pools/:id` | PATCH | Implemented | Update with `allowed-projects` relationship |
| `/api/v2/agent-pools/:id` | GET | Implemented | Returns `allowed-projects` in relationships |

## Implementation Details

### How it Works

In TFE, this is a separate resource that manages the `allowed-projects` relationship on an agent pool. In StackWeaver, this is handled via:

1. **PATCH request** to `/api/v2/agent-pools/:id` with a `relationships.allowed-projects` payload
2. The handler calls `poolRepo.ReplaceAllowedProjects(poolID, projectIDs)`
3. The relationship is stored in the `agent_pool_allowed_projects` join table

### Request Format

```json
{
  "data": {
    "type": "agent-pools",
    "relationships": {
      "allowed-projects": {
        "data": [
          { "id": "prj-abc123", "type": "projects" },
          { "id": "prj-def456", "type": "projects" }
        ]
      }
    }
  }
}
```

### Response Format

The updated agent pool is returned with `relationships.allowed-projects` populated:

```json
{
  "data": {
    "id": "pool-id",
    "type": "agent-pools",
    "attributes": { ... },
    "relationships": {
      "allowed-projects": {
        "data": [
          { "id": "prj-abc123", "type": "projects" },
          { "id": "prj-def456", "type": "projects" }
        ]
      }
    }
  }
}
```

## Example TFE Usage

```hcl
# Create an agent pool
resource "tfe_agent_pool" "production" {
  name               = "production-pool"
  organization       = "my-org"
  organization_scoped = false
}

# Allow all workspaces in the production project
resource "tfe_agent_pool_allowed_projects" "production" {
  agent_pool_id       = tfe_agent_pool.production.id
  allowed_project_ids = [tfe_project.production.id]
}
```

## StackWeaver Implementation

**Handler**: `backend/internal/api/v2/handlers/agent_pools.go` - `Update()` method
**Repository**: `backend/internal/repository/agent_pool.go` - `ReplaceAllowedProjects()`
**Model**: `backend/internal/models/agent_pool.go` - `AllowedProjects` many2many relation

## Testing

Tested in `stackweaver-tests/tfe-tests/agent-pools.tf`:

```hcl
resource "tfe_agent_pool_allowed_projects" "allowed_projects" {
  agent_pool_id       = tfe_agent_pool.test-agent-pool.id
  allowed_project_ids = [data.tfe_project.default-project.id]
}
```

## Behavior Notes

- Setting `allowed_project_ids` to an empty list clears all allowed projects
- Project-level access is additive with workspace-level access (`allowed_workspaces`)
- All workspaces within an allowed project inherit access to the pool
- Can be combined with `tfe_agent_pool_allowed_workspaces` for fine-grained control
