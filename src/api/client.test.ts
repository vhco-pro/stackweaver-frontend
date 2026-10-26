// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Wire-shape tests for the two write calls whose endpoints accept a JSON:API document and
// nothing else: organization create and run create. Both reject a body without `data`, and run
// create also rejects any top-level key beside it, so these pin the exact bytes the client puts
// on the wire rather than the arguments it was called with.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  stateVersionsApi,
  accountApi,
  activitiesApi,
  organizationsApi,
  registryApi,
  runsApi,
  settingsApi,
  tokensApi,
  adminUsersApi,
  adminOrganizationsApi,
  platformSettingsApi,
  twoFactorApi,
  variablesApi,
  vcsConnectionsApi,
  workspacesApi,
  type RunIntent,
} from './client';
import { onAuthenticationRequired } from '@/lib/zitadel';


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

// Stub fetch with one canned error response.
function stubErrorResponse(status: number, body: string, contentType = 'application/json; charset=utf-8'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(body, { status, headers: { 'Content-Type': contentType } })),
  );
}

const organizationResponse = {
  data: { id: 'acme', type: 'organizations', attributes: { name: 'acme', 'external-id': 'org-1' } },
};
const runResponse = { data: { id: 'run-1', type: 'runs', attributes: { status: 'pending' } } };

