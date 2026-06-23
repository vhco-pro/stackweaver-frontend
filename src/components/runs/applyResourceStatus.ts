// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

export type ResourceStatus = 'pending' | 'applying' | 'completed' | 'failed' | 'cancelled';

/**
 * Resolve a resource's display status against the run's terminal outcome.
 *
 * A resource can only be 'applying' (blue spinner) or 'pending' while the run is live —
 * those states come from a "Creating…" log line (or the initial plan) with no matching
 * terminal line yet. Once the run is cancelled/failed, no further log lines will ever
 * arrive, so anything still 'applying'/'pending' must be resolved to the run's outcome or
 * it spins/idles forever. A resource that genuinely finished is already 'completed' and is
 * left untouched.
 */
export function resolveTerminalResourceStatus(
  status: ResourceStatus,
  run: { isCancelled?: boolean; isFailed?: boolean },
): ResourceStatus {
  if (run.isCancelled && (status === 'applying' || status === 'pending')) return 'cancelled';
  if (run.isFailed && status === 'applying') return 'failed';
  return status;
}
