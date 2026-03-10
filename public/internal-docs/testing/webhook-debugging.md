<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Webhook Debugging Guide

## Issue: Webhook not triggering runs after commit

When a commit is pushed to a repository linked to a workspace, the webhook should automatically create a plan run. If this is not happening, check the following:

## 1. Check Workspace Configuration

The workspace must have **`auto_queue_runs` enabled**:

```sql
-- Check workspace configuration
SELECT name, vcs_repository, vcs_branch, auto_queue_runs 
FROM workspaces 
WHERE vcs_repository = 'your-repo/name' AND vcs_branch = 'your-branch';
```

**Required:**
- `vcs_repository` must match exactly (e.g., `owner/repo-name`)
- `vcs_branch` must match exactly (e.g., `main`, `master`)
- `auto_queue_runs` must be `true` (or `1` in SQL)

**Path-Based Filtering (GitOps-style):**
- If `working_directory` is set (e.g., `proxmox/api`), the workspace will only trigger when files in that path are changed
- If `working_directory` is empty or `/`, the workspace will trigger for any change (root-level workspace)
- This prevents unnecessary runs when multiple workspaces share the same repository but monitor different paths
- Check backend logs for messages like: `Webhook: Workspace X (path: "Y") skipped - no files in its path were changed`

## 2. Check Webhook Endpoint

The webhook endpoint is: `POST /api/v2/vcs-connections/github/webhook`

**Check if webhook is configured in GitHub:**
- GitHub App Settings → Webhooks
- Should be pointing to: `https://your-domain.com/api/v2/vcs-connections/github/webhook`
- "Push" events must be enabled

## 3. Check Backend Logs

The webhook handler logs all events using `fmt.Printf()`. Look for:

```
Webhook: Received branch push event - ref=refs/heads/main, branch=main, repository=owner/repo, commit=abc123
Webhook: Found X workspace(s) for repository owner/repo, branch main
```

**Common log messages:**
- `Webhook: No workspaces found for repository X, branch Y with AutoQueueRuns enabled` → Workspace doesn't have `auto_queue_runs` enabled
- `Webhook: Workspace X (path: "Y") skipped - no files in its path were changed` → Path-based filtering: changed files don't match workspace's `working_directory`
- `Webhook: Workspace X (path: "Y") will be triggered - files in its path were changed` → Workspace will be triggered (path matches)
- `Webhook: Filtered to N workspace(s) that match changed files (from M total)` → Path-based filtering applied
- `Webhook: Error finding workspaces` → Database error
- No webhook logs at all → Webhook not reaching the endpoint (check GitHub App configuration)

## 4. Debugging Steps

### Step 1: Verify Workspace Configuration
```sql
-- Enable auto_queue_runs for a workspace
UPDATE workspaces 
SET auto_queue_runs = true 
WHERE id = 'workspace-uuid';
```

### Step 2: Check VCS Connection
```sql
-- Verify VCS connection is properly linked
SELECT w.name, w.vcs_repository, w.vcs_branch, vc.installation_id, vc.provider
FROM workspaces w
LEFT JOIN vcs_connections vc ON w.vcs_connection_id = vc.id
WHERE w.vcs_repository = 'your-repo/name';
```

### Step 3: Manually Trigger Webhook
Use curl to manually trigger the webhook:

```bash
curl -X POST http://localhost:8022/api/v2/vcs-connections/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{
    "ref": "refs/heads/main",
    "after": "commit-sha",
    "repository": {
      "full_name": "owner/repo"
    },
    "commits": [{
      "id": "commit-sha",
      "message": "Test commit",
      "author": {
        "name": "Test User",
        "email": "test@example.com"
      }
    }]
  }'
```

Check backend logs for output.

### Step 4: Check GitHub App Installation
The workspace must be linked to a VCS connection that has a valid GitHub App installation:

```sql
-- Check VCS connection installation
SELECT id, provider, installation_id, organization_id
FROM vcs_connections
WHERE organization_id = 'your-org-uuid';
```

## 5. Common Issues and Fixes

### Issue: Workspace not found
**Symptom:** Log shows "No workspaces found for repository X, branch Y"

**Fix:**
1. Verify `vcs_repository` matches exactly (case-sensitive, includes owner)
2. Verify `vcs_branch` matches exactly
3. Enable `auto_queue_runs`:
   ```sql
   UPDATE workspaces SET auto_queue_runs = true WHERE id = 'workspace-id';
   ```

### Issue: Workspace skipped due to path filtering
**Symptom:** Log shows "Workspace X (path: 'Y') skipped - no files in its path were changed"

**Explanation:** This is expected behavior when path-based filtering is enabled. The workspace has a `working_directory` configured, but the changed files in the commit don't match that path.

**Fix:**
1. If you want the workspace to trigger for all changes, set `working_directory` to empty or `/`:
   ```sql
   UPDATE workspaces SET working_directory = '' WHERE id = 'workspace-id';
   ```
2. If the path is correct, verify that the files you changed are actually within that path
3. Check the commit to see which files were changed (added, modified, or removed)

### Issue: Webhook not reaching endpoint
**Symptom:** No webhook logs at all

**Fix:**
1. Check GitHub App webhook URL is correct
2. Check if webhook is enabled in GitHub App settings
3. Verify "Push" events are enabled
4. Check firewall/network access

### Issue: VCS Connection missing
**Symptom:** Webhook logs show error getting VCS connection

**Fix:**
1. Ensure workspace has `vcs_connection_id` set
2. Ensure VCS connection exists and has valid `installation_id`
3. Re-create VCS connection if needed

## 6. Code Reference

The webhook handler is in: `backend/internal/api/v2/handlers/vcs_app_installation.go`

Key function: `handleBranchPushEvent()` which:
1. Parses the push event
2. Finds workspaces with `FindByVCSRepositoryAndBranch(repository, branch)`
3. Creates a configuration version
4. Creates a plan run

The workspace repository query requires:
- `vcs_repository = ?` (exact match)
- `vcs_branch = ?` (exact match)
- `auto_queue_runs = true`

## 7. Testing Checklist

- [ ] Workspace `vcs_repository` matches GitHub repo (e.g., `owner/repo`)
- [ ] Workspace `vcs_branch` matches pushed branch (e.g., `main`)
- [ ] Workspace has valid `vcs_connection_id`
- [ ] VCS connection has valid `installation_id`
- [ ] GitHub App webhook is configured and enabled
- [ ] "Push" events are enabled in GitHub App settings
- [ ] Webhook URL is correct and accessible
- [ ] Backend logs show webhook events
- [ ] Backend logs show workspace found

## 8. Next Steps if Still Not Working

1. **Enable detailed logging**: Add more `fmt.Printf()` statements in webhook handler
2. **Check database**: Verify workspace record in database directly
3. **Test manually**: Create run manually via API to verify workspace is functional
4. **Check GitHub App**: Verify installation is active and webhooks are configured

