// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/** The reason the API records on a run whose apply was lost with its launcher (decision 16). */
const LOST_APPLY_PREFIX = 'runner lost during apply';

/** Whether a run ended because its launcher was lost during the apply phase. */
export function isLostApply(run: { status?: string; error_message?: string }): boolean {
  return run.status === 'failed' && (run.error_message ?? '').startsWith(LOST_APPLY_PREFIX);
}
