// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The browser's side of the backend-for-frontend session
// (docs/internal/plans/security/backend-for-frontend-session-plan.md, AC15, AC24).
//
// This file used to pin refreshAccessToken: one refresh in flight per tab, and a refused refresh
// told apart from a failed one. The browser holds no refresh token any more and never refreshes;
// the API keeps the session, so those tests went with the refresh grant. What a 401 means is now
// decided by the JSON:API error code, pinned below.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CSRF_HEADER,
  fetchSession,
  isAuthenticationRequired,
  onAuthenticationRequired,
  redeemSignIn,
  reportAuthenticationRequired,
  SessionError,
  sweepTokenEraStorage,
  TOKEN_ERA_LOCAL_KEYS,
  TOKEN_ERA_SESSION_KEYS,
} from './zitadel';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/vnd.api+json' } });
}

const sessionDoc = {
  data: {
    id: 's-1',
    type: 'sessions',
    attributes: { email: 'ada@example.com', name: 'Ada Lovelace', 'given-name': 'Ada', 'family-name': 'Lovelace', picture: '', 'expires-at': '2026-10-24T21:00:00Z' },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe('fetchSession', () => {
  it('reads the profile from GET /auth/session, with the cookie and the CSRF header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sessionDoc));
    vi.stubGlobal('fetch', fetchMock);

    const profile = await fetchSession();

    expect(profile).toMatchObject({ id: 's-1', email: 'ada@example.com', name: 'Ada Lovelace', givenName: 'Ada' });
    expect(profile?.picture).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/session$/);
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)[CSRF_HEADER]).toBe('1');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('answers null for a 401: the browser is not signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { errors: [{ status: '401', code: 'authentication-required' }] })));
    await expect(fetchSession()).resolves.toBeNull();
  });

  it('throws for anything else, so a blip is not taken for a sign-out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(503, { errors: [{ status: '503', detail: 'down' }] })));
    await expect(fetchSession()).rejects.toBeInstanceOf(SessionError);
  });
});

describe('redeemSignIn', () => {
  it('posts the code and state as a sessions document, and nothing else', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, sessionDoc));
    vi.stubGlobal('fetch', fetchMock);

    await redeemSignIn('the-code', 'the-state');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ data: { type: 'sessions', attributes: { code: 'the-code', state: 'the-state' } } });
    expect((init.headers as Record<string, string>)[CSRF_HEADER]).toBe('1');
  });

  it('carries the status of a refusal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { errors: [{ status: '403', detail: 'the account\'s email address is not verified' }] })));
    const err: unknown = await redeemSignIn('c', 's').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SessionError);
    expect((err as SessionError).status).toBe(403);
    expect((err as SessionError).message).toContain('not verified');
  });
});

// AC15: the token-era keys are gone after the first load of the new SPA.
describe('sweepTokenEraStorage', () => {
  beforeEach(() => {
    for (const key of TOKEN_ERA_SESSION_KEYS) sessionStorage.setItem(key, 'x');
    for (const key of TOKEN_ERA_LOCAL_KEYS) localStorage.setItem(key, 'x');
    sessionStorage.setItem('oauth_return_url', '/workspaces');
    localStorage.setItem('theme', 'dark');
  });

  it('deletes every token-era key and reports a signed-in browser', () => {
    expect(sweepTokenEraStorage()).toBe(true);
    for (const key of TOKEN_ERA_SESSION_KEYS) expect(sessionStorage.getItem(key)).toBeNull();
    for (const key of TOKEN_ERA_LOCAL_KEYS) expect(localStorage.getItem(key)).toBeNull();
    // Unrelated keys are left alone.
    expect(sessionStorage.getItem('oauth_return_url')).toBe('/workspaces');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('reports no sign-in when the browser held no token', () => {
    sessionStorage.removeItem('zitadel_access_token');
    sessionStorage.removeItem('zitadel_refresh_token');
    expect(sweepTokenEraStorage()).toBe(false);
    expect(sessionStorage.getItem('zitadel_oidc_state')).toBeNull();
  });
});

// AC24: only the authentication layer's code ends the session.
describe('isAuthenticationRequired', () => {
  it('is true for the authentication layer\'s code', () => {
    expect(isAuthenticationRequired({ errors: [{ status: '401', code: 'authentication-required' }] })).toBe(true);
  });
  it('is false for a 401 passed through from another service, or no document at all', () => {
    expect(isAuthenticationRequired({ errors: [{ status: '401', detail: 'bad registry credentials' }] })).toBe(false);
    expect(isAuthenticationRequired({ errors: ['unauthorized'] })).toBe(false);
    expect(isAuthenticationRequired({})).toBe(false);
    expect(isAuthenticationRequired(null)).toBe(false);
  });
});

describe('onAuthenticationRequired', () => {
  it('calls every listener until it is removed', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onAuthenticationRequired(first);
    const stopSecond = onAuthenticationRequired(second);
    reportAuthenticationRequired();
    stopFirst();
    reportAuthenticationRequired();
    stopSecond();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
