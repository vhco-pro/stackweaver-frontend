<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_agent_pool

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_pool

**Status**: Implemented

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `name` | string | `name` | Implemented | Pool name |
| `organization` | string | via org lookup | Implemented | |
| `organization_scoped` | bool | `organization_scoped` | Implemented | Default: true |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `id` (UUID) | Implemented | |
| `agent_count` | int | computed | Implemented | Count of registered agents |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/organizations/:org/agent-pools` | GET | Implemented | List pools |
| `/api/v2/organizations/:org/agent-pools` | POST | Implemented | Create pool |
| `/api/v2/agent-pools/:id` | GET | Implemented | Get by ID |
| `/api/v2/agent-pools/:id` | PATCH | Implemented | Update pool |
| `/api/v2/agent-pools/:id` | DELETE | Implemented | Delete pool |
| `/api/v2/agent-pools/:id/agents` | GET | Implemented | List agents (empty until runners impl) |

## Related Resources

### tfe_agent_pool_allowed_workspaces

Manages which workspaces can use the pool when `organization_scoped = false`.

| Attribute | Status | Notes |
|-----------|--------|-------|
| `agent_pool_id` | Implemented & Tested | |
| `allowed_workspace_ids` | Implemented & Tested | List of workspace IDs |

**API Endpoint**: `PATCH /api/v2/agent-pools/:id` with `allowed-workspaces` relationship

### tfe_agent_pool_allowed_projects

Manages which projects can use the pool.

| Attribute | Status | Notes |
|-----------|--------|-------|
| `agent_pool_id` | Implemented & Tested | |
| `allowed_project_ids` | Implemented & Tested | List of project IDs |

**API Endpoint**: `PATCH /api/v2/agent-pools/:id` with `allowed-projects` relationship

### tfe_agent_pool_excluded_workspaces

Excludes specific workspaces when `organization_scoped = true`.

| Attribute | Status | Notes |
|-----------|--------|-------|
| `agent_pool_id` | Implemented & Tested | |
| `excluded_workspace_ids` | Implemented & Tested | List of workspace IDs |

**API Endpoint**: `PATCH /api/v2/agent-pools/:id` with `excluded-workspaces` relationship

## Example TFE Usage

```hcl
# Create an organization-scoped pool
resource "tfe_agent_pool" "prod" {
  name               = "prod-pool"
  organization       = "my-org"
  organization_scoped = true
}

# Exclude a workspace from the pool
resource "tfe_agent_pool_excluded_workspaces" "prod" {
  agent_pool_id         = tfe_agent_pool.prod.id
  excluded_workspace_ids = [tfe_workspace.dev.id]
}

# Or create a restricted pool
resource "tfe_agent_pool" "restricted" {
  name               = "restricted-pool"
  organization       = "my-org"
  organization_scoped = false
}

# Allow specific workspaces
resource "tfe_agent_pool_allowed_workspaces" "restricted" {
  agent_pool_id         = tfe_agent_pool.restricted.id
  allowed_workspace_ids = [tfe_workspace.prod.id]
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/agent_pool.go`
**Handler**: `backend/internal/api/v2/handlers/agent_pools.go`
**Repository**: `backend/internal/repository/agent_pool.go`

**Frontend**: `frontend/src/pages/Settings/AgentPools.tsx`

## Testing

Test file: `stackweaver-tests/tfe-tests/agent-pools.tf`

All resources tested and working with terraform-provider-tfe:

```hcl
# Create an agent pool
resource "tfe_agent_pool" "test-agent-pool" {
  name               = "test-pool"
  organization       = tfe_organization.test-organization.name
  organization_scoped = false
}

# Allow specific projects to use the pool
resource "tfe_agent_pool_allowed_projects" "allowed_projects" {
  agent_pool_id       = tfe_agent_pool.test-agent-pool.id
  allowed_project_ids = [data.tfe_project.default-project.id]
}

# Allow specific workspaces to use the pool
resource "tfe_agent_pool_allowed_workspaces" "allowed_workspaces" {
  agent_pool_id         = tfe_agent_pool.test-agent-pool.id
  allowed_workspace_ids = [data.tfe_workspace.test-workspace.id]
}

# Exclude specific workspaces from the pool
resource "tfe_agent_pool_excluded_workspaces" "excluded" {
  agent_pool_id          = tfe_agent_pool.test-agent-pool.id
  excluded_workspace_ids = [data.tfe_workspace.mikeshop-api.id]
}
```

## Implementation Complete

The following TFE provider resources are fully implemented and tested:
- `tfe_agent_pool` - Create, read, update, delete agent pools
- `tfe_agent_pool_allowed_projects` - Scope pools to specific projects
- `tfe_agent_pool_allowed_workspaces` - Scope pools to specific workspaces
- `tfe_agent_pool_excluded_workspaces` - Exclude specific workspaces from pools

## Pending Work

1. **Agent Tokens**: `tfe_agent_token` resource not yet implemented
2. **Runner Registration**: Runners need to register with pool ID
3. **Job Routing**: Workspaces with `execution_mode = "agent"` need to route to pool
4. **Access Enforcement**: Verify runners only have access to allowed projects/workspaces at runtime (see GitHub issue)
