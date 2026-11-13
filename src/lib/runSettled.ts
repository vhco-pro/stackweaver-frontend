// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { isFinalRunStatus } from '@/utils/runStatus';

/**
 * Whether a run has finished moving, so what is read about its placement no longer changes: its
 * status is final. A plan-and-apply run at `planned` still waits for its apply.
 */
export function isRunSettled(run: { status?: string; operation?: string } | null | undefined): boolean {
  return isFinalRunStatus(run?.status);
}
