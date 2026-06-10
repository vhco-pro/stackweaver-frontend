// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization test for useControlledState — the safety net for refactoring its
// `set-state-in-effect` warning (the effect that syncs a controlled `value` prop into
// internal state). It pins the observable contract so the refactor can be verified green.
// First component-layer test on the new @testing-library + happy-dom harness.

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useControlledState } from './use-controlled-state';

describe('useControlledState', () => {
  it('uncontrolled: starts at defaultValue and updates locally', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControlledState<string>({ defaultValue: 'a', onChange }));

    expect(result.current[0]).toBe('a');
    act(() => { result.current[1]('b'); });
    expect(result.current[0]).toBe('b');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('controlled: reflects the value prop', () => {
    const { result } = renderHook(() => useControlledState<string>({ value: 'x' }));
    expect(result.current[0]).toBe('x');
  });

  it('controlled: syncs internal state when the value prop changes (the effect under test)', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useControlledState<string>({ value }),
      { initialProps: { value: 'x' } },
    );
    expect(result.current[0]).toBe('x');

    rerender({ value: 'y' });
    expect(result.current[0]).toBe('y');
  });

  it('calls onChange with the new value plus any extra args', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControlledState<string, [reason: string]>({ defaultValue: 'a', onChange }),
    );
    act(() => { result.current[1]('b', 'user-typed'); });
    expect(onChange).toHaveBeenCalledWith('b', 'user-typed');
  });

  it('does not call onChange on initial render', () => {
    const onChange = vi.fn();
    renderHook(() => useControlledState<string>({ defaultValue: 'a', onChange }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
