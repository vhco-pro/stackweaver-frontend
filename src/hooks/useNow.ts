// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';

/**
 * Returns a current-timestamp value (ms) for rendering live, ticking durations
 * without calling Date.now() during render (which the React Compiler flags as
 * impure). While `active` is true the value updates every `intervalMs`; when
 * false it stops ticking and stays at its last value.
 *
 * The timestamp is read in the lazy initializer / interval callback - never in
 * the render body - so consumers can pass it to pure helpers safely.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => { setNow(Date.now()); }, intervalMs);
    return () => { clearInterval(id); };
  }, [active, intervalMs]);

  return now;
}
