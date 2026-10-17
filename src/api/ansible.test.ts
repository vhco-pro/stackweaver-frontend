// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Wire-shape tests for the Ansible endpoints that read or answer a JSON:API document. The server
// refuses a flat body, so these pin the exact bytes the client puts on the wire rather than the
// arguments it was called with, and what the client makes of the answer.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ansibleJobsApi,
  ansibleJobTemplatesApi,
  ansibleNotificationsApi,
  ansiblePlaybooksApi,
  ansibleSchedulesApi,
  ansibleWorkflowsApi,
} from './ansible';

vi.mock('@/lib/zitadel', () => ({ getAccessToken: () => 'test-token' }));

interface Captured {
  url: string;
  method: string;
  /** The raw body, `undefined` when the request carried none. */
  rawBody: string | undefined;
}

const launchAnswer = { data: { id: 'job-1', type: 'ansible-jobs', attributes: { status: 'pending' } } };

// Stub fetch with a canned response (a JSON:API document by default) and return what the client sent.
function captureRequest(
  answer: unknown = launchAnswer,
  init: { status?: number; contentType?: string } = {},
): () => Captured {
  const contentType = init.contentType ?? 'application/json; charset=utf-8';
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(typeof answer === 'string' ? answer : JSON.stringify(answer), {
      status: init.status ?? 201,
      // The content type the API answers with; the client parses no other as JSON.
      headers: { 'Content-Type': contentType },
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

describe('Ansible request documents', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const body = (c: Captured) => JSON.parse(c.rawBody ?? 'null') as unknown;

  it('updates a schedule with only the attributes given', async () => {
    const sent = captureRequest({ data: { id: 's-1', type: 'schedules', attributes: {} } }, { status: 200 });

    await ansibleSchedulesApi.update('s-1', { cron: '0 3 * * *' });

    const request = sent();
    expect(request.method).toBe('PATCH');
    expect(body(request)).toEqual({ data: { type: 'schedules', attributes: { 'cron-expression': '0 3 * * *' } } });
  });

  it.each([
    ['enable', ansibleSchedulesApi.enable],
    ['disable', ansibleSchedulesApi.disable],
    ['run-now', ansibleSchedulesApi.runNow],
  ] as const)('posts the %s action with no body and reads the schedule back', async (action, call) => {
    const schedule = { data: { id: 's-1', type: 'schedules', attributes: { status: 'enabled' } } };
    const sent = captureRequest(schedule, { status: 200 });

    const res = await call('s-1');

    const request = sent();
    expect(request.url).toMatch(new RegExp(`/ansible/schedules/s-1/actions/${action}$`));
    expect(request.rawBody).toBeUndefined();
    expect(res).toEqual(schedule);
  });

  it('creates a notification template as a document', async () => {
    const sent = captureRequest({ data: { id: 'nt-1', type: 'ansible-notification-templates', attributes: {} } });

    await ansibleNotificationsApi.create('acme', {
      name: 'ops',
      notification_type: 'webhook',
      config: { url: 'https://hooks.example.com' },
      secret: 's3cret',
    });

    expect(body(sent())).toEqual({
      data: {
        type: 'ansible-notification-templates',
        attributes: {
          name: 'ops',
          'notification-type': 'webhook',
          config: { url: 'https://hooks.example.com' },
          secret: 's3cret',
        },
      },
    });
  });

  it('attaches a notification with its triggers and relationships', async () => {
    const sent = captureRequest({ data: { id: 'na-1', type: 'ansible-notification-attachments', attributes: {} } });

    await ansibleNotificationsApi.attach('acme', {
      notification_template_id: 'nt-1',
      job_template_id: 'jt-1',
      triggers: { started: true, success: false, failure: true },
    });

    expect(body(sent())).toEqual({
      data: {
        type: 'ansible-notification-attachments',
        attributes: { 'on-started': true, 'on-success': false, 'on-failure': true },
        relationships: {
          'notification-template': { data: { type: 'ansible-notification-templates', id: 'nt-1' } },
          'job-template': { data: { type: 'ansible-job-templates', id: 'jt-1' } },
        },
      },
    });
  });

  it('leaves the triggers not given to the server defaults and relates a workflow', async () => {
    const sent = captureRequest({ data: { id: 'na-1', type: 'ansible-notification-attachments', attributes: {} } });

    await ansibleNotificationsApi.attach('acme', { notification_template_id: 'nt-1', workflow_id: 'wf-1' });

    expect(body(sent())).toEqual({
      data: {
        type: 'ansible-notification-attachments',
        attributes: {},
        relationships: {
          'notification-template': { data: { type: 'ansible-notification-templates', id: 'nt-1' } },
          workflow: { data: { type: 'ansible-workflows', id: 'wf-1' } },
        },
      },
    });
  });

  it('attaches a credential by a resource identifier', async () => {
    const sent = captureRequest({ data: { id: 'cred-1', type: 'ansible-credentials', attributes: {} } });

    await ansibleJobTemplatesApi.attachCredential('jt-1', 'cred-1');

    const request = sent();
    expect(request.url).toMatch(/\/ansible\/job-templates\/jt-1\/credentials$/);
    expect(body(request)).toEqual({ data: { type: 'ansible-credentials', id: 'cred-1' } });
  });

  it('launches a workflow with its variables as a document', async () => {
    const sent = captureRequest();

    await ansibleWorkflowsApi.launch('wf-1', { env: 'prod' });

    expect(body(sent())).toEqual({
      data: { type: 'ansible-workflow-jobs', attributes: { 'extra-vars': { env: 'prod' } } },
    });
  });

  // An empty object is refused, so a launch without variables must carry no body at all.
  it('launches a workflow without variables with no body', async () => {
    const sent = captureRequest();

    await ansibleWorkflowsApi.launch('wf-1');

    expect(sent().rawBody).toBeUndefined();
  });

  it('bulk imports playbooks as a document and reads the playbooks and the outcome', async () => {
    const answer = {
      data: [{ id: 'pb-1', type: 'ansible-playbooks', attributes: { name: 'site', 'playbook-path': 'site.yml' } }],
      meta: { created: 1, skipped: 0, failed: 1, 'failed-rows': [{ path: 'bad.yml', error: 'path is required' }] },
    };
    const sent = captureRequest(answer, { status: 200 });

    const res = await ansiblePlaybooksApi.bulkImport('acme', {
      vcs_connection_id: 'vcs-1',
      repository: 'org/repo',
      branch: 'main',
      source_mode: 'cached',
      playbooks: [{ path: 'site.yml' }, { path: 'bad.yml' }],
    });

    expect(body(sent())).toEqual({
      data: {
        type: 'ansible-playbooks',
        attributes: {
          'vcs-connection-id': 'vcs-1',
          repository: 'org/repo',
          branch: 'main',
          'source-mode': 'cached',
          playbooks: [{ path: 'site.yml' }, { path: 'bad.yml' }],
        },
      },
    });
    expect(res).toEqual(answer);
  });

  it('finds or creates a playbook from a document', async () => {
    const sent = captureRequest({ data: { id: 'pb-1', type: 'ansible-playbooks', attributes: {} }, meta: { created: true } });

    await ansiblePlaybooksApi.findOrCreate('acme', {
      project_id: 'proj-1',
      vcs_connection_id: 'vcs-1',
      repository: 'org/repo',
      branch: 'main',
      path: 'site.yml',
    });

    expect(body(sent())).toEqual({
      data: {
        type: 'ansible-playbooks',
        attributes: {
          'project-id': 'proj-1',
          'vcs-connection-id': 'vcs-1',
          repository: 'org/repo',
          branch: 'main',
          path: 'site.yml',
        },
      },
    });
  });

  it('reads the job output as plain text', async () => {
    const sent = captureRequest('PLAY [all] ***\nok: [web1]\n', { status: 200, contentType: 'text/plain; charset=utf-8' });

    const output = await ansibleJobsApi.getOutput('job-1');

    expect(sent().url).toMatch(/\/ansible\/jobs\/job-1\/output$/);
    expect(output).toBe('PLAY [all] ***\nok: [web1]\n');
  });
});
