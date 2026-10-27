// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { lazy, type ComponentType } from 'react';
import { RouteBoundary } from './RouteBoundary';

/** One boundary per destination: a new page shows feedback even inside router transitions. */
export function deferredPage<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>, name = 'Page', options: { publicDocs?: boolean } = {}) {
  let pending: ReturnType<typeof loader> | undefined;
  const preload = () => (pending ??= loader());
  const Page = lazy(preload);
  function DeferredPage(props: P) {
    return <RouteBoundary publicDocs={options.publicDocs}><Page {...props} /></RouteBoundary>;
  }
  DeferredPage.preload = preload;
  DeferredPage.displayName = name;
  return DeferredPage;
}
