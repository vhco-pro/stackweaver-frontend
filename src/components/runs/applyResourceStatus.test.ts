// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { resolveTerminalResourceStatus, type ResourceStatus } from './applyResourceStatus';

// Regression guard for the cancelled/failed run bug: resources that were mid-create
// ('applying' — a "Creating…" log line with no matching "Creation complete") were left
// spinning forever once the run was cancelled, because no further log lines arrive. On a
// terminal run such resources must resolve to the run's outcome.
describe('resolveTerminalResourceStatus', () => {
  const live = { isCancelled: false, isFailed: false };

  it('leaves statuses untouched while the run is live', () => {
    for (const s of ['pending', 'applying', 'completed', 'failed', 'cancelled'] as ResourceStatus[]) {
      expect(resolveTerminalResourceStatus(s, live)).toBe(s);
    }
  });

  it('resolves applying/pending to cancelled when the run is cancelled (no infinite spinner)', () => {
    expect(resolveTerminalResourceStatus('applying', { isCancelled: true })).toBe('cancelled');
    expect(resolveTerminalResourceStatus('pending', { isCancelled: true })).toBe('cancelled');
  });

  it('keeps already-completed resources green on a cancelled run', () => {
    expect(resolveTerminalResourceStatus('completed', { isCancelled: true })).toBe('completed');
  });

  it('resolves a mid-apply (applying) resource to failed when the run failed', () => {
    expect(resolveTerminalResourceStatus('applying', { isFailed: true })).toBe('failed');
  });

  it('does not flip a completed resource on a failed run', () => {
    expect(resolveTerminalResourceStatus('completed', { isFailed: true })).toBe('completed');
  });

  it('models the reported partial-cancel mix: some completed (green), the rest cancelled (grey)', () => {
    // null_resource.server / time_sleep.resource_1 finished; time_sleep.resource_2..4 were
    // still creating; null_resource.resource_2..4 never started — all non-terminal → cancelled.
    const board: Record<string, ResourceStatus> = {
      'null_resource.server': 'completed',
      'time_sleep.resource_1': 'completed',
      'time_sleep.resource_2': 'applying',
      'time_sleep.resource_3': 'applying',
      'null_resource.resource_2': 'pending',
      'null_resource.resource_3': 'pending',
    };
    const resolved = Object.fromEntries(
      Object.entries(board).map(([k, v]) => [k, resolveTerminalResourceStatus(v, { isCancelled: true })]),
    );
    expect(resolved).toEqual({
      'null_resource.server': 'completed',
      'time_sleep.resource_1': 'completed',
      'time_sleep.resource_2': 'cancelled',
      'time_sleep.resource_3': 'cancelled',
      'null_resource.resource_2': 'cancelled',
      'null_resource.resource_3': 'cancelled',
    });
    // Critically: nothing is left 'applying' (which renders the infinite spinner).
    expect(Object.values(resolved)).not.toContain('applying');
  });
});
