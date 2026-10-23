// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// A refresh signs the browser out only when the server refused it. With one-hour tokens the SPA
// refreshes once an hour per tab, so a 429, a 5xx or a network blip at that moment must not end
// the session; and two renewals in one tab must not post the same refresh token twice, because
// Zitadel rotates it and refuses the second (React StrictMode's double mount does exactly that).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshAccessToken } from './zitadel';

const renewed = { access_token: 'at-new', id_token: 'id-new', refresh_token: 'rt-new', expires_in: 3600 };

function answer(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('refreshAccessToken', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('zitadel_access_token', 'at-old');
    sessionStorage.setItem('zitadel_id_token', 'id-old');
    sessionStorage.setItem('zitadel_refresh_token', 'rt-old');
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('renews and stores the new tokens', async () => {
    fetchMock.mockResolvedValue(answer(200, renewed));

    const result = await refreshAccessToken();

    expect(result).toEqual({ status: 'renewed', tokens: renewed });
    expect(sessionStorage.getItem('zitadel_refresh_token')).toBe('rt-new');
  });

  it.each([
    ['a dead refresh token or an ended session', 400, { error: 'invalid_grant' }],
    ['an invalid client', 401, { error: 'invalid_client' }],
    ['a forbidden request', 403, {}],
  ])('reports %s as refused', async (_, status, body) => {
    fetchMock.mockResolvedValue(answer(status, body));

    const result = await refreshAccessToken();

    expect(result.status).toBe('refused');
  });

  it.each([
    ['a timeout', 408],
    ['rate limiting', 429],
    ['an unavailable server', 503],
  ])('reports %s as failed and keeps the stored tokens', async (_, status) => {
    fetchMock.mockResolvedValue(answer(status));

    const result = await refreshAccessToken();

    expect(result.status).toBe('failed');
    expect(sessionStorage.getItem('zitadel_access_token')).toBe('at-old');
    expect(sessionStorage.getItem('zitadel_refresh_token')).toBe('rt-old');
  });

  it('reports a network error as failed and keeps the stored tokens', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await refreshAccessToken();

    expect(result.status).toBe('failed');
    expect(sessionStorage.getItem('zitadel_refresh_token')).toBe('rt-old');
  });

  it('reports a missing refresh token as refused without a request', async () => {
    sessionStorage.removeItem('zitadel_refresh_token');

    const result = await refreshAccessToken();

    expect(result.status).toBe('refused');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends one request for two renewals started together', async () => {
    let release: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { release = resolve; }));

    const first = refreshAccessToken();
    const second = refreshAccessToken();
    release(answer(200, renewed));

    expect(await first).toEqual(await second);
    expect((await first).status).toBe('renewed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('starts a new request once the previous one has settled', async () => {
    fetchMock.mockResolvedValue(answer(200, renewed));

    await refreshAccessToken();
    await refreshAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
