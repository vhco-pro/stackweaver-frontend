// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// After a verified email, a user who has no way to sign in yet (the auth proxy answers with
// `authenticatorSetupRequired`) goes on to set one up; everyone else goes to the success page.

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Verify from './Verify';

vi.mock('@/api/auth-client', () => ({
  finalizeAuthRequest: vi.fn(),
}));

vi.mock('./LoginLayout', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div><h1>{title}</h1>{children}</div>
  ),
}));

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function answerVerify(body: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
}

async function verify() {
  render(
    <MemoryRouter initialEntries={['/login/verify?userId=u1&authRequest=req1&invite=true']}>
      <Routes>
        <Route path="/login/verify" element={<Verify />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Code'), '123456');
  await user.click(screen.getByRole('button', { name: /verify/i }));
}

describe('Verify', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a user without an authentication method on to set one up', async () => {
    answerVerify({ details: {}, authenticatorSetupRequired: true });
    await verify();

    const where = await screen.findByTestId('where');
    expect(where.textContent).toMatch(/^\/login\/authenticator\/set\?/);
    const params = new URLSearchParams(where.textContent?.split('?')[1]);
    expect(params.get('userId')).toBe('u1');
    expect(params.get('authRequest')).toBe('req1');
  });

  it('checks an invite code at the invite-code endpoint and an email code at the email one', async () => {
    answerVerify({ details: {}, authenticatorSetupRequired: true });
    await verify();
    const [inviteURL, inviteInit] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(inviteURL).toMatch(/\/auth\/users\/u1\/invite-code\/verify$/);
    expect(JSON.parse(inviteInit.body as string)).toEqual({ verificationCode: '123456' });
    vi.unstubAllGlobals();

    answerVerify({ details: {} });
    render(
      <MemoryRouter initialEntries={['/login/verify?userId=u2&authRequest=req2']}>
        <Routes>
          <Route path="/login/verify" element={<Verify />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getAllByLabelText('Code').at(-1) as HTMLElement, '654321');
    await user.click(screen.getAllByRole('button', { name: /verify/i }).at(-1) as HTMLElement);
    const [emailURL] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(emailURL).toMatch(/\/auth\/users\/u2\/email$/);
  });

  it('sends everyone else to the success page', async () => {
    answerVerify({ details: {} });
    await verify();

    expect(await screen.findByTestId('where')).toHaveTextContent('/login/verify/success?authRequest=req1');
  });
});
