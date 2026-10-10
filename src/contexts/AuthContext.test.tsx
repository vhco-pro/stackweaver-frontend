// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// #829 D5: an account whose email is not verified does not reach the platform (the API answers
// 403). The SPA catches it earlier, from Zitadel's userinfo, and sends the user to a page that
// explains what to do instead of a dashboard full of failing requests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { needsEmailVerification } from '@/lib/emailVerification';

const zitadel = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getUserInfo: vi.fn(),
  getLogoutUrl: vi.fn(),
  clearTokens: vi.fn(),
  clearTokensIfClientChanged: vi.fn(),
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
}));
vi.mock('@/lib/zitadel', () => zitadel);

function Probe() {
  const { session, loading } = useAuth();
  if (loading) return <p>loading</p>;
  return <p>{session ? `signed in as ${session.user.email}` : 'no session'}</p>;
}

describe('needsEmailVerification', () => {
  it('is true for an email Zitadel has not verified', () => {
    expect(needsEmailVerification({ email: 'eve@example.com' })).toBe(true);
    expect(needsEmailVerification({ email: 'eve@example.com', email_verified: false })).toBe(true);
  });
  it('is false for a verified email or an account without one', () => {
    expect(needsEmailVerification({ email: 'ada@example.com', email_verified: true })).toBe(false);
    expect(needsEmailVerification({})).toBe(false);
  });
});

describe('AuthProvider', () => {
  const assign = vi.fn();
  beforeEach(() => {
    zitadel.getAccessToken.mockReturnValue('access-token');
    zitadel.isTokenExpired.mockReturnValue(false);
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends an unverified account to the verify-email page instead of signing it in', async () => {
    zitadel.getUserInfo.mockResolvedValue({ sub: 'u1', email: 'eve@example.com' });
    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => { expect(assign).toHaveBeenCalled(); });
    expect(assign.mock.calls[0][0]).toBe('/login/verify-email-required?email=eve%40example.com');
    expect(zitadel.clearTokens).toHaveBeenCalled();
    expect(await screen.findByText('no session')).toBeInTheDocument();
  });

  it('signs in a verified account', async () => {
    zitadel.getUserInfo.mockResolvedValue({ sub: 'u2', email: 'ada@example.com', email_verified: true });
    render(<AuthProvider><Probe /></AuthProvider>);

    expect(await screen.findByText('signed in as ada@example.com')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
