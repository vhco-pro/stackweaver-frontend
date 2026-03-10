<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Job Output: AWX vs StackWeaver Comparison

## Executive Summary

This document analyzes the differences between AWX's job output display and StackWeaver's current implementation, and proposes enhancements to provide a more familiar experience for AWX users while maintaining our structured parsing benefits.

## Current StackWeaver Implementation

### Backend (`backend/cmd/ansible-runner/main.go`)

**Current Approach:**
- Uses `ANSIBLE_STDOUT_CALLBACK=ansible.posix.jsonl` (JSONL format)
- Streams JSONL events line-by-line as they occur
- Stores each event in database with `Stdout` field containing the raw JSONL line
- `GetJobOutput()` (in `backend/internal/services/ansible/job.go:374-388`) concatenates all `Stdout` fields from events

**Key Code:**
```go
// Line 1116: JSONL callback is set
cmd.Env = append(cmd.Env, "ANSIBLE_STDOUT_CALLBACK=ansible.posix.jsonl")

// Lines 1167-1191: Events are parsed and stored
// The raw JSONL line is stored in event.Stdout for output display
```

### Frontend (`frontend/src/pages/Ansible/JobDetail.tsx`)

**Current Display:**
- Receives `output` field which is concatenated JSONL (one JSON object per line)
- Parses JSONL and displays structured view:
  - **Output Tab**: Shows formatted JSON objects (pretty-printed)
  - **Events Tab**: Shows structured task/host breakdown with status indicators
  - **Details Tab**: Shows job metadata
  - **Host Facts Tab**: Shows system information per host

**Key Code:**
```typescript
// Lines 611-647: Parses JSONL output
const parsedOutput = useMemo(() => {
  // Tries to parse each line as JSON
  // Formats JSON nicely, shows plain text lines separately
}, [output]);
```

## AWX Output Display

### What AWX Shows

Based on AWX documentation and user expectations:

1. **Standard Out (Stdout) Tab** - Main output view:
   - Human-readable terminal output (like running `ansible-playbook` locally)
   - Includes colors, formatting, progress indicators
   - Shows plays, tasks, host results in classic Ansible format
   - Example format:
     ```
     PLAY [web servers] **********************************************************
     
     TASK [Gathering Facts] ******************************************************
     ok: [web1]
     ok: [web2]
     
     TASK [Install packages] ****************************************************
     changed: [web1]
     ok: [web2]
     ```

2. **Details Tab**: Job metadata (similar to StackWeaver)

