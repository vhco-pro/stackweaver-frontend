// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { DashboardStats } from '@/api/client';
import Dashboard from './index';
import { dashboardStats, orgStats } from './dashboard.fixtures';
const auth = vi.hoisted(() => ({ authenticated: false }));
const preloadPattern = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const payload = vi.hoisted<{ finish: (value: DashboardStats) => void }>(() => ({ finish: () => undefined }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: auth.authenticated ? { user: { name: 'Test reader' } } : null }) }));
vi.mock('@/components/routes/RoutePreloadContext', () => ({ useRoutePreload: () => ({ preloadPattern }) }));
vi.mock('@/hooks/useActivityNotifications', () => ({ useActivityNotifications: () => undefined }));
vi.mock('./useDashboardData', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useDashboardStats: () => useQuery({ queryKey: ['dashboard', 'stats'], queryFn: () => new Promise<DashboardStats>(resolve => { payload.finish = resolve; }) }) };
});
vi.mock('./AttentionList', () => ({ AttentionList: () => null }));
vi.mock('./GettingStarted', () => ({ GettingStarted: () => null }));
vi.mock('./LiveOperations', () => ({ LiveOperations: () => null }));
vi.mock('./Organizations', () => ({ Organizations: () => null }));
vi.mock('./RecentActivityCard', () => ({ RecentActivityCard: () => null }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('wires warm-up to the dashboard, requiring auth and completed dashboard reads', async () => {
  vi.useFakeTimers(); vi.stubGlobal('requestIdleCallback', undefined);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const tree = <QueryClientProvider client={client}><Dashboard /></QueryClientProvider>;
  const anonymous = render(tree); await act(() => vi.advanceTimersByTimeAsync(6000)); expect(preloadPattern).not.toHaveBeenCalled(); anonymous.unmount();
  auth.authenticated = true;
  const signedIn = render(tree); await act(() => vi.advanceTimersByTimeAsync(6000)); expect(preloadPattern).not.toHaveBeenCalled();
  await act(async () => { payload.finish(dashboardStats({ organizations: [orgStats()] })); await Promise.resolve(); });
  await act(() => vi.advanceTimersByTimeAsync(1999)); expect(preloadPattern).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(1)); expect(preloadPattern).toHaveBeenCalledTimes(1);
  signedIn.unmount();
});
