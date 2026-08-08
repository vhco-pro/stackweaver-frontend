// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { getRunStatus, type JsonApiResource } from '@/utils/jsonapi';

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
