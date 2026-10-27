// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNavigationWarmupCoordinator, useNavigationWarmup, WARMUP_PATTERNS } from './useNavigationWarmup';
const state = vi.hoisted(() => ({ authenticated: true }));
const preloadPattern = vi.hoisted(() => vi.fn<(pattern: string) => Promise<void>>());
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: state.authenticated ? { user: { id: 'person' } } : null }) }));
vi.mock('@/components/routes/RoutePreloadContext', () => ({ useRoutePreload: () => ({ preloadPattern }) }));
function setup({ settled = true, orgs = true, strict = false, coordinator = createNavigationWarmupCoordinator() } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  if (settled) client.setQueryData(['dashboard', 'stats'], { organizations: orgs ? [{ name: 'example' }] : [] });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{strict ? <StrictMode>{children}</StrictMode> : children}</QueryClientProvider>;
  return { client, coordinator, wrapper, view: renderHook(() => useNavigationWarmup(coordinator), { wrapper }) };
}
const tick = async (ms = 2000) => { await act(() => vi.advanceTimersByTimeAsync(ms)); };
describe('dashboard code warm-up', () => {
  beforeEach(() => {
    vi.useFakeTimers(); state.authenticated = true; preloadPattern.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
    vi.stubGlobal('requestIdleCallback', undefined); vi.stubGlobal('cancelIdleCallback', undefined);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('requires settled stats and zero foreground fetches, then schedules serial fallback steps without API work', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { client } = setup({ settled: false });
    await tick(6000); expect(preloadPattern).not.toHaveBeenCalled();
    let finish!: () => void;
    let pending!: Promise<boolean>;
    act(() => { pending = client.fetchQuery({ queryKey: ['foreground'], queryFn: () => new Promise<boolean>(resolve => { finish = () => { resolve(true); }; }) }); client.setQueryData(['dashboard', 'stats'], { organizations: [{ name: 'example' }] }); });
    await tick(6000); expect(preloadPattern).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
    await act(async () => { finish(); await pending; });
    await tick(1999); expect(preloadPattern).not.toHaveBeenCalled();
    await tick(1); expect(preloadPattern.mock.calls.map(([p]) => p)).toEqual([WARMUP_PATTERNS[0]]);
    await tick(4000); expect(preloadPattern.mock.calls.map(([p]) => p)).toEqual([...WARMUP_PATTERNS]);
    expect(fetchSpy).not.toHaveBeenCalled(); fetchSpy.mockRestore();
  });
  it('waits for each import and rechecks foreground fetches without an idle busy loop', async () => {
    let finish!: () => void;
    preloadPattern.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const { client } = setup(); await tick(); await tick(10000); expect(preloadPattern).toHaveBeenCalledTimes(1);
    let finishRead!: () => void;
    let read!: Promise<boolean>;
    act(() => { read = client.fetchQuery({ queryKey: ['poll'], queryFn: () => new Promise<boolean>(resolve => { finishRead = () => { resolve(true); }; }) }); });
    await act(async () => { finish(); await Promise.resolve(); });
    await tick(10000); expect(preloadPattern).toHaveBeenCalledTimes(1);
    await act(async () => { finishRead(); await read; });
    await tick(); expect(preloadPattern).toHaveBeenCalledTimes(2);
  });
  it.each(['hidden', 'offline', 'restricted'] as const)('cancels queued work on %s and resumes while mounted', async condition => {
    const connection = Object.assign(new EventTarget(), { saveData: false });
    Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
    setup(); await tick(1000);
    if (condition === 'hidden') Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    if (condition === 'offline') Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    if (condition === 'restricted') connection.saveData = true;
    act(() => { (condition === 'restricted' ? connection : condition === 'hidden' ? document : window).dispatchEvent(new Event(condition === 'restricted' ? 'change' : condition === 'hidden' ? 'visibilitychange' : 'offline')); });
    await tick(6000); expect(preloadPattern).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); connection.saveData = false;
    act(() => { connection.dispatchEvent(new Event('change')); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); });
    await tick(); expect(preloadPattern).toHaveBeenCalledTimes(1);
  });
  it('uses idle callbacks and cancels them plus subscriptions/listeners on unmount', async () => {
    const callbacks = new Map<number, IdleRequestCallback>();
    vi.stubGlobal('requestIdleCallback', vi.fn((callback: IdleRequestCallback) => { callbacks.set(1, callback); return 1; }));
    const cancel = vi.fn((id: number) => { callbacks.delete(id); }); vi.stubGlobal('cancelIdleCallback', cancel);
    const remove = vi.spyOn(window, 'removeEventListener'); const removeDocument = vi.spyOn(document, 'removeEventListener');
    const { view, client } = setup(); expect(callbacks.size).toBe(1);
    await act(async () => { callbacks.get(1)?.({ didTimeout: false, timeRemaining: () => 10 }); await Promise.resolve(); });
    expect(preloadPattern).toHaveBeenCalledTimes(1); view.unmount();
    expect(cancel).toHaveBeenCalled(); expect(remove).toHaveBeenCalledWith('online', expect.any(Function)); expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    client.setQueryData(['unrelated'], 1); await tick(6000); expect(preloadPattern).toHaveBeenCalledTimes(1);
    remove.mockRestore(); removeDocument.mockRestore();
  });
  it('is once per document, serial across StrictMode and ordinary remounts, even when an import fails', async () => {
    let finish!: () => void;
    preloadPattern.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; })).mockRejectedValueOnce(new Error('Unavailable code'));
    const { view, wrapper, coordinator } = setup({ strict: true }); await tick(); expect(preloadPattern).toHaveBeenCalledTimes(1); view.unmount();
    const remount = renderHook(() => useNavigationWarmup(coordinator), { wrapper }); await tick(6000); expect(preloadPattern).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await Promise.resolve(); }); await tick(4000); expect(preloadPattern.mock.calls.map(([p]) => p)).toEqual([...WARMUP_PATTERNS]);
    remount.unmount(); renderHook(() => useNavigationWarmup(coordinator), { wrapper }); await tick(10000); expect(preloadPattern).toHaveBeenCalledTimes(3);
  });
  it('requires authentication and at least one organization', async () => {
    state.authenticated = false; const first = setup(); await tick(10000); expect(preloadPattern).not.toHaveBeenCalled(); first.view.unmount();
    state.authenticated = true; const second = setup({ orgs: false }); await tick(10000); expect(preloadPattern).not.toHaveBeenCalled();
    act(() => { second.client.setQueryData(['organizations'], [{ name: 'fallback-org' }]); }); await tick(); expect(preloadPattern).toHaveBeenCalledTimes(1);
  });
  it('allows settled error stats with organizations already in cache', async () => {
    const { client } = setup({ settled: false }); client.setQueryData(['organizations'], [{ name: 'example' }]);
    await act(async () => { await client.fetchQuery({ queryKey: ['dashboard', 'stats'], queryFn: () => Promise.reject(new Error('Stats unavailable')) }).catch(() => undefined); });
    await tick(); expect(preloadPattern).toHaveBeenCalledTimes(1);
  });
});
