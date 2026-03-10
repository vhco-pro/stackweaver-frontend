<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Run Cancellation Implementation Plan

## Executive Summary

### ✅ What's Working Now
- **Cancellation API**: Users can cancel runs in `pending`, `running`, `planning`, and `applying` states
- **Status Updates**: Cancellation properly updates run status to `cancelled`
- **Error Handling**: Early errors now properly update run status (no more stuck runs)

### 🐛 Known Issues
1. **Phase Timeline Display Bug**: When cancelling during apply phase, UI incorrectly shows plan phase as cancelled instead of apply phase
2. **No Active Cancellation**: Cancellation only detected after operations complete (can take up to 30+ minutes)
3. **No Rollback**: Cancelled applies leave infrastructure in partial state (no automatic rollback)

### 📋 Next Steps (Priority Order)
1. **Phase 1.3** (HIGH): Fix phase timeline display for cancelled runs (frontend-only, low risk)
2. **Phase 2** (HIGH): Implement active cancellation during execution (core functionality)
3. **Phase 3** (MEDIUM): Add rollback mechanism for apply cancellations (advanced feature)
4. **Phase 4** (LOW): Enhanced UI feedback and logging (polish)

---

## Current Situation Report

### Current Implementation Status

#### ✅ What Works
1. **Cancel API Endpoint**: `POST /api/v2/runs/:id/actions/cancel` exists
2. **Status Updates**: Cancellation updates run status to `cancelled` in database
3. **Context-Based Execution**: Terraform commands use `exec.CommandContext` which should respect context cancellation
4. **Cancellation Checks**: Runner checks for cancellation status at specific points:
   - Before starting execution
   - After init completes
   - After plan completes
   - After apply completes

#### ❌ Current Issues

1. ✅ **FIXED: Cancellation Restrictions Too Strict**
   - ~~Cancel handler only allows: `RunStatusPending` or `RunStatusRunning`~~
   - **Fixed**: Now allows cancellation of `planning` and `applying` runs

2. **Phase Timeline Display Issue** (NEW - HIGH PRIORITY)
   - When run is cancelled during apply phase, UI shows plan phase as cancelled
   - **Problem**: `UnifiedPhaseTimeline` doesn't handle `canceled` status
   - **Expected**: Plan phase should show as completed, Apply phase should show as cancelled
   - **Impact**: Confusing UX - users can't tell which phase was actually cancelled

3. **No Active Cancellation During Execution**
   - Runner only checks cancellation status AFTER operations complete
   - **Problem**: If terraform plan/apply is running for 30 minutes, cancellation won't be detected until it finishes
   - **Impact**: Cancelled runs continue executing until completion

4. **No Context Cancellation Integration**
   - `exec.CommandContext` is used, but the context is never cancelled when run is cancelled
   - **Problem**: Terraform process continues running even after cancellation
   - **Impact**: Resources continue to be consumed, operations can't be stopped

5. ✅ **FIXED: Stuck Run Issue**
   - ~~Run `run-9oCkVLvvYrrsYtC5` is stuck in `planning` status~~
   - **Fixed**: Early errors now properly update run status to `failed`

6. **No Rollback Mechanism for Apply Cancellations**
   - If apply is cancelled mid-execution, partial changes remain
   - **Problem**: No mechanism to revert to previous state
   - **Impact**: Infrastructure can be left in inconsistent state

### Current Code Flow

```
1. User clicks "Cancel Run"
   ↓
2. Cancel handler checks: run.Status in [Pending, Running, Planning, Applying] ✅
   ↓
3. If allowed: Updates run.Status = Cancelled
   ↓
4. Runner checks cancellation:
   - Before execution: ✅ Works
   - After init: ✅ Works  
   - After plan: ✅ Works
   - During plan: ❌ NOT CHECKED (waits for plan to complete)
   - During apply: ❌ NOT CHECKED (waits for apply to complete)
   ↓
5. Frontend displays phases:
   - Plan phase: ❌ Doesn't handle canceled status properly
   - Apply phase: ❌ Doesn't handle canceled status properly
```

## Implementation Plan

### Phase 1: Fix Immediate Issues (Priority: HIGH)

#### 1.1 Allow Cancellation of Planning/Applying Runs
**File**: `backend/internal/api/v2/handlers/terraform/runs.go`

