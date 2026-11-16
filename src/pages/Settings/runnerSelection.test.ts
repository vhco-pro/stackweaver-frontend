// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import {
  deleteTreatingNotFoundAsDone,
  headerState,
  normalizeLabel,
  runBulk,
  toggleAll,
  toggleOne,
  visibleSelection,
  withLabel,
  withoutLabel,
} from './runnerSelection';

const ids = ['a', 'b', 'c'];

describe('runner selection', () => {
  it('toggles a single runner in and out', () => {
    const one = toggleOne(new Set(), 'a');
    expect([...one]).toEqual(['a']);
    expect([...toggleOne(one, 'a')]).toEqual([]);
  });

  it('reports the header state from the visible runners only', () => {
    expect(headerState(new Set(), ids)).toBe('none');
    expect(headerState(new Set(['a']), ids)).toBe('some');
    expect(headerState(new Set(ids), ids)).toBe('all');
    // A selected runner that has left the list does not count.
    expect(headerState(new Set(['gone']), ids)).toBe('none');
    expect(headerState(new Set([...ids, 'gone']), ids)).toBe('all');
    expect(headerState(new Set(), [])).toBe('none');
  });

  it('select-all selects every visible runner, and clears when all are selected', () => {
    expect([...toggleAll(new Set(['a']), ids)].sort()).toEqual(ids);
    expect([...toggleAll(new Set(ids), ids)]).toEqual([]);
  });

  it('drops runners that are no longer listed from the selection', () => {
    expect(visibleSelection(new Set(['a', 'gone']), ids)).toEqual(['a']);
  });
});

describe('bulk label edits', () => {
  it('normalizes labels the same way as the single-runner editor', () => {
    expect(normalizeLabel('  GPU Nodes ')).toBe('gpu-nodes');
    expect(normalizeLabel('   ')).toBe('');
  });

  it('adds a label once and removes only that label', () => {
    expect(withLabel(['x'], 'gpu')).toEqual(['x', 'gpu']);
    expect(withLabel(['gpu'], 'gpu')).toEqual(['gpu']);
    expect(withoutLabel(['x', 'gpu'], 'gpu')).toEqual(['x']);
  });
});

describe('runBulk', () => {
  it('runs every operation and separates failures from successes', async () => {
    const result = await runBulk(ids, (id) => (id === 'b' ? Promise.reject(new Error('boom')) : Promise.resolve()));
    expect(result.succeeded).toEqual(['a', 'c']);
    expect(result.failed).toEqual([{ id: 'b', error: 'boom' }]);
  });
});

// A launcher another tab or administrator already deleted answers 404: that delete is done (#856).
describe('deleteTreatingNotFoundAsDone', () => {
  const failing = (status: number, message: string) => () =>
    Promise.reject(Object.assign(new Error(message), { status }));

  it('counts a 404 as done', async () => {
    await expect(deleteTreatingNotFoundAsDone(failing(404, 'Launcher not found'))).resolves.toBeUndefined();
  });

  it('still fails on any other error', async () => {
    await expect(deleteTreatingNotFoundAsDone(failing(500, 'Internal Server Error'))).rejects.toThrow('Internal Server Error');
    await expect(deleteTreatingNotFoundAsDone(failing(403, 'Forbidden'))).rejects.toThrow('Forbidden');
    await expect(deleteTreatingNotFoundAsDone(() => Promise.reject(new Error('network down')))).rejects.toThrow('network down');
  });

  it('lets runBulk report a launcher that was already gone as deleted', async () => {
    const result = await runBulk(ids, (id) =>
      deleteTreatingNotFoundAsDone(id === 'b' ? failing(404, 'Launcher not found') : () => Promise.resolve()),
    );
    expect(result.succeeded).toEqual(ids);
    expect(result.failed).toEqual([]);
  });
});
