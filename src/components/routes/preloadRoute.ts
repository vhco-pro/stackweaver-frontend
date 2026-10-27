// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Children, isValidElement, type ReactNode } from 'react';

function isPreloadable(value: unknown): value is { preload: () => Promise<unknown> } {
  return typeof value === 'function' && 'preload' in value && typeof value.preload === 'function';
}

/** Start only the matched destination and its wrappers, avoiding a provider -> page waterfall. */
export function preloadRoute(node: ReactNode): void {
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (isPreloadable(child.type)) {
      // Rendering the same destination handles a rejection through its recovery boundary.
      void child.type.preload().catch(() => undefined);
    }
    preloadRoute(child.props.children);
  });
}