**Change**: Update Cancel handler to allow cancellation of:
- `RunStatusPending`
- `RunStatusRunning` 
- `RunStatusPlanning` ✨ NEW
- `RunStatusApplying` ✨ NEW

**Implementation**:
```go
// Allow cancellation of pending, running, planning, and applying runs
cancellableStatuses := []models.RunStatus{
    models.RunStatusPending,
    models.RunStatusRunning,
    models.RunStatusPlanning,
    models.RunStatusApplying,
}
if !contains(cancellableStatuses, run.Status) {
    // Return error
}
```

#### 1.2 Fix Stuck Run Detection
**File**: `backend/cmd/runner/main.go`

**Change**: Ensure run status is updated to `failed` when errors occur early in execution

**Implementation**: Already partially implemented, but need to ensure all error paths update status

### Phase 1.3 Implementation Checklist

- [ ] Update `getPlanPhaseProps()` to handle `canceled` status
  - [ ] Check if `plannedAt` exists to determine if plan completed
  - [ ] Set status to `completed` if plan finished, `failed` if cancelled during planning
- [ ] Update `getApplyPhaseProps()` to handle `canceled` status
  - [ ] Check if `applyingAt` exists to determine if apply started
  - [ ] Set status to `failed` if apply was cancelled, `pending` if never started
- [ ] Test cancellation scenarios:
  - [ ] Cancel during planning → Plan shows cancelled, Apply shows pending
  - [ ] Cancel during applying → Plan shows completed, Apply shows cancelled
  - [ ] Cancel in planned status → Plan shows completed, Apply shows pending
- [ ] Verify status-timestamps are correctly set by backend when cancelling
  - [x] Backend already preserves `planned-at` if `PlanCompletedAt` is set (✅ Verified in `formatRunResponse`)
  - [x] Backend already preserves `applying-at` if `ApplyStartedAt` is set (✅ Verified in `formatRunResponse`)
  - [ ] **Note**: When cancelling via API, timestamps are preserved because cancellation only updates status, not timestamps

### Phase 2: Active Cancellation During Execution (Priority: HIGH)

#### 2.1 Create Cancellable Context with Database Polling
**File**: `backend/cmd/runner/main.go`

**Implementation**: Create a context that checks database for cancellation every few seconds

```go
func createCancellableContext(ctx context.Context, runRepo *repository.RunRepository, runID string) (context.Context, context.CancelFunc) {
    cancelCtx, cancel := context.WithCancel(ctx)
    
    go func() {
        ticker := time.NewTicker(2 * time.Second) // Check every 2 seconds
        defer ticker.Stop()
        
        for {
            select {
            case <-cancelCtx.Done():
                return
            case <-ticker.C:
                run, err := runRepo.GetByID(runID)
                if err == nil && run.Status == models.RunStatusCancelled {
                    cancel() // Cancel the context, which will kill terraform process
                    return
                }
            }
        }
    }()
    
    return cancelCtx, cancel
}
```

#### 2.2 Use Cancellable Context for Plan/Apply Operations
**File**: `backend/cmd/runner/main.go`

**Change**: Wrap plan and apply contexts with cancellation polling

```go
// For plan
planCtx, planCancel := context.WithTimeout(ctx, planTimeout)
defer planCancel()

// Wrap with cancellation polling
cancellablePlanCtx, cancelPolling := createCancellableContext(planCtx, runRepo, run.ID)
defer cancelPolling()

planResult, err := plugin.Plan(cancellablePlanCtx, terraformDir, variables, envVars)
```

### Phase 3: Optional Rollback Feature for Apply Cancellations (Priority: MEDIUM)

**Note**: This is a feature that TFE does NOT have - a competitive advantage! TFE does not provide automatic rollback for cancelled applies.

#### 3.1 Cancel Dialog Enhancement
**File**: `frontend/src/pages/RunDetail.tsx`

**Implementation**: When cancelling an apply operation, show a dialog with two options:

1. **Cancel Apply** (default): Stop the apply, leave partial resources (matches TFE behavior)
2. **Cancel and Rollback**: Stop the apply AND automatically rollback to previous state

**UI/UX**:
- Default to "Cancel Apply" (safer, matches TFE behavior)
- Make rollback option clearly marked as "Advanced" or "Destructive"
- Show warning message for rollback option
- Progress indicators during rollback

#### 3.2 Backend API Enhancement
**File**: `backend/internal/api/v2/handlers/terraform/runs.go`

