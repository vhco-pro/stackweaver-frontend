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

  // #829 AC8: registration and self-service reset are offered only when the policy says so, and
  // a settings load that fails offers neither (it used to fail open and show both).
  it('hides "Create account" and "Forgot password?" when the settings cannot be loaded', async () => {
    vi.mocked(getLoginSettings).mockRejectedValue(new Error('network'));
    render(
      <MemoryRouter initialEntries={['/login/loginname?authRequest=req']}>
        <LoginName />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText(/username or email/i)).toBeInTheDocument();
    await waitFor(() => { expect(getLoginSettings).toHaveBeenCalled(); });
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
  });

  it('shows both when the policy allows registration and password reset', async () => {
    vi.mocked(getLoginSettings).mockResolvedValue({ allowRegister: true, hidePasswordReset: false });
    render(
      <MemoryRouter initialEntries={['/login/loginname?authRequest=req']}>
        <LoginName />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it('hides both when the policy closes registration and hides password reset', async () => {
    vi.mocked(getLoginSettings).mockResolvedValue({ allowRegister: false, hidePasswordReset: true });
    render(
      <MemoryRouter initialEntries={['/login/loginname?authRequest=req']}>
        <LoginName />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText(/username or email/i)).toBeInTheDocument();
    await waitFor(() => { expect(getLoginSettings).toHaveBeenCalled(); });
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
  });
});
