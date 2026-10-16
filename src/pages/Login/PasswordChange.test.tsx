// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The auth proxy answers a rejected current password with exactly
// {"code":3,"message":"Password is invalid","details":[]}, for every user id. The page must
// recognise that answer and tell the user their current password is wrong; anything else keeps
// its own message.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { changePassword } from '@/api/auth-client';
import PasswordChange from './PasswordChange';

vi.mock('@/api/auth-client', () => ({
  changePassword: vi.fn(),
  finalizeAuthRequest: vi.fn(),
}));

vi.mock('./LoginLayout', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div><h1>{title}</h1>{children}</div>
  ),
}));

// What authFetch throws for an error answer: the body's message, the HTTP status as `code`.
function answered(status: number, message: string, grpcCode: number): Error {
  const err = new Error(message) as Error & { code: number; grpcCode: number };
  err.code = status;
  err.grpcCode = grpcCode;
  return err;
}

async function submit() {
  render(
    <MemoryRouter initialEntries={['/login/password/change?userId=u1&sessionId=s1&authRequest=r1']}>
      <PasswordChange />
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Current password'), 'WrongPassword1!');
  await user.type(screen.getByLabelText('New password'), 'NewPassword1!x');
  await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword1!x');
  await user.click(screen.getByRole('button', { name: /change password/i }));
}

describe('PasswordChange', () => {
  beforeEach(() => {
    vi.mocked(changePassword).mockReset();
  });

  it('says the current password is incorrect when the proxy rejects it', async () => {
    vi.mocked(changePassword).mockRejectedValue(answered(400, 'Password is invalid', 3));
    await submit();

    expect(await screen.findByTestId('pw-change-error')).toHaveTextContent('Current password is incorrect');
  });

  it('keeps the message of any other refusal', async () => {
    vi.mocked(changePassword).mockRejectedValue(answered(400, 'Password must contain upper case', 3));
    await submit();

    expect(await screen.findByTestId('pw-change-error')).toHaveTextContent('Password must contain upper case');
  });
});
