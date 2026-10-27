// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { matchRoutes, type RouteObject } from 'react-router-dom';
import { preloadRoute } from './preloadRoute';

const noop = () => Promise.resolve();
interface RoutePreloader { preloadPath: (to: string) => Promise<void>; preloadPattern: (pattern: string) => Promise<void> }
const RoutePreloadContext = createContext<RoutePreloader>({ preloadPath: noop, preloadPattern: noop });
function findChain(routes: RouteObject[], pattern: string, ancestors: RouteObject[] = []): RouteObject[] {
  for (const route of routes) {
    const chain = [...ancestors, route];
    if (route.path === pattern) return chain;
    const nested = findChain(route.children ?? [], pattern, chain);
    if (nested.length) return nested;
  }
  return [];
}
export function RoutePreloadProvider({ routes, children }: { routes: RouteObject[]; children: ReactNode }) {
  const value = useMemo(() => {
    const preload = async (chain: RouteObject[]) => { await Promise.all(chain.map(route => preloadRoute(route.element, { speculative: true }))); };
    return {
      preloadPath: async (to: string) => {
        // Link targets are absolute router-relative paths, independent of BrowserRouter's basename.
        try { await preload((matchRoutes(routes, to.split(/[?#]/)[0]) ?? []).map(match => match.route)); }
        catch { /* Speculation never interrupts navigation. */ }
      },
      preloadPattern: async (pattern: string) => { await preload(findChain(routes, pattern)); },
    };
  }, [routes]);
  return <RoutePreloadContext.Provider value={value}>{children}</RoutePreloadContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useRoutePreload() { return useContext(RoutePreloadContext); }