// The API has one error contract, the JSON:API error document, and the client reads that and
// nothing else. A flat {"error": "..."} body has no producer on any route this client calls, so
// it is treated like any other body the client does not understand: the status fallback.
describe('error messages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('takes the message from errors[0].detail and carries the status', async () => {
    stubErrorResponse(
      400,
      JSON.stringify({
        errors: [{ status: '400', title: 'Bad Request', detail: 'invalid cron expression: expected exactly 5 fields, found 4: [* * * *]' }],
      }),
    );

    const failure: unknown = await organizationsApi.create({ name: 'acme' }).catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('invalid cron expression: expected exactly 5 fields, found 4: [* * * *]');
    expect((failure as Error & { status?: number }).status).toBe(400);
  });

  it('does not read a flat error key: the message is the status fallback', async () => {
    stubErrorResponse(500, JSON.stringify({ error: 'x' }));

    await expect(organizationsApi.create({ name: 'acme' })).rejects.toThrow('HTTP error! status: 500');
  });

  it('does not read a flat error key on a 401 either', async () => {
    stubErrorResponse(401, JSON.stringify({ error: 'x' }));

    const failure: unknown = await organizationsApi.create({ name: 'acme' }).catch((err: unknown) => err);

    expect((failure as Error).message).toBe('Unauthorized');
    expect((failure as Error & { status?: number }).status).toBe(401);
  });

  it('falls back to the status for a body that is not JSON', async () => {
    stubErrorResponse(502, '<html>Bad Gateway</html>', 'text/html');

    await expect(organizationsApi.create({ name: 'acme' })).rejects.toThrow('HTTP error! status: 502');
  });

  it('applies the same rule to the multipart uploads', async () => {
    const file = new File(['x'], 'module.tar.gz');

    stubErrorResponse(500, JSON.stringify({ error: 'x' }));
    await expect(registryApi.modules.publishVersion('acme', 'vpc', 'aws', '1.0.0', file)).rejects.toThrow(
      'HTTP error! status: 500',
    );

    stubErrorResponse(500, JSON.stringify({ error: 'x' }));
    await expect(
      registryApi.providers.publishPlatform('acme', 'private', 'acme', 'widget', '1.0.0', 'linux', 'amd64', file),
    ).rejects.toThrow('HTTP error! status: 500');

    stubErrorResponse(413, JSON.stringify({ errors: [{ status: '413', title: 'Request Entity Too Large', detail: 'request body too large' }] }));
    await expect(registryApi.modules.publishVersion('acme', 'vpc', 'aws', '1.0.0', file)).rejects.toThrow(
      'request body too large',
    );
  });
});

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
      data: {
        type: 'organizations',
        attributes: { name: 'acme', description: 'Platform team', 'cost-estimation-enabled': false },
      },
    });
    expect(org.name).toBe('acme');
  });

  // The create form has no cost-estimation control. The value is sent rather than left to the
  // server's default for an absent attribute, so what the form creates does not move if that
  // default does: a new organization starts with cost estimation off.
  it('omits the description attribute when there is none, and always sends cost estimation off', async () => {
    const sent = captureRequest(organizationResponse);

    await organizationsApi.create({ name: 'acme' });

    expect(sent().body).toEqual({
      data: { type: 'organizations', attributes: { name: 'acme', 'cost-estimation-enabled': false } },
    });
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

// The create and edit workspace dialogs send the "Allow destroy plans" checkbox through these two
// calls. The attribute is go-tfe's name for it, and false has to reach the wire as false: a
// client that dropped a falsy value would create a workspace with the setting on.
describe('workspacesApi.create and update: allow-destroy-plan', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const workspaceResponse = {
    data: { id: 'ws-abc', type: 'workspaces', attributes: { name: 'network' } },
  };
  const attributesOf = (body: Record<string, unknown>) =>
    (body.data as { attributes: Record<string, unknown> }).attributes;

  it.each([false, true])('create sends allow-destroy-plan %s', async (value) => {
    const sent = captureRequest(workspaceResponse);

    await workspacesApi.create('acme', { name: 'network', allow_destroy_plan: value });

    const request = sent();
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/organizations\/acme\/workspaces$/);
    expect(attributesOf(request.body)['allow-destroy-plan']).toBe(value);
  });

  it.each([false, true])('update sends allow-destroy-plan %s', async (value) => {
    const sent = captureRequest(workspaceResponse);

    await workspacesApi.update('acme', 'network', { allow_destroy_plan: value });

    const request = sent();
    expect(request.method).toBe('PATCH');
    expect(request.url).toMatch(/\/organizations\/acme\/workspaces\/network$/);
    expect(attributesOf(request.body)).toEqual({ 'allow-destroy-plan': value });
  });

  it('update leaves the attribute out when it is not given, so the setting is left alone', async () => {
    const sent = captureRequest(workspaceResponse);

    await workspacesApi.update('acme', 'network', { description: 'core network' });

    expect(attributesOf(sent().body)).toEqual({ description: 'core network' });
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

// The platform endpoints #858 converted (Phase 3): the writes send documents, the VCS listings
// answer resources, the URL-issuing install steps and the platform variables answer meta-only
// documents, and the registry delete-all answers 204.
interface Sent {
  url: string;
  method: string;
  body: unknown;
}

// Stub fetch with a canned response per call, in order, and return what the client sent.
function stubResponses(...responses: { status?: number; body?: unknown }[]): () => Sent[] {
  const fetchMock = vi.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce(
      new Response(r.body === undefined ? null : JSON.stringify(r.body), {
        status: r.status ?? 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    );
  }
  vi.stubGlobal('fetch', fetchMock);
  return () =>
    (fetchMock.mock.calls as [string, RequestInit][]).map(([url, init]) => ({
      url,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }));
}

function providerBlock(current: number, size: number, next: number | null) {
  return {
    pagination: {
      'current-page': current,
      'page-size': size,
      'prev-page': current > 1 ? current - 1 : null,
      'next-page': next,
      'total-pages': null,
      'total-count': null,
    },
  };
}

function repositoryResource(id: number) {
  return {
    id: String(id),
    type: 'vcs-repositories',
    attributes: {
      name: `repo-${id}`,
      'full-name': `acme/repo-${id}`,
      description: 'd',
      private: true,
      'default-branch': 'main',
      url: `https://github.com/acme/repo-${id}`,
      'clone-url': `https://github.com/acme/repo-${id}.git`,
      'ssh-url': `git@github.com:acme/repo-${id}.git`,
    },
  };
}

describe('platform documents (Phase 3)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tokensApi.create sends a tokens document and reads the token once', async () => {
    const sent = stubResponses({
      status: 201,
      body: {
        data: {
          id: 'at-1',
          type: 'tokens',
          attributes: { token: 'tfe-abc', description: 'ci', expires_at: '2027-01-01T00:00:00Z', created_at: '2026-10-17T00:00:00Z' },
        },
      },
    });

    const created = await tokensApi.create({ description: 'ci', expires_at: '2027-01-01T00:00:00Z' });

    const [request] = sent();
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/tokens$/);
    expect(request.body).toEqual({
      data: { type: 'tokens', attributes: { description: 'ci', expires_at: '2027-01-01T00:00:00Z' } },
    });
    expect(created.token).toBe('tfe-abc');
  });

  it('tokensApi.create sends platform_admin and reads it back', async () => {
    const sent = stubResponses({
      status: 201,
      body: {
        data: {
          id: 'at-2',
          type: 'tokens',
          attributes: { token: 'tfe-def', description: 'admin', created_at: '2026-10-24T00:00:00Z', platform_admin: true },
        },
      },
    });

    const created = await tokensApi.create({ description: 'admin', platform_admin: true });

    expect(sent()[0].body).toEqual({ data: { type: 'tokens', attributes: { description: 'admin', platform_admin: true } } });
    expect(created.platform_admin).toBe(true);
  });

  it('adminUsersApi asks only the two lookups the route answers and posts the actions with no body', async () => {
    const admin = {
      id: 'user-1',
      type: 'users',
      attributes: { username: 'ada', email: 'ada@example.com', name: 'Ada', 'is-admin': true, 'platform-admin-declared': true },
    };
    const sent = stubResponses(
      { body: { data: [admin], meta: { pagination: { 'current-page': 1, 'page-size': 100, 'total-pages': 1, 'total-count': 1 } } } },
      { body: { data: [] } },
      { body: { data: { ...admin, attributes: { ...admin.attributes, 'platform-admin-declared': false } } } },
      { body: { data: admin } },
    );

    const admins = await adminUsersApi.lookupAdmins();
    const nobody = await adminUsersApi.lookupByEmail('Nobody@Example.com');
    const granted = await adminUsersApi.grantAdmin('user-1');
    await adminUsersApi.revokeAdmin('user-1');

    const [list, lookup, grant, revoke] = sent();
    expect(list.url).toContain('/admin/users?filter%5Badmin%5D=true&page%5Bsize%5D=100');
    expect(admins.data[0]).toMatchObject({ id: 'user-1', email: 'ada@example.com', platform_admin_declared: true });
    expect(lookup.url).toContain('/admin/users?q=Nobody%40Example.com');
    expect(nobody).toBeNull();
    expect(grant.method).toBe('POST');
    expect(grant.url).toMatch(/\/admin\/users\/user-1\/actions\/grant_admin$/);
    expect(grant.body).toBeUndefined();
    expect(granted.is_admin).toBe(true);
    expect(revoke.url).toMatch(/\/admin\/users\/user-1\/actions\/revoke_admin$/);
  });

  it('adminOrganizationsApi and platformSettingsApi read their resources', async () => {
    const sent = stubResponses(
      {
        body: {
          data: [{ id: 'demo', type: 'organizations', attributes: { name: 'demo', 'notification-email': 'ops@example.com', 'member-count': 4, 'workspace-count': 6, 'created-at': '2026-06-01T00:00:00Z' } }],
          meta: { pagination: { 'current-page': 2, 'page-size': 20, 'total-pages': 3, 'total-count': 41 } },
        },
      },
      { body: { data: { type: 'platform-settings', id: 'platform', attributes: { 'organization-creation': 'platform-admins' } } } },
    );

    const orgs = await adminOrganizationsApi.list({ search: 'de', page: 2, pageSize: 20 });
    const settings = await platformSettingsApi.get();

    const [list] = sent();
    expect(list.url).toContain('/admin/organizations?q=de&page%5Bnumber%5D=2&page%5Bsize%5D=20');
    expect(orgs.data[0]).toEqual({
      name: 'demo',
      external_id: undefined,
      notification_email: 'ops@example.com',
      created_at: '2026-06-01T00:00:00Z',
      member_count: 4,
      workspace_count: 6,
    });
    expect(orgs.pagination?.['total-count']).toBe(41);
    expect(settings).toEqual({ organization_creation: 'platform-admins' });
  });

  it('vcsConnectionsApi.create sends a vcs-connections document with snake_case attributes', async () => {
    const sent = stubResponses({ status: 201, body: { data: { id: 'vc-1', type: 'vcs-connections', attributes: {} } } });

    await vcsConnectionsApi.create('acme', {
      provider: 'azure_devops',
      access_token: 'ado-x',
      account_name: 'acme',
      account_type: 'organization',
    });

    const [request] = sent();
    expect(request.url).toMatch(/\/organizations\/acme\/vcs-connections$/);
    expect(request.body).toEqual({
      data: {
        type: 'vcs-connections',
        attributes: { provider: 'azure_devops', access_token: 'ado-x', account_name: 'acme', account_type: 'organization' },
      },
    });
  });

  it('createConnectionFromInstallation sends the code in a vcs-connections document, the state in the query', async () => {
    const sent = stubResponses({ status: 201, body: { data: { id: 'vc-1', type: 'vcs-connections', attributes: {} } } });

    await vcsConnectionsApi.createConnectionFromInstallation('acme', '4242', 'gh-code', 's.t');

    const [request] = sent();
    expect(request.url).toMatch(/\/organizations\/acme\/vcs-connections\/github\/installations\/4242\?state=s\.t$/);
    expect(request.body).toEqual({ data: { type: 'vcs-connections', attributes: { code: 'gh-code' } } });
  });

  it('the install and authorize steps read the URL from meta', async () => {
    stubResponses(
      { body: { meta: { 'install-url': 'https://github.com/apps/sw/installations/new?state=a' } } },
      { body: { meta: { 'auth-url': 'https://github.com/login/oauth/authorize?state=b' } } },
      { body: { meta: { 'auth-url': 'https://app.vssps.visualstudio.com/oauth2/authorize?state=c' } } },
    );

    await expect(vcsConnectionsApi.initiateInstallationWithRedirect('acme', 'https://sw.example/back')).resolves.toBe(
      'https://github.com/apps/sw/installations/new?state=a',
    );
    await expect(vcsConnectionsApi.authorizeGitHubInstallation('acme', '4242', 's')).resolves.toBe(
      'https://github.com/login/oauth/authorize?state=b',
    );
    await expect(vcsConnectionsApi.initiateAzureDevOpsInstallation('acme', 'contoso', '/back')).resolves.toBe(
      'https://app.vssps.visualstudio.com/oauth2/authorize?state=c',
    );
  });

  it('listAllRepositories follows next-page and maps vcs-repositories back onto Repository', async () => {
    const sent = stubResponses(
      { body: { data: Array.from({ length: 100 }, (_, i) => repositoryResource(i + 1)), meta: providerBlock(1, 100, 2) } },
      { body: { data: [repositoryResource(101)], meta: providerBlock(2, 100, null) } },
    );

    const repos = await vcsConnectionsApi.listAllRepositories('vc-1', 'Platform');

    const requests = sent();
    expect(requests.map(r => new URL(r.url, 'http://x').searchParams.get('page[number]'))).toEqual(['1', '2']);
    expect(new URL(requests[0].url, 'http://x').searchParams.get('page[size]')).toBe('100');
    expect(new URL(requests[0].url, 'http://x').searchParams.get('project')).toBe('Platform');
    expect(repos).toHaveLength(101);
    expect(repos[100]).toEqual({
      id: 101,
      name: 'repo-101',
      full_name: 'acme/repo-101',
      description: 'd',
      private: true,
      default_branch: 'main',
      url: 'https://github.com/acme/repo-101',
      clone_url: 'https://github.com/acme/repo-101.git',
      ssh_url: 'git@github.com:acme/repo-101.git',
    });
  });

  it('listBranches and listProjects map vcs-branches and vcs-projects', async () => {
    stubResponses(
      {
        body: {
          data: [{ id: 'main', type: 'vcs-branches', attributes: { protected: true, 'commit-sha': 'abc', 'commit-url': 'https://c/abc' } }],
          meta: providerBlock(1, 30, null),
        },
      },
      { body: { data: [{ id: 'p-1', type: 'vcs-projects', attributes: { name: 'Platform' } }], meta: providerBlock(1, 30, null) } },
    );

    await expect(vcsConnectionsApi.listBranches('vc-1', 'acme', 'infra')).resolves.toEqual([
      { name: 'main', protected: true, commit: { sha: 'abc', url: 'https://c/abc' } },
    ]);
    await expect(vcsConnectionsApi.listProjects('vc-1')).resolves.toEqual([{ id: 'p-1', name: 'Platform' }]);
  });

  it('getFileContent reads one vcs-files resource and listInventoryFiles reads the paths', async () => {
    stubResponses(
      { body: { data: { id: 'inventory/hosts.yml', type: 'vcs-files', attributes: { content: 'all: {}', ref: 'main' } } } },
      {
        body: {
          data: [
            { id: 'inventory/hosts.yml', type: 'vcs-files' },
            { id: 'inventory/prod.ini', type: 'vcs-files' },
          ],
          meta: providerBlock(1, 2, null),
        },
      },
    );

    await expect(vcsConnectionsApi.getFileContent('vc-1', 'acme', 'infra', 'inventory/hosts.yml', 'main')).resolves.toEqual({
      path: 'inventory/hosts.yml',
      content: 'all: {}',
      ref: 'main',
    });
    await expect(vcsConnectionsApi.listInventoryFiles('vc-1', 'acme', 'infra', 'main')).resolves.toEqual([
      'inventory/hosts.yml',
      'inventory/prod.ini',
    ]);
  });

  it('registryApi.modules.create sends a registry-modules document', async () => {
    const sent = stubResponses({ status: 201, body: { data: { id: 'm-1', type: 'registry-modules', attributes: { name: 'vpc' } } } });

    await registryApi.modules.create('acme', {
      name: 'vpc',
      provider: 'aws',
      vcs_connection_id: 'vc-1',
      vcs_repository: 'acme/terraform-aws-vpc',
      auto_publish_tags: true,
    });

    const [request] = sent();
    expect(request.body).toEqual({
      data: {
        type: 'registry-modules',
        attributes: {
          name: 'vpc',
          provider: 'aws',
          vcs_connection_id: 'vc-1',
          vcs_repository: 'acme/terraform-aws-vpc',
          auto_publish_tags: true,
        },
      },
    });
  });

  it('registryApi.modules.deleteAll accepts a 204 with no body', async () => {
    const sent = stubResponses({ status: 204 });

    await expect(registryApi.modules.deleteAll('acme')).resolves.toBeUndefined();
    expect(sent()[0].method).toBe('DELETE');
  });

  it('getPlatformVariableKeys reads meta', async () => {
    stubResponses({ body: { meta: { 'platform-variable-keys': ['STACKWEAVER_ORG', 'STACKWEAVER_WORKSPACE'] } } });

    await expect(variablesApi.getPlatformVariableKeys('ws-1')).resolves.toEqual(['STACKWEAVER_ORG', 'STACKWEAVER_WORKSPACE']);
  });

  it('activitiesApi.list pages by page[number] and page[size] and returns the block', async () => {
    const sent = stubResponses({
      body: {
        data: [],
        meta: { pagination: { 'current-page': 2, 'page-size': 50, 'prev-page': 1, 'next-page': 3, 'total-pages': 4, 'total-count': 170 } },
      },
    });

    const res = await activitiesApi.list({ page: 2, pageSize: 50 });

    const params = new URL(sent()[0].url, 'http://x').searchParams;
    expect(params.get('page[number]')).toBe('2');
    expect(params.get('page[size]')).toBe('50');
    expect(params.has('limit')).toBe(false);
    expect(params.has('offset')).toBe(false);
    expect(res.meta?.pagination?.['next-page']).toBe(3);
    expect(res.meta?.pagination?.['total-count']).toBe(170);
  });
});

describe('account and settings documents (Phase 4)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const userResource = {
    id: 'user-1',
    type: 'users',
    attributes: {
      username: 'ada',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      bio: '',
      company: 'Analytical Engines',
      location: 'London',
      'avatar-url': 'https://example.com/ada.png',
      'is-service-account': false,
      'v2-only': true,
      'created-at': '2026-06-01T10:00:00Z',
      'updated-at': '2026-06-02T10:00:00Z',
    },
  };

  it('accountApi.details reads the users resource onto the profile', async () => {
    const sent = stubResponses({ body: { data: userResource } });

    const profile = await accountApi.details();

    expect(sent()[0].url).toMatch(/\/account\/details$/);
    expect(profile).toEqual({
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      username: 'ada',
      bio: '',
      company: 'Analytical Engines',
      location: 'London',
      avatar: 'https://example.com/ada.png',
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-02T10:00:00Z',
      // The resource carries no platform attributes, so the profile reads an ordinary user
      // who may create organizations.
      is_site_admin: false,
      platform_admin_declared: false,
      can_create_organizations: true,
    });
  });

  it('accountApi.details reads the platform administrator attributes and permissions', async () => {
    stubResponses({
      body: {
        data: {
          ...userResource,
          attributes: {
            ...userResource.attributes,
            'is-site-admin': true,
            'platform-admin-declared': true,
            permissions: { 'can-create-organizations': false },
          },
        },
      },
    });

    const profile = await accountApi.details();

    expect(profile.is_site_admin).toBe(true);
    expect(profile.platform_admin_declared).toBe(true);
    expect(profile.can_create_organizations).toBe(false);
  });

  it('accountApi.update sends a users document with only the attributes given', async () => {
    const sent = stubResponses({ body: { data: userResource } });

    const profile = await accountApi.update({ company: '', location: 'London' });

    const [request] = sent();
    expect(request.method).toBe('PATCH');
    expect(request.url).toMatch(/\/account\/update$/);
    expect(request.body).toEqual({ data: { type: 'users', attributes: { company: '', location: 'London' } } });
    expect(profile.username).toBe('ada');
  });

  it('settingsApi.changePassword sends a users document and takes the 204', async () => {
    const sent = stubResponses({ status: 204 });

    await expect(settingsApi.changePassword('old-pw', 'new-pw')).resolves.toBeUndefined();

    const [request] = sent();
    expect(request.url).toMatch(/\/settings\/password$/);
    expect(request.body).toEqual({
      data: { type: 'users', attributes: { 'current-password': 'old-pw', 'new-password': 'new-pw' } },
    });
  });

  it('twoFactorApi reads the two-factor resource, the enrolment from meta and sends the code in a document', async () => {
    const sent = stubResponses(
      { body: { data: { id: 'user-1', type: 'two-factor', attributes: { enabled: false } } } },
      { body: { meta: { secret: 'JBSWY3DP', url: 'otpauth://totp/sw:ada?secret=JBSWY3DP' } } },
      { body: { data: { id: 'user-1', type: 'two-factor', attributes: { enabled: true } } } },
      { status: 204 },
    );

    await expect(twoFactorApi.getStatus()).resolves.toEqual({ enabled: false });
    await expect(twoFactorApi.start()).resolves.toEqual({ secret: 'JBSWY3DP', url: 'otpauth://totp/sw:ada?secret=JBSWY3DP' });
    await expect(twoFactorApi.verify('123456')).resolves.toEqual({ enabled: true });
    await expect(twoFactorApi.remove()).resolves.toBeUndefined();

    const requests = sent();
    expect(requests[1].method).toBe('POST');
    expect(requests[1].url).toMatch(/\/settings\/2fa\/start$/);
    expect(requests[2].url).toMatch(/\/settings\/2fa\/verify$/);
    expect(requests[2].body).toEqual({ data: { type: 'two-factor', attributes: { code: '123456' } } });
    expect(requests[3].method).toBe('DELETE');
  });

  it('twoFactorApi.listDevices maps mfa-devices resources onto the devices', async () => {
    stubResponses({
      body: {
        data: [{ id: 'dev-1', type: 'mfa-devices', attributes: { 'device-type': 'TOTP', name: 'Authenticator', state: 'AUTH_FACTOR_STATE_READY' } }],
      },
    });

    await expect(twoFactorApi.listDevices()).resolves.toEqual([
      { id: 'dev-1', type: 'TOTP', name: 'Authenticator', state: 'AUTH_FACTOR_STATE_READY' },
    ]);
  });

  it('settingsApi.listSessions maps sessions resources onto the sessions', async () => {
    stubResponses({
      body: {
        data: [
          {
            id: 's1',
            type: 'sessions',
            attributes: {
              'user-agent': 'Firefox on Linux',
              'ip-address': '10.0.0.1',
              'creation-date': '2026-06-01T10:00:00Z',
              'expiration-date': '2026-06-08T10:00:00Z',
              factors: ['password'],
              'is-current': true,
            },
          },
        ],
      },
    });

    await expect(settingsApi.listSessions()).resolves.toEqual([
      {
        id: 's1',
        user_agent: 'Firefox on Linux',
        ip_address: '10.0.0.1',
        creation_date: '2026-06-01T10:00:00Z',
        expiration_date: '2026-06-08T10:00:00Z',
        factors: ['password'],
        is_current: true,
      },
    ]);
  });

  it('settingsApi.listApiKeys reads the scope from the relationships', async () => {
    stubResponses({
      body: {
        data: [
          {
            id: 'key-1',
            type: 'api-keys',
            attributes: {
              name: 'ci',
              'key-prefix': 'sw_abc',
              scopes: ['org:read'],
              'expires-at': null,
              'last-used-at': '2026-06-03T10:00:00Z',
              'created-at': '2026-06-01T10:00:00Z',
            },
            relationships: { organization: { data: { id: 'org-uuid', type: 'organizations' } } },
          },
        ],
      },
    });

    await expect(settingsApi.listApiKeys()).resolves.toEqual([
      {
        id: 'key-1',
        name: 'ci',
        key_prefix: 'sw_abc',
        scopes: ['org:read'],
        organization_id: 'org-uuid',
        project_id: undefined,
        expires_at: undefined,
        last_used_at: '2026-06-03T10:00:00Z',
        created_at: '2026-06-01T10:00:00Z',
      },
    ]);
  });

  it('settingsApi.createApiKey sends an api-keys document and reads the key once', async () => {
    const sent = stubResponses({
      status: 201,
      body: {
        data: {
          id: 'key-2',
          type: 'api-keys',
          attributes: {
            name: 'deploy',
            key: 'sw_plaintext',
            'key-prefix': 'sw_pla',
            scopes: ['org:write'],
            'expires-at': '2027-01-01T00:00:00Z',
            'last-used-at': null,
            'created-at': '2026-10-17T00:00:00Z',
          },
        },
      },
    });

    const created = await settingsApi.createApiKey({ name: 'deploy', scopes: ['org:write'], expires_at: '2027-01-01T00:00:00Z' });

    const [request] = sent();
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/settings\/api-keys$/);
    expect(request.body).toEqual({
      data: { type: 'api-keys', attributes: { name: 'deploy', scopes: ['org:write'], 'expires-at': '2027-01-01T00:00:00Z' } },
    });
    expect(created.id).toBe('key-2');
    expect(created.key).toBe('sw_plaintext');
    expect(created.expires_at).toBe('2027-01-01T00:00:00Z');
  });

  it('the deletes take the 204', async () => {
    const sent = stubResponses({ status: 204 }, { status: 204 });

    await expect(settingsApi.deleteApiKey('key-1')).resolves.toBeUndefined();
    await expect(settingsApi.revokeSession('s1')).resolves.toBeUndefined();

    const requests = sent();
    expect(requests.map((r) => r.method)).toEqual(['DELETE', 'DELETE']);
    expect(requests[0].url).toMatch(/\/settings\/api-keys\/key-1$/);
    expect(requests[1].url).toMatch(/\/settings\/sessions\/s1$/);
  });
});

