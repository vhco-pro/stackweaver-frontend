<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# State Persistence Analysis & Implementation Plan

## Executive Summary

This document analyzes critical state persistence issues in the run detail view and provides a **TFE-compliant hybrid approach** implementation plan that:
- ✅ **Preserves** current streaming behavior during active runs (works perfectly)
- ✅ **Stores** parsed state when phases complete (for reload persistence) - **NOT full logs** (logs stay in MinIO)
- ✅ **Uses** stored state on reload (no re-parsing needed)
- ✅ **TFE-Compliant**: Implements `/api/v2/applies/:id` endpoint (✅ COMPLETED)
- ✅ Makes the system **production-ready** with proper state management

**Implementation Status**:
- ✅ **Phase 1**: Backend State Storage - **COMPLETED**
- ✅ **Phase 2**: Frontend State Management - **COMPLETED**
- ✅ **Phase 2.5**: Log Fetching Refactor - **COMPLETED**
- ✅ **Phase 3**: Fix Resource Detail Display - **COMPLETED**
- ✅ **Phase 4**: Fix Cancellation State - **COMPLETED**
- ✅ **Phase 5**: Fix Plan-Only Logs Display - **COMPLETED**

**🎉 All Phases Complete!** The state persistence system is now production-ready.

**Key Insights**:
1. **Current streaming approach works great** - only need to store state when phases complete
2. **Only store parsed state** (resource statuses, IDs, metadata) - NOT full logs (MinIO handles logs)
3. ✅ **TFE Compliance**: `/api/v2/applies/:id` endpoint implemented
4. **TFE-Compliant Design**: Use separate Plans and Applies endpoints (per [TFE API docs](https://developer.hashicorp.com/terraform/enterprise/api-docs/applies))
   - Plans endpoint: `/api/v2/plans/:id` - returns plan information
   - Applies endpoint: `/api/v2/applies/:id` - returns apply information (✅ IMPLEMENTED)
5. **Apply ID = Run ID** (same pattern as Plan ID = Run ID for plan-and-apply runs)

**TFE API Research Findings**:
- TFE has `/api/v2/plans/:id` endpoint that returns plan info, resource counts, and `plan-json`
- TFE has `/api/v2/applies/:id` endpoint (structure unclear from public docs)
- **Our Approach**: Extend Plans endpoint to include `apply-resources` and `apply-summary` when apply completes
- This is TFE-compliant since apply is part of the same run as plan

## Issues Identified

### 1. Resource Detail Cards on Failed Apply Runs

**Problem**: When an apply run fails, successfully completed resources don't show their creation time and ID, making it impossible for users to copy IDs or see when resources were created.

**Root Cause**: 
- Resource parsing extracts IDs and details from log patterns like `resource.id = "..."` and `resource.created = "..."`
- When apply fails, the parsing might stop early or the resources array isn't properly populated with completed resources
- The `resources` array is built incrementally from logs, but failed applies might not have complete log entries for all resources

**Impact**: High - Users cannot identify successfully created resources after a partial failure

### 2. State Persistence Across Page Reloads

**Problem**: Multiple state persistence issues:
- Resource statuses (failed/completed/applying) are lost on reload - red styling disappears
- Phase card styling not preserved
- Raw output viewer state (terminal/JSON view) lost on plan phase
- Plan-only runs don't show terminal/JSON view at all

**Root Cause**:
- **Resource Statuses**: Stored in component `useState` which is lost on reload. Statuses are derived from incremental log parsing, but on reload:
  - Full logs are available immediately
  - Incremental parsing logic (`lastParsedLengthRef`) resets
  - Status derivation from logs happens in `useEffect` hooks that may not run correctly on initial load
  - Error parsing and status setting happens in separate effects that may not execute in correct order
  
- **UI State**: `rawOutputView`, `jsonExpanded` are component state, lost on reload

- **Plan Logs**: Plan logs are fetched via `useRunPolling` hook, but:
  - The hook only fetches plan logs when `planOutput` exists and `planLogs` is null
  - For plan-only runs, the condition might not be met correctly
  - The phase parameter (`phase=plan`) was added but might not be working for plan-only runs

**Impact**: Critical - Core functionality broken on reload

### 3. Cancellation State Issues

**Problem**: When a plan-and-apply run is cancelled:
- Apply card shows "Loading apply output..." indefinitely
- Plan card becomes blank and cannot be collapsed
- State is not properly maintained

**Root Cause**:
- Cancellation handling checks for `isCancelled` prop and `canceled` status
- Phase visibility logic might be hiding content incorrectly
- The `UnifiedPhaseTimeline` component might not be handling cancelled state properly
- Content rendering logic in `RunDetail.tsx` might have conditions that exclude cancelled runs

**Impact**: High - Broken UX for cancelled runs

## Architectural Analysis

### Current Architecture

1. **State Management**: 
   - Component-level `useState` for all derived state
   - Incremental parsing from logs to build resource statuses
   - No persistence layer

2. **Data Flow**:
   ```
   During Active Run:
   Terraform → Redis (streaming) → Frontend (incremental parsing) → Component State
                                      ↓
                                  MinIO (persistence)
   
   On Reload:
   MinIO → Frontend → Parse full logs → Component State (but parsing breaks!)
   ```

3. **Problems with Current Approach**:
   - **Ephemeral State**: All derived state is lost on reload
   - **Incremental Parsing**: Works for streaming but breaks on reload when full logs available
   - **No Source of Truth**: Status derived from logs, but logs might be incomplete or parsing might fail
   - **Race Conditions**: Multiple `useEffect` hooks updating state independently
   - **Streaming vs Reload Mismatch**: Logic optimized for streaming doesn't work when full logs available

### Proposed Architecture (Hybrid Approach - Best of Both Worlds)

**Key Insight**: Current streaming approach works perfectly during active runs. The problem is only on reload when we need to reconstruct state from complete logs.

**Solution**: Store parsed state when phases complete, but keep streaming during active runs.

1. **During Active Runs (Keep Current Approach)**:
   - Stream logs to Redis → Frontend
   - Frontend parses incrementally (works great!)
   - Update component state in real-time
   - **No changes needed** - this works perfectly

2. **When Phase Completes (New - Store State)**:
   - Parse logs server-side to extract:
     - Resource statuses (completed/failed/applying)
     - Resource IDs and metadata
     - Creation timestamps
     - Error messages
   - Store structured state in database (not full logs, just parsed state)
   - Store in `run_phase_states` table

3. **On Reload (Use Stored State)**:
   - Check if phase is complete (has `planned-at` or `applied-at` timestamp)
   - If complete: Fetch stored state from backend
   - If active: Use streaming approach (current behavior)
   - Merge stored state with any new streaming updates

4. **Data Flow (Proposed)**:
   ```
   During Active Run (unchanged):
   Terraform → Redis → Frontend (incremental parsing) → Component State ✅
   
   When Phase Completes (new):
   Terraform → Redis → MinIO (logs)
                    → Backend Parser → Database (structured state) ✅
   
   On Reload (new):
   Backend (stored state) → Frontend → Component State ✅
   MinIO (logs) → Frontend (for terminal view) ✅
   ```

## Implementation Plan

### ✅ Phase 1: Backend State Storage (COMPLETED)

**Status**: ✅ **COMPLETED** - All tasks implemented in commit `568016d`

**What Was Implemented**:

**Goal**: Store parsed resource states when phases complete (not during active runs)

**Key Principle**: Only store state when phase is complete. During active runs, keep current streaming approach.

**Tasks**:
1. Create database schema for phase states:
   ```sql
   CREATE TABLE run_phase_states (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
     phase TEXT NOT NULL, -- 'plan' or 'apply'
     resources JSONB NOT NULL, -- Array of resource states
     summary JSONB, -- Summary counts (add, change, destroy, failed)
     parsed_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(run_id, phase)
   );
   
   CREATE INDEX idx_run_phase_states_run_id ON run_phase_states(run_id);
   ```

2. Create log parser service (server-side):
   - Parse logs to extract resource states (same logic as frontend)
   - Extract resource IDs, statuses, timestamps, error messages
   - Return structured data

3. Store state when phase completes:
   - In `runner/main.go`, after plan completes: parse plan logs, store state
   - In `runner/main.go`, after apply completes: parse apply logs, store state
   - Only parse if phase is complete (not during streaming)

4. **TFE-Compliant API Design** - Implement Applies Endpoint:
   
   **CRITICAL**: TFE has a separate `/api/v2/applies/:id` endpoint (per [TFE API docs](https://developer.hashicorp.com/terraform/enterprise/api-docs/applies))
   - We must implement this endpoint for TFE compatibility
   - Apply ID = Run ID (for plan-and-apply runs, same as plan ID = run ID)
   - Add `apply` relationship to run response when apply phase exists
   
   **Implementation Tasks**:
   a. Add `apply` relationship to run response:
      - In `formatRunResponse()`, add `relationships.apply` when apply phase exists
      - Apply ID = Run ID (for plan-and-apply runs)
   
   b. Implement `GET /api/v2/applies/:id` endpoint:
      - Handler: `GetApply()` in `RunHandlerV2`
      - Returns TFE-compatible applies response
      - Include parsed `apply-resources` from stored phase state
   
   **TFE Applies Endpoint Response Structure** (per [TFE docs](https://developer.hashicorp.com/terraform/enterprise/api-docs/applies)):
   ```json
   {
     "data": {
       "id": "apply-47MBvjwzBG8YKc2v",  // Apply ID = Run ID
       "type": "applies",
       "attributes": {
         "execution-details": {
           "mode": "remote"
         },
         "status": "finished",  // pending, running, finished, errored, canceled, unreachable
         "status-timestamps": {
           "queued-at": "2018-10-17T18:58:27+00:00",
           "started-at": "2018-10-17T18:58:29+00:00",
           "finished-at": "2018-10-17T18:58:37+00:00"
         },
         "log-read-url": "https://...",
         "resource-additions": 1,
         "resource-changes": 0,
         "resource-destructions": 0,
         "resource-imports": 0,
         "apply-resources": [           // NEW - parsed resource states
           {
             "address": "proxmox_vm.example",
             "status": "completed",
             "resource_id": "vm-123",
             "created_at": "2024-01-01T12:00:00Z",
             "error_message": null
           }
         ]
       },
       "relationships": {
         "state-versions": {
           "data": [...]
         }
       },
       "links": {
         "self": "/api/v2/applies/apply-47MBvjwzBG8YKc2v"
       }
     }
   }
   ```
   
   **Note**: TFE applies endpoint returns resource counts (`resource-additions`, etc.) but NOT individual resource states. We'll add `apply-resources` as an extension for our state persistence needs, which is TFE-compatible (TFE allows additional attributes).

5. **Database Schema**:
   - Store parsed state in `run_phase_states` table
   - Backend uses this to populate `apply-resources` in **Applies endpoint** response
   
6. **Add Apply Relationship to Run Response**:
   - Update `formatRunResponse()` in `runs.go`
   - Add `relationships.apply` when apply phase exists (plan-and-apply runs that have started apply)
   - Apply ID = Run ID (same pattern as plan ID = run ID)

**Completed Tasks**:
1. ✅ Created database schema for `run_phase_states` table
2. ✅ Implemented logparser service (server-side parsing)
3. ✅ Store state when plan/apply completes in `runner/main.go`
4. ✅ Implemented `GET /api/v2/applies/:id` endpoint (TFE-compliant)
5. ✅ Added `apply` relationship to run response
6. ✅ Database migrations added

**Estimated Effort**: 2-3 days (Actual: Completed)

### ✅ Phase 2: Frontend State Management (COMPLETED)

**Status**: ✅ **COMPLETED** - All tasks implemented in commit `568016d`

**What Was Implemented**:
- ✅ Updated `useRunPolling` to fetch apply state from applies endpoint
- ✅ Updated `ApplyOutputViewer` to initialize from stored state on reload
- ✅ Persisted UI state (raw output viewer tabs, expansion) in localStorage
- ✅ Fixed plan phase terminal/JSON persistence on reload
- ✅ Fixed cancelled run state persistence
- ✅ Default apply phase raw output to terminal view
- ✅ Terminal button appears first in raw output viewer

**Estimated Effort**: 2-3 days (Actual: Completed)

### ✅ Phase 4: Fix Cancellation State (COMPLETED)

**Status**: ✅ **COMPLETED** - Cancellation handling implemented

**What Was Implemented**:
- ✅ Updated `UnifiedPhaseTimeline` to properly detect cancelled state using timestamps
- ✅ Updated `RunDetail.tsx` to show phase content even when cancelled
- ✅ Updated `ApplyOutputViewer` to handle cancelled state properly
- ✅ Cancelled runs now show appropriate content and cards remain functional
- ✅ State persists on reload for cancelled runs

**Estimated Effort**: 1 day (Actual: Completed)

### 🔄 Phase 2.5: Log Fetching Refactor (High Priority) - **NEXT PRIORITY**

**Goal**: Separate plan and apply log fetching into distinct functions to prevent cross-contamination

**Root Cause**: Current generic `getLogs()` function with optional `phase` parameter allows backend to silently fallback to plan logs when apply logs don't exist (see `LOG_FETCHING_ROOT_CAUSE.md` for full analysis).

**Tasks**:
1. **Backend**: Create separate endpoints:
   - `GET /api/v2/runs/:id/logs/plan` - Always returns plan logs (or empty)
   - `GET /api/v2/runs/:id/logs/apply` - Always returns apply logs (or empty)
   - Remove `phase` query parameter from generic endpoint
   - **Remove fallback logic** that returns plan logs when apply logs don't exist (lines 1365-1373 in `runs.go`)

2. **Frontend**: Create separate API functions:
   - `runsApi.getPlanLogs(id)` - Explicitly fetches plan logs
   - `runsApi.getApplyLogs(id)` - Explicitly fetches apply logs
   - Remove generic `getLogs()` function or keep it for backward compatibility with explicit phase parameter

3. **Frontend**: Update `useRunPolling` hook:
   - Use `getPlanLogs()` for plan phase logs
   - Use `getApplyLogs()` for apply phase logs
   - No more phase parameter confusion

4. **Fix Log Writing on Cancellation**:
   - **Analysis Complete**: Verified that writing logs on cancellation is safe (see `LOG_WRITING_ON_CANCELLATION_ANALYSIS.md`)
   - **Current Issue**: `copyLogsFromRedisToMinIO()` is only called if `planResult != nil` or `applyResult != nil`
   - **Problem**: When cancelled, terraform process is killed, result might be `nil`, so logs aren't copied to MinIO
   - **Solution**: Always call `copyLogsFromRedisToMinIO()` before cancellation check (logs are already in Redis from streaming)
   - **Safety**: Frontend and backend both handle missing logs gracefully, so this change is safe
   - **Benefit**: Users can see partial output when run is cancelled (matches terminal behavior)

**Benefits**:
- Clear separation of concerns
- Type safety (can't accidentally request wrong phase)
- No silent fallbacks
- Easier debugging
- Future-proof (easy to add more phases)

**Estimated Effort**: 1-2 days

**Current Issue**: When a plan-and-apply run is cancelled during apply phase, the apply phase terminal output shows plan logs instead of being empty or showing only the apply logs that existed before cancellation.

**Root Cause**: Backend has fallback logic (lines 1365-1373 in `runs.go`) that silently returns plan logs when apply logs don't exist. See `LOG_FETCHING_ROOT_CAUSE.md` for full analysis.

### ⏳ Phase 3: Fix Resource Detail Display (Medium Priority)

**Goal**: Show IDs and creation times for completed resources even when apply fails

**Current Problem**: When an apply run fails, successfully completed resources don't show their creation time and ID, making it impossible for users to copy IDs or see when resources were created.

**Root Cause**: 
- When apply fails, successfully completed resources are parsed but may not be displayed if error handling marks them incorrectly
- Resource parsing extracts IDs and details from log patterns, but failed applies might not have complete log entries for all resources
- Error handling logic may be clearing or incorrectly marking completed resources

**Tasks**:
1. Ensure resource parsing captures all completed resources:
   - Parse resource IDs from log patterns: `[id=...]` and `resource.id = "..."`
   - Extract creation timestamps from log lines
   - Store in resources array even if apply fails later
   - **Critical**: Don't clear completed resources when error occurs

2. Update resource card rendering:
   - Always show ID if available (even if status is failed)
   - Show creation time if available
   - Make ID copyable
   - Ensure completed resources remain visible even when other resources fail

3. Fix error handling logic:
   - When marking resources as failed, preserve completed resources
   - Only mark resources as failed if they were actually applying when error occurred
   - Completed resources should remain completed even if apply fails overall

**Estimated Effort**: 1 day


### ✅ Phase 5: Fix Plan-Only Logs Display (COMPLETED)

**Status**: ✅ **COMPLETED**

**Goal**: Show terminal/JSON view for plan-only runs

**What Was Implemented**:
- ✅ `useRunPolling` already fetches plan logs for plan-only runs (checks `isPlanOperation` which includes `plan-only`)
- ✅ Plan logs are fetched when `planHasCompleted` (has `planned-at` timestamp) even if `planOutput` is null
- ✅ `OutputViewer` receives `polledPlanLogs` from `RunDetail.tsx`
- ✅ `OutputViewer` persists UI state (raw output viewer tabs, expansion) in localStorage per run
- ✅ Plan-only runs now show terminal/JSON view correctly and state persists on reload

**Result**: Plan-only runs now correctly display terminal/JSON logs, and the UI state (tab selection, expansion) persists across page reloads.

**Estimated Effort**: 0.5 days (Actual: Already working, verified)

## Recommended Approach

**Hybrid Approach (Best of Both Worlds) - RECOMMENDED**

**During Active Runs**:
- ✅ Keep current streaming approach (works perfectly)
- ✅ Frontend parses logs incrementally
- ✅ Real-time updates
- ✅ No changes needed

**When Phase Completes**:
- ✅ Parse logs server-side
- ✅ Store structured state in database
- ✅ Lightweight (just parsed state, not full logs)

**On Reload**:
- ✅ Fetch stored state from backend
- ✅ No re-parsing needed
- ✅ Instant state restoration
- ✅ Logs still available for terminal view

**Benefits**:
- ✅ Doesn't break existing streaming (critical!)
- ✅ Production-ready state persistence
- ✅ Minimal backend changes (only store on completion)
- ✅ Fast reloads (no re-parsing)
- ✅ Single source of truth for completed phases

**Why This Works**:
- Current streaming is optimized and works great - don't touch it
- Only need persistence for completed phases (when reload happens)
- Store minimal structured data (not full logs)
- Frontend uses stored state on reload, streaming during active runs

## Testing Plan

1. **Resource Display on Failed Apply**:
   - Create run with multiple resources
   - Let some complete, then fail
   - Verify completed resources show IDs and timestamps

2. **State Persistence**:
   - Start a run, let it progress
   - Reload page at various stages
   - Verify all state is preserved

3. **Cancellation**:
   - Start plan-and-apply run
   - Cancel during plan phase
   - Cancel during apply phase
   - Verify cards remain functional

4. **Plan-Only Runs**:
   - Create plan-only run
   - Verify terminal/JSON view works
   - Reload and verify state persists

## Success Criteria

- ✅ Resource IDs and creation times visible for all completed resources, even on failed applies
- ✅ Resource statuses (failed/completed) persist across page reloads
- ✅ Phase card styling and state persist across reloads
- ✅ Raw output viewer state persists across reloads
- ✅ Plan-only runs show terminal/JSON view correctly
- ✅ Cancelled runs display properly with functional cards
- ✅ No state loss on page reload

## Implementation Details

### Backend Log Parser Service

Create a service that parses logs using the same logic as frontend:

```go
// backend/internal/services/logparser/service.go
type ResourceState struct {
    Address     string    `json:"address"`
    Status      string    `json:"status"` // pending, applying, completed, failed, cancelled
    ResourceID  string    `json:"resource_id,omitempty"`
    CreatedAt   time.Time `json:"created_at,omitempty"`
    Action      string    `json:"action"` // create, update, delete, replace
    ErrorMsg    string    `json:"error_message,omitempty"`
    Details     string    `json:"details,omitempty"`
}

type PhaseState struct {
    Resources []ResourceState `json:"resources"`
    Summary   struct {
        Add      int `json:"add"`
        Change   int `json:"change"`
        Destroy  int `json:"destroy"`
        Replace  int `json:"replace"`
        Failed   int `json:"failed"`
        Total    int `json:"total"`
    } `json:"summary"`
}

func ParseApplyLogs(logs string, plannedResources []PlannedResource) (*PhaseState, error) {
    // Use same parsing logic as frontend ApplyOutputViewer
    // Extract resource states, IDs, timestamps, errors
    // Return structured state
}
```

### When to Store State

**Plan Phase**:
- Store when `planned-at` timestamp is set
- Parse plan logs (if available)
- Store resource states from plan output

**Apply Phase**:
- Store when `applied-at` timestamp is set OR when status is `failed`/`canceled`
- Parse apply logs
- Extract resource states, IDs, timestamps
- Store even if apply failed (to show completed resources)

**Cancellation**:
- Store state when run is cancelled
- Mark applying resources as cancelled
- Preserve completed resources

### Frontend Integration

**TFE-Compliant Approach**: Use separate Plans and Applies endpoints (per [TFE API docs](https://developer.hashicorp.com/terraform/enterprise/api-docs/applies))

```typescript
// In useRunPolling hook
// For plan phase state (from Plans endpoint)
const fetchPlanState = async (runId: string) => {
  if (run['status-timestamps']?.['planned-at']) {
    // Phase complete, fetch plan which includes plan-json
    const planResponse = await apiClient.get(`/api/v2/plans/${runId}`);
    return planResponse.data.attributes['plan-json']?.resource_changes || [];
  }
  return null;
};

// For apply phase state (from Applies endpoint - TFE-compliant)
const fetchApplyState = async (runId: string) => {
  if (run['status-timestamps']?.['applied-at'] || run.status === 'failed') {
    // Phase complete, fetch applies endpoint which includes apply-resources
    const applyResponse = await apiClient.get(`/api/v2/applies/${runId}`);
    return {
      resources: applyResponse.data.attributes['apply-resources'] || [],
      summary: {
        additions: applyResponse.data.attributes['resource-additions'] || 0,
        changes: applyResponse.data.attributes['resource-changes'] || 0,
        destructions: applyResponse.data.attributes['resource-destructions'] || 0,
        imports: applyResponse.data.attributes['resource-imports'] || 0,
      },
    };
  }
  return null; // Phase not complete, use streaming
};

// In ApplyOutputViewer
const initialPhaseState = phaseStateFromBackend || null;
const isPhaseComplete = !!phaseStateFromBackend;

if (isPhaseComplete) {
  // Use stored state as initial state
  // Still allow streaming updates if run is still active
} else {
  // Use current incremental parsing (active run)
}
```

## Timeline

### Completed Phases
- ✅ **Phase 1** (Backend State Storage): Completed
- ✅ **Phase 2** (Frontend State Management): Completed
- ✅ **Phase 4** (Cancellation State): Completed

### Remaining Phases
- 🔄 **Phase 2.5** (Log Fetching Refactor): 1-2 days - **NEXT PRIORITY**
- ⏳ **Phase 3** (Resource Display): 1 day
- ⏳ **Phase 5** (Plan Logs): 0.5 days

**Total Remaining**: ~2.5-3.5 days

## Next Steps

1. ✅ Phase 1 (Backend State Storage) - **COMPLETED**
2. ✅ Phase 2 (Frontend State Management) - **COMPLETED**
3. ✅ Phase 4 (Cancellation State) - **COMPLETED**
4. 🔄 **Phase 2.5 (Log Fetching Refactor)** - **NEXT PRIORITY**
   - Fix root cause of plan logs showing in apply phase when cancelled
   - Separate plan/apply log endpoints
   - Remove backend fallback logic
5. ⏳ Phase 3 (Resource Detail Display) - Show IDs/timestamps for completed resources on failed applies
6. ⏳ Phase 5 (Plan-Only Logs Display) - Ensure terminal/JSON view works for plan-only runs
7. Test thoroughly: active runs, reloads, cancellations, failures

