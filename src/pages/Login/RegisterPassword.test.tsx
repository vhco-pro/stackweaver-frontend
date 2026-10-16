// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// A user with no way to sign in yet sets a first password here, after verifying their email.
// The page sends no current password and no code: the proof is the verification the auth proxy
// recorded for this browser. When the proxy refuses (the verification is missing or has
// expired), the page must say so, rather than talk about a code the user never typed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { changePassword } from '@/api/auth-client';
import RegisterPassword from './RegisterPassword';

vi.mock('@/api/auth-client', () => ({
  changePassword: vi.fn(),
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

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/login/register/password?userId=u1&authRequest=req1']}>
      <Routes>
        <Route path="/login/register/password" element={<RegisterPassword />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submit(password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm password'), password);
  await user.click(screen.getByRole('button', { name: /set password/i }));
}

// The proxy's refusal of a password set without proof, as authFetch throws it.
function refusal(): Error {
  const err = new Error('Code is invalid (CODE-3M9fs)') as Error & { code: number; grpcCode: number };
  err.code = 400;
  err.grpcCode = 9;
  return err;
}

describe('RegisterPassword', () => {
  beforeEach(() => {
    vi.mocked(changePassword).mockReset();
  });

  it('sets the password with no current password or code, then returns to sign in', async () => {
    vi.mocked(changePassword).mockResolvedValue({ details: {} });
    renderPage();

    await submit('NewPassword1!');

    expect(changePassword).toHaveBeenCalledWith('u1', {
      newPassword: { password: 'NewPassword1!', changeRequired: false },
    });
    expect(await screen.findByTestId('where')).toHaveTextContent('/login/loginname?authRequest=req1');
  });

  it('asks the user to verify again when the proxy refuses the set', async () => {
    vi.mocked(changePassword).mockRejectedValue(refusal());
    renderPage();

    await submit('NewPassword1!');

    expect(await screen.findByText(/verify your email again/i)).toBeInTheDocument();
    expect(screen.queryByText(/code you entered/i)).not.toBeInTheDocument();
  });

  it('shows a password rule the identity provider rejects', async () => {
    const err = new Error('Password must contain upper case') as Error & { code: number };
    err.code = 400;
    vi.mocked(changePassword).mockRejectedValue(err);
    renderPage();

    await submit('newpassword1!');

    expect(await screen.findByText('Password must contain upper case')).toBeInTheDocument();
  });
});
