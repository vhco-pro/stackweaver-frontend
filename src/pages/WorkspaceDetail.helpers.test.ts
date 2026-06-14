// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for WorkspaceDetail's `purity` warnings: calculateRunDuration called Date.now()
// during render. It was extracted here as a pure function taking `now`, so the value
// can be supplied by a ticking clock (useNow) instead. These cases pin the duration
// math across operations and the finished-vs-running paths.

import { describe, it, expect } from 'vitest';
import type { Run } from '@/api/client';
import { calculateRunDuration, formatDuration, isRunActive, RUN_ACTIVE_STATUSES } from './WorkspaceDetail.helpers';

const T0 = Date.parse('2026-06-13T10:00:00.000Z');

function mkRun(partial: Partial<Run>): Run {
  const base: Run = {
    id: 'r1', workspace_id: 'w1', status: 'planned', operation: 'plan-and-apply',
    created_at: '', updated_at: '',
  };
  return { ...base, ...partial };
}

describe('formatDuration', () => {
  it('formats across magnitude boundaries', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(3 * 3600_000 + 4 * 60_000)).toBe('3h 4m');
  });
});

describe('isRunActive', () => {
  it('is true for in-progress statuses, false for terminal', () => {
    for (const status of RUN_ACTIVE_STATUSES) {
      expect(isRunActive({ status } as Pick<Run, 'status'>)).toBe(true);
    }
    expect(isRunActive({ status: 'applied' })).toBe(false);
    expect(isRunActive({ status: 'failed' })).toBe(false);
  });
});

describe('calculateRunDuration', () => {
  it('plan-and-apply finished: planning-at → applied-at', () => {
    const run = mkRun({
      operation: 'plan-and-apply',
      'status-timestamps': {
        'planning-at': new Date(T0).toISOString(),
        'applied-at': new Date(T0 + 65_000).toISOString(),
      },
    });
    // `now` is ignored because the run has an end timestamp.
    expect(calculateRunDuration(run, T0 + 999_999)).toBe('1m 5s');
  });

  it('plan-and-apply running: uses `now` as the end time', () => {
    const run = mkRun({
      operation: 'plan-and-apply',
      status: 'applying',
      'status-timestamps': { 'planning-at': new Date(T0).toISOString() },
    });
    expect(calculateRunDuration(run, T0 + 5_000)).toBe('5s');
  });

  it('plan-only finished: planning-at → planned-at', () => {
    const run = mkRun({
      operation: 'plan-only',
      'status-timestamps': {
        'planning-at': new Date(T0).toISOString(),
        'planned-at': new Date(T0 + 30_000).toISOString(),
      },
    });
    expect(calculateRunDuration(run, T0)).toBe('30s');
  });

  it('destroy running: uses `now`', () => {
    const run = mkRun({
      operation: 'destroy',
      status: 'applying',
      'status-timestamps': { 'planning-at': new Date(T0).toISOString() },
    });
    expect(calculateRunDuration(run, T0 + 120_000)).toBe('2m 0s');
  });

  it('falls back to started_at/completed_at when status-timestamps absent', () => {
    const run = mkRun({
      operation: 'plan-and-apply',
      started_at: new Date(T0).toISOString(),
      completed_at: new Date(T0 + 10_000).toISOString(),
    });
    expect(calculateRunDuration(run, T0)).toBe('10s');
  });

  it('returns null when no usable timestamps exist', () => {
    expect(calculateRunDuration(mkRun({ operation: 'plan-and-apply' }), T0)).toBeNull();
  });
});
