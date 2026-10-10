// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// #829 AC8: the password page offers "Forgot password?" only when the login policy allows
// self-service reset. Without SMTP the policy hides it, because a reset code could never arrive.

import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getLoginSettings } from '@/api/auth-client';
import Password from './Password';

vi.mock('@/api/auth-client', () => ({
  createSession: vi.fn(),
  updateSession: vi.fn(),
  finalizeAuthRequest: vi.fn(),
  getSession: vi.fn(),
  getLoginSettings: vi.fn(),
  getUserAuthMethods: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('./LoginLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderPassword() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login/password?authRequest=req&sessionId=s1&loginName=ada']}>
        <Password />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Password', () => {
  it('offers "Forgot password?" when the policy allows self-service reset', async () => {
    vi.mocked(getLoginSettings).mockResolvedValue({ hidePasswordReset: false });
    renderPassword();
    expect(await screen.findByText(/forgot password/i)).toBeInTheDocument();
  });

  it('hides "Forgot password?" when the policy hides password reset', async () => {
    vi.mocked(getLoginSettings).mockResolvedValue({ hidePasswordReset: true });
    renderPassword();
    await waitFor(() => { expect(getLoginSettings).toHaveBeenCalled(); });
    expect(screen.getByText(/use a different account/i)).toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
  });

  it('hides "Forgot password?" when the settings cannot be loaded', async () => {
    vi.mocked(getLoginSettings).mockRejectedValue(new Error('network'));
    renderPassword();
    await waitFor(() => { expect(getLoginSettings).toHaveBeenCalled(); });
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
  });
});
