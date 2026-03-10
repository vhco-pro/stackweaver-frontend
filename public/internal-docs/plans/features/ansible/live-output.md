<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Live Output Streaming Implementation

## Current State

The current implementation uses the `json` callback plugin which **buffers all output** until the playbook completes. This means users cannot see task progress in real-time.

**Current Flow:**
```
Ansible Start → (wait for completion) → Parse JSON → Store Events → Show to User
```

## Problem

When viewing a running job, users see:
- ✅ Status: "Running" 
- ❌ No task output until job completes
- ❌ No indication of progress
- ❌ Cannot debug failures in real-time

## Solution: JSONL Callback

Switch from `ANSIBLE_STDOUT_CALLBACK=json` to `ANSIBLE_STDOUT_CALLBACK=ansible.posix.jsonl`.

### Key Differences

| Feature | json | jsonl |
|---------|------|-------|
| Output timing | After completion | Per-event (streaming) |
| Memory usage | Buffers all events | Minimal (line-by-line) |
| Format | Single JSON object | JSON Lines (one per line) |
| Parse strategy | `json.Unmarshal` | `bufio.Scanner` |

### JSONL Output Format

Each line is a complete JSON object:

```json
{"__ansible_module_name__":"setup","__ansible_module_args__":{},"invocation":{"module_args":{}},"ansible_facts":{...},"changed":false}
{"task":"Install packages","host":"web1","status":"ok","changed":true}
{"task":"Start service","host":"web1","status":"ok","changed":false}
{"task":"Install packages","host":"web2","status":"failed","msg":"Package not found"}
```

## Implementation Plan

### 1. Update Runner (High Priority)

**File:** `backend/cmd/ansible-runner/main.go`

```go
// Before (line ~680)
cmd.Env = append(cmd.Env, "ANSIBLE_STDOUT_CALLBACK=json")

// After
cmd.Env = append(cmd.Env, "ANSIBLE_STDOUT_CALLBACK=ansible.posix.jsonl")
```

### 2. Stream Processing (High Priority)

Replace `io.ReadAll` with streaming parser:

```go
// Before
stdout, err := io.ReadAll(cmd.Stdout)
// Parse all at once after completion

// After - process line-by-line as events arrive
scanner := bufio.NewScanner(stdoutPipe)
for scanner.Scan() {
    line := scanner.Text()
    
    var event AnsibleEvent
    if err := json.Unmarshal([]byte(line), &event); err != nil {
        continue // Skip non-JSON lines
    }
    
    // Store event immediately
    if err := r.storeEvent(ctx, job.ID, &event); err != nil {
        log.Printf("Failed to store event: %v", err)
    }
    
    // Update job stats if this is a task result
    if event.Task != "" {
        r.updateJobStats(ctx, job.ID, &event)
    }
}
```

### 3. Event Structure

```go
type AnsibleEvent struct {
    Task      string                 `json:"task"`
    Play      string                 `json:"play"`
    Host      string                 `json:"host"`
    Status    string                 `json:"status"`    // ok, failed, changed, skipped, unreachable
    Changed   bool                   `json:"changed"`
    Failed    bool                   `json:"failed"`
    Skipped   bool                   `json:"skipped"`
    Msg       string                 `json:"msg"`
    Stdout    string                 `json:"stdout"`
    Stderr    string                 `json:"stderr"`
    Result    map[string]interface{} `json:"result"`
    StartTime string                 `json:"start"`
    EndTime   string                 `json:"end"`
}
```

### 4. Incremental Stats Update

```go
func (r *Runner) updateJobStats(ctx context.Context, jobID uuid.UUID, event *AnsibleEvent) error {
    update := map[string]interface{}{}
    
    switch {
    case event.Failed:
        update["hosts_failed"] = gorm.Expr("hosts_failed + 1")
    case event.Status == "unreachable":
        update["hosts_unreachable"] = gorm.Expr("hosts_unreachable + 1")
    case event.Skipped:
        update["hosts_skipped"] = gorm.Expr("hosts_skipped + 1")
    case event.Changed:
        update["hosts_changed"] = gorm.Expr("hosts_changed + 1")
    default:
        update["hosts_ok"] = gorm.Expr("hosts_ok + 1")
    }
    
    return r.db.Model(&AnsibleJob{}).Where("id = ?", jobID).Updates(update).Error
}
```

## Frontend Considerations

The frontend already polls for job details every 3 seconds. With streaming events:

**Current behavior:**
- Polls job status → sees "running"
- Polls events → empty until completion
- Job completes → events suddenly appear

**After implementation:**
- Polls job status → sees "running"
- Polls events → sees tasks completing in real-time
- Stats update incrementally

### No Frontend Changes Required

The existing polling mechanism will work seamlessly. Events will appear in the database as they happen, and the next poll will fetch them.

### Optional Enhancement: WebSocket

For sub-second updates, consider adding WebSocket support:

```
Client ──WebSocket── API ──Redis Pub/Sub── Runner
                            │
                            ├── job:{id}:events channel
                            └── job:{id}:status channel
```

This is a **future enhancement**, not required for initial streaming support.

## Testing Strategy

### 1. Unit Test Event Parsing

```go
func TestParseJSONLEvent(t *testing.T) {
    lines := []string{
        `{"task":"Gather facts","host":"web1","status":"ok","changed":false}`,
        `{"task":"Install nginx","host":"web1","status":"changed","changed":true}`,
        `{"task":"Install nginx","host":"web2","status":"failed","msg":"Package not found"}`,
    }
    
    for _, line := range lines {
        var event AnsibleEvent
        err := json.Unmarshal([]byte(line), &event)
        assert.NoError(t, err)
        assert.NotEmpty(t, event.Task)
    }
}
```

### 2. Integration Test

```go
func TestLiveEventStreaming(t *testing.T) {
    // Launch a slow playbook (with pauses)
    job := launchJob(t, "test-slow-playbook.yml")
    
    // Poll for events while job is running
    time.Sleep(2 * time.Second)
    events := getJobEvents(t, job.ID)
    
    // Should see some events even though job not complete
    assert.Greater(t, len(events), 0)
    assert.Equal(t, "running", job.Status)
}
```

### 3. Manual Test Playbook

```yaml
# test-slow.yml - for testing live streaming
- hosts: localhost
  gather_facts: no
  tasks:
    - name: Task 1
      debug:
        msg: "Starting"
    
    - name: Pause for visibility
      pause:
        seconds: 5
    
    - name: Task 2
      debug:
        msg: "Continuing"
    
    - name: Another pause
      pause:
        seconds: 5
    
    - name: Task 3 - intentional failure
      command: /bin/false
      ignore_errors: yes
    
    - name: Final task
      debug:
        msg: "Complete"
```

## Migration Steps

1. **Update callback environment variable** in runner
2. **Replace io.ReadAll with streaming parser**
3. **Add event storage in loop**
4. **Test with slow playbook**
5. **Verify frontend shows live updates**
6. **Deploy and monitor**

## Performance Impact

| Metric | Before (json) | After (jsonl) |
|--------|--------------|---------------|
| Memory (100 hosts) | ~50MB buffered | ~1MB streaming |
| First event visible | After completion | ~1 second |
| Database writes | 1 batch | N events |
| User experience | Blind until done | Live progress |

## Rollback Plan

If issues arise, simply revert the environment variable:

```go
cmd.Env = append(cmd.Env, "ANSIBLE_STDOUT_CALLBACK=json")
```

The rest of the code can remain - the JSON callback output is still parseable, just arrives all at once.
