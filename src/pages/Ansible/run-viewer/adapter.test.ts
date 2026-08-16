// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import type { AnsibleJobEvent } from '@/api/ansible';
import { buildRunModel, deriveStatus } from './adapter';
import { hostWorstStatus, resultFor, taskAggregate, type ModuleResult } from './model';
import demoEvents from './__fixtures__/demo-run-events.json';

/**
 * The fixture is the exact event stream `scripts/seed-ansible-demo-job.py`
 * writes to the database (20 hosts, 9 tasks, 182 events, one failed host, one
 * unreachable host), regenerate with:
 *
 *   python3 scripts/seed-ansible-demo-job.py --project-id <any> --inventory-id <any> \
 *     --events-json frontend/src/pages/Ansible/run-viewer/__fixtures__/demo-run-events.json
 */
interface FixtureRow {
  counter: number;
  event: string;
  event_data: Record<string, unknown>;
  task: string;
  play: string;
  created_at: string;
}

function toEvent(row: FixtureRow): AnsibleJobEvent {
  return {
    id: `evt-${row.counter}`,
    job_id: 'de300000-0000-4000-8000-000000000001',
    event_type: row.event,
    event_data: row.event_data,
    task: row.task,
    play: row.play,
    counter: row.counter,
    created_at: row.created_at,
  };
}

const DEMO_EVENTS: AnsibleJobEvent[] = (demoEvents as FixtureRow[]).map(toEvent);

function event(partial: Partial<AnsibleJobEvent> & { counter: number }): AnsibleJobEvent {
  return {
    id: `evt-${partial.counter}`,
    job_id: 'job-1',
    event_type: 'runner_on_ok',
    created_at: '2026-08-15T09:41:12.000000Z',
    ...partial,
  };
}

function taskByName(name: string, model = buildRunModel(DEMO_EVENTS)) {
  const task = model.tasks.find((t) => t.name === name);
  if (!task) throw new Error(`no task named ${name}`);
  return task;
}

