<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_agent_pool_allowed_workspaces

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_pool_allowed_workspaces

**Status**: Implemented & Tested

## Description

Adds workspaces to the allowlist for an agent pool that is NOT organization-scoped (`organization_scoped = false`). When a pool is not organization-scoped, only workspaces explicitly listed in the allowlist can use the pool.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `agent_pool_id` | string | `agent_pool_id` | Implemented | Required. The ID of the agent pool |
| `allowed_workspace_ids` | list(string) | `allowed-workspaces` relationship | Implemented | Required. List of workspace IDs to allow |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | composite | Implemented | Same as `agent_pool_id` |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/agent-pools/:id` | PATCH | Implemented | Update with `allowed-workspaces` relationship |
| `/api/v2/agent-pools/:id` | GET | Implemented | Returns `allowed-workspaces` in relationships |

## Implementation Details

### How it Works

In TFE, this is a separate resource that manages the `allowed-workspaces` relationship on an agent pool. In StackWeaver, this is handled via:

1. **PATCH request** to `/api/v2/agent-pools/:id` with a `relationships.allowed-workspaces` payload
2. The handler calls `poolRepo.ReplaceAllowedWorkspaces(poolID, workspaceIDs)`
3. The relationship is stored in the `agent_pool_allowed_workspaces` join table

### Request Format

```json
{
  "data": {
    "type": "agent-pools",
    "relationships": {
      "allowed-workspaces": {
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

The updated agent pool is returned with `relationships.allowed-workspaces` populated:

```json
{
  "data": {
    "id": "pool-id",
    "type": "agent-pools",
    "attributes": { ... },
    "relationships": {
      "allowed-workspaces": {
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
# Create a restricted pool (not organization-scoped)
resource "tfe_agent_pool" "restricted" {
  name               = "restricted-pool"
  organization       = "my-org"
  organization_scoped = false
}

# Allow specific workspaces to use the pool
resource "tfe_agent_pool_allowed_workspaces" "restricted" {
  agent_pool_id         = tfe_agent_pool.restricted.id
  allowed_workspace_ids = [
    tfe_workspace.prod.id,
    tfe_workspace.staging.id
  ]
}
```

## StackWeaver Implementation

**Handler**: `backend/internal/api/v2/handlers/agent_pools.go` - `Update()` method
**Repository**: `backend/internal/repository/agent_pool.go` - `ReplaceAllowedWorkspaces()`
**Model**: `backend/internal/models/agent_pool.go` - `AllowedWorkspaces` many2many relation

## Testing

Tested in `stackweaver-tests/tfe-tests/agent-pools.tf`:

```hcl
resource "tfe_agent_pool_allowed_workspaces" "allowed_workspaces" {
  agent_pool_id         = tfe_agent_pool.test-agent-pool.id
  allowed_workspace_ids = [data.tfe_workspace.test-workspace.id]
}
```

## Behavior Notes

- Setting `allowed_workspace_ids` to an empty list clears all allowed workspaces
- This resource only applies when `organization_scoped = false` on the parent pool
- Workspaces not in the allowlist cannot use the pool for runs