describe('state versions (Phase 5)', () => {
  const resource = {
    id: 'sv-1',
    type: 'state-versions',
    attributes: {
      'state-version': 3,
      serial: 2,
      lineage: 'l-1',
      'vcs-commit-sha': 'abc1234def',
      committer: 'ada@example.com',
      'created-at': '2026-10-16T12:00:00Z',
      status: 'finalized',
      'hosted-state-download-url': 'http://api/api/v2/state-versions/sv-1/download',
    },
    relationships: {
      workspace: { data: { id: 'ws-1', type: 'workspaces' } },
      run: { data: { id: 'run-1', type: 'runs' } },
      outputs: { data: [] },
    },
  };

  it('maps the state-versions projection onto the model the pages read', async () => {
    stubResponses({ body: { data: [resource], meta: { pagination: {} } } });
    const [v] = await stateVersionsApi.list('ws-1');
    expect(v).toEqual({
      id: 'sv-1', workspace_id: 'ws-1', run_id: 'run-1', version: 3, serial: 2, lineage: 'l-1',
      commit_hash: 'abc1234def', committer: 'ada@example.com', created_at: '2026-10-16T12:00:00Z',
    });
  });

  it('removes a resource with a state-versions document and reads the version it wrote', async () => {
    const sent = stubResponses({ status: 201, body: { data: resource } });
    const v = await stateVersionsApi.removeResource('ws-1', 'null_resource.a');
    expect(sent()[0].body).toEqual({ data: { type: 'state-versions', attributes: { address: 'null_resource.a' } } });
    expect(v.id).toBe('sv-1');
  });
});

