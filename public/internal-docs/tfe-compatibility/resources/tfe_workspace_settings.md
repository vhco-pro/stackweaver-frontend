<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_workspace_settings

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/workspace_settings

**Status**: Implemented (self-hosted runner / agent mode)

## Overview

`tfe_workspace_settings` manages execution mode and agent pool assignment for a workspace. It is the recommended way to set `execution_mode` and `agent_pool_id` (replacing the deprecated attributes on `tfe_workspace`). Required for using self-hosted runners with the TFE provider.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `workspace_id` | string (Required) | workspace ID | Implemented | Workspace to configure |
| `execution_mode` | string (Optional) | `execution_mode` | Implemented | `remote`, `local`, or `agent` |
| `agent_pool_id` | string (Optional) | `agent_pool_id` | Implemented | Required when `execution_mode` is `agent` |
| `allow_destroy_plan` | bool (Optional) | `allow_destroy_plan` | Implemented | Allow destroy plans to be queued |
| `auto_apply` | bool (Optional) | `auto_apply` | Implemented | Auto-apply after plan |
| Other (e.g. `run_timeout`) | — | Custom / partial | Partial | StackWeaver supports `run_timeout` via workspace update |

## API Compatibility

The TFE provider uses the go-tfe client, which for workspace settings:

1. **Read**: `GET /api/v2/workspaces/:id` — workspace response must include `agent-pool` as a **relationship** (not only `agent-pool-id` as attribute). StackWeaver returns both.
2. **Update**: `PATCH /api/v2/workspaces/:id` with body `data.attributes.execution-mode`, `data.attributes.agent-pool-id` (or empty string to clear).

StackWeaver implements:

- `GET /api/v2/workspaces/:id` — returns workspace with `relationships.agent-pool.data` (required for provider state).
- `PATCH /api/v2/workspaces/:id` — accepts `execution_mode`, `agent_pool_id`; supports clearing agent pool with empty string.

## StackWeaver Implementation

**Handler**: `backend/internal/api/v2/handlers/terraform/workspaces.go` — `GetByID`, `UpdateByID`  
**Route**: `v2.GET("/workspaces/:id", ...)`, `v2.PATCH("/workspaces/:id", ...)`

Workspace response formatting (`formatWorkspaceResponse`) includes:

- `attributes["execution-mode"]`, `attributes["agent-pool-id"]`
- `relationships["agent-pool"]` with `data: { id, type: "agent-pools" }` or `data: null`
- `attributes["setting-overwrites"]` with `execution-mode` and `agent-pool` booleans (for go-tfe client compatibility).

## Example

```hcl
resource "tfe_workspace" "agent_ws" {
  name         = "my-agent-workspace"
  organization = "main"
  project_id   = data.tfe_project.default.id
}

resource "tfe_workspace_settings" "agent_ws_settings" {
  workspace_id   = tfe_workspace.agent_ws.id
  execution_mode = "agent"
  agent_pool_id  = tfe_agent_pool.my_pool.id
}
```

## Testing

`stackweaver-tests/tfe-tests/agent-pools.tf` — `tfe_workspace_settings.test-settings`, `tfe_workspace_settings.selfhosted-runner-test-settings`, `tfe_workspace_settings.selfhosted-runner-cli-settings`.
