// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useRef } from 'react';

/**
 * Declarative setInterval. Pass `null` as the delay to pause. The latest callback is always
 * invoked without re-arming the timer, so callers can pass inline closures.
 *
 * This is a browser-timer subscription (a sanctioned useEffect use) - never use it to poll
 * data; use React Query's `refetchInterval` for that.
 */
export function useInterval(callback: () => void, delayMs: number | null) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = window.setInterval(() => saved.current(), delayMs);
    return () => window.clearInterval(id);
  }, [delayMs]);
}
