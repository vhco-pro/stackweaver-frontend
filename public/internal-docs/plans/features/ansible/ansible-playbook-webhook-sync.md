<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Playbook Webhook Auto-Sync Implementation Plan

## Issue

When making a commit to a GitHub repository, Ansible playbooks connected via VCS are not automatically synced. Currently, the webhook handler at `/api/v2/vcs-connections/github/webhook` handles workspace runs and inventory syncs on push events, but does not trigger playbook syncs.

**Note**: Manual sync functionality (via `POST /api/v2/ansible/playbooks/:id/actions/sync`) will remain fully functional and is not affected by this implementation. This change adds automatic sync capabilities while preserving user-initiated sync.

## Root Cause Analysis

1. **Old webhook handler** (`backend/internal/api/handlers/github_webhook.go`) at `/api/v2/webhooks/github`:
   - Has playbook sync logic implemented
   - But `syncQueuer` is set to `nil` in route setup (line 55 in `backend/internal/api/routes/routes.go`)
   - Therefore, playbook syncs are never queued even if the handler finds affected playbooks

2. **Current v2 webhook handler** (`backend/internal/api/v2/handlers/vcs_app_installation.go`) at `/api/v2/vcs-connections/github/webhook`:
   - This is the active webhook handler used for GitHub App installations
   - Handles workspace runs on branch pushes (lines 178-892)
   - Handles inventory syncs on branch pushes (lines 894-934)
   - **Missing**: Playbook sync logic

3. **Current practice**: The codebase uses the v2 handler (`VCSAppInstallationHandlerV2`) for all GitHub App webhooks, following the pattern established for workspaces and inventories.

## Solution

Add playbook sync logic to the `handleBranchPushEvent` method in `VCSAppInstallationHandlerV2`, following the same pattern used for inventory syncs.

This implementation **adds** automatic sync capability without affecting existing manual sync functionality. Users will be able to:
- ✅ **Manually trigger sync** via UI/API (existing functionality - unchanged)
- ✅ **Automatically sync on push events** (new functionality - this implementation)

## Implementation Steps

### 1. Add Playbook Repository to Handler

**File**: `backend/internal/api/v2/handlers/vcs_app_installation.go`

- Add `playbookRepo *repository.AnsiblePlaybookRepository` field to `VCSAppInstallationHandlerV2` struct (around line 38)
- Update `NewVCSAppInstallationHandlerV2` constructor to accept and store `playbookRepo`

### 2. Add Playbook Sync Logic to Webhook Handler

**File**: `backend/internal/api/v2/handlers/vcs_app_installation.go`

- In `handleBranchPushEvent` method (after inventory sync logic, around line 934):
  - Query for playbooks matching the repository and branch using `playbookRepo.ListByVCSRepositoryAndBranch()`
  - For each matching playbook, check if it's affected using `isPlaybookAffected()` helper
  - If affected, queue a sync using the existing `ansibleQueue`
  - Use the same message format: `{"playbook_id": "<uuid>"}` (same format as inventory syncs)

### 3. Add Helper Method

**File**: `backend/internal/api/v2/handlers/vcs_app_installation.go`

- Add `isPlaybookAffected()` method (similar to `isInventoryAffected` at line 1017)
- Logic should check if `PlaybookPath` or files in the playbook directory were modified
- Can reuse logic from old handler's `isPlaybookAffected` method in `github_webhook.go` (lines 314-342)

### 4. Update Route Setup

**File**: `backend/internal/api/v2/routes/routes.go`

- In webhook route setup (around line 603), create `AnsiblePlaybookRepository` instance
- Pass it to `NewVCSAppInstallationHandlerV2` constructor
- Repeat for installation handler setup (around line 670)

### 5. Reference Implementation

The inventory sync implementation (lines 894-934 in `vcs_app_installation.go`) serves as the perfect template:

```go
// Also sync VCS inventories that match this repository and branch
inventories, err := h.inventoryRepo.FindByVCSRepositoryAndBranch(repositoryFullName, branchName)
if err != nil {
    // error handling
} else if len(inventories) > 0 {
    // Check if affected and queue sync
}
```

## Technical Details

### Queue Message Format

Playbook sync messages use the same format as inventory syncs:
```json
{
  "playbook_id": "<uuid>"
}
```

The `ansible-runner` already handles this format - see `backend/cmd/ansible-runner/main.go` lines 273-304.

### Path Matching Logic

Playbooks use `PlaybookPath` field (e.g., `site.yml`, `playbooks/deploy.yml`). The sync should trigger if:
- The playbook file itself is changed (added/modified/removed)
- Any file in the playbook's directory is changed
- If `PlaybookPath` is empty, any change to the repo triggers sync

This matches the behavior in the old handler's `isPlaybookAffected` method.

### Testing Considerations

1. **Manual webhook test**: Send a push event to the webhook endpoint and verify playbooks are queued
2. **Integration test**: Create a playbook with VCS connection, make a commit, verify sync is triggered
3. **Path filtering**: Test that only affected playbooks sync when specific paths change
4. **Manual sync verification**: Ensure `POST /api/v2/ansible/playbooks/:id/actions/sync` endpoint still works correctly (should be unaffected)

## Files to Modify

1. `backend/internal/api/v2/handlers/vcs_app_installation.go`
   - Add `playbookRepo` field
   - Update constructor
   - Add playbook sync logic in `handleBranchPushEvent`
   - Add `isPlaybookAffected` helper method

2. `backend/internal/api/v2/routes/routes.go`
   - Create `AnsiblePlaybookRepository` instances
   - Pass to handler constructors (2 locations: webhook and installation handlers)

## Conformity with Current Practices

✅ Uses existing v2 webhook handler (not the deprecated old handler)  
✅ Follows same pattern as inventory syncs  
✅ Uses existing `ansibleQueue` (no new queue needed)  
✅ Uses existing `ListByVCSRepositoryAndBranch` repository method  
✅ Consistent error handling and logging patterns  
✅ Async processing with goroutines (same as inventories)  

## Related Code References

- **Inventory sync implementation**: `backend/internal/api/v2/handlers/vcs_app_installation.go:894-934`
- **Repository method**: `backend/internal/repository/ansible_playbook.go:107-114` (`ListByVCSRepositoryAndBranch`)
- **Old handler (reference)**: `backend/internal/api/handlers/github_webhook.go:314-342` (`isPlaybookAffected` logic)
- **Queue format**: `backend/internal/api/v2/handlers/ansible/playbooks.go:19-21` (`PlaybookSyncMessage`)
- **Runner handler**: `backend/cmd/ansible-runner/main.go:273-304` (processes playbook sync messages)
- **Manual sync endpoint**: `backend/internal/api/v2/handlers/ansible/playbooks.go:662-731` (`SyncPlaybook` handler - unchanged by this implementation)
- **Manual sync route**: `backend/internal/api/v2/routes/ansible_routes.go:230` (`POST /api/v2/ansible/playbooks/:id/actions/sync`)

