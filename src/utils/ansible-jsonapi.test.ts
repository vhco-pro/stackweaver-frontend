// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import {
  getAnsibleJobFromJsonApi,
  getAnsiblePlaybookFromJsonApi,
  getAnsibleInventoryFromJsonApi,
  getAnsibleCredentialFromJsonApi,
  getAnsibleJobTemplateFromJsonApi,
  getAnsibleHostFromJsonApi,
  getAnsibleGroupFromJsonApi,
  getAnsibleJobEventFromJsonApi,
  getAnsibleInventorySourceFromJsonApi,
  getAnsibleScheduleFromJsonApi,
  getAnsibleWorkflowFromJsonApi,
} from './ansible-jsonapi';
import type { JsonApiResource } from './jsonapi';

// Helper to build a JSON:API resource with relationships
function makeResource(
  type: string,
  attrs: Record<string, unknown> = {},
  rels: Record<string, { data: { id: string; type: string } | { id: string; type: string }[] }> = {},
): JsonApiResource {
  return {
    id: 'test-id-123',
    type,
    attributes: attrs as Record<string, any>,
    relationships: rels,
  };
}

describe('getAnsibleJobFromJsonApi', () => {
  it('transforms a full job resource', () => {
    const resource = makeResource('ansible-jobs', {
      name: 'Deploy Prod',
      status: 'successful',
      verbosity: 2,
      forks: 10,
      'become-enabled': true,
      'become-user': 'root',
      'hosts-ok': 5,
      'hosts-changed': 2,
      'hosts-failed': 0,
      'hosts-skipped': 1,
      'hosts-unreachable': 0,
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-02T00:00:00Z',
    }, {
      project: { data: { id: 'proj-1', type: 'projects' } },
      playbook: { data: { id: 'pb-1', type: 'ansible-playbooks' } },
      inventory: { data: { id: 'inv-1', type: 'ansible-inventories' } },
    });

    const job = getAnsibleJobFromJsonApi(resource);
    expect(job.id).toBe('test-id-123');
    expect(job.name).toBe('Deploy Prod');
    expect(job.status).toBe('successful');
    expect(job.project_id).toBe('proj-1');
    expect(job.playbook_id).toBe('pb-1');
    expect(job.inventory_id).toBe('inv-1');
    expect(job.verbosity).toBe(2);
    expect(job.forks).toBe(10);
    expect(job.become).toBe(true);
    expect(job.hosts_ok).toBe(5);
    expect(job.hosts_changed).toBe(2);
  });

  it('applies defaults for missing fields', () => {
    const resource = makeResource('ansible-jobs', {}, {
      project: { data: { id: 'p', type: 'projects' } },
      playbook: { data: { id: 'pb', type: 'ansible-playbooks' } },
      inventory: { data: { id: 'i', type: 'ansible-inventories' } },
    });
    const job = getAnsibleJobFromJsonApi(resource);
    expect(job.name).toBe('');
    expect(job.status).toBe('pending');
    expect(job.verbosity).toBe(0);
    expect(job.forks).toBe(5);
    expect(job.become).toBe(false);
  });
});

describe('getAnsiblePlaybookFromJsonApi', () => {
  it('transforms a playbook resource', () => {
    const resource = makeResource('ansible-playbooks', {
      name: 'site.yml',
      description: 'Main playbook',
      'playbook-path': 'playbooks/site.yml',
      'vcs-repository': 'org/repo',
      'vcs-branch': 'main',
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      project: { data: { id: 'proj-1', type: 'projects' } },
    });

    const pb = getAnsiblePlaybookFromJsonApi(resource);
    expect(pb.name).toBe('site.yml');
    expect(pb.playbook_path).toBe('playbooks/site.yml');
    expect(pb.project_id).toBe('proj-1');
    expect(pb.vcs_repository).toBe('org/repo');
  });
});

describe('getAnsibleInventoryFromJsonApi', () => {
  it('transforms a static inventory', () => {
    const resource = makeResource('ansible-inventories', {
      name: 'Production',
      'inventory-type': 'static',
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      organization: { data: { id: 'org-1', type: 'organizations' } },
    });

    const inv = getAnsibleInventoryFromJsonApi(resource);
    expect(inv.name).toBe('Production');
    expect(inv.type).toBe('static');
    expect(inv.organization_id).toBe('org-1');
  });

  it('maps scm type to vcs for backward compat', () => {
    const resource = makeResource('ansible-inventories', {
      'inventory-type': 'scm',
      'created-at': '',
      'updated-at': '',
    }, {
      organization: { data: { id: 'org-1', type: 'organizations' } },
    });
    const inv = getAnsibleInventoryFromJsonApi(resource);
    expect(inv.type).toBe('vcs');
  });
});

describe('getAnsibleCredentialFromJsonApi', () => {
  it('transforms a credential resource', () => {
    const resource = makeResource('ansible-credentials', {
      name: 'SSH Key',
      'credential-type': 'ssh',
      username: 'deploy',
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      organization: { data: { id: 'org-1', type: 'organizations' } },
    });

    const cred = getAnsibleCredentialFromJsonApi(resource);
    expect(cred.name).toBe('SSH Key');
    expect(cred.type).toBe('ssh');
    expect(cred.username).toBe('deploy');
  });
});

describe('getAnsibleJobTemplateFromJsonApi', () => {
  it('transforms a job template resource', () => {
    const resource = makeResource('ansible-job-templates', {
      name: 'Deploy Template',
      description: 'Standard deploy',
      verbosity: 1,
      forks: 5,
      'become-enabled': false,
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      project: { data: { id: 'proj-1', type: 'projects' } },
      playbook: { data: { id: 'pb-1', type: 'ansible-playbooks' } },
      inventory: { data: { id: 'inv-1', type: 'ansible-inventories' } },
    });

    const tpl = getAnsibleJobTemplateFromJsonApi(resource);
    expect(tpl.name).toBe('Deploy Template');
    expect(tpl.project_id).toBe('proj-1');
    expect(tpl.playbook_id).toBe('pb-1');
    expect(tpl.inventory_id).toBe('inv-1');
  });
});

