// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// `terraform login` opens this page in the browser. The browser session is the cookie, shared by
// every tab, so any page could open this one in a signed-in browser: nothing is minted until the
// person confirms, after seeing the account and the listener the code goes to. A browser without a
// session signs in first and comes back (backend-for-frontend-session-plan.md, AC35 context).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OAuthAuthorize from './OAuthAuthorize';

const login = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ login }) }));

const query = '?response_type=code&client_id=terraform-cli&redirect_uri=http%3A%2F%2Flocalhost%3A10000%2Flogin&code_challenge=abc&code_challenge_method=S256&state=xyz';

function signedInFetch() {
  return vi.fn((url: string) => Promise.resolve(url.endsWith('/auth/session')
    ? new Response(JSON.stringify({ data: { id: 's', type: 'sessions', attributes: { email: 'ada@example.com' } } }), { status: 200 })
    : new Response(JSON.stringify({ code: 'one-time', state: 'xyz' }), { status: 201, headers: { 'Content-Type': 'application/json' } })));
}

function renderPage() {
  render(<MemoryRouter initialEntries={[`/oauth/authorize${query}`]}><OAuthAuthorize /></MemoryRouter>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('OAuthAuthorize', () => {
  it('asks before minting, then hands the code to the CLI', async () => {
    const fetchMock = signedInFetch();
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    renderPage();

    const authorize = await screen.findByRole('button', { name: 'Authorize' });
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('localhost:10000')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/oauth/authorize')), 'nothing is minted before the person confirms').toBe(false);
    expect(assign).not.toHaveBeenCalled();

    authorize.click();
    await waitFor(() => { expect(assign).toHaveBeenCalledWith('http://localhost:10000/login?code=one-time&state=xyz'); });
    expect(login).not.toHaveBeenCalled();
  });

  it('answers the CLI with access_denied on cancel and mints nothing', async () => {
    const fetchMock = signedInFetch();
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    renderPage();
    (await screen.findByRole('button', { name: 'Cancel' })).click();

    await waitFor(() => { expect(assign).toHaveBeenCalledWith('http://localhost:10000/login?error=access_denied&state=xyz'); });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/oauth/authorize'))).toBe(false);
    expect(await screen.findByText('Authorization cancelled')).toBeInTheDocument();
  });

  // The page navigates to the redirect URI on Authorize and on Cancel, so anything but the CLI's
  // loopback listener is refused before the consent step: a javascript: URL would run script in
  // this origin, another host would be an open redirect.
  it.each([
    ['a javascript: URL', 'javascript:void(window.pwned=true)//'],
    ['another host', 'https://evil.example.com/login'],
    ['a port the CLI does not use', 'http://localhost:8080/login'],
    ['https on loopback', 'https://localhost:10000/login'],
  ])('refuses %s as the redirect and never navigates', async (_name, redirectUri) => {
    const fetchMock = signedInFetch();
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const bad = `?response_type=code&client_id=terraform-cli&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=abc&code_challenge_method=S256&state=xyz`;
    render(<MemoryRouter initialEntries={[`/oauth/authorize${bad}`]}><OAuthAuthorize /></MemoryRouter>);

    expect(await screen.findByText('Invalid or unsupported authorization request')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Authorize' })).toBeNull();
    expect(assign).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/oauth/authorize'))).toBe(false);
  });

  it('signs in first when the browser has no session, returning here', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ status: '401', code: 'authentication-required' }] }), { status: 401 })));
    window.history.replaceState({}, '', `/oauth/authorize${query}`);
    renderPage();
    await waitFor(() => { expect(login).toHaveBeenCalled(); });
    expect(sessionStorage.getItem('oauth_return_url')).toContain('/oauth/authorize');
  });
});
