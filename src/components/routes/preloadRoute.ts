// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Children, isValidElement, type ReactNode } from 'react';

type Preloadable = { preload: () => Promise<unknown>; prefetch?: () => Promise<void> };
function isPreloadable(value: unknown): value is Preloadable {
  return typeof value === 'function' && 'preload' in value && typeof value.preload === 'function';
}

/** Start only the matched destination and its wrappers, avoiding a provider -> page waterfall. */
export async function preloadRoute(node: ReactNode, options: { speculative?: boolean } = {}): Promise<void> {
  const pending: Promise<unknown>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (isPreloadable(child.type)) {
      const start = options.speculative ? child.type.prefetch : child.type.preload;
      // Background failures remain invisible; an adopted rejection uses route recovery.
      if (start) {
        try { pending.push(start().catch(() => undefined)); }
        catch { /* A synchronous loader failure must not break a link event. */ }
      }
    }
    pending.push(preloadRoute(child.props.children, options));
  });
  await Promise.all(pending);
}