describe('buildRunModel - demo fleet run', () => {
  const model = buildRunModel(DEMO_EVENTS);

  it('pivots the stream into 20 hosts x 9 tasks', () => {
    expect(DEMO_EVENTS).toHaveLength(182);
    expect(model.tasks).toHaveLength(9);
    expect(model.hosts).toHaveLength(20);
    expect(model.playName).toBe('Rolling deploy of web application');
    expect(model.hosts.slice(0, 3)).toEqual(['api01', 'api02', 'api03']);
    expect(model.tasks[0].name).toBe('Gathering Facts');
    expect(model.tasks[8].name).toBe('Report deployed version');
  });

  it('never drops an event: every event becomes exactly one stream line', () => {
    expect(model.streamLines).toHaveLength(DEMO_EVENTS.length);
    const classified = model.streamLines.filter((l) => l.kind !== 'raw').length;
    const raw = model.streamLines.filter((l) => l.kind === 'raw').length;
    expect(classified + raw).toBe(DEMO_EVENTS.length);
    // The demo stream is fully structured, so nothing should fall to the raw lane.
    expect(raw).toBe(0);
    expect(model.streamLines[0].kind).toBe('play');
    expect(model.streamLines.at(-1)?.kind).toBe('recap');
  });

  it('reads totals from the recap event', () => {
    expect(model.totals).toEqual({ ok: 122, changed: 43, failed: 1, unreachable: 1, skipped: 47 });
    // api03: facts + ping ok, apt + unarchive changed (counted in ok too),
    // template + migrations skipped, service restart failed.
    expect(model.statsByHost?.api03).toEqual({
      ok: 4,
      changed: 2,
      failures: 1,
      skipped: 2,
      unreachable: 0,
      rescued: 0,
      ignored: 0,
    });
  });

  it('derives the same totals without a recap (job still running)', () => {
    const midRun = buildRunModel(DEMO_EVENTS.filter((e) => e.event_type !== 'v2_playbook_on_stats'));
    expect(midRun.statsByHost).toBeUndefined();
    expect(midRun.totals).toEqual(model.totals);
  });

  it('places api03 as the only failure, on the service restart task', () => {
    const restart = taskByName('Restart application service', model);
    const failed = model.hosts.filter((h) => resultFor(model, h, restart.id)?.status === 'failed');
    expect(failed).toEqual(['api03']);

    const result = resultFor(model, 'api03', restart.id);
    expect(result?.result.rc).toBe(1);
    expect(result?.result.action).toBe('ansible.builtin.systemd_service');
    expect(result?.result.msg).toContain('Unable to restart service app');
    expect(hostWorstStatus(model, 'api03')).toBe('failed');
  });

  it('stops recording api03 after it failed', () => {
    const health = taskByName('Wait for health endpoint to report ready', model);
    expect(resultFor(model, 'api03', health.id)).toBeUndefined();
  });

  it('marks web07 unreachable and leaves its later cells empty', () => {
    const connectivity = taskByName('Verify connectivity and sudo access', model);
    const result = resultFor(model, 'web07', connectivity.id);
    expect(result?.status).toBe('unreachable');
    expect(result?.result.msg).toContain('Connection timed out');
    expect(hostWorstStatus(model, 'web07')).toBe('unreachable');

    // Everything after the drop-out is a did-not-run cell.
    for (const task of model.tasks.slice(2)) {
      expect(resultFor(model, 'web07', task.id)).toBeUndefined();
    }
  });

  it('keeps skip reasons for hosts a task did not apply to', () => {
    const migrations = taskByName('Run database migrations', model);
    const db02 = resultFor(model, 'db02', migrations.id);
    expect(db02?.status).toBe('skipped');
    expect(db02?.result.skip_reason).toBe('run_once with delegate');
    expect(resultFor(model, 'db01', migrations.id)?.status).toBe('changed');
  });

  it('keeps diffs on the hosts that templated a file', () => {
    const template = taskByName('Render nginx site configuration', model);
    const web01 = resultFor(model, 'web01', template.id);
    expect(web01?.status).toBe('changed');
    expect(Array.isArray(web01?.result.diff)).toBe(true);
    // Non-web hosts skipped the task, so they carry no diff.
    expect(resultFor(model, 'db01', template.id)?.result.diff).toBeUndefined();
  });

  it('keeps gathered facts on the fact-gathering task', () => {
    const gathering = taskByName('Gathering Facts', model);
    const facts = resultFor(model, 'web01', gathering.id)?.result.ansible_facts;
    expect(facts?.ansible_distribution).toBe('Ubuntu');
    expect(facts?.ansible_default_ipv4).toEqual({ address: '10.20.0.10', interface: 'ens5' });
  });

  it('keeps retry counts from the health check', () => {
    const health = taskByName('Wait for health endpoint to report ready', model);
    const attempts = model.hosts
      .map((h) => resultFor(model, h, health.id)?.result.attempts)
      .filter((a): a is number => typeof a === 'number');
    expect(attempts.length).toBeGreaterThan(0);
    expect(Math.max(...attempts)).toBeGreaterThan(1);
  });

  it('aggregates a task column by status', () => {
    const template = taskByName('Render nginx site configuration', model);
    const counts = taskAggregate(model, template.id);
    // 8 web hosts minus the unreachable one, plus lb01, changed; the rest skipped.
    expect(counts).toEqual({ ok: 0, changed: 8, failed: 0, unreachable: 0, skipped: 11 });
  });

  it('gives every task a window on the run clock', () => {
    expect(model.endMs).toBeGreaterThan(model.startMs);
    for (const task of model.tasks) {
      expect(task.startMs).toBeGreaterThanOrEqual(model.startMs);
      expect(task.endMs).toBeGreaterThanOrEqual(task.startMs);
      expect(task.endMs).toBeLessThanOrEqual(model.endMs);
    }
    // Tasks come out in playbook order.
    const starts = model.tasks.map((t) => t.startMs);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(model.tasks.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('buildRunModel - degenerate and unstructured input', () => {
  it('handles an empty stream', () => {
    const model = buildRunModel([]);
    expect(model).toMatchObject({
      playName: '',
      startMs: 0,
      endMs: 0,
      tasks: [],
      hosts: [],
      streamLines: [],
      totals: { ok: 0, changed: 0, failed: 0, unreachable: 0, skipped: 0 },
    });
    expect(model.results.size).toBe(0);
    expect(model.statsByHost).toBeUndefined();
  });

  it('renders a job that has only started its first task', () => {
    const model = buildRunModel([
      event({
        counter: 1,
        event_data: {
          play: { name: 'Deploy', id: 'p1', path: '/runner/project/deploy.yml:2' },
          _event: 'v2_playbook_on_play_start',
          _timestamp: '2026-08-15T09:41:12.400000Z',
        },
      }),
      event({
        counter: 2,
        task: 'Gathering Facts',
        event_data: {
          task: {
            name: 'Gathering Facts',
            id: 't1',
            path: '/runner/project/deploy.yml:2',
            duration: { start: '2026-08-15T09:41:12.600000Z' },
          },
          hosts: {},
          _event: 'v2_playbook_on_task_start',
          _timestamp: '2026-08-15T09:41:12.600000Z',
        },
      }),
    ]);
    expect(model.playName).toBe('Deploy');
    expect(model.tasks).toHaveLength(1);
    expect(model.hosts).toEqual([]);
    expect(model.streamLines.map((l) => l.kind)).toEqual(['play', 'task']);
  });

  it('routes anything it cannot classify to the raw lane, verbatim', () => {
    const model = buildRunModel([
      event({
        counter: 1,
        event_type: 'galaxy_install',
        stdout: 'Starting galaxy collection install process\n',
        event_data: {},
      }),
      event({ counter: 2, event_type: 'runner_stderr', stderr: '[WARNING]: provided hosts list is empty' }),
      event({ counter: 3, event_data: { _event: 'v3_something_new_entirely', payload: { a: 1 } } }),
      // A result event whose task object is missing cannot become a cell.
      event({ counter: 4, event_data: { _event: 'v2_runner_on_ok', hosts: { web01: { changed: true } } } }),
    ]);
    expect(model.streamLines.map((l) => l.kind)).toEqual(['raw', 'raw', 'raw', 'raw']);
    expect(model.streamLines[0].message).toBe('Starting galaxy collection install process');
    expect(model.streamLines[1].message).toBe('[WARNING]: provided hosts list is empty');
    expect(model.streamLines[2].message).toContain('v3_something_new_entirely');
    expect(model.tasks).toEqual([]);
    expect(model.hosts).toEqual([]);
  });

  it('builds columns from result events alone, for a partial window of the stream', () => {
    const model = buildRunModel([
      event({
        counter: 40,
        event_data: {
          task: {
            name: 'Restart application service',
            id: 't7',
            path: '/runner/project/roles/app/tasks/service.yml:3',
            duration: { start: '2026-08-15T09:41:40.000000Z', end: '2026-08-15T09:41:41.000000Z' },
          },
          hosts: { api03: { action: 'ansible.builtin.systemd_service', failed: true, msg: 'boom', rc: 1 } },
          _event: 'v2_runner_on_failed',
          _timestamp: '2026-08-15T09:41:41.000000Z',
        },
      }),
    ]);
    expect(model.tasks).toHaveLength(1);
    expect(model.hosts).toEqual(['api03']);
    expect(resultFor(model, 'api03', 't7')?.status).toBe('failed');
    expect(model.totals.failed).toBe(1);
  });

  it('falls back to created_at when the callback timestamp is missing', () => {
    const model = buildRunModel([
      event({
        counter: 1,
        created_at: '2026-08-15T09:41:12.000Z',
        event_data: {
          task: { name: 'Ping', id: 't1', path: 'play.yml:1' },
          hosts: { web01: { ping: 'pong' } },
          _event: 'v2_runner_on_ok',
        },
      }),
    ]);
    expect(model.startMs).toBe(Date.parse('2026-08-15T09:41:12.000Z'));
    expect(resultFor(model, 'web01', 't1')?.atMs).toBe(model.startMs);
  });

  it('identifies tasks by name when the callback omits a task id', () => {
    const withoutId = (counter: number, host: string) =>
      event({
        counter,
        event_data: {
          task: { name: 'Ping', path: 'play.yml:1' },
          hosts: { [host]: { ping: 'pong' } },
          _event: 'v2_runner_on_ok',
          _timestamp: '2026-08-15T09:41:12.400000Z',
        },
      });
    const model = buildRunModel([withoutId(1, 'web01'), withoutId(2, 'web02')]);
    expect(model.tasks).toHaveLength(1);
    expect(model.tasks[0].id).toBe('name:Ping');
    expect(model.hosts).toEqual(['web01', 'web02']);
  });
});

describe('deriveStatus', () => {
  const cases: [string, ModuleResult, string | undefined, string][] = [
    ['plain ok', { ping: 'pong' }, 'v2_runner_on_ok', 'ok'],
    ['changed', { changed: true }, 'v2_runner_on_ok', 'changed'],
    ['skipped', { skipped: true, changed: false }, 'v2_runner_on_skipped', 'skipped'],
    ['failed beats changed', { failed: true, changed: true }, 'v2_runner_on_failed', 'failed'],
    ['unreachable beats failed', { unreachable: true, failed: true }, 'v2_runner_on_unreachable', 'unreachable'],
    ['verb only, no flags', {}, 'v2_runner_on_failed', 'failed'],
    ['loop result with an item failure', { failed: true, results: [{ failed: true }] }, 'v2_runner_on_failed', 'failed'],
    ['no signal at all', {}, undefined, 'ok'],
  ];

  for (const [name, result, verb, expected] of cases) {
    it(name, () => {
      expect(deriveStatus(result, verb)).toBe(expected);
    });
  }
});
