<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Status Badge Unification - Implementation Documentation

## Overview

Status badge logic has been unified into a single shared utility and component, eliminating ~300+ lines of duplicated code across 3+ components.

**Implementation Date**: 2025-12-30  
**Approach**: Frontend shared utility (TFE-compatible)

## Implementation

### Core Components

#### 1. Status Computation Utility
**Location**: `frontend/src/utils/runStatus.ts`

Single function that computes display status from TFE-compatible run attributes:
- `status` - Run status from API
- `operation` - Run operation type
- `planOnly` - Whether run is plan-only
- `hasChanges` - Whether plan has changes
- `canApply` - Whether run can be applied

**Function**: `computeDisplayStatus(input: RunStatusInput): DisplayStatus`

**Status Mapping**:
- `failed` → `errored`
- `canceled` → `cancelled`
- `pending` → `pending`
- `planning` → `planning`
- `applying` → `applying`
- `running` → `running`
- `planned` → `planned` (if can apply) or `finished` (if plan-only or no changes)
- `applied` → `applied`
- `completed` → `finished` (plan-and-apply no changes), `applied` (apply), `destroyed` (destroy), or `finished` (plan-only)

#### 2. Status Badge Component
**Location**: `frontend/src/components/runs/StatusBadge.tsx`

Unified React component for displaying status badges with consistent styling and icons.

**Props**:
- `status: DisplayStatus` - Display status from computeDisplayStatus
- `variant?: 'default' | 'outline'` - Badge variant
- `className?: string` - Additional CSS classes

**Usage**:
```typescript
import { StatusBadge } from '@/components/runs/StatusBadge';
import { computeDisplayStatus } from '@/utils/runStatus';

const displayStatus = computeDisplayStatus({
  status: run.status,
  operation: run.operation,
  planOnly: run.plan_only,
  hasChanges: run.has_changes,
  canApply: run.permissions?.['can-apply'],
});

<StatusBadge status={displayStatus} />
```

### Component Updates

#### 1. RunDetail.tsx
**Location**: `frontend/src/pages/RunDetail.tsx`

**Changes**:
- Removed `getStatusBadge()` function (~90 lines)
- Added `displayStatus` useMemo hook that:
  - Handles optimistic update for "Applying" state (`isApplyStarting`)
  - Computes `hasChanges` from plan output
  - Calls `computeDisplayStatus()` utility
- Replaced badge rendering with `<StatusBadge status={displayStatus} />`

**Reference**: Lines 271-298 (displayStatus computation), Line 474 (badge rendering)

#### 2. WorkspaceDetail.tsx
**Location**: `frontend/src/pages/WorkspaceDetail.tsx`

**Changes**:
- Removed `getRunStatusBadge()` function (~95 lines)
- Removed `getWorkspaceStatusBadge()` function (~90 lines)
- Added simplified `getRunStatusBadge()` that uses `computeDisplayStatus()`
- Added simplified `getWorkspaceStatusBadge()` that uses latest run's status badge
- Workspace status = latest run status (TFE pattern)

**Reference**: Lines 736-752 (run status badge), Lines 754-765 (workspace status badge)

#### 3. Workspaces.tsx
**Location**: `frontend/src/pages/Workspaces.tsx`

**Changes**:
- Removed `getRunStatusBadge()` function (~40 lines)
- Added simplified `getRunStatusBadge()` that:
  - Extracts attributes from JSON:API resource
  - Calls `computeDisplayStatus()` utility
  - Returns `<StatusBadge>` component

**Reference**: Lines 407-425 (run status badge computation)

## TFE Compatibility

### API Attributes Used
All status computation uses TFE-compatible attributes:
- ✅ `status` - Matches TFE `attributes.status`
- ✅ `operation` - Matches TFE `attributes.operation`
- ✅ `plan-only` - Matches TFE `attributes.plan-only`
- ✅ `has-changes` - Matches TFE `attributes.has-changes`
- ✅ `permissions.can-apply` - Matches TFE `attributes.permissions.can-apply`

### Status Values
Status values match TFE API specification:
- Run statuses: `pending`, `planning`, `planned`, `applying`, `applied`, `failed`, `canceled`, `running`, `completed`
- Display statuses: `pending`, `planning`, `planned`, `applying`, `applied`, `finished`, `errored`, `cancelled`, `running`, `destroyed`

### Workspace Status Pattern
Workspace status badge = latest run's status badge (matches TFE behavior)

## Benefits

1. **Single Source of Truth**: Status computed once in shared utility
2. **Consistency**: All components show identical badges
3. **Maintainability**: Changes in one place (utility function)
4. **TFE Compatible**: Uses same attributes TFE provides
5. **Type Safety**: TypeScript types ensure correct usage
6. **Code Reduction**: Removed ~300 lines of duplicated code

## Edge Cases Handled

1. **Optimistic Updates**: RunDetail handles `isApplyStarting` for immediate "Applying" display
2. **No Changes Detection**: Computes `hasChanges` from plan output when available
3. **Plan-Only Runs**: Shows "Finished" instead of "Planned"
4. **Legacy Statuses**: Handles `completed` and `running` statuses
5. **Missing Data**: Gracefully handles missing `hasChanges` or `canApply`

## Testing

### Test Cases Covered
- ✅ Plan-only run: `planned` → "Finished"
- ✅ Plan-and-apply with changes: `planned` + `can-apply=true` → "Planned"
- ✅ Plan-and-apply no changes: `planned` + no changes → "Finished"
- ✅ Plan-and-apply applied: `applied` → "Applied"
- ✅ Plan-and-apply in progress: `applying` → "Applying"
- ✅ Failed run: `failed` → "Errored"
- ✅ Canceled run: `canceled` → "Cancelled"
- ✅ Destroy run: `completed` + `destroy` → "Destroyed"
- ✅ Workspace status = latest run status

## Migration Notes

- All components now use shared utility
- Old badge calculation functions removed
- No API changes required
- Backward compatible (uses existing TFE-compatible attributes)

## References

- **TFE Runs API**: https://developer.hashicorp.com/terraform/enterprise/api-docs/run
- **TFE Plans API**: https://developer.hashicorp.com/terraform/enterprise/api-docs/plans
- **TFE Workspaces API**: https://developer.hashicorp.com/terraform/enterprise/api-docs/workspaces

