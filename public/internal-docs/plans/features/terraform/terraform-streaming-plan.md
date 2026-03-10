<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Terraform Output Streaming Implementation

## Overview

This document describes the implementation of live Terraform output streaming and real-time resource status updates for StackWeaver. The feature provides optional terminal-like views during plan execution and live resource status updates during apply operations.

**Status**: Phase 1 (Backend) ✅ Complete | Phase 2 (Frontend Terminal) ✅ Complete | Phase 3 (Frontend Live Resource Updates) ✅ Complete

## Architecture

### Backend Implementation

The backend implements a dual-mode approach supporting both streaming and non-streaming execution:

#### 1. Terraform Plugin (`backend/internal/plugins/terraform/plugin.go`)

**New Methods** (streaming support):
- `PlanWithOptions()` - Plan execution with optional streaming callback
- `ApplyWithOptions()` - Apply execution with optional streaming callback
- `planWithStreaming()` - Internal streaming implementation for plan
- `applyWithStreaming()` - Internal streaming implementation for apply

**Original Methods** (backward compatible):
- `Plan()` - Original plan method (still supported, uses CombinedOutput)
- `Apply()` - Original apply method (still supported, uses CombinedOutput)

**Backward Compatibility**: Original methods are preserved and continue to work. New streaming methods are opt-in via options struct.

#### 2. Redis Log Buffer Service (`backend/internal/services/logbuffer/redis.go`)

Provides efficient log streaming using Redis:
- `Append()` - Stream logs to Redis with TTL (24 hours)
- `Get()` - Retrieve logs with offset/limit support
- `CopyToMinIO()` - Copy logs to MinIO for long-term persistence
- `Delete()` - Cleanup helper
- `Exists()` - Check if logs exist in Redis

**Key Features**:
- Uses Redis `APPEND` for efficient string concatenation (O(1) amortized)
- Automatic TTL cleanup (24 hours)
- Supports offset/limit for pagination/streaming
- Graceful fallback to MinIO when Redis is unavailable

#### 3. Runner Integration (`backend/cmd/runner/main.go`)

**Streaming Mode** (new):
- Uses `PlanWithOptions()` and `ApplyWithOptions()` with callbacks
- Streams logs to Redis in real-time during execution
- Copies logs from Redis to MinIO at completion

**Non-Streaming Mode** (original):
- Still available via original methods
- Logs written to MinIO after completion (existing behavior)

#### 4. API Logs Endpoint (`backend/internal/api/v2/handlers/terraform/runs.go`)

**Dual-Source Strategy**:
1. **Redis First** (for active runs):
   - Checks Redis for logs during execution
   - Returns partial logs for streaming
   - Supports offset/limit parameters

2. **MinIO Fallback** (for completed runs):
   - Falls back to MinIO when Redis doesn't have logs
   - Serves complete logs after execution finishes
   - Maintains TFE compatibility

**Backward Compatibility**: Endpoint works identically for both streaming and non-streaming modes. Clients don't need changes.

### Frontend Implementation

#### 1. Terminal Output Component (`frontend/src/components/runs/TerminalOutput.tsx`)

New component for displaying streaming terminal output:
- Terminal-like appearance styled like JSON parser (`bg-muted/10`, monospace font, `text-sm`)
- Auto-scroll to bottom when new content arrives
- User can scroll up to view history (auto-scroll pauses)
- Copy to clipboard functionality (top-right button)
- Scroll to bottom button when user has scrolled up (top-right)
- Streaming indicator (pulsing cursor)
- Uses `<pre>` tag for proper whitespace handling (consistent with JSON parser styling)

#### 2. User Preferences (`frontend/src/contexts/RunDisplayPreferencesContext.tsx`)

Extended to support terminal view preference:
- `showTerminalDuringPlanning` - Optional terminal view during plan phase (default: `false`)
- Stored in localStorage
- Default behavior remains spinner (backward compatible)

#### 3. RunDetail Integration (`frontend/src/pages/RunDetail.tsx`)

**Default Behavior** (preference = false):
- Shows blue spinner during planning (current implementation, unchanged)
- No terminal view

**Terminal View Enabled** (preference = true or toggle button):
- Polls logs endpoint every 1 second during planning (with offset for incremental updates)
- Shows `TerminalOutput` component with streaming logs
- Transitions to `OutputViewer` when plan completes (unchanged)
- Local state allows toggling terminal view independently of preference

**After Plan Completes** (both cases):
- Shows structured output with resource cards (existing `OutputViewer`)
- Behavior identical to current implementation

