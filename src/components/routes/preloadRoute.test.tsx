// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe, expect, it, vi } from 'vitest';
import { preloadRoute } from './preloadRoute';

describe('matched route preloading', () => {
  it('awaits only the supplied wrapper and destination and absorbs speculative failures', async () => {
    let finish!: () => void;
    const Wrapper = Object.assign(({ children }: { children?: React.ReactNode }) => children, {
      preload: vi.fn(() => Promise.resolve()),
      prefetch: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })),
    });
    const Destination = Object.assign(() => null, {
      preload: vi.fn(() => Promise.resolve()),
      prefetch: vi.fn(() => Promise.reject(new Error('Unavailable module'))),
    });
    let settled = false;
    const pending = preloadRoute(<Wrapper><Destination /></Wrapper>, { speculative: true }).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(Wrapper.prefetch).toHaveBeenCalledTimes(1);
    expect(Destination.prefetch).toHaveBeenCalledTimes(1);
    expect(Wrapper.preload).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(settled).toBe(true);
  });
});
