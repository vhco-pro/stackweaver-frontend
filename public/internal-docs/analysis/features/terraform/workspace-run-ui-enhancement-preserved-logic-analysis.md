<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Preserved Logic Analysis - Terraform Run Detail UI

## Current Implementation Analysis

This document captures all the core logic that must be preserved when implementing the new unified timeline UI design.

## Run Types and Status Flow

### Run Operations (from `backend/internal/models/run.go`)
1. **`plan-only`**: Speculative plan, cannot be applied
2. **`plan-and-apply`**: Single run that goes through both phases
3. **`destroy`**: Destroy run (tear down infrastructure)

**Note**: Legacy `plan` and `apply` operations exist in the codebase but are not used for new runs. We focus on the three current run types above.

### Status Transitions

**Plan-and-Apply Runs**:
- `pending` → `planning` → `planned` → `applying` → `applied`
- Same run instance transitions through all statuses

**Plan-Only Runs**:
- `pending` → `planning` → `planned` (final state)
- Cannot transition to applying

**Destroy Runs**:
- `pending` → `running`/`applying` → `completed`
- Uses `running` or `applying` status during execution

## Critical Logic to Preserve

### 1. Real-Time Polling (`useRunPolling` hook)
**Location**: `frontend/src/pages/RunDetail.tsx:73-99`

**Current Behavior**:
- Polls every 2 seconds
- Updates `run`, `planOutput`, and `runLogs` automatically
- Calls `onStatusChange` callback when status changes
- Shows toast notifications on status changes

**Must Preserve**:
- Same polling mechanism
- Same data structure (`run`, `planOutput`, `runLogs`)
- Same callback behavior

### 2. Status Badge Logic (`getStatusBadge` function)
**Location**: `frontend/src/pages/RunDetail.tsx:256-332`

**Current Behavior**:
- Special handling for plan-and-apply runs: shows "Applying" when `isApplyStarting` or status is 'applying'
- Plan-only runs: shows "Finished" when status is 'planned'
- Standard status variants for all other statuses (pending, planning, planned, applying, applied, failed, canceled)

**Must Preserve**:
- All status badge logic
- Special cases for different run types
- Optimistic update handling (`isApplyStarting`)

### 3. Permission-Based Actions
**Location**: `frontend/src/pages/RunDetail.tsx:373-386`

**Current Behavior**:
- `canApply`: Based on `run.permissions?.['can-apply']` (backend is source of truth)
  - For plan-and-apply: true when plan phase completed (status="planned")
  - For plan-only: always false
  - For destroy: not applicable
- `canDiscard`: Only for plan-and-apply runs
  - Must be in "planned" or "completed" status
  - Must have no error message
  - Must have `can-apply` permission still true

**Must Preserve**:
- Permission checks
- Backend as source of truth for `can-apply`
- Discard button visibility logic

### 4. Apply Action Handling
**Location**: `frontend/src/pages/RunDetail.tsx:393-441`

**Current Behavior**:
- Sets `isApplyStarting` flag for optimistic UI update
- For plan-and-apply runs: Same run transitions to "applying" status
- Auto-scrolls to apply phase when it starts
- Clears `isApplyStarting` when status updates to 'applying'

**Must Preserve**:
- Optimistic update flag (`isApplyStarting`)
- Different behavior for plan-and-apply vs legacy runs
- Auto-scroll behavior
- Error handling

### 5. Auto-Scroll Logic
**Location**: `frontend/src/pages/RunDetail.tsx:198-232`

**Current Behavior**:
- Auto-scrolls to action buttons when plan completes (plan-and-apply runs)
- Auto-scrolls to apply phase when it starts (status changes from 'planned' to 'applying')
- Uses refs: `actionButtonsRef`, `applyPhaseRef`

**Must Preserve**:
- Auto-scroll triggers
- Ref-based scrolling
- Timing delays for DOM updates

### 6. Warnings Banner (Plan-Only Runs)
**Location**: `frontend/src/pages/RunDetail.tsx:716-755`

**Current Behavior**:
- Only shown for plan-only runs
- Parses warnings from plan JSON output (diagnostics array)
- Parses warnings from logs as fallback
- Collapsible banner with warning/deprecation distinction
- Default expanded (`showWarnings` state)