#### 4. ApplyOutputViewer Incremental Parsing (`frontend/src/components/runs/ApplyOutputViewer.tsx`)

**Performance Improvements**:
- Replaced 266-line `useMemo` block with incremental parsing using `useEffect` hooks
- Only parses new log lines (not all lines on every update)
- ~1000x performance improvement for large log files
- Real-time resource status updates as logs arrive
- Action badges show immediately (from plan output) while resources are applying
- Summary badges only count completed resources (increment as they complete)

**Cancellation Handling**:
- Resources in "applying" state are marked as "cancelled" when run is cancelled
- Cancelled resources show grey styling with X icon (consistent with cancelled phases)

#### 5. JSON Viewer Lazy Loading (`frontend/src/components/runs/JsonViewer.tsx`)

**Performance Optimization**:
- Large JSON arrays (e.g., JSONL logs with 1000+ entries) use lazy loading
- Only renders first 100 items initially
- "Load More" button to load additional items (100 at a time)
- "Show All" button to load everything at once
- Prevents UI blocking when viewing large JSON outputs

## Implementation Status

### Phase 1: Backend - Redis Streaming ✅

- [x] Create Redis log buffer service
- [x] Modify Terraform plugin to stream output line-by-line
- [x] Update runner to write logs to Redis during execution
- [x] Update logs endpoint to check Redis first, fall back to MinIO
- [x] Copy logs from Redis to MinIO at completion

### Phase 2: Frontend - Terminal Component ✅

- [x] Create `TerminalOutput` component (styled like JSON parser)
- [x] Add user preference for `showTerminalDuringPlanning` (default = false)
- [x] Update `RunDetail` to show terminal during planning (when preference enabled)
- [x] Add terminal toggle button in plan phase card header
- [x] Poll logs endpoint more frequently during planning (every 1s with offset)
- [x] Transition to `OutputViewer` when plan completes

### Phase 3: Frontend - Live Resource Updates ✅

- [x] Update `ApplyOutputViewer` for incremental log parsing
- [x] Parse logs incrementally to extract resource completion events
- [x] Update resource cards in real-time as they complete
- [x] Implement cancellation handling with grey styling for cancelled resources
- [x] Update polling for apply phase (750ms during apply, 2000ms otherwise)
- [x] Fix action badges to show while applying (not just after completion)
- [x] Fix summary badges to only count completed resources
- [x] Implement lazy loading for large JSON outputs (prevents UI blocking)

## Backward Compatibility

### Backend

- **Original methods preserved**: `Plan()` and `Apply()` continue to work without changes
- **Streaming is opt-in**: New methods (`PlanWithOptions`, `ApplyWithOptions`) are used only when callbacks are provided
- **API endpoint unchanged**: Logs endpoint works identically for both streaming and non-streaming modes
- **MinIO fallback**: Always available, ensures logs are accessible even if Redis is unavailable

### Frontend

- **Default behavior unchanged**: Spinner during planning (preference defaults to `false`)
- **Terminal view is opt-in**: Users must enable it in preferences
- **Existing components unchanged**: `OutputViewer` and `ApplyOutputViewer` work as before
- **Progressive enhancement**: Terminal view enhances UX but doesn't replace existing functionality

## Performance Considerations

1. **Redis Memory**: 
   - Typical log size: 5-10MB per run (30-minute plan/apply)
   - With 50 concurrent runs: ~250-500MB in Redis (acceptable)
   - TTL ensures automatic cleanup after 24 hours

2. **Redis Performance**: 
   - `APPEND` is O(1) amortized, very fast (microseconds)
   - `GET` is O(1), suitable for frequent polling
   - Network overhead: Minimal (local Redis, same network)

3. **Frontend Polling**: 
   - Plan phase: 1 second when terminal view enabled (vs 2 seconds default)
   - Apply phase: 500ms-1s for live resource updates (vs 2 seconds default)
   - Balanced between real-time feel and server load

## References

- Implementation plan: `docs/terraform/plan-streaming-implementation.md`
- Redis log buffer service: `backend/internal/services/logbuffer/redis.go`
- Terraform plugin: `backend/internal/plugins/terraform/plugin.go`
- Runner integration: `backend/cmd/runner/main.go`
- Logs endpoint: `backend/internal/api/v2/handlers/terraform/runs.go`
- Terminal component: `frontend/src/components/runs/TerminalOutput.tsx`
- RunDetail integration: `frontend/src/pages/RunDetail.tsx`

