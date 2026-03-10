<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Terraform Plan Streaming & Apply Live Resource Updates Implementation Plan

> **Status**: ✅ **IMPLEMENTATION COMPLETE**  
> This document was the planning/design document for the streaming feature.  
> The implementation is now complete. For the final implementation details, see:
> - `docs/features/terraform-streaming.md` - Implementation status and architecture
>
> This document is kept for historical reference and implementation details.

## Overview

This document outlines the implementation plan for two distinct but related features:

1. **Plan Phase**: Optional terminal-like interface during planning (preference toggle, default = spinner), then transition to structured plan output with resource cards when plan completes.

2. **Apply Phase**: Keep the existing resource card list implementation, but update resource statuses in real-time as they're applied (not all at once after completion). This enables live feedback where resources turn green/red as they complete, even if other resources are still applying or have failed.

**Key Points**:
- **Plan Phase**: 
  - **During planning**: Optional terminal view (preference toggle, default = blue spinner)
  - **After plan completes**: Structured output with resource cards (like current implementation)
  - Terminal view is for power users during long plans
- **Apply Phase**: Resource cards with live status updates (no terminal view, keeps existing UI)

## Current State

### Backend
- ✅ **Streaming support implemented** (Phase 1 complete)
  - Terraform plugin supports streaming via `PlanWithOptions()` and `ApplyWithOptions()`
  - Original methods (`Plan()`, `Apply()`) still available for backward compatibility
  - Logs streamed to Redis during execution, copied to MinIO at completion
  - Logs endpoint checks Redis first (active runs), falls back to MinIO (completed runs)
- **Original behavior** (still supported):
  - `Plan()` and `Apply()` use `cmd.CombinedOutput()` for backward compatibility
  - Logs stored in MinIO after operation completes (unchanged behavior)
- Logs stored at: `runs/{run_id}/logs/{phase}.log` (MinIO) and `run:logs:{runID}:{phase}` (Redis during execution)