**Must Preserve**:
- Warning parsing logic (`parseWarningsFromPlan`, `parseWarningsFromLogs`)
- Banner visibility (only for plan-only)
- Collapsible behavior

### 7. Phase Display Logic

#### Plan-and-Apply Runs (`run.operation === 'plan-and-apply'`)
**Location**: `frontend/src/pages/RunDetail.tsx:610-712`

**Current Behavior**:
- Always shows Plan Phase section
- Plan Phase:
  - Default expanded when: `pending`, `planning`, or `planned`
  - Not collapsible when: `pending` or `planning`
  - Shows loading spinner when pending/planning and no planOutput
  - Shows OutputViewer when planOutput exists
- Action buttons shown between phases when `canApply && status === 'planned'`
- Apply Phase:
  - Only shown when: `applying`, `applied`, `completed`, or `isApplyStarting`
  - Default expanded when: `applying`, `applied`, `completed`, or `isApplyStarting`
  - Always collapsible
  - Shows ApplyOutputViewer with planOutput and logs

**Must Preserve**:
- Conditional rendering based on status
- Default expansion logic
- Collapsible behavior
- Loading states
- Action button placement

#### Plan-Only Runs (`run.operation === 'plan-only'`)
**Location**: `frontend/src/pages/RunDetail.tsx:713-781`

**Current Behavior**:
- Shows warnings banner (if warnings exist)
- Shows Plan Phase section:
  - Default expanded when: `pending`, `planning`, `planned`, or `completed`
  - Not collapsible when: `pending` or `planning`
  - Shows loading spinner when pending/planning and no planOutput
  - Shows OutputViewer when planOutput exists

**Must Preserve**:
- Warnings banner
- Single phase display
- Expansion/collapse logic

#### Destroy Runs (else case)
**Location**: `frontend/src/pages/RunDetail.tsx:782-809`

**Current Behavior**:
- Shows single section: "Destroy Phase"
- Default expanded when: `running` or `applying`
- Not collapsible when: `running` or `applying`
- Shows ApplyOutputViewer with logs
- Title: "Destroy Phase"

**Must Preserve**:
- Single phase display
- Title logic
- Expansion/collapse logic

### 8. Error Message Display
**Location**: `frontend/src/pages/RunDetail.tsx:596-607`

**Current Behavior**:
- Always shown at top of content area if `run.error_message` exists
- Red border, red background tint
- Shows error icon and message

**Must Preserve**:
- Error display location and styling
- Conditional rendering

### 9. Cancel Action
**Location**: `frontend/src/pages/RunDetail.tsx:234-254`

**Current Behavior**:
- Only enabled when: `pending`, `planning`, `applying`, or `running`
- Calls `runsApi.cancel(id)`
- Refetches run after cancellation

**Must Preserve**:
- Cancel button visibility logic
- Cancel action behavior
- Refetch after cancel

### 10. Discard Action
**Location**: `frontend/src/pages/RunDetail.tsx:443-466`

**Current Behavior**:
- Only enabled when `canDiscard` is true
- Calls `runsApi.discard(id)`
- Refetches run after discard
- Shows success toast

**Must Preserve**:
- Discard button visibility (already covered in `canDiscard` logic)
- Discard action behavior
- Refetch after discard

## Data Flow

### Current Data Flow
```
RunDetail.tsx
  ├─ useRunPolling hook
  │   ├─ Polls run data every 2 seconds
  │   ├─ Updates: run, planOutput, runLogs
  │   └─ Triggers callbacks on status change
  │
  ├─ Status-based rendering (based on run.operation)
  │   ├─ plan-and-apply: Shows Plan Phase → Apply Phase
  │   ├─ plan-only: Shows Plan Phase only
  │   └─ destroy: Shows Destroy Phase only
  │
  ├─ CollapsibleSection components
  │   ├─ Plan Phase (for plan-only and plan-and-apply)
  │   ├─ Apply Phase (for plan-and-apply only)
  │   └─ Destroy Phase (for destroy runs)
  │
  └─ Action handlers
      ├─ handleApply (with optimistic updates, only for plan-and-apply)
      ├─ handleDiscard (only for plan-and-apply)
      └─ handleCancel (all run types)
```

