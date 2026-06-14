// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for PasswordSet's `refs` warning fix: the URL params were
// captured into refs read during render; the fix captures them once via lazy
// useState initialisers. Pins: on mount the URL is stripped, and the captured
// userId/code survive the strip and flow into the changePassword submit.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { changePassword } from '@/api/auth-client';
import PasswordSet from './PasswordSet';

vi.mock('@/api/auth-client', () => ({
  changePassword: vi.fn(),
}));

vi.mock('./LoginLayout', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div><h1>{title}</h1>{children}</div>
  ),
}));

describe('PasswordSet', () => {
  beforeEach(() => {
    vi.mocked(changePassword).mockResolvedValue({ message: 'ok' });
  });

  it('strips the URL on mount and titles for the initial-setup flow', () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    render(
      <MemoryRouter initialEntries={['/login/password?userId=u1&code=c1&authRequest=req&initial=true']}>
        <PasswordSet />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
    expect(replaceSpy).toHaveBeenCalled();
    replaceSpy.mockRestore();
  });

  it('submits with the captured userId/code even after the URL is stripped', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login/password?userId=u1&code=c1&authRequest=req&initial=true']}>
        <PasswordSet />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('New password'), 'hunter2hunter2');
    await user.type(screen.getByLabelText('Confirm password'), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /save password/i }));

    expect(changePassword).toHaveBeenCalledWith('u1', {
      newPassword: { password: 'hunter2hunter2', changeRequired: false },
      verificationCode: 'c1',
    });
  });
});
