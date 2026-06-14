// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for LoginName's `immutability` warning fix (the mount effect's
// auto-submit branch referenced `doSubmit` before its declaration; the fix reorders
// `doSubmit` above the effect). Pins: a `loginHint` triggers the mount auto-submit,
// which fetches settings/providers and then calls doSubmit → createSession.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createSession, getLoginSettings, listIdpProviders } from '@/api/auth-client';
import LoginName from './LoginName';

vi.mock('@/api/auth-client', () => ({
  createSession: vi.fn(),
  getLoginSettings: vi.fn(),
  listIdpProviders: vi.fn(),
  startIdP: vi.fn(),
}));

// LoginLayout pulls in ThemeContext; render its children directly to keep the test
// focused on LoginName's own behaviour.
vi.mock('./LoginLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('LoginName', () => {
  beforeEach(() => {
    vi.mocked(getLoginSettings).mockResolvedValue({ ignoreUnknownUsernames: false });
    vi.mocked(listIdpProviders).mockResolvedValue({ result: [] });
    vi.mocked(createSession).mockResolvedValue({ sessionId: 's1', sessionToken: 'tok1' });
  });

  it('renders the sign-in form on mount (no login hint)', async () => {
    render(
      <MemoryRouter initialEntries={['/login/loginname?authRequest=req']}>
        <LoginName />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText(/username or email/i)).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('auto-submits via doSubmit when a loginHint is present', async () => {
    render(
      <MemoryRouter initialEntries={['/login/loginname?authRequest=req&loginHint=ada@example.com']}>
        <LoginName />
      </MemoryRouter>,
    );

    // The mount effect fetches settings/providers, then the reordered doSubmit
    // is invoked with the hint → createSession with that loginName.
    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({ checks: { user: { loginName: 'ada@example.com' } } });
    });
  });
});
