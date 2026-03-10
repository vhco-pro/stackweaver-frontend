<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Log Writing on Cancellation - Analysis

## Current Behavior

### Plan Phase Cancellation
1. Terraform plan runs with streaming callback (`OnOutputLine`) writing to Redis in real-time
2. If cancelled, context is cancelled → terraform process is killed
3. `PlanWithOptions` returns (may return `nil` result if context cancelled)
4. **Current code**: `copyLogsFromRedisToMinIO("plan")` is called ONLY if `planResult != nil` (line 628-632)
5. **Problem**: If cancelled, `planResult` might be `nil`, so logs aren't copied to MinIO
6. Cancellation check happens AFTER the copy attempt (line 636)

### Apply Phase Cancellation
1. Same pattern as plan phase
2. `copyLogsFromRedisToMinIO("apply")` is called ONLY if `applyResult != nil` (line 834-838)
3. **Problem**: If cancelled, `applyResult` might be `nil`, so logs aren't copied to MinIO

## Key Insight

**Logs are already in Redis** (streamed via `OnOutputLine` callback) even when cancelled. The issue is that we only copy to MinIO if the terraform operation returns a result. When cancelled, the result might be `nil`, so logs stay in Redis but aren't persisted to MinIO.

## Verification: Will Writing Logs on Cancellation Break Anything?

### Frontend Checks
- ✅ **No file existence checks**: Frontend doesn't check if log files exist
- ✅ **Graceful handling**: `getLogs()` returns empty string if logs don't exist (TFE-compliant)
- ✅ **Empty log handling**: Frontend handles empty logs gracefully (shows empty terminal, doesn't break)

### Backend Checks
- ✅ **`storePhaseState` function**: If logs don't exist in MinIO, it logs a warning and returns (line 500-503 in `runner/main.go`)
- ✅ **No breaking behavior**: Missing logs don't cause errors, just warnings

### Conclusion
**Writing logs on cancellation is SAFE** - it won't break any existing checks. The frontend and backend both handle missing logs gracefully.

## Recommended Fix

Ensure logs are copied from Redis to MinIO even when cancelled:

```go
// For plan phase
planResult, err := plugin.PlanWithOptions(cancellablePlanCtx, terraformDir, variables, envVars, planOptions)
if planResult != nil {
    operationLogs.WriteString("=== Terraform Plan ===\n")
    operationLogs.WriteString(planResult.Logs)
}
// ALWAYS copy logs from Redis to MinIO, even if cancelled
// Logs are already in Redis from streaming callback, even if planResult is nil
copyLogsFromRedisToMinIO("plan")

// Check if run was cancelled during plan
run, _ = runRepo.GetByID(job.RunID)
if run.Status == models.RunStatusCancelled {
    log.Printf("Run %s was cancelled during plan execution", run.ID)
    return nil
}
```

Same pattern for apply phase.

## Benefits
- ✅ Users can see partial output even when run is cancelled
- ✅ Matches terminal behavior (if you cancel in terminal, you still see output up to cancellation)
- ✅ Logs are persisted for debugging cancelled runs
- ✅ No breaking changes (frontend/backend handle missing logs gracefully)

