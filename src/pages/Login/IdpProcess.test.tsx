// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// #598: the IdP intent token is single-use. The consume guard used to be a
// per-mount ref, so a remount re-fired completeIdP and the losing call 400ed.
// Pins that a remount for the same intentId reuses the first run's outcome.

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  completeIdP: vi.fn(),
  getLoginSettings: vi.fn(),
  createSession: vi.fn(),
  finalizeAuthRequest: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock('@/api/auth-client', () => mocks);

vi.mock('./LoginLayout', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

import IdpProcess from './IdpProcess';

const renderAt = (intentId: string) =>
  render(
    <MemoryRouter initialEntries={[`/login/idp/oidc/process?id=${intentId}&token=tok`]}>
      <Routes>
        <Route path="/login/idp/:provider/process" element={<IdpProcess />} />
      </Routes>
    </MemoryRouter>,
  );

describe('IdpProcess', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('consumes the intent once across a remount and shows the outcome on the new instance', async () => {
    let reject: (err: Error) => void = () => {};
    mocks.completeIdP.mockReturnValue(
      new Promise((_resolve, rej) => { reject = rej; }),
    );

    const first = renderAt('intent-remount');
    first.unmount();
    renderAt('intent-remount');

    expect(mocks.completeIdP).toHaveBeenCalledTimes(1);

    reject(new Error('Identity provider login failed'));
    expect(await screen.findByText('Login failed')).toBeInTheDocument();
    expect(mocks.completeIdP).toHaveBeenCalledTimes(1);
  });

  it('consumes a different intent independently', async () => {
    mocks.completeIdP.mockRejectedValue(new Error('Identity provider login failed'));

    renderAt('intent-other');

    expect(await screen.findByText('Login failed')).toBeInTheDocument();
    expect(mocks.completeIdP).toHaveBeenCalledTimes(1);
    expect(mocks.completeIdP).toHaveBeenCalledWith('intent-other', 'tok');
  });
});
