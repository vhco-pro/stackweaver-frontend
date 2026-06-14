// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for Accounts' `immutability` warning fix (the redirect used
// `window.location.href = ...` assignment, replaced with `window.location.assign(...)`).
// Pins: sessions load on mount and selecting one creates + finalizes the auth request
// and navigates to the returned callback URL via assign().

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { searchSessions, createSession, finalizeAuthRequest } from '@/api/auth-client';
import Accounts from './Accounts';

vi.mock('@/api/auth-client', () => ({
  searchSessions: vi.fn(),
  createSession: vi.fn(),
  finalizeAuthRequest: vi.fn(),
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
    vi.mocked(createSession).mockResolvedValue({ sessionId: 'sess1', sessionToken: 'tok1' });
    vi.mocked(finalizeAuthRequest).mockResolvedValue({ callbackUrl: 'https://app.example.com/cb' });
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

  it('selecting a session finalizes and redirects via window.location.assign', async () => {
    const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login/accounts?authRequest=req123']}>
        <Accounts />
      </MemoryRouter>,
    );

    await user.click(await screen.findByText('Ada'));

    expect(createSession).toHaveBeenCalledWith({ checks: { user: { loginName: 'ada@example.com' } } });
    expect(finalizeAuthRequest).toHaveBeenCalledWith({
      authRequestId: 'req123',
      sessionId: 'sess1',
      sessionToken: 'tok1',
    });
    expect(assignSpy).toHaveBeenCalledWith('https://app.example.com/cb');
    assignSpy.mockRestore();
  });
});
