// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The run viewer rebuilds its whole model on every poll rather than appending
 * to it, which is only acceptable while a rebuild is cheap next to the 3-second
 * poll interval. This test states that budget so a future change that makes the
 * adapter quadratic (a nested scan over hosts, say) fails here instead of in a
 * user's browser during a fleet run.
 *
 * The threshold is deliberately loose - CI machines are slower and noisier than
 * a laptop - and it is a ceiling, not a target: the point is to catch an order
 * of magnitude, not a few milliseconds.
 */

import { describe, expect, it } from 'vitest';
import type { AnsibleJobEvent } from '@/api/ansible';
import { buildRunModel } from './adapter';

const HOSTS = 500;
const TASKS = 40;
/** 500 hosts x 40 tasks plus play/task starts and a recap: ~20k events. */
const REBUILD_BUDGET_MS = 1500;

function syntheticRun(): AnsibleJobEvent[] {
  const events: AnsibleJobEvent[] = [];
  const at = (seconds: number) => new Date(Date.UTC(2026, 7, 15, 9, 0, 0) + seconds * 1000).toISOString();
  let counter = 0;

  const push = (eventData: Record<string, unknown>, task = '') => {
    counter++;
    events.push({
      id: `evt-${counter}`,
      job_id: 'perf',
      event_type: 'runner_on_ok',
      event_data: eventData,
      task,
      play: '',
      counter,
      created_at: at(counter / 100),
    });
  };

  push({ play: { name: 'Fleet deploy', id: 'p1', path: 'deploy.yml:2' }, _event: 'v2_playbook_on_play_start', _timestamp: at(0) });

  for (let t = 0; t < TASKS; t++) {
    const task = { id: `task-${t}`, name: `Task number ${t}`, path: `roles/app/tasks/main.yml:${t}`, duration: { start: at(t * 5) } };
    push({ task, hosts: {}, _event: 'v2_playbook_on_task_start', _timestamp: at(t * 5) }, task.name);

    for (let h = 0; h < HOSTS; h++) {
      const host = `host${String(h).padStart(3, '0')}`;
      const changed = (h + t) % 3 === 0;
      const failed = h === 42 && t === 17;
      push(
        {
          task: { ...task, duration: { start: at(t * 5), end: at(t * 5 + 4) } },
          hosts: {
            [host]: {
              action: 'ansible.builtin.command',
              changed,
              failed,
              // A realistically chunky module result, so the measurement
              // includes the object sizes a real run carries.
              stdout: `line one for ${host}\nline two\nline three`,
              invocation: { module_args: { _raw_params: 'systemctl restart app', warn: false } },
            },
          },
          _event: failed ? 'v2_runner_on_failed' : 'v2_runner_on_ok',
          _timestamp: at(t * 5 + (h % 5)),
        },
        task.name,
      );
    }
  }

  const stats: Record<string, unknown> = {};
  for (let h = 0; h < HOSTS; h++) {
    stats[`host${String(h).padStart(3, '0')}`] = { ok: TASKS, changed: 13, failures: 0, skipped: 0, unreachable: 0, rescued: 0, ignored: 0 };
  }
  push({ stats, _event: 'v2_playbook_on_stats', _timestamp: at(TASKS * 5) });

  return events;
}

describe('buildRunModel at fleet scale', () => {
  it(`rebuilds a ${HOSTS}-host x ${TASKS}-task run well inside the poll interval`, () => {
    const events = syntheticRun();
    expect(events.length).toBeGreaterThan(20_000);

    const started = performance.now();
    const model = buildRunModel(events);
    const elapsed = performance.now() - started;

    expect(model.hosts).toHaveLength(HOSTS);
    expect(model.tasks).toHaveLength(TASKS);
    expect(model.streamLines).toHaveLength(events.length);
    expect(elapsed).toBeLessThan(REBUILD_BUDGET_MS);
  });
});
