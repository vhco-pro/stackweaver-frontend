// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession } from './auth-client';

type AuthErr = Error & { code?: number; grpcCode?: number };

async function rejectionOf(p: Promise<unknown>): Promise<AuthErr> {
  try {
    await p;
  } catch (err) {
    return err as AuthErr;
  }
  throw new Error('expected the call to reject');
}

describe('authFetch error shape', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Zitadel answers with a JSON body whose `code` is a gRPC code (5 = NotFound). Callers
  // compare `code` against HTTP statuses, so the body's value must not overwrite the status.
  it('carries the HTTP status as code and the body gRPC code separately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 5, message: 'User could not be found (QUERY-Dfbg2)' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    const err = await rejectionOf(createSession({}));

    expect(err.code).toBe(404);
    expect(err.grpcCode).toBe(5);
    expect(err.message).toBe('User could not be found (QUERY-Dfbg2)');
  });

  it('falls back to the status line when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('upstream down', { status: 502, statusText: 'Bad Gateway' }),
    ));

    const err = await rejectionOf(createSession({}));

    expect(err.code).toBe(502);
    expect(err.grpcCode).toBeUndefined();
    expect(err.message).toBe('Bad Gateway');
  });
});