**Implementation**: Add `rollback` parameter to Cancel endpoint:

```go
// POST /api/v2/runs/:id/actions/cancel
// Request body: { "rollback": true/false }
// - rollback: false (default): Just cancel, leave partial resources
// - rollback: true: Cancel and rollback to previous state
```

#### 3.3 State Versioning Integration
**File**: `backend/cmd/runner/main.go`

**Implementation**: 
1. Before starting apply, save current state version to state storage
2. Store state version ID in run metadata or separate table
3. When "Cancel with Rollback" is selected:
   - Load previous state version from state storage
   - Write previous state to current state
   - Run `terraform refresh` to sync state with infrastructure
   - Update run status with rollback information

#### 3.4 Rollback Implementation
**File**: `backend/internal/plugins/terraform/plugin.go`

**Implementation**:
```go
func (p *Plugin) Rollback(ctx context.Context, workspaceDir string, previousState []byte) error {
    // Write previous state to terraform.tfstate
    stateFile := filepath.Join(workspaceDir, "terraform.tfstate")
    if err := os.WriteFile(stateFile, previousState, 0644); err != nil {
        return fmt.Errorf("failed to write rollback state: %w", err)
    }
    
    // Refresh state to ensure consistency with infrastructure
    cmd := exec.CommandContext(ctx, "terraform", "refresh", "-input=false")
    cmd.Dir = workspaceDir
    return cmd.Run()
}
```

**Important Notes**:
- Rollback only restores the state file, it does NOT destroy resources
- State file and infrastructure may be out of sync after rollback
- `terraform refresh` helps sync state, but may not fully reconcile
- Users should be warned about potential state inconsistencies
- Rollback should be logged for audit trail

### Phase 4: Enhanced Cancellation Feedback (Priority: LOW)

#### 4.1 Real-time Cancellation Status
- Update UI to show "Cancelling..." status
- Provide feedback when cancellation is detected
- Show rollback progress if applicable

#### 4.2 Cancellation Logs
- Log cancellation events
- Include rollback operations in logs
- Store cancellation reason (user-initiated, timeout, etc.)

## Phase 1.3: Fix Phase Timeline Display for Cancelled Runs (Priority: HIGH)

### Issue
When a run is cancelled during the apply phase, the UI incorrectly shows the plan phase as cancelled instead of showing:
- Plan phase: Completed (it finished successfully)
- Apply phase: Cancelled (it was cancelled during execution)

**Current Behavior**:
- User cancels run during apply phase
- Run status becomes `canceled`
- UI shows plan phase as cancelled (incorrect)
- UI doesn't show apply phase as cancelled (missing)

**Expected Behavior**:
- Plan phase should show as "Plan Finished" (completed) if plan completed
- Apply phase should show as "Apply Phase" (cancelled) if apply was in progress

### Root Cause
The `UnifiedPhaseTimeline` component's `getPlanPhaseProps()` and `getApplyPhaseProps()` functions don't handle the `canceled` status. They need to check status-timestamps to determine which phase was active when cancellation occurred.

**Status-Timestamps Available** (from backend):
- `planning-at`: When plan phase started
- `planned-at`: When plan phase completed (PlanCompletedAt)
- `applying-at`: When apply phase started (ApplyStartedAt)
- `applied-at`: When apply phase completed

### Solution Logic
Use status-timestamps to determine cancellation phase:

**Cancellation Scenarios**:

1. **Cancelled during planning**:
   - No `planned-at` timestamp
   - Plan phase: `status = 'failed'` (or 'cancelled'), `title = 'Plan Phase'`
   - Apply phase: `status = 'pending'`, `title = 'Apply Phase'` (never started)

2. **Cancelled during applying**:
   - Has `planned-at` timestamp (plan completed)
   - Has `applying-at` timestamp (apply started)
   - Plan phase: `status = 'completed'`, `title = 'Plan Finished'`
   - Apply phase: `status = 'failed'` (or 'cancelled'), `title = 'Apply Phase'`

3. **Cancelled after plan, before apply** (planned status):
   - Has `planned-at` timestamp
   - No `applying-at` timestamp
   - Plan phase: `status = 'completed'`, `title = 'Plan Finished'`
   - Apply phase: `status = 'pending'`, `title = 'Apply Phase'` (never started)

### Implementation Details

