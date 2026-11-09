// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The reasons the API records on a run whose apply was lost with its launcher (decision 16). Runs
 * that lost their launcher before the standard names stored the older wording and keep it, so
 * both are recognised.
 */
const LOST_APPLY_PREFIXES = ['launcher lost during apply', 'runner lost during apply'];

/** Whether a run ended because its launcher was lost during the apply phase. */
export function isLostApply(run: { status?: string; error_message?: string }): boolean {
  const reason = run.error_message ?? '';
  return run.status === 'failed' && LOST_APPLY_PREFIXES.some((prefix) => reason.startsWith(prefix));
}
