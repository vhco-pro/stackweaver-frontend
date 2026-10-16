// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Once a passkey is registered the page offers the way on: "Continue to sign in" takes the user to
// the sign-in page with the same auth request, where RegisterPassword sends a user who set a first
// password.

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PasskeySet from './PasskeySet';

vi.mock('./LoginLayout', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div><h1>{title}</h1>{children}</div>
  ),
}));

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('PasskeySet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers to continue to sign in once the passkey is registered', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({
        passkeyId: 'pk-1',
        publicKeyCredentialCreationOptions: { publicKey: { challenge: 'Y2hhbGxlbmdl', user: { id: 'dTE', name: 'u', displayName: 'u' } } },
      }))
      .mockResolvedValueOnce(json({ details: {} })));
    const buf = new Uint8Array([1, 2, 3]).buffer;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue({
          type: 'public-key', id: 'cred', rawId: buf,
          response: { clientDataJSON: buf, attestationObject: buf },
        }),
      },
    });

    render(
      <MemoryRouter initialEntries={['/login/passkey/set?userId=u1&authRequest=req1']}>
        <Routes>
          <Route path="/login/passkey/set" element={<PasskeySet />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /register passkey/i }));
    expect(await screen.findByRole('heading', { name: 'Passkey registered' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue to sign in' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/login/loginname?authRequest=req1');
  });
});
