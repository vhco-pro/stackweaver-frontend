<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Root Cause Analysis: Plan Logs Showing in Apply Phase

## Problem Statement
When a plan-and-apply run is cancelled during the apply phase, the apply phase's terminal output viewer shows plan logs instead of being empty or showing only the apply logs that existed before cancellation.

## Root Cause

### Backend Fallback Logic (The Culprit)

**Location**: `backend/internal/api/v2/handlers/terraform/runs.go:1365-1373`

```go
// For plan-and-apply runs, if apply logs don't exist, try plan logs
if run.Operation == models.RunOperationPlanAndApply && phase == "apply" {
    planLogsKey := fmt.Sprintf("runs/%s/logs/plan.log", run.ID)
    planLogs, planErr := h.storageClient.Get(context.Background(), planLogsKey)
    if planErr == nil && len(planLogs) > 0 {
        logs = planLogs  // ⚠️ FALLBACK TO PLAN LOGS
        err = nil
    }
}
```

**The Problem**: When the frontend explicitly requests `phase=apply` logs, but apply logs don't exist (e.g., cancelled early), the backend **silently falls back** to returning plan logs. The frontend has no way to know these are plan logs, not apply logs.

### Flow Diagram

```
1. Frontend: GET /api/v2/runs/{id}/logs?phase=apply
   ↓
2. Backend: Try to fetch runs/{id}/logs/apply.log
   ↓
3. Backend: apply.log doesn't exist (cancelled early, no apply logs written)
   ↓
4. Backend: FALLBACK - Try to fetch runs/{id}/logs/plan.log
   ↓
5. Backend: plan.log exists → Return plan logs
   ↓
6. Frontend: Receives logs, assumes they're apply logs
   ↓
7. ApplyOutputViewer: Displays plan logs in apply phase terminal view ❌
```

## Current Architecture Issues

### 1. **Single Generic `getLogs()` Function**
- **Location**: `frontend/src/api/client.ts:571-600`
- **Issue**: One function handles both plan and apply logs via optional `phase` parameter
- **Problem**: No type safety or explicit separation of concerns
- **Current Code**:
```typescript
getLogs: async (id: string, options?: { offset?: number; limit?: number; phase?: 'plan' | 'apply' }): Promise<string>
```

### 2. **Shared State Management**
- **Location**: `frontend/src/hooks/useRunPolling.ts`
- **Issue**: Two separate state variables (`logs` for apply, `planLogs` for plan), but both use the same `runsApi.getLogs()` function
- **Problem**: Easy to mix up which logs are which, especially when backend does fallback

### 3. **Backend Fallback Without Indication**
- **Location**: `backend/internal/api/v2/handlers/terraform/runs.go:1365-1373`
- **Issue**: Backend returns plan logs when apply logs don't exist, but doesn't indicate this in the response
- **Problem**: Frontend can't distinguish between "empty apply logs" and "plan logs returned as fallback"

## Options for Solution

### Option 1: Remove Backend Fallback (Simplest)
**Approach**: Remove the fallback logic entirely. If apply logs don't exist, return empty string.

**Pros**:
- Simple, clear behavior
- Frontend gets what it asks for (empty if no apply logs)
- No ambiguity

**Cons**:
- If apply logs genuinely don't exist, user sees empty terminal (but this is correct behavior)

**Implementation**:
- Remove lines 1365-1373 in `runs.go`
- Frontend already handles empty logs correctly

### Option 2: Separate API Functions (Recommended)
**Approach**: Create separate functions for fetching plan logs vs apply logs.

**Backend**:
- `GET /api/v2/runs/:id/logs/plan` - Always returns plan logs (or empty)
- `GET /api/v2/runs/:id/logs/apply` - Always returns apply logs (or empty)
- Remove phase parameter from generic endpoint

**Frontend**:
- `runsApi.getPlanLogs(id)` - Explicitly fetches plan logs
- `runsApi.getApplyLogs(id)` - Explicitly fetches apply logs
- No shared function, no confusion

**Pros**:
- Clear separation of concerns
- Type safety (can't accidentally request wrong phase)
- Backend can't silently fallback (different endpoints)
- Easier to reason about
- Better for future extensibility

**Cons**:
- Requires API change (but we're already using phase parameter, so this is just restructuring)
- Slightly more code

### Option 3: Backend Indicates Fallback
**Approach**: Keep current structure but backend indicates when it's returning fallback logs.

**Backend Response**:
```json
{
  "logs": "...",
  "phase": "plan",  // Indicates actual phase of logs returned
  "requested_phase": "apply",  // What was requested
  "is_fallback": true  // Indicates fallback occurred
}
```

**Frontend**:
- Check `is_fallback` or `phase !== requested_phase`
- If fallback occurred, don't use the logs for apply phase

**Pros**:
- Maintains backward compatibility
- Frontend can make informed decision

**Cons**:
- Changes response format (currently returns plain text, not JSON)
- More complex logic
- Still allows confusion

### Option 4: Frontend Validates Logs Phase
**Approach**: Frontend checks if returned logs are actually apply logs by parsing them.

**Implementation**:
- Parse logs to check for apply-specific patterns (e.g., "Applying...", "Apply complete!")
- If logs contain plan patterns (e.g., "Terraform will perform the following actions:"), reject them

**Pros**:
- Works with current backend
- No backend changes needed

**Cons**:
- Fragile (depends on log format)
- Performance overhead (parsing logs)
- Not foolproof (logs might not have clear indicators)

## Recommendation

**Option 2 (Separate API Functions)** is the best long-term solution because:
1. **Clear Intent**: `getPlanLogs()` vs `getApplyLogs()` makes the code self-documenting
2. **Type Safety**: Can't accidentally pass wrong phase
3. **No Silent Fallbacks**: Backend can't return plan logs when apply logs are requested (different endpoints)
4. **Easier Debugging**: Clear separation makes it obvious which logs are being fetched
5. **Future-Proof**: Easy to add more phases (e.g., `getDestroyLogs()`) if needed

**Short-term Fix**: Option 1 (Remove Backend Fallback) can be implemented immediately to fix the bug, then Option 2 can be done as a proper refactor.

## Current State Mapping

### Frontend State Variables
- `logs` (in `useRunPolling`) → `polledLogs` → `runLogs` → passed to `ApplyOutputViewer` as `logs` prop
- `planLogs` (in `useRunPolling`) → `polledPlanLogs` → `planLogs` → passed to `OutputViewer` (plan phase)

### Backend Endpoints
- `GET /api/v2/runs/:id/logs?phase=plan` → Should return plan logs
- `GET /api/v2/runs/:id/logs?phase=apply` → Should return apply logs (but falls back to plan if apply doesn't exist)

### The Bug Flow
1. Run cancelled during apply (no apply logs written)
2. Frontend requests `phase=apply` logs
3. Backend can't find apply logs
4. Backend falls back to plan logs (lines 1365-1373)
5. Frontend receives plan logs, thinks they're apply logs
6. `ApplyOutputViewer` displays plan logs in terminal view

## Testing Scenarios

1. **Plan-and-apply run, cancelled during apply**:
   - Apply phase terminal should be empty (no apply logs)
   - Plan phase terminal should show plan logs

2. **Plan-and-apply run, cancelled during plan**:
   - Plan phase terminal should show partial plan logs
   - Apply phase should not exist

3. **Plan-and-apply run, completed successfully**:
   - Plan phase terminal shows plan logs
   - Apply phase terminal shows apply logs

