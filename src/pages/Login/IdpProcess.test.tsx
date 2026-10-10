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

  // #829 D5: auto-registration sends only the intent; the proxy builds the user from Zitadel.
  it('auto-registers an unlinked identity by sending only the intent', async () => {
    mocks.completeIdP.mockResolvedValue({
      idpInformation: { idpId: 'idp-1', rawInformation: {} },
      addHumanUser: { email: { email: 'ada@corp.example' }, idpLinks: [{ idpId: 'idp-1', userId: 'sub-1' }] },
    });
    mocks.createUser.mockResolvedValue({ userId: 'u-1' });
    mocks.createSession.mockResolvedValue({ sessionId: 's-1', sessionToken: 't-1' });

    renderAt('intent-create');

    await vi.waitFor(() => { expect(mocks.createUser).toHaveBeenCalledTimes(1); });
    expect(mocks.createUser).toHaveBeenCalledWith({ idpIntentId: 'intent-create', idpIntentToken: 'tok' });
  });

  // #829 Q13: an email that already has an account must sign in with its password first.
  it('tells the user to sign in with their password when the email already has an account', async () => {
    mocks.completeIdP.mockResolvedValue({
      idpInformation: { idpId: 'idp-1', rawInformation: {} },
      addHumanUser: { email: { email: 'ada@corp.example' } },
    });
    mocks.createUser.mockRejectedValue(Object.assign(new Error('conflict'), { code: 409 }));

    renderAt('intent-conflict');

    expect(await screen.findByText(/sign in with your password first/i)).toBeInTheDocument();
  });
});
