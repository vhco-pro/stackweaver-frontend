<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# VCS Path-Based Filtering (GitOps-style)

## Overview

When a repository is configured multiple times as a workspace with different path configurations, the VCS webhook system now intelligently filters which workspaces should be triggered based on which files actually changed in the push event.

This implements a GitOps-style flow where workspaces only trigger when files in their configured path are modified, preventing unnecessary runs when multiple workspaces share the same repository but monitor different paths.

## How It Works

### Path Matching Logic

1. **Root-level workspaces** (`working_directory` is empty or `/`):
   - Trigger for **any** file change in the repository
   - Use this when the workspace monitors the entire repository

2. **Subfolder workspaces** (`working_directory` is a path like `proxmox/api`):
   - Only trigger when files **within that subfolder** are changed
   - Matches files that start with the configured path
   - Example: If `working_directory` is `proxmox/api`, it will trigger for:
     - `proxmox/api/main.tf`
     - `proxmox/api/variables.tf`
     - `proxmox/api/modules/...`
   - But will **not** trigger for:
     - `proxmox/passwd/main.tf` (different subfolder)
     - `ansible/playbook.yml` (different path entirely)

### Implementation

**Handler**: `handleBranchPushEvent()` in `backend/internal/api/v2/handlers/vcs_app_installation.go`

**Filtering Function**: `isWorkspaceAffected()` - `backend/internal/api/v2/handlers/vcs_app_installation.go:886-930`

The filtering process:
1. Collects all changed files from all commits in the push event (added, modified, removed)
2. For each workspace matching the repository and branch:
   - Checks if any changed files match the workspace's `working_directory` path
   - If `working_directory` is empty/root, matches all changes
   - If `working_directory` is a subfolder, only matches files within that path
3. Only triggers runs for workspaces where files in their path were changed

## Example Scenarios

### Scenario 1: Multiple Workspaces, Same Repository

Repository structure:
```
my-repo/
├── frontend/
│   └── main.tf
├── backend/
│   └── main.tf
└── shared/
    └── module.tf
```

Workspace configurations:
- **Workspace A**: `working_directory` = `frontend/` → Monitors frontend changes
- **Workspace B**: `working_directory` = `backend/` → Monitors backend changes
- **Workspace C**: `working_directory` = `` (empty) → Monitors all changes

Push event changes:
- `frontend/main.tf` (modified)
- `shared/module.tf` (added)

Result:
- ✅ **Workspace A** triggers (file in `frontend/` changed)
- ❌ **Workspace B** skipped (no files in `backend/` changed)
- ✅ **Workspace C** triggers (root-level, matches all changes)

### Scenario 2: Nested Paths

Repository structure:
```
terraform-repo/
└── environments/
    ├── dev/
    │   └── main.tf
    └── prod/
        └── main.tf
```

Workspace configurations:
- **Dev Workspace**: `working_directory` = `environments/dev/`
- **Prod Workspace**: `working_directory` = `environments/prod/`

Push event changes:
- `environments/dev/main.tf` (modified)

Result:
- ✅ **Dev Workspace** triggers
- ❌ **Prod Workspace** skipped

## Logging

The webhook handler logs path-based filtering decisions:

```
Webhook: Found 3 workspace(s) for repository owner/repo, branch main
Webhook: Workspace ws-abc123 (path: "frontend/") will be triggered - files in its path were changed
Webhook: Workspace ws-def456 (path: "backend/") skipped - no files in its path were changed
Webhook: Workspace ws-ghi789 (path: "") will be triggered - files in its path were changed
Webhook: Filtered to 2 workspace(s) that match changed files (from 3 total)
```

## Configuration

### Setting Working Directory

The `working_directory` field can be set when creating or updating a workspace:

**Via API:**
```json
{
  "working_directory": "proxmox/api"
}
```

**Via SQL:**
```sql
UPDATE workspaces 
SET working_directory = 'proxmox/api' 
WHERE id = 'workspace-id';
```

### Path Format

- **Root-level**: Empty string `""` or `/`
- **Subfolder**: Path relative to repository root, e.g., `proxmox/api` or `/proxmox/api`
- Leading and trailing slashes are normalized automatically

## Benefits

1. **Efficiency**: Prevents unnecessary runs when only unrelated paths change
2. **GitOps Compliance**: Follows GitOps best practices where changes trigger only relevant deployments
3. **Cost Savings**: Reduces compute usage by avoiding redundant runs
4. **Clear Separation**: Allows multiple environments/workspaces in the same repository without cross-triggering

## Related Documentation

- **Implementation**: See `backend/internal/api/v2/handlers/vcs_app_installation.go`
- **Webhook Debugging**: See `docs/testing/webhook-debugging.md`
- **Workspace Design**: See `docs/architecture/TFE_WORKSPACE_DESIGN.md`