### New Data Flow (Must Maintain Same Logic)
```
RunDetail.tsx
  ├─ useRunPolling hook (UNCHANGED)
  │   ├─ Polls run data every 2 seconds
  │   ├─ Updates: run, planOutput, runLogs
  │   └─ Triggers callbacks on status change
  │
  ├─ Status-based rendering (UNCHANGED - based on run.operation)
  │   ├─ plan-and-apply: Shows Plan Phase → Apply Phase
  │   ├─ plan-only: Shows Plan Phase only
  │   └─ destroy: Shows Destroy Phase only
  │
  ├─ UnifiedPhaseTimeline component (NEW)
  │   ├─ CreatedNode (NEW)
  │   ├─ PhaseBox (Plan Phase) - replaces CollapsibleSection
  │   │   ├─ Status transitions (blue → green/red)
  │   │   ├─ Title changes ("Plan Phase" → "Plan Finished")
  │   │   └─ Same content: OutputViewer
  │   ├─ Action buttons (within Plan Phase box when completed, UNCHANGED logic)
  │   ├─ PhaseBox (Apply Phase) - replaces CollapsibleSection (plan-and-apply only)
  │   │   ├─ Status transitions (blue → green/red)
  │   │   ├─ Title changes ("Apply Phase" → "Applied")
  │   │   └─ Same content: ApplyOutputViewer
  │   └─ PhaseBox (Destroy Phase) - replaces CollapsibleSection (destroy only)
  │       ├─ Status transitions (blue → green/red)
  │       └─ Same content: ApplyOutputViewer
  │
  └─ Action handlers (UNCHANGED)
      ├─ handleApply (with optimistic updates, only for plan-and-apply)
      ├─ handleDiscard (only for plan-and-apply)
      └─ handleCancel (all run types)
```

## Component Mapping

### Current → New Component Mapping

| Current Component | New Component | Changes |
|------------------|---------------|---------|
| `VerticalRunTimeline` (sidebar) | `CreatedNode` + connection lines | Timeline integrated into boxes |
| `CollapsibleSection` (Plan Phase) | `PhaseBox` (Plan Phase) | Adds status-based border/icon, same content |
| `CollapsibleSection` (Apply Phase) | `PhaseBox` (Apply Phase) | Adds status-based border/icon, same content |
| `CollapsibleSection` (Destroy Phase) | `PhaseBox` (Destroy Phase) | Adds status-based border/icon, same content |
| Action buttons (between sections) | Action buttons (between phase boxes) | Same logic, different placement |

## Status Determination Logic

### Plan Phase Status
```typescript
// Current logic (implicit in CollapsibleSection rendering)
// Must be explicit in PhaseBox status prop

const getPlanPhaseStatus = (run: Run): 'pending' | 'running' | 'completed' | 'failed' => {
  if (run.status === 'planning') return 'running';
  if (run.status === 'planned' || run.status === 'applying' || run.status === 'applied' || run.status === 'completed') return 'completed';
  if (run.status === 'failed' && (run.operation === 'plan-only' || run.operation === 'plan-and-apply' || run.operation === 'plan')) return 'failed';
  return 'pending';
};

const getPlanPhaseTitle = (run: Run): string => {
  if (run.status === 'planned' || run.status === 'applying' || run.status === 'applied' || run.status === 'completed') {
    return 'Plan Finished';
  }
  return 'Plan Phase';
};
```

### Apply Phase Status
```typescript
const getApplyPhaseStatus = (run: Run): 'pending' | 'running' | 'completed' | 'failed' => {
  if (run.status === 'applying') return 'running';
  if (run.status === 'applied' || run.status === 'completed') return 'completed';
  if (run.status === 'failed' && run.operation === 'plan-and-apply') return 'failed';
  return 'pending';
};

const getApplyPhaseTitle = (run: Run): string => {
  if (run.status === 'applied' || run.status === 'completed') {
    return 'Applied';
  }
  return 'Apply Phase';
};
```

