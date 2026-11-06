// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { vi } from 'vitest';

// The component test DOM cannot calculate intersections; browser tests use the real observer.
export function stubFenceViewport(initiallyNear = true) {
  const listeners = new Set<(near: boolean) => void>();
  vi.stubGlobal('IntersectionObserver', class {
    private notify?: (near: boolean) => void;
    private readonly callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) { this.callback = callback; }
    observe() {
      this.notify = near => this.callback([{
        isIntersecting: near,
        intersectionRect: { width: near ? 10 : 0, height: near ? 10 : 0 },
      } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      listeners.add(this.notify);
      this.notify(initiallyNear);
    }
    disconnect() {
      if (this.notify) listeners.delete(this.notify);
    }
  });
  return (near: boolean) => [...listeners].forEach(listener => listener(near));
}