**File**: `frontend/src/components/runs/UnifiedPhaseTimeline.tsx`

**Changes to `getPlanPhaseProps()`**:
```typescript
const getPlanPhaseProps = () => {
  let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
  let title = 'Plan Phase';

  // Handle cancelled status
  if (run.status === 'canceled') {
    // If plan completed (has planned-at), plan phase succeeded before cancellation
    if (plannedAt) {
      status = 'completed';
      title = 'Plan Finished';
    } else {
      // Plan was cancelled before completion
      status = 'failed'; // Shows as cancelled/failed
      title = 'Plan Phase';
    }
    return { status, title, timestamp: run.started_at };
  }

  // ... existing logic for other statuses
}
```

**Changes to `getApplyPhaseProps()`**:
```typescript
const getApplyPhaseProps = () => {
  let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
  let title = 'Apply Phase';

  // Handle cancelled status
  if (run.status === 'canceled') {
    // If apply started (has applying-at), apply phase was cancelled
    if (applyingAt) {
      status = 'failed'; // Shows as cancelled/failed
      title = 'Apply Phase';
    } else {
      // Apply never started, so it's still pending
      status = 'pending';
      title = 'Apply Phase';
    }
    return { status, title, timestamp: run.started_at };
  }

  // ... existing logic for other statuses
}
```

**Note**: Using `'failed'` status with appropriate styling (gray/cancelled appearance) is acceptable, or we can add a new `'cancelled'` status type to the phase status union if we want distinct styling.

### Testing
- Cancel run during planning → Verify plan phase shows as cancelled, apply phase shows as pending
- Cancel run during applying → Verify plan phase shows as completed, apply phase shows as cancelled
- Cancel run in planned status → Verify plan phase shows as completed, apply phase shows as pending

## Implementation Order

### ✅ Completed
1. **Phase 1.1**: ✅ Allow cancellation of planning/applying runs (DONE)
2. **Phase 1.2**: ✅ Fix stuck run detection (DONE)

### 🔄 Next Steps
3. **Phase 1.3**: Fix phase timeline display for cancelled runs (HIGH PRIORITY - User-facing bug)
   - **Impact**: Users see incorrect phase status when cancelling during apply
   - **Effort**: Low (frontend-only change)
   - **Risk**: Low (only affects UI display, doesn't change functionality)

### 📋 Future Phases
4. **Phase 2.1-2.2**: Active cancellation during execution (Core functionality)
   - **Impact**: Cancellation will be detected within 2 seconds instead of waiting for operation completion
   - **Effort**: Medium (requires context polling implementation)
   - **Risk**: Low (Go's exec.CommandContext handles process termination safely)

5. **Phase 3**: Rollback mechanism (Advanced feature)
   - **Impact**: Prevents infrastructure inconsistencies when apply is cancelled mid-execution
   - **Effort**: High (requires state management, rollback logic, testing)
   - **Risk**: Medium (could cause state inconsistencies if not implemented correctly)

6. **Phase 4**: Enhanced feedback (Polish)
   - **Impact**: Better UX with real-time cancellation status and rollback progress
   - **Effort**: Low
   - **Risk**: Low (UI-only changes)

## Testing Plan

### Unit Tests
- Test cancellation handler with different run statuses
- Test cancellation context polling
- Test rollback mechanism

### Integration Tests
- Test cancellation during long-running plan
- Test cancellation during apply
- Test rollback after partial apply
- Test cancellation of stuck runs

### Manual Testing
- Cancel run in planning phase
- Cancel run in applying phase
- Verify terraform process is killed
- Verify rollback works correctly

## Risk Assessment

### Low Risk
- Phase 1: Status check changes (low risk of breaking existing functionality)
- Phase 2: Context cancellation (Go's exec.CommandContext handles this safely)

### Medium Risk
- Phase 3: Rollback mechanism (could potentially cause state inconsistencies if not implemented correctly)

### Mitigation
- Thorough testing of rollback mechanism
- Backup state before rollback
- Log all rollback operations for audit trail
- Allow manual state recovery if automatic rollback fails

## References

- **TFE Cancel API**: https://developer.hashicorp.com/terraform/enterprise/api-docs/run#cancel-a-run
- **Go Context Cancellation**: https://pkg.go.dev/context
- **Terraform State Management**: https://developer.hashicorp.com/terraform/language/state

