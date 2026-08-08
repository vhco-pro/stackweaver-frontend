// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { Run } from '@/api/client';

// Run statuses that mean the run is still in progress (its duration is still
// growing). Shared by the WorkspaceDetail poll gate and the live-duration clock.
export const RUN_ACTIVE_STATUSES = [
  'running', 'pending', 'planning', 'applying', 'plan_queued', 'apply_queued',
];

export function isRunActive(run: Pick<Run, 'status'>): boolean {
  return RUN_ACTIVE_STATUSES.includes(run.status);
}

/** Format a millisecond duration as a compact human string (e.g. "1m 5s", "2h 3m"). */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Compute a run's elapsed duration string, or null when it can't be determined.
 *
 * `now` is passed in (rather than read via Date.now()) so this stays pure and
 * callable during render - for in-progress runs the caller supplies a ticking
 * clock (see useNow); for finished runs the end timestamp is used and `now` is
 * ignored.
 */
export function calculateRunDuration(run: Run, now: number): string | null {
  const statusTimestamps = run['status-timestamps'];

  // For plan-and-apply runs: from planning-at to applied-at (or now if still running)
  if (run.operation === 'plan-and-apply') {
    const planningAt = statusTimestamps?.['planning-at'] || run.started_at;
    const appliedAt = statusTimestamps?.['applied-at'] || run.completed_at;

    if (planningAt) {
      const startTime = new Date(planningAt).getTime();
      const endTime = appliedAt ? new Date(appliedAt).getTime() : now;
      if (endTime >= startTime) {
        return formatDuration(endTime - startTime);
      }
    }

    // Fallback: use started_at and completed_at if status-timestamps not available
    if (run.started_at) {
      const startTime = new Date(run.started_at).getTime();
      const endTime = run.completed_at ? new Date(run.completed_at).getTime() : now;
      if (endTime >= startTime) {
        return formatDuration(endTime - startTime);
      }
    }
  }

  // For plan-only runs: from planning-at to planned-at (or now if still running)
  if (run.operation === 'plan-only' || run.operation === 'plan') {
    const planningAt = statusTimestamps?.['planning-at'] || run.started_at;
    const plannedAt = statusTimestamps?.['planned-at'] || run.completed_at;

    if (planningAt) {
      const startTime = new Date(planningAt).getTime();
      const endTime = plannedAt ? new Date(plannedAt).getTime() : now;
      if (endTime >= startTime) {
        return formatDuration(endTime - startTime);
      }
    }

    // Fallback: use started_at and completed_at
    if (run.started_at) {
      const startTime = new Date(run.started_at).getTime();
      const endTime = run.completed_at ? new Date(run.completed_at).getTime() : now;
      if (endTime >= startTime) {
        return formatDuration(endTime - startTime);
      }
    }
  }

  // For destroy runs: TFE-compatible two-phase flow (same as plan-and-apply)
  if (run.operation === 'destroy') {
    const planningAt = statusTimestamps?.['planning-at'] || run.started_at;
    const appliedAt = statusTimestamps?.['applied-at'] || run.completed_at;

    if (planningAt) {
      const startTime = new Date(planningAt).getTime();
      const endTime = appliedAt ? new Date(appliedAt).getTime() : now;
      if (endTime >= startTime) {
        return formatDuration(endTime - startTime);
      }
    }

    // Fallback
    if (run.started_at) {
      const startTime = new Date(run.started_at).getTime();
      const endTime = run.completed_at ? new Date(run.completed_at).getTime() : now;
      if (endTime >= startTime) {
        return formatDuration(endTime - startTime);
      }
    }
  }

  return null;
}
