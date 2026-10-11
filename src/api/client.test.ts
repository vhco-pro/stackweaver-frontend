// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Wire-shape tests for the two write calls whose endpoints accept a JSON:API document and
// nothing else: organization create and run create. Both reject a body without `data`, and run
// create also rejects any top-level key beside it, so these pin the exact bytes the client puts
// on the wire rather than the arguments it was called with.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { organizationsApi, runsApi, workspacesApi, type RunIntent } from './client';

vi.mock('@/lib/zitadel', () => ({ getAccessToken: () => 'test-token' }));

interface Captured {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

// Stub fetch with one canned JSON:API response and return what the client sent.
function captureRequest(responseBody: unknown): () => Captured {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(responseBody), {
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
      body: JSON.parse(init.body as string) as Record<string, unknown>,
    };
  };
}

const organizationResponse = {
  data: { id: 'acme', type: 'organizations', attributes: { name: 'acme', 'external-id': 'org-1' } },
};
const runResponse = { data: { id: 'run-1', type: 'runs', attributes: { status: 'pending' } } };

describe('organizationsApi.create', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends a JSON:API document with data as the only top-level key', async () => {
    const sent = captureRequest(organizationResponse);

    const org = await organizationsApi.create({ name: 'acme', description: 'Platform team' });

    const request = sent();
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/organizations$/);
    expect(Object.keys(request.body)).toEqual(['data']);
    expect(request.body).toEqual({
      data: { type: 'organizations', attributes: { name: 'acme', description: 'Platform team' } },
    });
    expect(org.name).toBe('acme');
  });

  it('omits the description attribute when there is none', async () => {
    const sent = captureRequest(organizationResponse);

    await organizationsApi.create({ name: 'acme' });

    expect(sent().body).toEqual({ data: { type: 'organizations', attributes: { name: 'acme' } } });
  });
});

describe('workspacesApi.get', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const workspaceResponse = (attributes: Record<string, unknown>) => ({
    data: { id: 'ws-abc', type: 'workspaces', attributes: { name: 'network', ...attributes } },
  });

  // The new-run dialog disables its Destroy choice from this field, so a workspace whose
  // setting is off must not read as "allowed" because the attribute was never mapped.
  it.each([
    { sent: false, want: false },
    { sent: true, want: true },
  ])('maps allow-destroy-plan $sent to allow_destroy_plan', async ({ sent, want }) => {
    captureRequest(workspaceResponse({ 'allow-destroy-plan': sent, 'auto-apply': true }));

    const ws = await workspacesApi.get('acme', 'network');

    expect(ws.allow_destroy_plan).toBe(want);
    expect(ws.auto_apply).toBe(true);
  });

  it('leaves allow_destroy_plan undefined when the API does not send the attribute', async () => {
    captureRequest(workspaceResponse({}));

    const ws = await workspacesApi.get('acme', 'network');

    expect(ws.allow_destroy_plan).toBeUndefined();
  });
});

describe('runsApi.create', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const workspace = { data: { type: 'workspaces', id: 'ws-abc' } };

  // The attributes are go-tfe's RunCreateOptions vocabulary and nothing else: plan-only,
  // is-destroy and auto-apply. A plan-and-apply run carries no marker of its own, because a run
  // that is neither speculative nor a destroy is applyable by default.
  const cases: { name: string; intent: RunIntent; attributes: Record<string, boolean> }[] = [
    { name: 'plan-only', intent: { kind: 'plan-only' }, attributes: { 'plan-only': true } },
    {
      name: 'plan-and-apply that waits for confirmation',
      intent: { kind: 'plan-and-apply', autoApply: false },
      attributes: { 'auto-apply': false },
    },
    {
      name: 'plan-and-apply on an auto-apply workspace',
      intent: { kind: 'plan-and-apply', autoApply: true },
      attributes: { 'auto-apply': true },
    },
    {
      name: 'destroy',
      intent: { kind: 'destroy', autoApply: false },
      attributes: { 'is-destroy': true, 'auto-apply': false },
    },
  ];

  it.each(cases)('$name sends only a JSON:API document', async ({ intent, attributes }) => {
    const sent = captureRequest(runResponse);

    await runsApi.create({ workspaceId: 'ws-abc', intent });

    const request = sent();
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/runs$/);
    // The endpoint answers 400 to workspace_id, configuration_version_id, operation or
    // auto_apply_after_plan at top level, so `data` must be the only key.
    expect(Object.keys(request.body)).toEqual(['data']);
    expect(request.body).toEqual({
      data: { type: 'runs', attributes, relationships: { workspace } },
    });
  });

  // A destroy carries the workspace's auto-apply setting, like Terraform Enterprise: on an
  // auto-apply workspace it removes resources as soon as its plan finishes. The dialog asks for
  // the workspace's name before it gets here; the body itself is the same either way.
  it.each([true, false])('destroy with autoApply %s sends is-destroy and that auto-apply, nothing else', async (autoApply) => {
    const sent = captureRequest(runResponse);

    await runsApi.create({ workspaceId: 'ws-abc', intent: { kind: 'destroy', autoApply } });

    const request = sent();
    expect(Object.keys(request.body)).toEqual(['data']);
    expect(request.body).toEqual({
      data: {
        type: 'runs',
        attributes: { 'is-destroy': true, 'auto-apply': autoApply },
        relationships: { workspace },
      },
    });
  });

  it('adds the configuration version as a relationship when one is given', async () => {
    const sent = captureRequest(runResponse);

    await runsApi.create({
      workspaceId: 'ws-abc',
      configurationVersionId: 'cv-123',
      intent: { kind: 'plan-only' },
    });

    const request = sent();
    expect(Object.keys(request.body)).toEqual(['data']);
    expect(request.body).toEqual({
      data: {
        type: 'runs',
        attributes: { 'plan-only': true },
        relationships: {
          workspace,
          'configuration-version': { data: { type: 'configuration-versions', id: 'cv-123' } },
        },
      },
    });
  });
});
