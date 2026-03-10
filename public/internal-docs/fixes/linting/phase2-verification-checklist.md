<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Phase 2 Verification Checklist

After fixing exhaustive switches, please verify the following functionality:

## 1. Terraform Run Status Handling

### Status Check Service (`cmd/orchestrator/status_check.go`)
- **What changed**: Removed cases for `Applying`, `Applied`, `Running`, `Completed` statuses (these shouldn't occur for plan-only PR runs)
- **Rationale**: PR status checks are only for plan-only (speculative) runs, so apply-related statuses are invalid and should fall through to default (no update)
- **Verification needed**: 
  - ✅ Verify VCS status checks (GitHub/GitLab) show correct status for plan-only run states (pending, planning, planned, failed, cancelled)
  - ✅ Verify that if apply-related statuses somehow occur, they don't update the status check (silent skip)

### Runner Service (`cmd/runner/main.go`)
- **What changed**: 
  - Line 601: Added missing status cases in run execution logic
  - Line 741: Added `Destroy` operation case
  - Line 789: Added `Destroy` operation case  
  - Line 1034: Added missing status cases for terminal state detection
- **Verification needed**:
  - ✅ Test plan-only runs work correctly
  - ✅ Test plan-and-apply runs transition through all states correctly
  - ✅ Test destroy runs execute correctly
  - ✅ Verify runs complete properly and set `CompletedAt` timestamp correctly
  - ✅ Test that terminal states are detected correctly

## 2. API Handlers (`internal/api/v2/handlers/terraform/runs.go`)

### Plan Status (`runs.go:893`)
- **What changed**: Added cases for `Pending`, `Planning`, `Planned`, `Applying`, `Applied`
- **Verification needed**:
  - ✅ Test GET `/api/v2/runs/{id}/plan` endpoint returns correct status for all run states
  - ✅ Verify plan status timestamps are set correctly

### Apply Status (`runs.go:1106`)
- **What changed**: Added cases for `Pending`, `Planning`, `Planned`, `Running`, `Completed`
- **Verification needed**:
  - ✅ Test GET `/api/v2/runs/{id}/apply` endpoint returns correct status for all run states
  - ✅ Verify apply status timestamps are set correctly

### Log Phase Detection (`runs.go:1352`)
- **What changed**: Added cases for `Pending`, `Failed`, `Cancelled`, `Running`, `Completed`
- **Verification needed**:
  - ✅ Test GET `/api/v2/runs/{id}/logs` endpoint returns correct phase for all statuses
  - ✅ Verify logs are accessible for runs in all states

### Auto-Cancel Logic (`runs.go:2811`)
- **What changed**: Added `Destroy` operation case - destroy runs now cancel ALL other runs (plan-only, plan-and-apply, and other destroy runs)
- **Rationale**: Destroy operations remove infrastructure, so any other run that reads or modifies state should be cancelled to prevent conflicts
- **Verification needed**:
  - ✅ Test that destroy runs cancel plan-only runs
  - ✅ Test that destroy runs cancel plan-and-apply runs
  - ✅ Test that destroy runs cancel other destroy runs
  - ✅ Verify that cancelled runs are properly marked as cancelled

## 3. Ansible Runner (`cmd/ansible-runner/main.go`)

### VCS Provider (`ansible-runner/main.go:703`)
- **What changed**: Added `Bitbucket` case
- **Verification needed**:
  - ✅ Test cloning playbooks from Bitbucket repositories
  - ✅ Verify Bitbucket authentication works correctly
  - ✅ Test that GitHub and GitLab still work

### Credential Type (`ansible-runner/main.go:920`)
- **What changed**: Added `SCM` credential type case
- **Verification needed**:
  - ✅ Test SCM credentials are handled correctly
  - ✅ Verify SSH, Vault, AWS, Azure, GCP, VMware credentials still work
  - ✅ Test that jobs execute correctly with SCM credentials

### Job Type (`ansible-runner/main.go:1026`)
- **What changed**: Added `Run` job type case (default behavior)
- **Verification needed**:
  - ✅ Test normal playbook execution (run type) works
  - ✅ Test check mode (--check) still works
  - ✅ Test syntax check (--syntax-check) still works

## 4. Inventory Source Service (`internal/services/ansible/inventory_source.go`)

### Inventory Type (`inventory_source.go:272, 288, 695`)
- **What changed**: Added `Custom` inventory source type case
- **Verification needed**:
  - ✅ Test custom inventory sources work correctly
  - ✅ Verify AWS, Azure, GCP, VMware inventory sources still work
  - ✅ Test that custom inventory scripts/plugins are executed correctly

## 5. RBAC Service (`internal/services/rbac/service.go`)

### Permission Checks (`rbac/service.go:774, 814`)
- **What changed**: Added default case (returns false) for all missing permissions
- **Note**: These functions are deprecated but still called by other deprecated functions (`projectAccessGrantsPermission` and `workspaceAccessGrantsPermission`)
- **Status**: Functions are marked for removal in cleanup, but exhaustive switch fix is needed while they're still in use
- **Verification needed**:
  - ⚠️ **Low priority** - Functions are deprecated but still active, verify:
  - ✅ No regressions in permission checking (these functions are still called)
  - ✅ Default case correctly denies access for unhandled permissions

## Testing Strategy

1. **Start with critical paths**:
   - Terraform run creation and execution
   - Ansible job execution
   - VCS integration

2. **Test edge cases**:
   - Runs in all possible states
   - All operation types (plan-only, plan-and-apply, destroy)
   - All credential types
   - All inventory source types

3. **Verify API responses**:
   - Check that all status values are correctly mapped
   - Verify timestamps are set appropriately
   - Test error handling for invalid states