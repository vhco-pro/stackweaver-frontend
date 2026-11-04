// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The run placement resources read and write their JSON:API shapes (#933, D6, D8, D0): what an
// empty choice puts on the wire, and how a resolved setting and its level read back.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  effectiveSettingsApi,
  effectiveSettingsFromJsonApi,
  identityBindingFromJsonApi,
  runImageFromJsonApi,
  runImagesApi,
} from './runPlacement';

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('run placement resources', () => {
  it('reads a run image, with no credential as null', () => {
    const img = runImageFromJsonApi({
      id: 'ri-1',
      type: 'run-images',
      attributes: { name: 'tofu-aws', kind: 'tofu', image: 'ghcr.io/acme/tofu:1', digest: '', 'registry-credential-id': null },
    });
    expect(img).toMatchObject({ id: 'ri-1', kind: 'tofu', image: 'ghcr.io/acme/tofu:1', registry_credential_id: null });
  });

  it('sends an empty registry credential to pull without one', async () => {
    const fetchMock = stubFetch({ data: { id: 'ri-1', type: 'run-images', attributes: { name: 'x', kind: 'ansible' } } });
    await runImagesApi.create('acme', { name: 'x', kind: 'ansible', image: 'quay.io/ee:1', registry_credential_id: null });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/organizations/acme/run-images');
    const body = JSON.parse(init.body as string) as { data: { type: string; attributes: Record<string, unknown> } };
    expect(body.data.type).toBe('run-images');
    expect(body.data.attributes).toEqual({ name: 'x', kind: 'ansible', image: 'quay.io/ee:1', 'registry-credential-id': '' });
  });

  it('reads an identity binding and its pool', () => {
    const b = identityBindingFromJsonApi({
      id: 'ib-1',
      type: 'identity-bindings',
      attributes: { name: 'deploy', mechanism: 'aws-irsa', 'service-account': 'sw', annotations: { a: 'b', n: 1 }, 'declared-externally': true, 'external-manager': 'argocd' },
      relationships: { 'agent-pool': { data: { id: 'pool-1', type: 'agent-pools' } } },
    });
    expect(b).toMatchObject({ agent_pool_id: 'pool-1', annotations: { a: 'b' }, declared_externally: true, external_manager: 'argocd', object_present: null });
  });

  it('reads each effective setting with the level it came from', async () => {
    const fetchMock = stubFetch({
      data: {
        id: 'ws-1',
        type: 'effective-settings',
        attributes: {
          'run-timeout': { value: 5400, level: 'project' },
          'run-image-id': { value: null, level: 'deployment' },
          'identity-binding-id': { value: 'ib-1', level: 'organization' },
        },
      },
    });
    const s = await effectiveSettingsApi.get('inventory-source', 'src-1');
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain('/ansible/inventory-sources/src-1/effective-settings');
    expect(s.run_timeout).toEqual({ value: 5400, level: 'project' });
    expect(s.run_image_id).toEqual({ value: null, level: 'deployment' });
    expect(s.identity_binding_id).toEqual({ value: 'ib-1', level: 'organization' });
    expect(s.execution_mode).toBeUndefined();
    expect(effectiveSettingsFromJsonApi({ id: 'x', type: 'effective-settings', attributes: { 'run-timeout': { value: 1, level: 'bogus' } } }).run_timeout?.level).toBeNull();
  });
});
