<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Terminal Output Implementation Plan

**Status:** ❌ Not implemented — no terminal output reconstruction from JSONL events exists yet. Jobs still display raw JSONL format.

## Overview

Add terminal-style output view for Ansible jobs to match AWX's familiar display format, while maintaining our structured JSONL parsing benefits. This will provide a dual-view approach similar to how Terraform workspaces handle output.

## Problem Statement

Current StackWeaver Ansible job output shows JSONL format (structured but not terminal-like), which is unfamiliar to AWX users who expect the classic `ansible-playbook` terminal output format.

**User Feedback:**
> "The output of the run is very different from an actual `ansible playbook run`"

## Solution: Reconstruct Terminal Output from JSONL Events

**Approach:** Reconstruct terminal-style output from existing JSONL events (no need to run Ansible twice).

**Benefits:**
- ✅ No performance impact (no dual execution)
- ✅ Maintains structured parsing benefits
- ✅ Provides familiar AWX-like terminal output
- ✅ Similar pattern to Terraform implementation

## Implementation Phases

### Phase 1: Backend - Terminal Output Reconstruction

**File:** `backend/internal/services/ansible/job.go`

**Task:** Add `ReconstructTerminalOutput()` function

**Function Signature:**
```go
func (s *JobService) ReconstructTerminalOutput(jobID uuid.UUID) (string, error)
```

**Implementation Details:**
1. Retrieve all job events (same as `GetJobOutput`)
2. Group events by play → task → host
3. Reconstruct classic Ansible output format:
   ```
   PLAY [play name] **************************************************
   
   TASK [Gathering Facts] ********************************************
   ok: [host1]
   changed: [host2]
   failed: [host3]
   
   TASK [task name] **************************************************
   ok: [host1]
   changed: [host2]
   ```
4. Handle different event types:
   - `playbook_on_play_start` → `PLAY [name]`
   - `playbook_on_task_start` → `TASK [name]`
   - `runner_on_ok` → `ok: [host]`
   - `runner_on_changed` → `changed: [host]`
   - `runner_on_failed` → `failed: [host]`
   - `runner_on_unreachable` → `unreachable: [host]`
   - `runner_on_skipped` → `skipped: [host]`
5. Include stdout/stderr from events where available
6. Preserve ANSI color codes if present (optional enhancement)

**Reference:** See `GetJobOutput()` at `backend/internal/services/ansible/job.go:374-388` for event retrieval pattern.

### Phase 2: Backend - API Endpoint

**File:** `backend/internal/api/v2/handlers/ansible/jobs.go`

**Task:** Add new endpoint for terminal output

**Endpoint:**
```go
// GET /api/v2/ansible/jobs/:id/output/terminal
func (h *JobHandler) GetTerminalOutput(c *gin.Context)
```

**Implementation:**
1. Parse job ID from URL parameter
2. Call `jobService.ReconstructTerminalOutput(jobID)`
3. Return terminal output as plain text
4. Handle errors appropriately

**Reference:** See `GetOutput()` at `backend/internal/api/v2/handlers/ansible/jobs.go:644-671` for similar pattern.

### Phase 3: Frontend - API Client

**File:** `frontend/src/api/ansible.ts`

**Task:** Add function to fetch terminal output

**Function:**
```typescript
export const ansibleJobsApi = {
  // ... existing functions
  getTerminalOutput: (jobId: string): Promise<string> => {
    return apiClient.get(`/ansible/jobs/${jobId}/output/terminal`)
      .then(res => res.data);
  },
};
```

### Phase 4: Frontend - UI Toggle (Similar to Terraform)

**File:** `frontend/src/pages/Ansible/JobDetail.tsx`

**Task:** Add terminal/JSON toggle in Output tab

**Implementation:**
1. Add state for view toggle: `'terminal' | 'json' | 'structured'`
2. Add tabs or buttons to switch between views:
   - **Terminal** tab: Shows reconstructed terminal output (new)
   - **JSON** tab: Shows current JSONL output (formatted)
   - **Structured** tab: Shows current Events view (keep as-is)
3. Fetch terminal output on-demand when Terminal tab is selected
4. Cache terminal output in component state to avoid re-fetching
5. Strip ANSI codes for clean display (or preserve with syntax highlighting)

**Reference:** See `frontend/src/components/runs/ApplyOutputViewer.tsx:284-319` for toggle pattern:
- Lines 284-299: UI state management
- Lines 301-303: State initialization
- Lines 309-319: Persist to localStorage

**UI Pattern:**
```typescript
const [outputView, setOutputView] = useState<'terminal' | 'json' | 'structured'>('structured');
const [terminalOutput, setTerminalOutput] = useState<string | null>(null);

// Fetch terminal output when tab is selected
useEffect(() => {
  if (outputView === 'terminal' && !terminalOutput) {
    void ansibleJobsApi.getTerminalOutput(job.id)
      .then(output => setTerminalOutput(output))
      .catch(err => console.error('Failed to fetch terminal output:', err));
  }
}, [outputView, terminalOutput, job.id]);
```

### Phase 5: Enhancement - ANSI Color Support (Optional)

**Task:** Preserve ANSI color codes in terminal view

**Implementation:**
1. Check if terminal output contains ANSI codes
2. Use a library like `react-ansi` or similar to render colored output
3. Provide toggle to strip colors for plain text view

**Reference:** See `frontend/src/components/runs/ApplyOutputViewer.tsx:368-372` for ANSI stripping pattern.

## Testing Plan

### Backend Tests

1. **Unit Test:** `ReconstructTerminalOutput()`
   - Test with sample JSONL events
   - Verify output format matches expected terminal style
   - Test edge cases (empty events, missing fields)

2. **Integration Test:** API endpoint
   - Test `/api/v2/ansible/jobs/:id/output/terminal`
   - Verify response format and status codes
   - Test error handling (invalid job ID, missing events)

### Frontend Tests

1. **Component Test:** Output view toggle
   - Test tab switching
   - Test terminal output fetching
   - Test caching behavior

2. **E2E Test:** Full flow
   - Run Ansible job
   - View terminal output
   - Compare with actual `ansible-playbook` output

## Performance Considerations

- **Terminal output reconstruction:** On-demand computation (acceptable for viewing)
- **Caching:** Frontend caches terminal output in component state
- **Event limit:** Use same limit as `GetJobOutput()` (10,000 events)
- **Large outputs:** Consider pagination or streaming for very large jobs

## Success Criteria

- [ ] Terminal output view displays classic Ansible format
- [ ] Toggle between Terminal/JSON/Structured views works smoothly
- [ ] Output format is recognizable to AWX users
- [ ] Performance is acceptable (no noticeable lag)
- [ ] Structured parsing benefits are maintained
- [ ] Documentation updated

## References

- **Analysis Document:** `docs/ansible/output-comparison-analysis.md`
- **Current Implementation:**
  - Backend: `backend/cmd/ansible-runner/main.go:1116-1191`
  - Frontend: `frontend/src/pages/Ansible/JobDetail.tsx:611-647`
- **Terraform Reference:** `frontend/src/components/runs/ApplyOutputViewer.tsx:280-372`
- **AWX Documentation:** https://docs.ansible.com/projects/awx/en/24.6.1/userguide/jobs.html

## Future Enhancements

- [ ] ANSI color code preservation and rendering
- [ ] Download terminal output as text file
- [ ] Search/filter within terminal output
- [ ] Real-time terminal output streaming (if needed)
