// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for useNow — the ticking clock that lets WorkspaceDetail render live run
// durations without calling Date.now() during render (react-hooks/purity fix).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('advances every interval while active', () => {
    const { result } = renderHook(() => useNow(true, 1000));
    const start = result.current;
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBeGreaterThan(start);
  });

  it('does not advance while inactive', () => {
    const { result } = renderHook(() => useNow(false, 1000));
    const start = result.current;
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(start);
  });

  it('stops ticking when active flips to false', () => {
    const { result, rerender } = renderHook(({ active }) => useNow(active, 1000), {
      initialProps: { active: true },
    });
    act(() => { vi.advanceTimersByTime(1000); });
    const afterTick = result.current;
    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(afterTick);
  });
});
