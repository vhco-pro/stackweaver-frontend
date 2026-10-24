// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins: sessions load on mount; picking one routes to the password page for that login name to
// re-authenticate.
//
// Picking used to create a fresh session holding only a user check and finalize that, minting a
// token with no credential verified. The picker now re-authenticates on the password page, and
// the proxy refuses any finalize whose session verified no credential.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { searchSessions } from '@/api/auth-client';
import Accounts from './Accounts';

vi.mock('@/api/auth-client', () => ({
  searchSessions: vi.fn(),
}));

// LoginLayout pulls in ThemeContext; render its children directly to keep the test
// focused on Accounts' own behaviour.
vi.mock('./LoginLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('Accounts', () => {
  beforeEach(() => {
    vi.mocked(searchSessions).mockResolvedValue({
      sessions: [{ id: 's1', factors: { user: { loginName: 'ada@example.com', displayName: 'Ada' } } }],
    });
  });

  it('lists active sessions on mount', async () => {
    render(
      <MemoryRouter initialEntries={['/login/accounts?authRequest=req123']}>
        <Accounts />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(searchSessions).toHaveBeenCalledTimes(1);
  });

  it('picking a session routes to the password page to re-authenticate', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login/accounts?authRequest=req123']}>
        <Routes>
          <Route path="/login/accounts" element={<Accounts />} />
          <Route path="/login/password" element={<PasswordProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText('Ada'));

    expect(await screen.findByTestId('password-page')).toHaveTextContent('authRequest=req123&loginName=ada%40example.com');
  });
});

function PasswordProbe() {
  const location = useLocation();
  return <div data-testid="password-page">{location.search}</div>;
}
