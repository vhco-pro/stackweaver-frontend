// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/** Statuses after which a run has nothing left to place or report. */
const SETTLED = ['applied', 'planned_and_finished', 'errored', 'failed', 'canceled', 'discarded', 'force_canceled'];

/**
 * Whether a run has finished moving, so what is read about its placement no longer changes. The
 * API reports a finished plan-only run as `planned`; a plan-and-apply run at `planned` still waits
 * for its apply.
 */
export function isRunSettled(run: { status?: string; operation?: string } | null | undefined): boolean {
  if (!run?.status) return false;
  if (run.status === 'planned') return run.operation === 'plan-only';
  return SETTLED.includes(run.status);
}