### Frontend - Plan Phase
- ✅ **Plan output structure** (Phase 2 complete)
  - **Main content**: Structured plan output with resource cards (parsed from plan JSON)
    - Shows resource changes with + Add, C Replace, etc.
    - Displays plan summary and data sources
  - **"View Raw Output" section** (expandable, below resource cards):
    - **Terminal tab**: Plain text output (what you'd see when running `terraform plan` in a terminal)
      - Extracts plain text lines from logs (skips JSONL lines)
      - Shows raw terminal output with monospace font
    - **JSON tab**: JSONL structured logs (the structured JSON output from Terraform)
      - Shows JSON objects with syntax highlighting
      - Separates plain text lines from JSON objects
- ✅ **Optional terminal view during planning** (user preference, default = false)
  - Default behavior: Shows "Planning in progress..." spinner (backward compatible)
  - Terminal view enabled: Shows `TerminalOutput` component with streaming plain text logs
  - Polls logs endpoint every 1 second when terminal view enabled
- Polls run status every 2 seconds via `useRunPolling`

### Frontend - Apply Phase
- **Apply output structure**:
  - **Main content**: Resource cards showing apply status (blue circles while applying, green/red when done)
    - Shows which resources are being applied, completed, or failed
    - Displays apply summary and outputs
  - **"View Raw Output" section** (expandable, below resource cards):
    - **Terminal tab**: Plain text output (what you'd see when running `terraform apply` in a terminal)
      - Extracts plain text lines from logs (skips JSONL lines)
      - Shows raw terminal output with monospace font
    - **JSON tab**: JSONL structured logs (the structured JSON output from Terraform)
      - Shows JSON objects with syntax highlighting
      - Separates plain text lines from JSON objects
- Shows "Loading apply output..." spinner during apply phase
- Uses `ApplyOutputViewer` component with resource cards
- **Problem**: Resource statuses only update after entire apply completes (all resources must finish)
- **Problem**: If one resource errors, user must wait for all resources to complete to see which ones succeeded/failed
- **Problem**: Cancellation shows "Loading apply output..." because logs aren't available until completion
- **Current Implementation**: Resource cards exist and work, but update all at once after completion

## Target State

### Backend
- **Plan Phase**: Stream Terraform plan output line-by-line as it executes
- **Apply Phase**: Stream Terraform apply output line-by-line as it executes
- Store logs incrementally in Redis during execution (shared between runner and API)
- Logs endpoint serves partial logs from Redis (active runs) or MinIO (completed runs)
- Final logs written to MinIO at completion for persistence

### Frontend - Plan Phase
- **Optional terminal view during planning** (preference toggle, default = spinner)
  - Default behavior: Keep blue spinner (current implementation)
  - Power user option: Show terminal-like interface with streaming logs
  - Terminal view useful for long-running plans
- Display streaming logs in real-time with auto-scroll (when terminal view enabled)
- Poll logs endpoint more frequently during planning (every 500ms-1s) when terminal view enabled
- Transition to `OutputViewer` when plan completes (shows resource cards like current implementation)
- **Resource cards displayed after plan completes** (structured output with + Add, C Replace, etc.)

### Frontend - Apply Phase
- **Keep existing resource card list implementation** (no terminal view)
- **Live resource status updates**: Update resource cards in real-time as they're applied
- Resources turn green/red immediately when they complete (not after all resources finish)
- If one resource errors, other resources continue updating independently
- Poll logs endpoint more frequently during apply (every 500ms-1s) to get incremental updates
- Parse logs incrementally to extract resource completion events
- **Cancellation handling**: Show which resources were applied before cancellation (parse logs up to cancellation point)

## Architecture Decision: Redis for Streaming Logs (Recommended)

**Decision**: Use Redis directly for log streaming (skip in-memory MVP approach).

### Why Redis Over In-Memory Buffer?

**Memory Concerns with In-Memory Approach:**
- **Per-run memory**: Long-running plans/applies (30+ minutes) can generate 5-10MB of logs per run
- **Concurrent runs**: With 10 concurrent runs = 50-100MB, 50 concurrent runs = 250-500MB
- **Memory pressure**: Logs stored in runner process memory, competing with Terraform execution
- **Crash risk**: Runner crashes = logs lost (even with periodic writes, there's a window of data loss)
- **Scalability**: Doesn't scale well with multiple runner instances (each instance has its own memory)

**Benefits of Redis Approach:**
- ✅ **Already available**: Redis is already in the stack (used for job queues)
- ✅ **Persistent**: Logs survive runner crashes (critical for debugging)
- ✅ **Scalable**: Shared across multiple runner instances (production-ready)
- ✅ **Efficient**: Redis `APPEND` is O(1) amortized, very fast
- ✅ **Memory offloaded**: Logs stored in Redis, not in runner process
- ✅ **Automatic cleanup**: TTL ensures old logs are cleaned up
- ✅ **Production-ready**: No need for phased approach (MVP → Redis)

**Performance Impact:**
- **Negligible**: Redis `APPEND` operations are extremely fast (microseconds)
- **Network overhead**: Minimal (local Redis, same network)
- **Read performance**: Redis `GET` is also very fast, suitable for frequent polling

**Conclusion**: Since Redis is already available and the memory concerns with in-memory buffers are real (especially with concurrent runs), we should implement Redis directly. This is the production-ready approach and avoids technical debt.

### Implementation (Redis)

1. Stream output line-by-line, append to Redis key: `run:logs:{runID}:{phase}`
2. Use Redis `APPEND` command for efficient string concatenation
3. Logs endpoint reads from Redis if run is active, otherwise from MinIO
4. Copy from Redis to MinIO at completion (for long-term persistence)
5. Set TTL on Redis keys (e.g., 24 hours) for automatic cleanup

### Option C: Database Table for Log Lines (Like Ansible Events)

**Pros:**
- Persistent and queryable
- Can track individual log lines with timestamps
- Similar to existing Ansible implementation

**Cons:**
- Requires schema changes
- More database writes
- Slower than in-memory/Redis

**Recommendation:** Use **Redis directly** (Option B) - it's already available, production-ready, and avoids memory concerns with in-memory buffers.

## Implementation Plan

### Phase 1: Backend - Streaming Output Capture

#### 1.1 Modify Terraform Plugin to Stream Output ✅ COMPLETE

**File**: `backend/internal/plugins/terraform/plugin.go`

**Changes:**
- ✅ Added `PlanWithOptions()` and `ApplyWithOptions()` methods with streaming support
- ✅ Implemented `planWithStreaming()` and `applyWithStreaming()` internal methods
- ✅ Uses `cmd.StdoutPipe()` and `cmd.StderrPipe()` for streaming
- ✅ Uses `bufio.Scanner` to read output line-by-line (similar to Ansible runner)
- ✅ **Backward compatibility**: Original `Plan()` and `Apply()` methods preserved
  - Original methods use `cmd.CombinedOutput()` (existing behavior)
  - New streaming methods are opt-in via options struct
  - Runner uses new methods, but old methods still work if called directly

**Key Changes:**
```go
// Add streaming callback to Plan method
type PlanOptions struct {
    OnOutputLine func(line string) // Called for each output line
}

func (p *Plugin) Plan(ctx context.Context, workspaceDir string, variables map[string]string, envVars map[string]string, options *PlanOptions) (*plugins.PlanResult, error) {
    // ... existing setup ...
    
    stdout, err := cmd.StdoutPipe()
    if err != nil {
        return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
    }
    
    stderr, err := cmd.StderrPipe()
    if err != nil {
        return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
    }
    
    if err := cmd.Start(); err != nil {
        return nil, fmt.Errorf("failed to start terraform plan: %w", err)
    }
    
    var outputBuffer strings.Builder
    var wg sync.WaitGroup
    
    // Stream stdout
    wg.Add(1)
    go func() {
        defer wg.Done()
        scanner := bufio.NewScanner(stdout)
        for scanner.Scan() {
            line := scanner.Text()
            outputBuffer.WriteString(line)
            outputBuffer.WriteString("\n")
            if options != nil && options.OnOutputLine != nil {
                options.OnOutputLine(line)
            }
        }
    }()
    
    // Stream stderr
    wg.Add(1)
    go func() {
        defer wg.Done()
        scanner := bufio.NewScanner(stderr)
        for scanner.Scan() {
            line := scanner.Text()
            outputBuffer.WriteString(line)
            outputBuffer.WriteString("\n")
            if options != nil && options.OnOutputLine != nil {
                options.OnOutputLine(line)
            }
        }
    }()
    
    wg.Wait()
    err = cmd.Wait()
    
    // ... rest of existing logic ...
}
```

#### 1.2 Add Redis Log Buffer ✅ COMPLETE

**File**: `backend/internal/services/logbuffer/redis.go` (new service)

**Implementation:**
- ✅ Created `RedisLogBuffer` service with full functionality
- ✅ `Append()`: Streams logs to Redis key `run:logs:{runID}:{phase}`
- ✅ Uses Redis `APPEND` command for efficient string concatenation (O(1) amortized)
- ✅ Sets TTL on keys (24 hours) for automatic cleanup
- ✅ `Get()`: Retrieves logs with offset/limit support
- ✅ `CopyToMinIO()`: Copies logs to MinIO at completion for long-term persistence
- ✅ `Delete()` and `Exists()`: Helper methods for cleanup and checking

**Changes:**
- Initialize Redis client (reuse existing queue connection or create new)
- Append log lines to Redis key: `run:logs:{runID}:{phase}`
- Use Redis `APPEND` command for efficient string concatenation
- Set TTL on keys (24 hours) for automatic cleanup
- Copy to MinIO at completion for long-term persistence

**Key Implementation:**
```go
type RedisLogBuffer struct {
    client *redis.Client
}

func NewRedisLogBuffer(client *redis.Client) *RedisLogBuffer {
    return &RedisLogBuffer{client: client}
}

func (b *RedisLogBuffer) Append(ctx context.Context, runID, phase, line string) error {
    key := fmt.Sprintf("run:logs:%s:%s", runID, phase)
    // Use APPEND for efficient string concatenation
    err := b.client.Append(ctx, key, line+"\n").Err()
    if err != nil {
        return err
    }
    // Set TTL on first write (24 hours)
    b.client.Expire(ctx, key, 24*time.Hour)
    return nil
}

func (b *RedisLogBuffer) Get(ctx context.Context, runID, phase string, offset, limit int) (string, error) {
    key := fmt.Sprintf("run:logs:%s:%s", runID, phase)
    content, err := b.client.Get(ctx, key).Result()
    if err == redis.Nil {
        return "", nil
    }
    if err != nil {
        return "", err
    }
    
    // Handle offset/limit
    lines := strings.Split(content, "\n")
    if offset >= len(lines) {
        return "", nil
    }
    end := offset + limit
    if end > len(lines) {
        end = len(lines)
    }
    return strings.Join(lines[offset:end], "\n"), nil
}

func (b *RedisLogBuffer) CopyToMinIO(ctx context.Context, runID, phase string, storageClient storage.Client) error {
    key := fmt.Sprintf("run:logs:%s:%s", runID, phase)
    content, err := b.client.Get(ctx, key).Result()
    if err == redis.Nil {
        // No logs in Redis, skip
        return nil
    }
    if err != nil {
        return err
    }
    
    // Write to MinIO for long-term persistence
    logsKey := fmt.Sprintf("runs/%s/logs/%s.log", runID, phase)
    if err := storageClient.Put(ctx, logsKey, []byte(content)); err != nil {
        return fmt.Errorf("failed to copy logs to MinIO: %w", err)
    }
    
    // Delete from Redis after successful copy (or keep with TTL)
    // Option: Keep in Redis with TTL for faster access, let TTL handle cleanup
    return nil
}

func (b *RedisLogBuffer) Delete(ctx context.Context, runID, phase string) error {
    key := fmt.Sprintf("run:logs:%s:%s", runID, phase)
    return b.client.Del(ctx, key).Err()
}
```

#### 1.3 Update Runner to Use Redis Streaming ✅ COMPLETE

**File**: `backend/cmd/runner/main.go`

**Implementation:**
- ✅ Initialized `RedisLogBuffer` service (reuses Redis connection from queue)
- ✅ Updated Plan execution to use `PlanWithOptions()` with Redis callback
- ✅ Updated Apply execution to use `ApplyWithOptions()` with Redis callback
- ✅ Logs streamed to Redis during execution in real-time
- ✅ Logs copied from Redis to MinIO at completion via `CopyToMinIO()`
- ✅ TTL automatically set on Redis keys (handled by `Append()` method)
- ✅ **Backward compatibility**: If Redis unavailable, logs still written to MinIO after completion

**Key Changes:**
```go
// In main() or executeJob function
redisLogBuffer := NewRedisLogBuffer(redisClient) // Reuse existing Redis connection

// During plan execution
planOptions := &terraform.PlanOptions{
    OnOutputLine: func(line string) {
        if err := redisLogBuffer.Append(ctx, run.ID, "plan", line); err != nil {
            log.Printf("Warning: Failed to append log line to Redis: %v", err)
        }
    },
}

planResult, err := plugin.Plan(planCtx, terraformDir, variables, envVars, planOptions)
// ... existing logic ...

// Copy logs from Redis to MinIO at completion
if err := redisLogBuffer.CopyToMinIO(ctx, run.ID, "plan", storageClient); err != nil {
    log.Printf("Warning: Failed to copy plan logs to MinIO: %v", err)
}

// Similar for apply phase
applyOptions := &terraform.ApplyOptions{
    OnOutputLine: func(line string) {
        if err := redisLogBuffer.Append(ctx, run.ID, "apply", line); err != nil {
            log.Printf("Warning: Failed to append log line to Redis: %v", err)
        }
    },
}
```

#### 1.4 Update Logs Endpoint to Check Redis ✅ COMPLETE

**File**: `backend/internal/api/v2/handlers/terraform/runs.go`

**Implementation:**
- ✅ Added `logBufferService` field to `RunHandlerV2` struct
- ✅ Initialized Redis log buffer service in routes (optional, graceful fallback)
- ✅ Endpoint checks Redis first for active runs (logs available during execution)
- ✅ Falls back to MinIO if not in Redis (completed runs or Redis unavailable)
- ✅ Supports offset/limit for both Redis and MinIO sources
- ✅ **Backward compatibility**: Endpoint works identically if Redis unavailable (MinIO only)
- ✅ **TFE compatibility**: Returns 200 OK with empty body when logs don't exist yet

**Key Changes:**
```go
func (h *RunHandlerV2) GetLogs(c *gin.Context) {
    runID := c.Param("id")
    // ... existing run fetch logic ...
    
    // Determine phase
    phase := "plan"
    if run.Operation == models.RunOperationPlanAndApply {
        switch run.Status {
        case models.RunStatusPlanning, models.RunStatusPlanned:
            phase = "plan"
        case models.RunStatusApplying, models.RunStatusApplied:
            phase = "apply"
        }
    }
    
    // Try Redis first (for active runs)
    if h.redisClient != nil {
        redisBuffer := &RedisLogBuffer{client: h.redisClient}
        logs, err := redisBuffer.Get(runID, phase, offset, limit)
        if err == nil && logs != "" {
            c.Data(http.StatusOK, "text/plain", []byte(logs))
            return
        }
    }
    
    // Fall back to MinIO
    // ... existing MinIO logic ...
}
```

### Phase 2: Frontend - Terminal Component

#### 3.1 Create Terminal Output Component ✅ COMPLETE

**File**: `frontend/src/components/runs/TerminalOutput.tsx` (created)

**Implementation:**
- ✅ Terminal-like appearance styled like JSON parser (`bg-muted/10`, monospace font)
- ✅ Auto-scroll to bottom when new content arrives
- ✅ User can scroll up to view history (auto-scroll pauses)
- ✅ Copy to clipboard button (top-right)
- ✅ Scroll to bottom button when user has scrolled up (top-right)
- ✅ Streaming indicator (pulsing cursor when `isStreaming=true`)
- ✅ Line-by-line rendering with proper whitespace handling (`<pre>` tag)
- ✅ Toggle button in plan phase card header to switch between terminal view and spinner view

**Key Implementation:**
```typescript
interface TerminalOutputProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function TerminalOutput({ content, isStreaming, className }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (shouldAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, shouldAutoScroll]);
  
  // Detect user scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setShouldAutoScroll(isAtBottom);
  };
  
  const lines = content.split('\n');
  
  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-[#1e1e1e] text-green-400 font-mono text-sm p-4 rounded-lg overflow-auto max-h-[600px]"
      >
        {lines.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap">
            {line || '\u00A0'} {/* Non-breaking space for empty lines */}
          </div>
        ))}
        {isStreaming && (
          <div className="inline-flex items-center gap-1">
            <span className="animate-pulse">▋</span>
          </div>
        )}
      </div>
      {/* Copy button, scroll to bottom button, etc. */}
    </div>
  );
}
```

#### 3.3 Update RunDetail to Show Terminal During Planning (Optional) ✅ COMPLETE

**File**: `frontend/src/pages/RunDetail.tsx`

**Implementation:**
- ✅ Added `showTerminalDuringPlanning` preference to `RunDisplayPreferencesContext`
- ✅ Default behavior (preference = false):
  - Shows blue spinner during planning (current implementation, unchanged)
  - No terminal view
  - **Fully backward compatible**: Default preference ensures existing behavior
- ✅ Terminal view enabled (preference = true or toggle button):
  - Added `planLogs` state for streaming logs content
  - Polls logs endpoint every 1 second during planning (with offset for incremental updates)
  - Shows `TerminalOutput` component when status is 'planning' and logs are available
  - Clears logs when plan completes or status changes
  - Local state allows toggling terminal view independently of preference (syncs with preference by default)
- ✅ After plan completes (both cases):
  - Transitions to `OutputViewer` when plan completes (unchanged behavior)
  - Shows structured output with resource cards (like current implementation)
  - Resource cards show: + Add, C Replace, etc. (unchanged)
- ✅ **Note**: Apply phase keeps existing resource card implementation (see Phase 3)

#### 3.4 Add Terminal Toggle Button in Plan Phase Card Header ✅ COMPLETE

**Files**: 
- `frontend/src/components/runs/PhaseBox.tsx` - Added `headerActions` prop support
- `frontend/src/components/runs/UnifiedPhaseTimeline.tsx` - Added terminal toggle button
- `frontend/src/pages/RunDetail.tsx` - Passes toggle handler to UnifiedPhaseTimeline

**Implementation:**
- ✅ Terminal icon button added to plan phase card header (only shown when plan is running)
- ✅ Button allows switching between terminal view and spinner view on-the-fly
- ✅ Toggle state managed locally in RunDetail (can override preference)
- ✅ Button positioned before status icon in header, stops event propagation
- ✅ Tooltip indicates current state ("Switch to terminal view" / "Switch to spinner view")

**Key Changes:**
```typescript
const [planLogs, setPlanLogs] = useState<string>('');

// Poll logs during planning
useEffect(() => {
  if (run.status !== 'planning' || planOutput) {
    return;
  }
  
  const interval = setInterval(async () => {
    try {
      const response = await runsApi.getLogs(run.id);
      if (response.data) {
        setPlanLogs(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch plan logs:', err);
    }
  }, 1000); // Poll every 1 second during planning
  
  return () => clearInterval(interval);
}, [run.status, run.id, planOutput]);

// In planPhaseContent:
{(run.status === 'planning' && planLogs) ? (
  <TerminalOutput content={planLogs} isStreaming={true} />
) : (run.status === 'pending' || run.status === 'planning') && !planOutput ? (
  <div className="border rounded-lg p-8 text-center text-muted-foreground">
    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
    <p>{run.status === 'pending' ? 'Waiting to start...' : 'Planning in progress...'}</p>
  </div>
) : planOutput ? (
  <OutputViewer data={planOutput} showJsonViewer={true} title="Terraform Plan" />
) : null}
```

#### 3.3 Update API Client for Logs Endpoint

**File**: `frontend/src/api/client.ts`

**Changes:**
- Add `getLogs()` method if not already present
- Support offset/limit parameters for incremental fetching
- Return raw text content

**Key Implementation:**
```typescript
async getLogs(runId: string, offset?: number, limit?: number): Promise<{ data: string }> {
  const params = new URLSearchParams();
  if (offset !== undefined) params.append('offset', offset.toString());
  if (limit !== undefined) params.append('limit', limit.toString());
  
  const url = `/api/v2/runs/${runId}/logs${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await this.client.get(url, {
    responseType: 'text',
  });
  return { data: response.data };
}
```

## Phase 3: Real-Time Resource Status Updates (Apply Phase)

**Important**: Apply phase keeps the existing resource card list implementation. This phase only adds live status updates (resources update as they complete, not all at once after completion).

### Problem Statement

**Current Implementation Issues:**

1. **Performance Problem**: The current implementation uses a `useMemo` hook that re-parses **all logs from the beginning** every time `cleanedLogs` changes (which happens on every poll during apply, every 1-2 seconds). This causes:
   - **O(n) parsing time on every update** - If logs are 10MB (100,000 lines), it re-parses all 100,000 lines every second
   - **Memory pressure** - Creates new arrays and maps on every render
   - **UI blocking** - Large log files cause noticeable UI lag/stuttering
   - **Unnecessary work** - Re-parses lines that were already parsed in previous updates

2. **User Experience**: Resources only update after the entire apply completes, so users don't see real-time progress

3. **Cancellation**: When a run is cancelled, the UI shows "Loading apply output..." instead of showing which resources were applied before cancellation

### Solution: Incremental Parsing with State Management

**What We'll Fix:**

1. **Incremental Parsing**: Only parse **new lines** since the last parse (using `lastParsedLengthRef` to track position)
   - **Performance**: O(new_lines) instead of O(total_lines) on each update
   - **Example**: With 100,000 total lines and 100 new lines per poll, we parse 100 lines instead of 100,000
   - **Result**: ~1000x faster for large logs, no UI blocking

2. **State Management**: Maintain resources and statuses in React state (not recreated in `useMemo`)
   - **Performance**: React only re-renders when state actually changes (not on every log poll)
   - **Memory**: Reuses existing objects instead of recreating everything

3. **Real-Time Updates**: Resources update immediately as logs stream in (not after completion)
   - **User Experience**: Users see resources turn green/red as they complete
   - **Cancellation**: Shows which resources were applied before cancellation

**Why This Is Better:**

- **Performance**: 
  - Current: Parses 100,000 lines every 1-2 seconds = ~50,000-100,000 lines/second
  - New: Parses ~100 new lines every 1-2 seconds = ~50-100 lines/second
  - **~1000x reduction in parsing work**
  
- **Memory**:
  - Current: Creates new arrays/maps on every render (even if nothing changed)
  - New: Only updates state when resources actually change (React optimizes re-renders)
  
- **User Experience**:
  - Current: Static view until completion, then everything updates at once
  - New: Live updates, resources turn green/red as they complete

### Implementation Plan

#### Step 1: Add State Management Infrastructure ✅ COMPLETE

**File**: `frontend/src/components/runs/ApplyOutputViewer.tsx`

**Changes Made:**
- ✅ Added state variables: `resources`, `resourceStatuses`, `summary`
- ✅ Added refs: `lastParsedLengthRef`, `destroyedResourcesRef`, `summaryLineRef`
- ✅ Added `isCancelled` prop support
- ✅ Added `'cancelled'` status to `AppliedResource` interface
- ✅ Updated `AppliedResourceCard` to handle cancelled status with grey styling

**Current State**: Infrastructure in place, ready for incremental parsing implementation.

#### Step 2: Replace useMemo with Incremental Parsing useEffects

**File**: `frontend/src/components/runs/ApplyOutputViewer.tsx`

**What to Replace:**
- Current: Lines 546-811 (~266 lines) - Single `useMemo` that re-parses all logs
- New: Multiple `useEffect` hooks that parse incrementally

**Implementation Structure:**

1. **Initialization Effect** (runs when `plannedResources` or `isApplying` changes):
   ```typescript
   useEffect(() => {
     // Initialize status map from planned resources
     // Reset parsing state (lastParsedLengthRef, destroyedResourcesRef, etc.)
     // Clear resources and summary state
   }, [plannedResources, isApplying]);
   ```

2. **Incremental Parsing Effect** (runs when `cleanedLogs` changes):
   ```typescript
   useEffect(() => {
     // Detect log reset (shorter than before) - reset state if new run
     // Extract only new lines: cleanedLogs.slice(lastParsedLengthRef.current)
     // Parse only new lines (patterns: Creating, Creation complete, Modifying, etc.)
     // Update state incrementally:
     //   - setResourceStatuses() - update status map
     //   - setResources() - add/update resource objects
     //   - Update destroyedResourcesRef for replace detection
     //   - Update summaryLineRef if summary line found
     // Update lastParsedLengthRef.current = cleanedLogs.length
   }, [cleanedLogs]);
   ```

3. **Summary Recalculation Effect** (runs when `resources` or `summaryLineRef` changes):
   ```typescript
   useEffect(() => {
     // Recalculate summary from resources array and summaryLineRef
     // Handle replace count adjustments (Terraform counts replaces as add+destroy)
     // Update summary state
   }, [resources, summaryLineRef.current]);
   ```

4. **Cancellation Effect** (runs when `isCancelled` changes):
   ```typescript
   useEffect(() => {
     // Mark all 'applying' resources as 'cancelled'
     // Update resourceStatuses state
   }, [isCancelled]);
   ```

5. **Error Handling Effect** (runs when `errorParseResult` changes):
   ```typescript
   useEffect(() => {
     // Mark resources as 'failed' based on errorParseResult
     // Use findMatchingResourceAddress for fuzzy matching
     // Update resourceStatuses state
   }, [errorParseResult, plannedResources]);
   ```

**Key Implementation Details:**

- **Replace Detection**: Use `destroyedResourcesRef` to track destroyed resources. When we see a creation after a destruction (same resource), mark as replace.
- **Log Reset Detection**: If `cleanedLogs.length < lastParsedLengthRef.current`, reset state (new run started).
- **State Updates**: Use functional updates (`setState(prev => ...)`) to ensure we're working with latest state.
- **Pattern Matching**: Same regex patterns as current implementation (Creating, Creation complete, Modifying, etc.).

#### Step 3: Handle Edge Cases

1. **Replace Detection**: 
   - Track destroyed resources in `destroyedResourcesRef`
   - When creation complete found, check if resource was in destroyed set
   - If yes, mark as replace; remove from destroyed set; adjust summary counts

2. **Summary Line Processing**:
   - Store summary line in `summaryLineRef` when found
   - Recalculate summary when resources change (to account for replaces)
   - Adjust counts: Terraform counts replaces as add+destroy, so subtract from both

3. **Backfill Incomplete Resources**:
   - When status map has resources not in resources array, add them
   - Determine action from logs (Creating → create, Destroying → delete, else → update)
   - Only add if not already in resources array

4. **Error Matching**:
   - Use existing `findMatchingResourceAddress` function for fuzzy matching
   - Handles module prefix mismatches (error: `resource.name`, planned: `module.x.resource.name`)

#### Step 4: Update Polling Frequency (Optional Optimization)

**File**: `frontend/src/hooks/useRunPolling.ts` or `frontend/src/pages/RunDetail.tsx`

**Optional Enhancement:**
- Poll logs more frequently during apply (every 500ms-1s instead of 2s)
- This is optional - current 2s polling will work fine with incremental parsing
- More frequent polling = more responsive UI, but more network requests

**Note**: This is a separate optimization that can be done independently. The incremental parsing itself provides the main performance benefit.

### 3.1 Incremental Log Parsing for Resource Events

**File**: `frontend/src/components/runs/ApplyOutputViewer.tsx`

**Current State**: Component already exists and parses complete logs after apply finishes. All resources update at once.

**Goal**: Parse logs incrementally as they stream, updating resource statuses in real-time.

**Terraform Output Patterns to Detect**:
- `resource.address: Creating...` → Set status: `applying`
- `resource.address: Creation complete after Xs [id=...]` → Set status: `completed`, extract ID
- `resource.address: Modifying...` → Set status: `applying`
- `resource.address: Modifications complete after Xs [id=...]` → Set status: `completed`
- `resource.address: Destroying...` → Set status: `applying`
- `resource.address: Destruction complete after Xs` → Set status: `completed`
- `resource.address: Error: ...` → Set status: `failed`, extract error message
- `Error applying plan:` → Parse error and match to resource

**Key Changes**:
```typescript
// Track last parsed log length to only parse new lines
const [lastParsedLength, setLastParsedLength] = useState(0);

// Parse only new log lines incrementally
const parseIncrementalLogs = (logs: string, previousResources: Map<string, AppliedResource>) => {
  const newLines = logs.slice(lastParsedLength).split('\n');
  const updatedResources = new Map(previousResources);
  
  for (const line of newLines) {
    // Pattern: "resource.address: Creating..."
    const creatingMatch = line.match(/^([\w.]+):\s+Creating\.\.\./);
    if (creatingMatch) {
      const address = creatingMatch[1];
      const resource = updatedResources.get(address) || { address, status: 'pending', action: 'create' };
      resource.status = 'applying';
      updatedResources.set(address, resource);
    }
    
    // Pattern: "resource.address: Creation complete after Xs [id=...]"
    const completeMatch = line.match(/^([\w.]+):\s+(Creation|Modifications|Destruction)\s+complete\s+after\s+\d+s(?:\s+\[id=([^\]]+)\])?/);
    if (completeMatch) {
      const address = completeMatch[1];
      const resource = updatedResources.get(address);
      if (resource) {
        resource.status = 'completed';
        if (completeMatch[3]) resource.id = completeMatch[3];
      }
    }
    
    // Pattern: "resource.address: Error: ..."
    const errorMatch = line.match(/^([\w.]+):\s+Error:\s+(.+)/);
    if (errorMatch) {
      const address = errorMatch[1];
      const resource = updatedResources.get(address);
      if (resource) {
        resource.status = 'failed';
        resource.errorMessage = errorMatch[2];
      }
    }
  }
  
  setLastParsedLength(logs.length);
  return updatedResources;
};
```

### 3.2 Update ApplyOutputViewer for Incremental Updates

**File**: `frontend/src/components/runs/ApplyOutputViewer.tsx`

**Changes**:
- Track last parsed log length to only parse new lines on each update
- Maintain resource state map that updates incrementally (not all at once)
- Re-parse logs on each poll (only new lines since last parse)
- Update resource cards immediately when status changes (React will re-render)
- **Keep existing UI**: Resource cards with blue circles (applying), green checkmarks (completed), red X (failed)
- **No terminal view**: Keep the resource card list implementation

### 3.3 Update Polling for Apply Phase

**File**: `frontend/src/hooks/useRunPolling.ts` or `frontend/src/pages/RunDetail.tsx`

**Changes**:
- Poll logs endpoint more frequently during apply (every 500ms-1s instead of 2s)
- Pass incremental logs to `ApplyOutputViewer` on each poll
- Component will parse incrementally and update resource statuses

### 3.4 Cancellation Handling

**Implementation**: When run is cancelled during apply:
1. Parse logs up to the cancellation point (using lastParsedLength)
2. Show resources that completed: `completed` status (green checkmark)
3. Show resources that were applying: `cancelled` status (grey styling with X icon)
   - **Styling**: Grey border (`border-gray-400`), grey background (`bg-gray-400/5`)
   - **Icon**: XCircle icon in grey (`text-gray-400`)
   - **Consistent with cancelled phase styling** (matches PhaseBox cancelled status)
4. Show resources that never started: `pending` status (grey, no icon change)
5. Display cancellation message above resource list
6. **No terminal view**: Keep resource cards, just show cancelled status with grey styling

**Visual Consistency**:
- Cancelled resource cards use the same grey styling as cancelled phases
- XCircle icon matches the cancelled phase indicator
- Distinguishes from `failed` status (red) and `pending` status (grey, no X icon)

**Code Example**:
```typescript
// In AppliedResourceCard component
case 'cancelled':
  return {
    border: 'border-gray-400',
    bg: 'bg-gray-400/5',
    icon: <XCircle className="h-4 w-4 text-gray-400" />,
  };
```

## Testing Strategy

### Backend Tests
1. **Unit Tests**: Test log buffer append/get/flush operations
2. **Integration Tests**: Test streaming output capture from Terraform command
3. **Redis Tests**: Test Redis log buffer operations
4. **API Tests**: Test logs endpoint with offset/limit parameters

### Frontend Tests
1. **Component Tests**: Test TerminalOutput rendering and auto-scroll
2. **Integration Tests**: Test RunDetail polling and transition from terminal to OutputViewer
3. **E2E Tests**: Test full flow from plan start to completion

### Manual Testing
1. Start a plan run and verify logs stream in real-time
2. Verify auto-scroll works and can be disabled
3. Verify transition to OutputViewer after plan completes
4. Test with long-running plans (5+ minutes)
5. Test error scenarios (plan failures, network issues)

## Migration Path

**Note**: Since we're implementing Redis directly (production-ready approach), there's no phased migration. All features are implemented together:

### Implementation Steps
1. **Backend**: Add Redis log buffer service
2. **Backend**: Update Terraform plugin to stream output
3. **Backend**: Update runner to write logs to Redis during execution
4. **Backend**: Update logs endpoint to check Redis first, fall back to MinIO
5. **Backend**: Copy logs from Redis to MinIO at completion
6. **Frontend**: Add terminal component for plan phase (optional, preference toggle)
7. **Frontend**: Update apply phase for live resource status updates

### Future Enhancements
- Add syntax highlighting for Terraform output
- Add filtering/search in terminal
- Add export/download logs
- Add WebSocket support for sub-second updates (optional)

## Performance Considerations

1. **Redis Memory**: Set TTL on Redis keys (24 hours) to prevent unbounded growth
   - Active runs: Logs stored in Redis during execution
   - Completed runs: Logs copied to MinIO, Redis keys expire after 24h
   - Typical log size: 5-10MB per run (30-minute plan/apply)
   - With 50 concurrent runs: ~250-500MB in Redis (acceptable)
2. **Redis Performance**: 
   - `APPEND` is O(1) amortized, very fast (microseconds)
   - `GET` is O(1), suitable for frequent polling
   - Network overhead: Minimal (local Redis, same network)
3. **Polling Frequency**: Balance between real-time feel and server load (1 second is reasonable)
4. **Log Size**: Consider truncation for very large logs (e.g., >10MB) if needed

## Security Considerations

1. **Log Access**: Ensure logs endpoint respects run permissions (user can only see their org's runs)
2. **Redis Keys**: Use namespaced keys to prevent collisions
3. **TTL**: Ensure Redis keys are cleaned up to prevent data leakage

## Summary of Changes

### Plan Phase
- ✅ **Optional terminal view during planning** (preference toggle, default = spinner)
  - Default: Blue spinner (current behavior, unchanged)
  - Optional: Terminal-like live view with streaming logs (power user feature)
- ✅ **After plan completes**: `OutputViewer` shows structured output with resource cards
  - Resource cards display: + Add, C Replace, etc. (like screenshot)
  - Resource cards are part of the structured plan output (same as current implementation)
- ✅ Terminal view useful for long-running plans (gives real-time feedback)

### Apply Phase
- ✅ Keep existing resource card list implementation (no terminal view)
- ✅ Live resource status updates (resources update as they complete, not all at once)
- ✅ Independent resource updates (one error doesn't block others from updating)
- ✅ Better cancellation handling (shows which resources were applied before cancellation)
  - Resources that completed: green checkmark
  - Resources that were applying: grey styling with X icon (consistent with cancelled phase styling)
  - Resources that never started: grey pending status
- ❌ No terminal view (keeps resource cards with blue circles → green/red/grey cancelled)

## Future Enhancements

1. **WebSocket Support**: Replace polling with WebSocket for instant updates (plan phase)
2. **Syntax Highlighting**: Color-code Terraform output in terminal (plan phase)
3. **Search/Filter**: Allow users to search logs or filter by log level (plan phase)
4. **Export**: Download logs as text file
5. **Destroy Phase Streaming**: Extend streaming to destroy phase (terminal view)
6. **Destroy Phase Live Updates**: Extend live resource updates to destroy phase

## Implementation Status Summary

- ✅ **Phase 1: Backend - Redis Streaming** (Complete)
  - Redis log buffer service with full functionality
  - Terraform plugin streaming support (with backward compatibility)
  - Runner integration with Redis streaming
  - API endpoint with Redis-first, MinIO-fallback strategy

- ✅ **Phase 2: Frontend - Terminal Component** (Complete)
  - TerminalOutput component created
  - User preference system extended
  - RunDetail integration with optional terminal view
  - Default behavior unchanged (backward compatible)

- ⏳ **Phase 3: Frontend - Live Resource Updates** (In Progress)
  - ✅ Infrastructure: State management, refs, cancelled status support
  - ⏳ Incremental log parsing implementation (replacing 266-line useMemo)
  - ⏳ Real-time resource status updates
  - ⏳ Cancellation handling with styling
  - **Performance Impact**: ~1000x reduction in parsing work (O(new_lines) vs O(total_lines))

## References

- **Implementation Documentation**: `docs/features/terraform-streaming.md`
- **Ansible streaming implementation**: `backend/cmd/ansible-runner/main.go:1143-1212`
- **Logs endpoint**: `backend/internal/api/v2/handlers/terraform/runs.go:936-1168`
- **Runner execution**: `backend/cmd/runner/main.go:485-565`
- **Terraform plugin**: `backend/internal/plugins/terraform/plugin.go`
- **Redis log buffer**: `backend/internal/services/logbuffer/redis.go`
- **Terminal component**: `frontend/src/components/runs/TerminalOutput.tsx`
- **RunDetail integration**: `frontend/src/pages/RunDetail.tsx`