3. **Event Summary**: Host status breakdown (similar to StackWeaver's Events tab)

4. **Host Events/JSON Tab**: Detailed per-host events and JSON structure

### Key Differences

| Feature | AWX | StackWeaver (Current) |
|---------|-----|----------------------|
| **Primary Output View** | Terminal-style (human-readable) | JSONL (structured but not terminal-like) |
| **Format** | Classic Ansible output with colors | JSON objects (pretty-printed) |
| **User Familiarity** | Matches `ansible-playbook` CLI | Requires understanding JSON structure |
| **Structured Parsing** | Limited (relies on text parsing) | Excellent (structured events) |
| **Terminal Output Available** | ✅ Yes (default view) | ❌ No (only JSONL) |

## Terraform Workspace Output (Reference Implementation)

StackWeaver already implements a dual-view approach for Terraform:

### Implementation (`frontend/src/components/runs/ApplyOutputViewer.tsx`)

**Features:**
- **Terminal View** (default): Shows raw terminal output with ANSI codes stripped
- **JSON View**: Shows structured JSON output
- Toggle between views with tabs
- Terminal view loads faster (default for apply phase)
- Both views available simultaneously

**Key Code:**
```typescript
// Lines 284-299: UI state management for view toggle
const [rawOutputView, setRawOutputView] = useState<'json' | 'terminal'>('terminal');

// Lines 368-372: ANSI code stripping for terminal view
const cleanedLogs = useMemo(() => {
  return logs.replace(/\x1b\[[0-9;]*m/g, '');
}, [logs]);
```

## Proposed Solution

### Option 1: Reconstruct Terminal Output from JSONL Events (Recommended)

**Approach:**
- Keep current JSONL parsing for structured views
- Reconstruct terminal-style output from JSONL events
- Display both views with tabs (similar to Terraform)

**Pros:**
- ✅ No need to run Ansible twice
- ✅ Maintains structured parsing benefits
- ✅ Provides familiar terminal output
- ✅ Similar to Terraform implementation pattern

**Cons:**
- ⚠️ Requires reconstruction logic (moderate complexity)
- ⚠️ May not match exact AWX formatting (but close enough)

**Implementation:**
1. Create `ReconstructTerminalOutput()` function in backend
2. Convert JSONL events to terminal-style format
3. Store in new `terminal_output` field or compute on-demand
4. Add terminal/JSON toggle in frontend (like Terraform)

### Option 2: Capture Both Outputs Simultaneously

**Approach:**
- Run Ansible with default callback (terminal output)
- Also capture JSONL via tee or dual streams
- Store both outputs

**Pros:**
- ✅ Exact terminal output match
- ✅ No reconstruction needed

**Cons:**
- ❌ More complex execution (dual streams)
- ❌ Potential performance impact
- ❌ Storage overhead (storing duplicate data)

### Option 3: User Preference Toggle

**Approach:**
- Add job template setting: "Output Format" (Terminal/JSONL)
- Run with appropriate callback based on preference
- Store only selected format

**Pros:**
- ✅ Simple implementation
- ✅ User choice

**Cons:**
- ❌ Can't show both views
- ❌ Requires re-running to see other format
- ❌ Doesn't solve the user's concern (they want both)

## Recommended Implementation Plan

### Phase 1: Terminal Output Reconstruction (Backend)

**File:** `backend/internal/services/ansible/job.go`

Add function to reconstruct terminal output from events:

```go
// ReconstructTerminalOutput converts JSONL events to terminal-style output
func (s *JobService) ReconstructTerminalOutput(jobID uuid.UUID) (string, error) {
    events, _, err := s.jobRepo.ListEventsByJob(jobID, 10000, 0)
    if err != nil {
        return "", fmt.Errorf("failed to get job events: %w", err)
    }

    var output strings.Builder
    
    // Group events by play/task
    // Reconstruct classic Ansible output format
    // Example:
    // PLAY [play name] **************************************************
    // TASK [task name] **************************************************
    // ok: [host1]
    // changed: [host2]
    
    return output.String(), nil
}
```

### Phase 2: API Endpoint for Terminal Output

**File:** `backend/internal/api/v2/handlers/ansible/jobs.go`

Add endpoint:
```go
// GET /api/v2/ansible/jobs/:id/output/terminal
func (h *JobHandler) GetTerminalOutput(c *gin.Context) {
    // Return reconstructed terminal output
}
```

### Phase 3: Frontend Toggle (Similar to Terraform)

**File:** `frontend/src/pages/Ansible/JobDetail.tsx`

Add tabs to Output section:
- **Terminal** tab: Shows reconstructed terminal output
- **JSON** tab: Shows current JSONL output (formatted)
- **Structured** tab: Shows current Events view (keep as-is)

**Reference:** See `frontend/src/components/runs/ApplyOutputViewer.tsx:284-319` for toggle pattern

### Phase 4: Enhancement - Color Support

If terminal output reconstruction includes ANSI color codes, preserve them in terminal view (with option to strip for plain text).

## Comparison with Terraform Implementation

| Feature | Terraform | Proposed Ansible |
|---------|-----------|------------------|
| **Dual View** | ✅ Terminal + JSON | ✅ Terminal + JSON |
| **Default View** | Terminal (faster) | Terminal (familiar) |
| **Storage** | Both stored | Terminal reconstructed |
| **Performance** | Fast (pre-stored) | Moderate (on-demand) |
| **User Benefit** | Familiar CLI output | Familiar AWX output |

## User Feedback Context

The AWX user's concern:
> "The output of the run is very different from an actual `ansible playbook run`"

**Root Cause:**
- StackWeaver shows JSONL (structured but not terminal-like)
- AWX shows terminal output (human-readable, familiar)

**Solution:**
- Add terminal output view alongside JSON view
- Match Terraform's dual-view pattern
- Provide familiar experience while keeping structured parsing

## Next Steps

1. **Investigate**: Review AWX's exact terminal output format
2. **Prototype**: Implement `ReconstructTerminalOutput()` function
3. **Test**: Compare reconstructed output with actual `ansible-playbook` output
4. **Implement**: Add frontend toggle (similar to Terraform)
5. **Document**: Update user-facing docs with new output view options

## References

- **Current Implementation**: 
  - Backend: `backend/cmd/ansible-runner/main.go:1116-1191`
  - Frontend: `frontend/src/pages/Ansible/JobDetail.tsx:611-647`
- **Terraform Reference**: `frontend/src/components/runs/ApplyOutputViewer.tsx:280-372`
- **AWX Documentation**: https://docs.ansible.com/projects/awx/en/24.6.1/userguide/jobs.html
