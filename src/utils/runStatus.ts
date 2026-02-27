// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Unified status badge computation utility
 * 
 * Computes display status from TFE-compatible run attributes.
 * This is the single source of truth for status badge logic.
 * 
 * Implementation: frontend/src/utils/runStatus.ts
 * Usage: All components use this function to compute status badges consistently
 * 
 * @see frontend/src/components/runs/StatusBadge.tsx - Badge component
 * @see frontend/src/pages/RunDetail.tsx - Run detail page usage
 * @see frontend/src/pages/WorkspaceDetail.tsx - Workspace detail page usage
 * @see frontend/src/pages/Workspaces.tsx - Workspaces list page usage
 */

export interface RunStatusInput {
  status: string;
  operation?: string;
  planOnly?: boolean;
  hasChanges?: boolean;
  canApply?: boolean;
}

export type DisplayStatus = 
  | 'pending' 
  | 'planning' 
  | 'planned' 
  | 'applying' 
  | 'applied' 
  | 'finished' 
  | 'errored' 
  | 'cancelled' 
  | 'running' 
  | 'destroyed'
  | 'no-runs';

/**
 * Computes display status badge from TFE-compatible run attributes
 * 
 * Matches TFE's badge logic but centralized in one place.
 * Based on TFE API attributes: status, operation, plan-only, has-changes, can-apply
 * 
 * @param input - Run status attributes from TFE-compatible API
 * @returns Display status string for badge component
 */
export function computeDisplayStatus(input: RunStatusInput): DisplayStatus {
  const { status, operation, planOnly, hasChanges, canApply } = input;
  
  // Priority order (matches TFE behavior):
  // 1. Failed/Canceled (highest priority)
  // 2. In-progress statuses
  // 3. Completed statuses with operation-specific labels
  
  if (status === 'failed') return 'errored';
  if (status === 'canceled') return 'cancelled';
  if (status === 'pending') return 'pending';
  if (status === 'planning') return 'planning';
  if (status === 'applying') return 'applying';
  if (status === 'running') return 'running';
  
  if (status === 'planned') {
    if (operation === 'plan-only' || planOnly) {
      return 'finished'; // Plan-only: cannot be applied
    }
    // Plan-and-apply: check if has changes
    // If hasChanges is explicitly false, no changes detected
    if (hasChanges === false) {
      return 'finished'; // No changes detected
    }
    // If hasChanges is true, definitely has changes
    if (hasChanges === true) {
      return 'planned'; // Has changes, waiting for apply
    }
    // If hasChanges is undefined, use canApply as fallback indicator
    // canApply=true means the run can be applied (likely has changes)
    // canApply=false means the run cannot be applied (likely no changes or already applied)
    if (hasChanges === undefined) {
      if (canApply === true) {
        return 'planned'; // Can apply, assume has changes
      }
      if (canApply === false) {
        return 'finished'; // Cannot apply, assume no changes
      }
      // If both are undefined, default to planned (safer assumption)
      return 'planned';
    }
    return 'planned'; // Default to planned if hasChanges is true
  }
  
  // Destroy runs complete with status 'applied' but display as 'destroyed'
  if (status === 'applied') {
    if (operation === 'destroy') return 'destroyed';
    return 'applied';
  }
  
  if (status === 'completed') {
    // Completed status - map based on operation
    if (operation === 'plan-and-apply') {
      // Plan-and-apply with no changes: backend sets status to 'completed' (not 'applied')
      // Backend logic: if no changes, status='completed'; if has changes, status='planned' (waiting for apply)
      // So 'completed' for plan-and-apply always means finished (no changes detected)
      return 'finished';
    }
    if (operation === 'plan-only') return 'finished';
    if (operation === 'destroy') return 'destroyed';
    return 'applied'; // Default for legacy apply runs
  }
  
  return 'pending'; // Fallback
}

