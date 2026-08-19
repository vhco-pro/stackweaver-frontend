// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { Workspace } from '@/api/client';
import { getAttribute, getRunOperation, getRunStatus, type JsonApiResource } from '@/utils/jsonapi';

// Run statuses that mean a workspace is still doing work, so the list should keep
// polling for updates. Used by the Workspaces list's React Query refetchInterval.
const ACTIVE_RUN_STATUSES = ['pending', 'planning', 'planned', 'applying', 'running'];

/**
 * Whether any workspace in the list has an active (in-progress) latest run.
 * The Workspaces list polls while this is true and stops once it is false.
 */
export function hasActiveWorkspaceRun(workspaces: { latestRun?: JsonApiResource }[]): boolean {
  return workspaces.some(
    (w) => !!w.latestRun && ACTIVE_RUN_STATUSES.includes(getRunStatus(w.latestRun)),
  );
}

/**
 * The status buckets the Workspaces list filters and counts by. `all` is the filter's
 * no-op option and is never a category a workspace lands in.
 */
export type WorkspaceStatusFilter = 'all' | 'needs_attention' | 'errored' | 'running' | 'on_hold' | 'success';
export type WorkspaceStatusCategory = Exclude<WorkspaceStatusFilter, 'all'>;

export interface WorkspaceStatusCounts {
  needsAttention: number;
  errored: number;
  running: number;
  onHold: number;
  success: number;
}

/**
 * The API returns a workspace's latest run flattened onto the workspace; every run helper in the
 * UI reads the TFE-style JSON:API shape. This is the one place that bridges the two, so the
 * Dashboard and the Workspaces list derive a workspace's status from identical input.
 */
export function latestRunResource(workspace: Workspace): JsonApiResource | undefined {
  const run = workspace.latest_run;
  if (!run) return undefined;
  return {
    id: run.id,
    type: 'runs',
    attributes: {
      'status': run.status,
      'operation': run.operation,
      'is-destroy': run.is_destroy,
      'plan-only': run.plan_only,
      'has-changes': run.has_changes,
      'created-at': run.created_at,
      'completed-at': run.completed_at ?? null,
      'permissions': {
        'can-apply': !run.plan_only && run.status === 'planned',
      },
    },
  };
}

/** True when the run cannot be applied without someone deciding to apply it. */
function isPlanOnlyRun(latestRun: JsonApiResource): boolean {
  return getRunOperation(latestRun) === 'plan' || (getAttribute<boolean>(latestRun, 'plan-only', false) ?? false);
}

/**
 * The bucket a workspace lands in, derived from its latest run. A workspace that has never run is
 * uncategorised (null) rather than "success" - it has no outcome to report.
 *
 * `needs_attention` and `on_hold` describe the same set of runs (queued, or planned and waiting for
 * an apply); the categoriser resolves the overlap in favour of `needs_attention`, which is why the
 * list's On Hold counter reads zero. That is long-standing behaviour and is preserved verbatim here
 * rather than corrected, so lifting the logic out of the page changes nothing on screen.
 */
export function workspaceStatusCategory(latestRun: JsonApiResource | undefined): WorkspaceStatusCategory | null {
  if (!latestRun) return null;

  const status = getRunStatus(latestRun);
  const planOnly = isPlanOnlyRun(latestRun);

  if (status === 'failed' || status === 'errored') return 'errored';
  if (['running', 'planning', 'applying'].includes(status)) return 'running';
  if (status === 'planned' && !planOnly) return 'needs_attention';
  if (status === 'pending') return 'needs_attention';
  if (status === 'completed' || status === 'applied' || (status === 'planned' && planOnly)) return 'success';

  return null;
}

/**
 * Whether a workspace matches a status filter. Distinct from {@link workspaceStatusCategory}
 * because the filter lets the overlapping buckets both match: filtering by On Hold shows the runs
 * waiting on a decision even though the counter above categorises them as Needs Attention.
 */
export function workspaceMatchesStatus(
  latestRun: JsonApiResource | undefined,
  filter: WorkspaceStatusFilter,
): boolean {
  if (filter === 'all') return true;
  // A workspace that has never run matches no status filter.
  if (!latestRun) return false;

  const status = getRunStatus(latestRun);
  const planOnly = isPlanOnlyRun(latestRun);

  switch (filter) {
    case 'needs_attention':
      return (status === 'planned' && !planOnly) || status === 'pending';
    case 'errored':
      return status === 'failed' || status === 'errored';
    case 'running':
      return ['running', 'planning', 'applying'].includes(status);
    case 'on_hold':
      return status === 'pending' || (status === 'planned' && !planOnly);
    case 'success':
      return status === 'completed' || status === 'applied' || (status === 'planned' && planOnly);
  }
}

/** Counts workspaces by bucket. Counts workspaces, not the runs inside them. */
export function countWorkspacesByStatus(
  workspaces: { latestRun?: JsonApiResource }[],
): WorkspaceStatusCounts {
  const counts: WorkspaceStatusCounts = {
    needsAttention: 0,
    errored: 0,
    running: 0,
    onHold: 0,
    success: 0,
  };
  for (const workspace of workspaces) {
    switch (workspaceStatusCategory(workspace.latestRun)) {
      case 'needs_attention':
        counts.needsAttention++;
        break;
      case 'errored':
        counts.errored++;
        break;
      case 'running':
        counts.running++;
        break;
      case 'on_hold':
        counts.onHold++;
        break;
      case 'success':
        counts.success++;
        break;
    }
  }
  return counts;
}

export interface PendingCreateDialogDecision {
  /** Whether the Create Workspace dialog should be reopened. */
  open: boolean;
  /** Whether to strip the `openDialog` query param from the URL. */
  clearUrl: boolean;
  /** Whether to remove the `pendingWorkspaceDialog` localStorage entry. */
  clearStorage: boolean;
}

/**
 * Decide whether the Create Workspace dialog should reopen after a GitHub OAuth
 * install redirect, reading the `openDialog` URL param (primary) and the
 * `pendingWorkspaceDialog` localStorage entry (fallback, org- and recency-scoped).
 *
 * Pure decision: it reads `window.location`/`localStorage` but performs no
 * mutations - the caller applies the indicated cleanup. Runs inside a mount
 * effect (never during render), so the `Date.now()` recency check is safe.
 */
export function evaluatePendingCreateDialog(
  selectedOrg: string,
  orgName: string | undefined,
): PendingCreateDialogDecision {
  const none: PendingCreateDialogDecision = { open: false, clearUrl: false, clearStorage: false };
  if (!selectedOrg || !orgName) return none;

  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('openDialog') === 'true') {
    return { open: true, clearUrl: true, clearStorage: true };
  }

  const pendingDialog = localStorage.getItem('pendingWorkspaceDialog');
  if (!pendingDialog) return none;

  try {
    const parsed = JSON.parse(pendingDialog) as { orgName: string; timestamp: number };
    const recent = Date.now() - parsed.timestamp < 5 * 60 * 1000;
    // Reopen only when the saved request is recent and for the current org;
    // otherwise still clear the stale entry.
    return { open: recent && parsed.orgName === selectedOrg, clearUrl: false, clearStorage: true };
  } catch (err) {
    console.error('Failed to parse pending dialog state:', err);
    return { open: false, clearUrl: false, clearStorage: true };
  }
}
