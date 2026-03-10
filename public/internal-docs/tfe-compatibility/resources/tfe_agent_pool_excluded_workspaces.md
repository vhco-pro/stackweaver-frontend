<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_agent_pool_excluded_workspaces

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_pool_excluded_workspaces

**Status**: Implemented & Tested

## Description

Adds workspaces to the exclusion list for an organization-scoped agent pool (`organization_scoped = true`). When a pool is organization-scoped, all workspaces in the organization can use it by default. Excluded workspaces are explicitly denied access even though the pool is organization-scoped.

This is useful for blocking specific workspaces (e.g., development workspaces) from using a production agent pool.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `agent_pool_id` | string | `agent_pool_id` | Implemented | Required. The ID of the agent pool |
| `excluded_workspace_ids` | list(string) | `excluded-workspaces` relationship | Implemented | Required. List of workspace IDs to exclude |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | composite | Implemented | Same as `agent_pool_id` |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/agent-pools/:id` | PATCH | Implemented | Update with `excluded-workspaces` relationship |
| `/api/v2/agent-pools/:id` | GET | Implemented | Returns `excluded-workspaces` in relationships |

## Implementation Details

### How it Works

In TFE, this is a separate resource that manages the `excluded-workspaces` relationship on an agent pool. In StackWeaver, this is handled via:

1. **PATCH request** to `/api/v2/agent-pools/:id` with a `relationships.excluded-workspaces` payload
2. The handler calls `poolRepo.ReplaceExcludedWorkspaces(poolID, workspaceIDs)`
3. The relationship is stored in the `agent_pool_excluded_workspaces` join table

### Request Format

```json
{
  "data": {
    "type": "agent-pools",
    "relationships": {
      "excluded-workspaces": {
        "data": [
          { "id": "ws-abc123", "type": "workspaces" },
          { "id": "ws-def456", "type": "workspaces" }
        ]
      }
    }
  }
}
```

### Response Format

The updated agent pool is returned with `relationships.excluded-workspaces` populated:

```json
{
  "data": {
    "id": "pool-id",
    "type": "agent-pools",
    "attributes": { ... },
    "relationships": {
      "excluded-workspaces": {
        "data": [
          { "id": "ws-abc123", "type": "workspaces" },
          { "id": "ws-def456", "type": "workspaces" }
        ]
      }
    }
  }
}
```

## Example TFE Usage

```hcl
# Create an organization-scoped pool (default for all workspaces)
resource "tfe_agent_pool" "prod" {
  name               = "prod-pool"
  organization       = "my-org"
  organization_scoped = true  # All workspaces can use by default
}

# Exclude development workspaces from the production pool
resource "tfe_agent_pool_excluded_workspaces" "prod" {
  agent_pool_id          = tfe_agent_pool.prod.id
  excluded_workspace_ids = [
    tfe_workspace.dev.id,
    tfe_workspace.sandbox.id
  ]
}
```

## StackWeaver Implementation

**Handler**: `backend/internal/api/v2/handlers/agent_pools.go` - `Update()` method
**Repository**: `backend/internal/repository/agent_pool.go` - `ReplaceExcludedWorkspaces()`
**Model**: `backend/internal/models/agent_pool.go` - `ExcludedWorkspaces` many2many relation

## Testing

Tested in `stackweaver-tests/tfe-tests/agent-pools.tf`:

```hcl
resource "tfe_agent_pool_excluded_workspaces" "excluded" {
  agent_pool_id          = tfe_agent_pool.test-agent-pool.id
  excluded_workspace_ids = [data.tfe_workspace.mikeshop-api.id]
}
```

## Behavior Notes

- Setting `excluded_workspace_ids` to an empty list clears all exclusions
- This resource only has effect when `organization_scoped = true` on the parent pool
- Excluded workspaces are denied access to the pool even if they would otherwise have access
- Exclusions take precedence over project-level allowlists
