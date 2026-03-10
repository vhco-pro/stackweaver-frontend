<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Run Timeout Feature

## Overview

StackWeaver includes a configurable timeout feature that automatically cancels long-running apply operations to prevent jobs from getting stuck indefinitely. This is a **StackWeaver-specific extension** that is not part of the Terraform Enterprise (TFE) specification, but is designed to be compatible with TFE clients.

## TFE Compatibility

The `run-timeout` attribute is added as a **custom extension** to the workspace API. TFE-compatible clients (including the Terraform CLI and Terraform Cloud provider) will ignore unknown attributes per the JSON:API specification, ensuring full compatibility.

### API Format

- **JSON:API format**: `run-timeout` (with hyphen, following TFE naming conventions)
- **Simple JSON format**: `run_timeout` (with underscore, for frontend compatibility)

## Configuration

### Default Value

- **Default**: 7200 seconds (2 hours)
- **Minimum**: No enforced minimum (but recommended: 1800 seconds / 30 minutes)
- **Maximum**: No enforced maximum (but recommended: 86400 seconds / 24 hours)

### Setting Timeout

#### Via API

**Create Workspace:**
```json
{
  "data": {
    "type": "workspaces",
    "attributes": {
      "name": "my-workspace",
      "run-timeout": 10800
    }
  }
}
```

**Update Workspace:**
```json
{
  "run_timeout": 10800
}
```

#### Via UI

1. Navigate to the workspace detail page
2. Go to the "Overview" tab
3. In the "Workspace Settings" section, click "Edit" next to "Run Timeout"
4. Enter the timeout in hours (e.g., 2.5 for 2.5 hours)
5. Click "Save"

**Reference**: See `frontend/src/pages/WorkspaceDetail.tsx:1070-1150` for UI implementation

## Behavior

### Apply Operations

When an apply operation exceeds the configured timeout:
1. The operation is automatically cancelled
2. The run status is set to `failed`
3. An error message is logged: `"Apply operation exceeded timeout of {duration} and was automatically cancelled"`
4. The workspace is unlocked, allowing new runs to proceed

**Implementation**: See `backend/cmd/runner/main.go:568-603`

### Plan Operations

Plan operations use a timeout of **half the apply timeout** (minimum 30 minutes):
- If workspace timeout is 2 hours → plan timeout is 1 hour
- If workspace timeout is 1 hour → plan timeout is 30 minutes (minimum)
- If workspace timeout is 30 minutes → plan timeout is 30 minutes (minimum)

**Implementation**: See `backend/cmd/runner/main.go:392-418`

### Timeout Enforcement

Timeouts are enforced using Go's `context.WithTimeout`, which:
- Automatically cancels the Terraform process when the deadline is reached
- Ensures proper cleanup and resource release
- Prevents stuck processes from consuming resources indefinitely

## Backend Implementation

### Model

**Workspace Model**: `backend/internal/models/workspace.go:44`
- Field: `RunTimeout int` (default: 7200 seconds)
- Stored in database as `run_timeout` column

### API Handlers

**Create Workspace**: `backend/internal/api/v2/handlers/terraform/workspaces.go:324+`
- Accepts `run-timeout` (JSON:API) or `run_timeout` (Simple JSON)
- Defaults to 7200 if not provided

**Update Workspace**: `backend/internal/api/v2/handlers/terraform/workspaces.go:666+`
- Accepts `run_timeout` in update payload
- Updates workspace model and persists to database

**Response Formatting**: `backend/internal/api/v2/handlers/terraform/workspaces.go:153+`
- Includes `run-timeout` in TFE-compatible JSON:API responses
- Includes `run_timeout` in simple JSON responses

### Runner

**Apply Timeout**: `backend/cmd/runner/main.go:568-603`
- Creates timeout context based on `workspace.RunTimeout`
- Defaults to 2 hours if not configured
- Checks for timeout after apply completes
- Sets run status to `failed` with appropriate error message

**Plan Timeout**: `backend/cmd/runner/main.go:392-418`
- Creates timeout context (half of apply timeout, minimum 30 minutes)
- Checks for timeout after plan completes
- Sets run status to `failed` with appropriate error message

### Orchestrator

The orchestrator's `cleanupStuckRuns` function also uses the workspace timeout to identify and mark stuck runs as failed.

**Reference**: See `backend/cmd/orchestrator/main.go:152-192`

## Frontend Implementation

### Workspace Interface

**Type Definition**: `frontend/src/api/client.ts:174-194`
- Added `run_timeout?: number` to `Workspace` interface

### UI Components

**Workspace Detail Page**: `frontend/src/pages/WorkspaceDetail.tsx:1070-1150`
- Displays current timeout in human-readable format
- Provides "Edit" button to configure timeout
- Dialog for setting timeout in hours
- Shows note about TFE compatibility

**Helper Function**: `frontend/src/pages/WorkspaceDetail.tsx:703+`
- `formatTimeout(seconds: number)`: Converts seconds to human-readable format (e.g., "2 hours", "1 hour 30 minutes")

## Documentation

### API Reference

- **Backend API**: `docs/api-reference/backend-api-reference.md`
  - Workspace create/update endpoints document `run-timeout` attribute
  - Runs section includes note about timeout enforcement

- **Frontend API**: `docs/api-reference/frontend-api-reference.md`
  - `workspacesApi.create()` and `workspacesApi.update()` document `run_timeout` parameter

## Terraform Provider Compatibility

The Terraform Cloud provider will ignore the `run-timeout` attribute when managing workspaces, as it's not part of the TFE specification. This means:

- ✅ Workspaces created/updated via Terraform provider will work correctly
- ✅ The timeout setting will be preserved (not overwritten) by Terraform provider operations
- ✅ Manual timeout configuration via StackWeaver UI/API will persist

## Best Practices

1. **Set appropriate timeouts** based on your infrastructure complexity:
   - Simple infrastructure: 1-2 hours
   - Complex infrastructure: 2-4 hours
   - Very large deployments: 4-8 hours

2. **Monitor timeout failures**: If you see frequent timeout failures, consider:
   - Increasing the timeout value
   - Optimizing your Terraform configuration
   - Breaking large deployments into smaller workspaces

3. **Use timeouts as a safety net**: The timeout is a maximum duration, not a target. Most operations should complete well before the timeout.

## Troubleshooting

### Runs Failing with Timeout Errors

If runs are consistently timing out:
1. Check the workspace timeout setting in the UI
2. Review the apply logs to see where the operation is getting stuck
3. Consider increasing the timeout if the operation is legitimate but slow
4. Investigate infrastructure issues (network, provider API rate limits, etc.)

### Timeout Not Working

If timeouts aren't being enforced:
1. Verify the workspace has a `run_timeout` value set (check via API or database)
2. Check runner logs for timeout-related messages
3. Ensure the runner is using the latest code with timeout support

## Related Files

- **Backend Model**: `backend/internal/models/workspace.go`
- **Backend API**: `backend/internal/api/v2/handlers/terraform/workspaces.go`
- **Runner**: `backend/cmd/runner/main.go`
- **Orchestrator**: `backend/cmd/orchestrator/main.go`
- **Frontend API**: `frontend/src/api/client.ts`
- **Frontend UI**: `frontend/src/pages/WorkspaceDetail.tsx`
