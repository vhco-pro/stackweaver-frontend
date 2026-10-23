// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Vitest setup for component tests. Extends `expect` with @testing-library/jest-dom
// matchers (toBeInTheDocument, toHaveTextContent, …) and unmounts rendered trees
// after each test so they don't leak between cases.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// happy-dom's Animation.cancel() rejects `finished` with an AbortError but skips the Web
// Animations step that marks that promise handled ("cancel an animation", step 1.3), so every
// cancelled animation nobody awaited surfaces as an unhandled rejection. Motion cancels its
// native animations when a component unmounts, which cleanup() does after every test. Mark the
// promise handled the way a browser does; code that awaits `finished` still sees the rejection.
// eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound with call() below
const cancelAnimation = Animation.prototype.cancel;
Animation.prototype.cancel = function cancel(this: Animation) {
  this.finished.catch(() => undefined);
  cancelAnimation.call(this);
};

afterEach(() => {
  cleanup();
  // Clear call history between tests (implementations set in beforeEach are
  // re-applied per test, so mock return values survive while .calls reset).
  vi.clearAllMocks();
});