// The browser's credential is the httpOnly session cookie (backend-for-frontend-session-plan.md,
// AC1, AC24): requests carry the CSRF header and no Authorization, and only the authentication
// layer's 401 ends the session.
describe('the session cookie', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sends the cookie and the CSRF header, never an Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await organizationsApi.list().catch(() => undefined);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['X-Stackweaver-CSRF']).toBe('1');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('the multipart uploads carry the CSRF header too', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await registryApi.modules.publishVersion('acme', 'vpc', 'aws', '1.0.0', new File(['x'], 'm.tgz'));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Stackweaver-CSRF']).toBe('1');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('reports a 401 carrying authentication-required', async () => {
    const ended = vi.fn();
    const stop = onAuthenticationRequired(ended);
    stubErrorResponse(401, JSON.stringify({ errors: [{ status: '401', code: 'authentication-required', detail: 'not signed in' }] }));
    await organizationsApi.create({ name: 'acme' }).catch(() => undefined);
    stop();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('does not report a 401 passed through from another service', async () => {
    const ended = vi.fn();
    const stop = onAuthenticationRequired(ended);
    stubErrorResponse(401, JSON.stringify({ errors: [{ status: '401', detail: 'the registry refused the credentials' }] }));
    await organizationsApi.create({ name: 'acme' }).catch(() => undefined);
    stop();
    expect(ended).not.toHaveBeenCalled();
  });
});