### Destroy Phase Status
```typescript
const getDestroyPhaseStatus = (run: Run): 'pending' | 'running' | 'completed' | 'failed' => {
  if (run.status === 'running' || run.status === 'applying') return 'running';
  if (run.status === 'completed') return 'completed';
  if (run.status === 'failed' && run.operation === 'destroy') return 'failed';
  return 'pending';
};

const getDestroyPhaseTitle = (run: Run): string => {
  if (run.status === 'completed') {
    return 'Destroyed';
  }
  return 'Destroy Phase';
};
```

## Default Expansion Logic

### Current Logic (from CollapsibleSection defaultExpanded prop)

**Plan Phase (plan-and-apply)**:
- `defaultExpanded={run.status === 'pending' || run.status === 'planning' || run.status === 'planned'}`

**Plan Phase (plan-only)**:
- `defaultExpanded={run.status === 'pending' || run.status === 'planning' || run.status === 'planned' || run.status === 'completed'}`

**Apply Phase**:
- `defaultExpanded={run.status === 'applying' || run.status === 'applied' || run.status === 'completed' || isApplyStarting}`

**Destroy Phase**:
- `defaultExpanded={run.status === 'running' || run.status === 'applying'}`

**Must Preserve**: Same default expansion logic in PhaseBox components

## Collapsible Behavior

### Current Logic (from CollapsibleSection collapsible prop)

**Plan Phase (plan-and-apply runs)**:
- `collapsible={run.status !== 'pending' && run.status !== 'planning'}`

**Plan Phase (plan-only runs)**:
- `collapsible={run.status !== 'pending' && run.status !== 'planning'}`

**Apply Phase (plan-and-apply runs only)**:
- `collapsible={true}` (always collapsible)

**Destroy Phase (destroy runs only)**:
- `collapsible={run.status !== 'running' && run.status !== 'applying'}`

**Must Preserve**: Same collapsible logic in PhaseBox components

## Action Button Placement

### Current Logic
- Action buttons appear between Plan Phase and Apply Phase sections
- Only shown when `canApply && run.status === 'planned'`
- Uses `actionButtonsRef` for auto-scrolling

### New Placement
- Action buttons should appear within Plan Phase box when it's completed
- Or between Plan Phase box and Apply Phase box (if Apply Phase is visible)
- Same visibility logic: `canApply && run.status === 'planned'`

## Error Handling

### Current Behavior
- Error message shown at top of content area
- Red border, red background
- Always visible if `run.error_message` exists

### New Behavior
- Error message should still be shown at top
- Or could be shown within the failed phase box
- Must preserve error visibility

## Testing Checklist

When implementing the new UI, verify:

- [ ] Real-time polling still works (status updates every 2 seconds)
- [ ] Status badges show correct values for all run types
- [ ] Apply button only shows when `can-apply` is true
- [ ] Discard button only shows when `can-discard` is true
- [ ] Auto-scroll to action buttons when plan completes
- [ ] Auto-scroll to apply phase when it starts
- [ ] Warnings banner shows for plan-only runs
- [ ] Plan Phase expands/collapses correctly
- [ ] Apply Phase expands/collapses correctly
- [ ] Destroy Phase expands/collapses correctly
- [ ] Optimistic updates work (`isApplyStarting` flag)
- [ ] Error messages display correctly
- [ ] Cancel action works
- [ ] Discard action works
- [ ] Apply action works (plan-and-apply runs only - same run transitions to applying status)
- [ ] Phase status transitions correctly (blue → green/red)
- [ ] Phase titles update correctly
- [ ] Connection lines show correct colors
- [ ] Created node displays correctly

## Migration Strategy

1. **Phase 1**: Create new components alongside existing ones
   - Create `PhaseBox`, `CreatedNode`, `PhaseConnectionLine`, `UnifiedPhaseTimeline`
   - Test with same data/logic

2. **Phase 2**: Replace rendering logic
   - Update `RunDetail.tsx` to use `UnifiedPhaseTimeline` instead of separate sections
   - Keep all existing hooks, handlers, and logic unchanged

3. **Phase 3**: Remove old components
   - Remove `VerticalRunTimeline` from sidebar
   - Keep `CollapsibleSection` for other uses or deprecate

4. **Phase 4**: Polish and optimize
   - Smooth transitions
   - Performance optimization
   - Responsive design

