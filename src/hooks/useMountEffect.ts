// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect } from 'react';

/**
 * Run an effect exactly once on mount, with optional cleanup on unmount.
 * This is the only sanctioned way to call useEffect with an empty dependency array.
 *
 * Good uses: DOM focus/scroll, third-party widget init, browser API subscriptions.
 * Bad uses: data fetching (use React Query), derived state (compute inline).
 */
export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
