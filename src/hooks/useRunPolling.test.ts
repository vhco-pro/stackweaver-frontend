// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// AUD-030 / #741: the callback props used to be polling-effect dependencies, so a consumer
// passing inline arrows (RunDetail does) restarted the interval and fired an immediate fetch
// on every render. These tests pin that polling is keyed only on runId/enabled/pollInterval
// while the latest callbacks are still the ones invoked.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Run } from '@/api/client';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  getPlanLogs: vi.fn(),
  getPlan: vi.fn(),
  getApply: vi.fn(),
  getApplyLogs: vi.fn(),
  getLogs: vi.fn(),
  status: { value: 'planning' },
}));

vi.mock('@/api/client', () => ({
  runsApi: {
    get: mocks.get,
    getPlanLogs: mocks.getPlanLogs,
    getPlan: mocks.getPlan,
    getApply: mocks.getApply,
    getApplyLogs: mocks.getApplyLogs,
    getLogs: mocks.getLogs,
  },
}));

vi.mock('@/utils/jsonapi', () => ({
  getRunFromJsonApi: (resource: { id: string; status: string }) =>
    ({ id: resource.id, status: resource.status, operation: 'plan-only' }) as unknown as Run,
}));

import { useRunPolling } from './useRunPolling';

// Let the in-flight fetchRun promise chain settle without advancing the interval.
const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

describe('useRunPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.status.value = 'planning';
    mocks.get.mockImplementation((id: string) =>
      Promise.resolve({ data: { id, status: mocks.status.value } }));
    mocks.getPlanLogs.mockResolvedValue({ bytes: 0, text: '', done: false });
    mocks.getPlan.mockResolvedValue({});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not restart polling when callback identities change between renders', async () => {
    const { rerender } = renderHook(
      ({ cb }) => useRunPolling({ runId: 'run-1', pollInterval: 2000, onStatusChange: cb }),
      { initialProps: { cb: (r: Run) => { void r; } } },
    );
    await flush();
    expect(mocks.get).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) {
      rerender({ cb: (r: Run) => { void r; } });
      await flush();
    }
    // A fresh callback identity must not trigger an immediate re-fetch.
    expect(mocks.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it('invokes the latest onStatusChange and stops on a terminal status', async () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useRunPolling({ runId: 'run-1', pollInterval: 2000, onStatusChange: cb }),
      { initialProps: { cb: first } },
    );
    await flush();
    rerender({ cb: latest });
    await flush();

    mocks.status.value = 'planned'; // terminal for a plan-only run
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(latest.mock.calls[0][0]).toMatchObject({ status: 'planned' });

    const calls = mocks.get.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mocks.get).toHaveBeenCalledTimes(calls);
  });
});