describe('getAnsibleHostFromJsonApi', () => {
  it('transforms a host resource', () => {
    const resource = makeResource('ansible-inventory-hosts', {
      name: 'web-server-01',
      hostname: '10.0.1.5',
      port: 22,
      enabled: true,
      variables: { ansible_user: 'deploy' },
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      inventory: { data: { id: 'inv-1', type: 'ansible-inventories' } },
    });

    const host = getAnsibleHostFromJsonApi(resource);
    expect(host.name).toBe('web-server-01');
    expect(host.hostname).toBe('10.0.1.5');
    expect(host.port).toBe(22);
    expect(host.enabled).toBe(true);
    expect(host.variables).toEqual({ ansible_user: 'deploy' });
  });
});

describe('getAnsibleGroupFromJsonApi', () => {
  it('transforms a group resource', () => {
    const resource = makeResource('ansible-inventory-groups', {
      name: 'webservers',
      description: 'Web server group',
      variables: { http_port: 80 },
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      inventory: { data: { id: 'inv-1', type: 'ansible-inventories' } },
      parent: { data: { id: 'grp-parent', type: 'ansible-inventory-groups' } },
    });

    const group = getAnsibleGroupFromJsonApi(resource);
    expect(group.name).toBe('webservers');
    expect(group.parent_id).toBe('grp-parent');
    expect(group.variables).toEqual({ http_port: 80 });
  });
});

describe('getAnsibleJobEventFromJsonApi', () => {
  it('transforms a job event resource', () => {
    const resource = makeResource('ansible-job-events', {
      'event-type': 'runner_on_ok',
      host: 'web-server-01',
      task: 'Install nginx',
      play: 'Deploy',
      role: 'nginx',
      counter: 5,
      stdout: 'ok: [web-server-01]',
      changed: false,
      failed: false,
      timestamp: '2024-01-01T00:00:01Z',
      'created-at': '2024-01-01T00:00:00Z',
    }, {
      job: { data: { id: 'job-1', type: 'ansible-jobs' } },
    });

    const event = getAnsibleJobEventFromJsonApi(resource);
    expect(event.event_type).toBe('runner_on_ok');
    expect(event.host).toBe('web-server-01');
    expect(event.task).toBe('Install nginx');
    expect(event.counter).toBe(5);
    expect(event.job_id).toBe('job-1');
    // Both were served by the API and silently dropped before.
    expect(event.role).toBe('nginx');
    expect(event.timestamp).toBe('2024-01-01T00:00:01Z');
  });
});

describe('getAnsibleInventorySourceFromJsonApi', () => {
  it('transforms an inventory source resource', () => {
    const resource = makeResource('ansible-inventory-sources', {
      name: 'AWS EC2',
      'source-type': 'aws',
      status: 'successful',
      'update-on-launch': true,
      'group-by-region': true,
      'hostname-var': 'private_ip',
      'hosts-count': 42,
      config: { regions: ['us-east-1'] },
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      inventory: { data: { id: 'inv-1', type: 'ansible-inventories' } },
    });

    const src = getAnsibleInventorySourceFromJsonApi(resource);
    expect(src.name).toBe('AWS EC2');
    expect(src.type).toBe('aws');
    expect(src.status).toBe('successful');
    expect(src.hosts_count).toBe(42);
    expect(src.hostname_var).toBe('private_ip');
  });
});

describe('getAnsibleScheduleFromJsonApi', () => {
  it('transforms a schedule resource', () => {
    const resource = makeResource('ansible-schedules', {
      name: 'Nightly Deploy',
      'schedule-type': 'job_template',
      status: 'enabled',
      'cron-expression': '0 2 * * *',
      timezone: 'America/New_York',
      'run-count': 15,
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      organization: { data: { id: 'org-1', type: 'organizations' } },
      'job-template': { data: { id: 'tpl-1', type: 'ansible-job-templates' } },
    });

    const sched = getAnsibleScheduleFromJsonApi(resource);
    expect(sched.name).toBe('Nightly Deploy');
    expect(sched.type).toBe('job_template');
    expect(sched.cron_expression).toBe('0 2 * * *');
    expect(sched.timezone).toBe('America/New_York');
    expect(sched.run_count).toBe(15);
    expect(sched.job_template_id).toBe('tpl-1');
  });
});

describe('getAnsibleWorkflowFromJsonApi', () => {
  it('transforms a workflow resource', () => {
    const resource = makeResource('ansible-workflows', {
      name: 'Full Deploy Pipeline',
      description: 'Build, test, deploy',
      'allow-simultaneous': false,
      'ask-variables-on-launch': true,
      'survey-enabled': true,
      'created-at': '2024-01-01T00:00:00Z',
      'updated-at': '2024-01-01T00:00:00Z',
    }, {
      organization: { data: { id: 'org-1', type: 'organizations' } },
      project: { data: { id: 'proj-1', type: 'projects' } },
    });

    const wf = getAnsibleWorkflowFromJsonApi(resource);
    expect(wf.name).toBe('Full Deploy Pipeline');
    expect(wf.organization_id).toBe('org-1');
    expect(wf.project_id).toBe('proj-1');
    expect(wf.allow_simultaneous).toBe(false);
    expect(wf.ask_variables_on_launch).toBe(true);
    expect(wf.survey_enabled).toBe(true);
  });
});
