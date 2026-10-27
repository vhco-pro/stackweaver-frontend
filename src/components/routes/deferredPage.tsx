// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { lazy, type ComponentType } from 'react';
import { RouteBoundary } from './RouteBoundary';

/** One boundary per destination: a new page shows feedback even inside router transitions. */
export function deferredPage<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>, name = 'Page', options: { publicDocs?: boolean } = {}) {
  let pending: ReturnType<typeof loader> | undefined;
  const preload = () => {
    if (!pending) {
      try { pending = loader(); }
      catch (error) { pending = Promise.reject(error instanceof Error ? error : new Error('Loading route module', { cause: error })); }
    }
    return pending;
  };
  let adopted = false;
  const prefetch = async (): Promise<void> => {
    const attempt = preload();
    try { await attempt; }
    catch {
      // React caches an adopted promise. Only speculation that it has not seen can reset.
      if (!adopted && pending === attempt) pending = undefined;
    }
  };
  const Page = lazy(() => { adopted = true; return preload(); });
  function DeferredPage(props: P) {
    return <RouteBoundary publicDocs={options.publicDocs}><Page {...props} /></RouteBoundary>;
  }
  DeferredPage.preload = preload;
  DeferredPage.prefetch = prefetch;
  DeferredPage.displayName = name;
  return DeferredPage;
}
