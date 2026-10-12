// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Wire-shape tests for the job template launch. The endpoint reads its overrides from a JSON:API
// document of type `ansible-jobs` and refuses the same names as top-level keys, so these pin the
// exact bytes the client puts on the wire rather than the arguments it was called with.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ansibleJobTemplatesApi } from './ansible';

vi.mock('@/lib/zitadel', () => ({ getAccessToken: () => 'test-token' }));

interface Captured {
  url: string;
  method: string;
  /** The raw body, `undefined` when the request carried none. */
  rawBody: string | undefined;
}

// Stub fetch with a canned launch response and return what the client sent.
function captureRequest(): () => Captured {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: { id: 'job-1', type: 'ansible-jobs', attributes: { status: 'pending' } } }), {
      status: 201,
      // The content type the API answers with; the client parses no other.
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return () => {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return {
      url,
      method: init.method ?? 'GET',
      rawBody: typeof init.body === 'string' ? init.body : undefined,
    };
  };
}

describe('ansibleJobTemplatesApi.launch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the overrides as the attributes of an ansible-jobs document', async () => {
    const sent = captureRequest();

    await ansibleJobTemplatesApi.launch('tpl-1', {
      extra_vars: { app_version: '1.1.0' },
      limit: 'web:&production',
      tags: 'deploy,config',
      skip_tags: 'slow',
    });

    const request = sent();
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/ansible\/job-templates\/tpl-1\/launch$/);
    expect(JSON.parse(request.rawBody ?? 'null')).toEqual({
      data: {
        type: 'ansible-jobs',
        attributes: {
          'extra-vars': { app_version: '1.1.0' },
          limit: 'web:&production',
          tags: 'deploy,config',
          'skip-tags': 'slow',
        },
      },
    });
  });

  it('leaves an override that was not given out of the document', async () => {
    const sent = captureRequest();

    await ansibleJobTemplatesApi.launch('tpl-1', { limit: 'db' });

    expect(JSON.parse(sent().rawBody ?? 'null')).toEqual({
      data: { type: 'ansible-jobs', attributes: { limit: 'db' } },
    });
  });

  // An empty string is how a launch drops a value the template carries, so it must reach the
  // server as an empty string rather than be dropped as "not given".
  it('sends an override that was given as an empty string', async () => {
    const sent = captureRequest();

    await ansibleJobTemplatesApi.launch('tpl-1', { limit: '', tags: '', skip_tags: '' });

    expect(JSON.parse(sent().rawBody ?? 'null')).toEqual({
      data: { type: 'ansible-jobs', attributes: { limit: '', tags: '', 'skip-tags': '' } },
    });
  });

  it('sends no body when there are no overrides', async () => {
    const sent = captureRequest();

    await ansibleJobTemplatesApi.launch('tpl-1');

    expect(sent().rawBody).toBeUndefined();
  });
});
