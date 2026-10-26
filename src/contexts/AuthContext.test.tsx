// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The browser session as AuthContext sees it (backend-for-frontend-session-plan.md, AC15, AC24).
//
// This file used to pin the token-era context: the profile came from Zitadel's userinfo, an
// unverified email was caught there, and a refused or failed token renewal decided whether the
// browser stayed signed in. The browser now holds no token. The profile comes from
// GET /auth/session, an unverified email is refused at sign-in by the API
// (TestProvisionBrowserUser_RefusesUnverifiedEmail; Callback sends the person to the verify page),
// and the API alone decides when a session ends, which the SPA learns from a coded 401.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { TOUCH_INTERVAL_MS } from './authSession';
import { needsEmailVerification } from '@/lib/emailVerification';
import { reportAuthenticationRequired } from '@/lib/zitadel';

const authClient = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock('@/api/auth-client', () => authClient);

function Probe() {
  const { session, loading } = useAuth();
  if (loading) return <p>loading</p>;
  return <p>{session ? `signed in as ${session.user.email}` : 'no session'}</p>;
}

function wrapper(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}

const sessionDoc = { data: { id: 's-1', type: 'sessions', attributes: { email: 'ada@example.com', name: 'Ada' } } };

// fetchRoutes answers the session endpoints and records what the SPA sent.
function fetchRoutes(signedIn: boolean) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const mock = vi.fn((url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/session') && (init.method ?? 'GET') === 'GET') {
      return Promise.resolve(signedIn
        ? new Response(JSON.stringify(sessionDoc), { status: 200 })
        : new Response(JSON.stringify({ errors: [{ status: '401', code: 'authentication-required' }] }), { status: 401 }));
    }
    if (url.endsWith('/auth/session/touch')) return Promise.resolve(new Response(null, { status: 204 }));
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
  vi.stubGlobal('fetch', mock);
  return calls;
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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('reads the profile from GET /auth/session, sending no Authorization header', async () => {
    const calls = fetchRoutes(true);
    render(wrapper(<Probe />));

    expect(await screen.findByText('signed in as ada@example.com')).toBeInTheDocument();
    const read = calls.find((c) => c.url.endsWith('/auth/session'));
    expect(read?.init.headers).not.toHaveProperty('Authorization');
    expect((read?.init.headers as Record<string, string>)['X-Stackweaver-CSRF']).toBe('1');
  });

  it('has no session when the API answers 401', async () => {
    fetchRoutes(false);
    render(wrapper(<Probe />));
    expect(await screen.findByText('no session')).toBeInTheDocument();
  });

  // AC24: a 401 carrying authentication-required, from any request, signs the browser out.
  it('signs out when a request reports the session is gone', async () => {
    fetchRoutes(true);
    render(wrapper(<Probe />));
    expect(await screen.findByText('signed in as ada@example.com')).toBeInTheDocument();

    act(() => { reportAuthenticationRequired(); });

    expect(await screen.findByText('no session')).toBeInTheDocument();
  });

  // AC15: the token-era keys are deleted before any query runs, and a browser that was signed in
  // starts sign-in on its own, returning to the page it had open.
  it('sweeps the token-era keys and starts sign-in with the current page as the return address', async () => {
    sessionStorage.setItem('zitadel_access_token', 'old-token');
    sessionStorage.setItem('zitadel_refresh_token', 'old-refresh');
    localStorage.setItem('zitadel_client_id', 'old-client');
    window.history.replaceState({}, '', '/app/acme/workspaces?tab=runs');
    const calls = fetchRoutes(false);
    const routed = globalThis.fetch as (url: string, init?: RequestInit) => Promise<Response>;
    const seenAtFirstRequest: Array<string | null> = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (seenAtFirstRequest.length === 0) seenAtFirstRequest.push(sessionStorage.getItem('zitadel_access_token'));
      return routed(url, init);
    });
    authClient.authorize.mockResolvedValue({ authRequest: 'V2_1' });
    const hrefs: string[] = [];
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/app/acme/workspaces',
      search: '?tab=runs',
      hash: '',
      set href(v: string) { hrefs.push(v); },
    });

    render(wrapper(<Probe />));

    await waitFor(() => { expect(hrefs).toContain('/login/loginname?authRequest=V2_1'); });
    expect(seenAtFirstRequest).toEqual([null]);
    expect(sessionStorage.getItem('zitadel_access_token')).toBeNull();
    expect(sessionStorage.getItem('zitadel_refresh_token')).toBeNull();
    expect(localStorage.getItem('zitadel_client_id')).toBeNull();
    expect(sessionStorage.getItem('oauth_return_url')).toBe('/app/acme/workspaces?tab=runs');
    expect(calls.length).toBeGreaterThan(0);
  });

  it('does not start sign-in on its own for a browser that held no token', async () => {
    fetchRoutes(false);
    render(wrapper(<Probe />));
    expect(await screen.findByText('no session')).toBeInTheDocument();
    expect(authClient.authorize).not.toHaveBeenCalled();
  });

  // AC8: the activity touch is sent only after input, and at most once a minute.
  it('touches the session after input, at most once a minute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = fetchRoutes(true);
    render(wrapper(<Probe />));
    expect(await screen.findByText('signed in as ada@example.com')).toBeInTheDocument();
    const touches = () => calls.filter((c) => c.url.endsWith('/auth/session/touch')).length;

    await act(async () => { await vi.advanceTimersByTimeAsync(5 * TOUCH_INTERVAL_MS); });
    expect(touches()).toBe(0); // time alone is not activity

    act(() => { window.dispatchEvent(new KeyboardEvent('keydown')); });
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    expect(touches()).toBe(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(TOUCH_INTERVAL_MS); });
    expect(touches()).toBe(1);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown')); });
    expect(touches()).toBe(2);
    const touch = calls.find((c) => c.url.endsWith('/auth/session/touch'));
    expect(touch?.init.method).toBe('POST');
    expect((touch?.init.headers as Record<string, string>)['X-Stackweaver-CSRF']).toBe('1');
  });

  it('sends no touch while signed out', async () => {
    const calls = fetchRoutes(false);
    render(wrapper(<Probe />));
    expect(await screen.findByText('no session')).toBeInTheDocument();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown')); });
    expect(calls.some((c) => c.url.endsWith('/auth/session/touch'))).toBe(false);
  });
});

describe('logout', () => {
  beforeEach(() => { fetchRoutes(true); });
  afterEach(() => { vi.unstubAllGlobals(); });

  // AC5: sign-out is a form POST to the API, which ends the session server-side; a POST carries the
  // page's Origin, which the API checks.
  it('submits a POST to /auth/session/end', async () => {
    const submitted: Array<{ method: string; action: string }> = [];
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
      submitted.push({ method: this.method.toLowerCase(), action: this.action });
    });
    function SignOut() {
      const { logout, session } = useAuth();
      return session ? <button onClick={logout}>sign out</button> : <p>waiting</p>;
    }
    render(wrapper(<SignOut />));
    (await screen.findByText('sign out')).click();
    expect(submitted).toEqual([{ method: 'post', action: expect.stringMatching(/\/auth\/session\/end$/) }]);
    vi.restoreAllMocks();
  });
});
