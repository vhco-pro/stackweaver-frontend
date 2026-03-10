<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Terraform Run UI Enhancement - Implementation Summary

## Three Run Types (Current Implementation)

1. **`plan-only`**: Speculative plan, cannot be applied
   - Status flow: `pending` → `planning` → `planned` (final)
   - Shows: Plan Phase box only

2. **`plan-and-apply`**: Single run with both phases
   - Status flow: `pending` → `planning` → `planned` → `applying` → `applied`
   - Shows: Plan Phase box → Apply Phase box
   - Action buttons appear when plan completes

3. **`destroy`**: Destroy infrastructure
   - Status flow: `pending` → `running`/`applying` → `completed`
   - Shows: Destroy Phase box only

## Core Logic to Preserve (No Legacy Code)

### 1. Real-Time Polling
- `useRunPolling` hook - polls every 2 seconds
- Updates: `run`, `planOutput`, `runLogs`
- Toast notifications on status changes

### 2. Status Badge Display
- Plan-and-apply: "Applying" when `isApplyStarting` or status='applying'
- Plan-only: "Finished" when status='planned'
- Standard variants for: pending, planning, planned, applying, applied, failed, canceled

### 3. Permission-Based Actions
- `canApply`: From `run.permissions?.['can-apply']` (backend truth)
  - plan-and-apply: true when status='planned'
  - plan-only: always false
- `canDiscard`: Only for plan-and-apply runs in 'planned' status with can-apply=true

### 4. Apply Action (plan-and-apply only)
- Sets `isApplyStarting` flag (optimistic update)
- Same run transitions to 'applying' status
- Auto-scrolls to apply phase
- Clears flag when status updates

### 5. Phase Display Logic

**Plan-and-Apply Runs**:
- Plan Phase: Always shown, expanded when pending/planning/planned
- Apply Phase: Shown when applying/applied/completed or isApplyStarting
- Action buttons: Between phases when canApply && status='planned'

**Plan-Only Runs**:
- Plan Phase: Always shown, expanded when pending/planning/planned
- Warnings banner: Shown if warnings exist

**Destroy Runs**:
- Destroy Phase: Always shown, expanded when running/applying

### 6. Warnings Banner
- Standalone `WarningDisplay` component (`components/runs/WarningDisplay.tsx`)
- Parses from plan JSON (diagnostics array), plan logs, apply logs, and error_message
- Shown for all run types (plan-only, plan-and-apply, destroy) when warnings exist
- Collapsible, default expanded
- Shows warning/deprecation distinction with file/line location when available

### 7. Error Display
- Shown at top if `run.error_message` exists
- Red border, red background
- Only shows errors, never warnings (those go to WarningDisplay)

### 8. Cancel Action
- Enabled when: pending, planning, applying, or running
- Calls API and refetches

### 9. Discard Action (plan-and-apply only)
- Enabled when `canDiscard` is true
- Calls API and refetches

### 10. Auto-Scroll
- Scrolls to action buttons when plan completes (plan-and-apply)
- Scrolls to apply phase when it starts

## Phase Status Determination

### Plan Phase
- Status: `planning` → `running`, `planned`/`applying`/`applied`/`completed` → `completed`, `failed` → `failed`, else → `pending`
- Title: `planned`+ → "Plan Finished", else → "Plan Phase"

### Apply Phase (plan-and-apply only)
- Status: `applying` → `running`, `applied`/`completed` → `completed`, `failed` → `failed`, else → `pending`
- Title: `applied`/`completed` → "Applied", else → "Apply Phase"

### Destroy Phase (destroy only)
- Status: `running`/`applying` → `running`, `completed` → `completed`, `failed` → `failed`, else → `pending`
- Title: `completed` → "Destroyed", else → "Destroy Phase"

## What Changes (UI Only)

- Replace `CollapsibleSection` with `PhaseBox` (adds status-based border/icon)
- Remove `VerticalRunTimeline` from sidebar
- Add `CreatedNode` at top
- Add connection lines between phases
- Phase boxes transition status/color (same component instance)

## What Stays the Same

- All hooks (`useRunPolling`)
- All handlers (`handleApply`, `handleDiscard`, `handleCancel`)
- All permission logic
- All status determination logic
- All expansion/collapse logic
- All content rendering (OutputViewer, ApplyOutputViewer)
- All action button logic

