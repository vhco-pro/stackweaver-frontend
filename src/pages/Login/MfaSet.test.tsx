// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// #829 AC8: MFA enrollment offers email codes only when the login policy allows them, which
// zitadel-init does only when mail can be delivered. The other methods need no mail and stay.

import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getLoginSettings } from '@/api/auth-client';
import MfaSet from './MfaSet';

vi.mock('@/api/auth-client', () => ({
  getLoginSettings: vi.fn(),
}));

vi.mock('./LoginLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderMfaSet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login/mfa/set?authRequest=req&sessionId=s1&userId=u1']}>
        <MfaSet />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const alwaysOffered = [/authenticator app/i, /security key/i, /passkey/i];

describe('MfaSet', () => {
  it('offers email codes when the policy allows them', async () => {
    vi.mocked(getLoginSettings).mockResolvedValue({
      secondFactors: ['SECOND_FACTOR_TYPE_OTP', 'SECOND_FACTOR_TYPE_OTP_EMAIL'],
    });
    renderMfaSet();
    expect(await screen.findByRole('button', { name: /email verification/i })).toBeInTheDocument();
    for (const name of alwaysOffered) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('does not offer email codes when the policy does not allow them', async () => {
    vi.mocked(getLoginSettings).mockResolvedValue({ secondFactors: ['SECOND_FACTOR_TYPE_OTP', 'SECOND_FACTOR_TYPE_U2F'] });
    renderMfaSet();
    await waitFor(() => { expect(getLoginSettings).toHaveBeenCalled(); });
    for (const name of alwaysOffered) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /email verification/i })).not.toBeInTheDocument();
  });

  it('does not offer email codes when the settings cannot be loaded', async () => {
    vi.mocked(getLoginSettings).mockRejectedValue(new Error('network'));
    renderMfaSet();
    await waitFor(() => { expect(getLoginSettings).toHaveBeenCalled(); });
    expect(screen.getByRole('button', { name: /authenticator app/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /email verification/i })).not.toBeInTheDocument();
  });
});
