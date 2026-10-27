// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { type RouteObject } from 'react-router-dom';
import { appRoutes } from '@/appRoutes';
import { RoutePreloadProvider, useRoutePreload } from './RoutePreloadContext';

const page = () => Object.assign(() => null, { prefetch: vi.fn(() => Promise.resolve()), preload: vi.fn() });
describe('route preload context', () => {
  it('finds all bounded warm-up patterns in the actual route table', () => {
    const paths = (routes: RouteObject[]): Array<string | undefined> => routes.flatMap(route => [route.path, ...paths(route.children ?? [])]);
    for (const pattern of ['/app/:orgName/workspaces', '/app/:orgName/ansible/playbooks', '/app/:orgName/ansible/job-templates']) expect(paths(appRoutes)).toContain(pattern);
  });
  it('resolves just the matched chain, dropping search/hash and safely ignoring unknown paths', async () => {
    const Shell = page(), Playbooks = page(), Other = page();
    const routes = [{ element: <Shell />, children: [{ path: '/app/:orgName/ansible/playbooks', element: <Playbooks /> }, { path: '/other', element: <Other /> }] }];
    const { result } = renderHook(useRoutePreload, { wrapper: ({ children }: { children: ReactNode }) => <RoutePreloadProvider routes={routes}>{children}</RoutePreloadProvider> });
    await result.current.preloadPath('/app/team/ansible/playbooks?search=secret#row');
    expect(Shell.prefetch).toHaveBeenCalledTimes(1);
    expect(Playbooks.prefetch).toHaveBeenCalledTimes(1);
    expect(Other.prefetch).not.toHaveBeenCalled();
    await result.current.preloadPath('/unknown');
    await result.current.preloadPattern('/app/:orgName/ansible/playbooks');
    expect(Playbooks.prefetch).toHaveBeenCalledTimes(2);
    await expect(result.current.preloadPattern('/absent')).resolves.toBeUndefined();
  });
  it('defaults to a settled no-op outside the application provider', async () => {
    const { result } = renderHook(useRoutePreload);
    await expect(result.current.preloadPath('/app/team/workspaces')).resolves.toBeUndefined();
    await expect(result.current.preloadPattern('/unknown')).resolves.toBeUndefined();
  });
});
