// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Vitest setup for component tests. Extends `expect` with @testing-library/jest-dom
// matchers (toBeInTheDocument, toHaveTextContent, …) and unmounts rendered trees
// after each test so they don't leak between cases.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  // Clear call history between tests (implementations set in beforeEach are
  // re-applied per test, so mock return values survive while .calls reset).
  vi.clearAllMocks();
});
