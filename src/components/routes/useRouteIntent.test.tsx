// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutePreloadProvider } from './RoutePreloadContext';
import { useRouteIntent } from './useRouteIntent';
const preload = vi.fn(() => Promise.resolve());
const Destination = Object.assign(() => null, { prefetch: preload, preload });
function IntentLink({ to = '/next' }: { to?: string }) { return <Link to={to} {...useRouteIntent(to)}>Next</Link>; }
function setup(to?: string, basename = '/') {
  return render(<MemoryRouter basename={basename} initialEntries={[basename === '/' ? '/current' : '/prefix/current']}><RoutePreloadProvider routes={[{ path: '/next', element: <Destination /> }, { path: '/current', element: <Destination /> }]}><IntentLink to={to} /></RoutePreloadProvider></MemoryRouter>);
}
describe('route intent', () => {
  beforeEach(() => { vi.useFakeTimers(); preload.mockClear(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined }); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
  it.each(['pointerEnter', 'focus'] as const)('waits 75ms on %s and cancels short visits', async event => {
    setup(); const link = screen.getByRole('link');
    fireEvent[event](link); await act(() => vi.advanceTimersByTimeAsync(74)); expect(preload).not.toHaveBeenCalled();
    fireEvent[event === 'focus' ? 'blur' : 'pointerLeave'](link); await act(() => vi.advanceTimersByTimeAsync(5)); expect(preload).not.toHaveBeenCalled();
    fireEvent[event](link); await act(() => vi.advanceTimersByTimeAsync(75)); expect(preload).toHaveBeenCalledTimes(1);
  });
  it('starts on pointerdown immediately, including restricted connections', async () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    setup(); fireEvent.pointerDown(screen.getByRole('link')); await act(async () => { await Promise.resolve(); }); expect(preload).toHaveBeenCalledTimes(1);
  });
  it.each([{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }, { offline: true }])('skips delayed intent on restricted connections %j', async connection => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: !connection.offline });
    setup(); fireEvent.pointerEnter(screen.getByRole('link')); await act(() => vi.advanceTimersByTimeAsync(100)); expect(preload).not.toHaveBeenCalled();
  });
  it('skips the current router pathname including search/hash', async () => {
    setup('/current?tab=1#row'); fireEvent.pointerDown(screen.getByRole('link')); await act(async () => { await Promise.resolve(); }); expect(preload).not.toHaveBeenCalled();
  });
  it('uses router-relative targets under a non-root basename and cancels on unmount', async () => {
    const view = setup('/next', '/prefix'); expect(screen.getByRole('link')).toHaveAttribute('href', '/prefix/next');
    fireEvent.focus(screen.getByRole('link')); await act(() => vi.advanceTimersByTimeAsync(75)); expect(preload).toHaveBeenCalledTimes(1);
    fireEvent.focus(screen.getByRole('link')); view.unmount(); await act(() => vi.advanceTimersByTimeAsync(100)); expect(preload).toHaveBeenCalledTimes(1);
  });
});
