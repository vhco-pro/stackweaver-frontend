// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import * as React from 'react';

interface CommonControlledStateProps<T> {
  value?: T;
  defaultValue?: T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useControlledState<T, Rest extends any[] = []>(
  props: CommonControlledStateProps<T> & {
    onChange?: (value: T, ...args: Rest) => void;
  },
): readonly [T, (next: T, ...args: Rest) => void] {
  const { value, defaultValue, onChange } = props;

  // Controlled when `value` is provided: read it directly so the prop is the
  // single source of truth (no effect mirroring it into state — that's the
  // set-state-in-effect the React Compiler flags). Uncontrolled: own internal state.
  const isControlled = value !== undefined;
  const [internalState, setInternalState] = React.useState<T>(defaultValue as T);
  const state = isControlled ? value : internalState;

  const setState = React.useCallback(
    (next: T, ...args: Rest) => {
      // In controlled mode the parent owns the value; it updates via onChange and
      // re-renders with a new `value`. Only track internally when uncontrolled.
      if (value === undefined) setInternalState(next);
      onChange?.(next, ...args);
    },
    [value, onChange],
  );

  return [state, setState] as const;
}
