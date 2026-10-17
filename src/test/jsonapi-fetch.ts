// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// A fetch stub that answers JSON:API documents by route, so a page test exercises the real API
// client (its document parsing included) rather than a mock of the client's return values.

import { vi } from 'vitest';

export interface StubbedResponse {
  status?: number;
  body?: unknown;
}

/** One request the page made: its method, its path below /api/v2 and its parsed body. */
export interface SentRequest {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Routes are keyed `METHOD /path` with the path below the API base (`GET /settings/sessions`).
 * A route answers a fixed response or a function of the request body. An unrouted request
 * answers 404 with a JSON:API error document, so a call the test did not expect fails loudly.
 */
export type Routes = Record<string, StubbedResponse | ((body: unknown) => StubbedResponse)>;

/** Stubs the global fetch with the routes and returns the requests made so far, in order. */
export function stubJsonApiFetch(routes: Routes): () => SentRequest[] {
  const requests: SentRequest[] = [];
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const request: SentRequest = {
      method: (init?.method ?? 'GET').toUpperCase(),
      path: new URL(href).pathname.replace(/^.*\/api\/v2/, ''),
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    requests.push(request);
    const key = `${request.method} ${request.path}`;
    const route = routes[key];
    const answer: StubbedResponse =
      route === undefined
        ? { status: 404, body: { errors: [{ status: '404', title: 'Not Found', detail: `no route for ${key}` }] } }
        : typeof route === 'function'
          ? route(request.body)
          : route;
    const status = answer.status ?? 200;
    return Promise.resolve(
      new Response(status === 204 || answer.body === undefined ? null : JSON.stringify(answer.body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return () => [...requests];
}

/** The requests sent to one `METHOD /path`. */
export function requestsTo(sent: SentRequest[], route: string): SentRequest[] {
  return sent.filter((r) => `${r.method} ${r.path}` === route);
}
