// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The sign-in callback (backend-for-frontend-session-plan.md, AC15, AC20): it posts the code and
// state for the API to redeem, which replaces whatever session the browser held, so several tabs
// and a second sign-in all end with one session. Only a refused redemption (a reload, or a code
// another tab already used) falls back to the session the browser has.
//
// It used to skip redemption whenever a session existed, which kept a browser signed in as the
// first account when it signed in again as another.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Callback from './Callback';

const sessionDoc = { data: { id: 's-1', type: 'sessions', attributes: { email: 'ada@example.com' } } };

function renderCallback(query: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/auth/callback${query}`]}>
        <Routes>
          <Route path="/auth/callback" element={<Callback />} />
          <Route path="/dashboard" element={<p>dashboard</p>} />
          <Route path="/auth/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubFetch(getStatus: number, postStatus: number, postBody: unknown = sessionDoc) {
  const mock = vi.fn((_url: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') === 'GET') {
      return Promise.resolve(getStatus === 200
        ? new Response(JSON.stringify(sessionDoc), { status: 200 })
        : new Response(JSON.stringify({ errors: [{ status: '401', code: 'authentication-required' }] }), { status: getStatus }));
    }
    return Promise.resolve(new Response(JSON.stringify(postBody), { status: postStatus }));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('Callback', () => {
  it('redeems the code and state when the browser has no session', async () => {
    const mock = stubFetch(401, 201);
    renderCallback('?code=the-code&state=the-state');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    const post = mock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ data: { type: 'sessions', attributes: { code: 'the-code', state: 'the-state' } } });
  });

  // A browser that is signed in and signs in again redeems the new code: the API replaces its
  // session, so it does not stay signed in as the first account.
  it('redeems even when the browser already has a session', async () => {
    const mock = stubFetch(200, 201);
    renderCallback('?code=the-code&state=the-state');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(mock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true);
  });

  // AC20: another tab already used this browser's code, or the page was reloaded; the refused
  // redemption goes on with the session the browser has.
  it('goes on with the existing session when the redemption is refused', async () => {
    stubFetch(200, 400, { errors: [{ status: '400', detail: 'the sign-in expired or was started in another browser; sign in again' }] });
    renderCallback('?code=the-code&state=the-state');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
  });

  // AC15: the person lands back on the page they had open.
  it('returns to the page the person was on', async () => {
    stubFetch(401, 201);
    sessionStorage.setItem('oauth_return_url', '/app/acme/workspaces?tab=runs');
    const hrefs: string[] = [];
    vi.stubGlobal('location', { ...window.location, origin: 'http://localhost:3000', set href(v: string) { hrefs.push(v); } });
    renderCallback('?code=c&state=s');
    await waitFor(() => { expect(hrefs).toEqual(['http://localhost:3000/app/acme/workspaces?tab=runs']); });
    expect(sessionStorage.getItem('oauth_return_url')).toBeNull();
  });

  it('ignores a return address on another origin', async () => {
    stubFetch(401, 201);
    sessionStorage.setItem('oauth_return_url', 'https://evil.example.net/phish');
    renderCallback('?code=c&state=s');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
  });

  // #829 D5: an unverified email is refused at sign-in and sent to the page that explains it.
  it('sends an unverified account to the verify-email page', async () => {
    stubFetch(401, 403, { errors: [{ status: '403', code: 'email-not-verified', detail: 'the account\'s email address is not verified' }] });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderCallback('?code=c&state=s');
    await waitFor(() => { expect(assign).toHaveBeenCalledWith('/login/verify-email-required?email='); });
  });

  // Any other 403 (an untrusted origin, a proxy that drops the CSRF header) is shown as itself, not
  // taken for an unverified email.
  it('shows any other refusal instead of the verify-email page', async () => {
    stubFetch(401, 403, { errors: [{ status: '403', detail: 'cross-origin request blocked' }] });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderCallback('?code=c&state=s');
    expect(await screen.findByText('cross-origin request blocked')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows the refusal for a code from another browser', async () => {
    stubFetch(401, 400, { errors: [{ status: '400', detail: 'the sign-in could not be completed; start again' }] });
    renderCallback('?code=c&state=s');
    expect(await screen.findByText('the sign-in could not be completed; start again')).toBeInTheDocument();
  });

  it('reports a redirect without a code', async () => {
    stubFetch(401, 201);
    renderCallback('');
    expect(await screen.findByText('No authorization code received')).toBeInTheDocument();
  });
});
