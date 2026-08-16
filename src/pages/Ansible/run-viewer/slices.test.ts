// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import type { AnsibleJobEvent } from '@/api/ansible';
import { buildRunModel } from './adapter';
import { mergeSlices } from './slices';
import { resultFor } from './model';

/**
 * Build one slice's event stream. Each slice is its own `ansible-playbook`
 * invocation, so the task ids differ between slices even though the tasks are
 * the same - which is exactly what the merge has to survive.
 */
function sliceEvents(opts: {
  hosts: string[];
  taskIdPrefix: string;
  startSecond: number;
  failOn?: string;
}): AnsibleJobEvent[] {
  const { hosts, taskIdPrefix, startSecond, failOn } = opts;
  const events: AnsibleJobEvent[] = [];
  const at = (seconds: number) => new Date(Date.UTC(2026, 7, 16, 10, 0, 0) + seconds * 1000).toISOString();
  let counter = 0;

  const push = (eventData: Record<string, unknown>) => {
    counter++;
    events.push({
      id: `${taskIdPrefix}-evt-${counter}`,
      job_id: taskIdPrefix,
      event_type: 'runner_on_ok',
      event_data: eventData,
      counter,
      created_at: at(startSecond),
    });
  };

  push({ play: { name: 'Rolling deploy', id: `${taskIdPrefix}-p` }, _event: 'v2_playbook_on_play_start', _timestamp: at(startSecond) });

  const tasks = [
    { name: 'Gathering Facts', path: '/runner/project/deploy.yml:2' },
    { name: 'Restart application service', path: '/runner/project/roles/app/tasks/service.yml:3' },
  ];

  tasks.forEach((task, index) => {
    const id = `${taskIdPrefix}-task-${index}`;
    const startedAt = startSecond + index * 2;
    push({
      task: { id, name: task.name, path: task.path, duration: { start: at(startedAt) } },
      hosts: {},
      _event: 'v2_playbook_on_task_start',
      _timestamp: at(startedAt),
    });
    hosts.forEach((host, hostIndex) => {
      const failed = index === 1 && host === failOn;
      push({
        task: { id, name: task.name, path: task.path, duration: { start: at(startedAt), end: at(startedAt + 1) } },
        hosts: { [host]: failed ? { failed: true, msg: 'boom' } : { changed: index === 1 } },
        _event: failed ? 'v2_runner_on_failed' : 'v2_runner_on_ok',
        _timestamp: at(startedAt + hostIndex * 0.1),
      });
    });
  });

  const stats: Record<string, unknown> = {};
  for (const host of hosts) {
    stats[host] = {
      ok: 2, changed: host === failOn ? 0 : 1, failures: host === failOn ? 1 : 0,
      skipped: 0, unreachable: 0, rescued: 0, ignored: 0,
    };
  }
  push({ stats, _event: 'v2_playbook_on_stats', _timestamp: at(startSecond + 6) });

  return events;
}

const sliceOne = buildRunModel(sliceEvents({ hosts: ['web01', 'web03'], taskIdPrefix: 's1', startSecond: 0 }));
const sliceTwo = buildRunModel(sliceEvents({ hosts: ['web02', 'web04'], taskIdPrefix: 's2', startSecond: 1, failOn: 'web04' }));

describe('mergeSlices', () => {
  const merged = mergeSlices([
    { sliceNumber: 2, jobId: 'job-2', model: sliceTwo },
    { sliceNumber: 1, jobId: 'job-1', model: sliceOne },
  ]);

  it('presents the fan-out as one run', () => {
    expect(merged.model.hosts).toEqual(['web01', 'web02', 'web03', 'web04']);
    expect(merged.model.playName).toBe('Rolling deploy');
  });

  it('merges the same task into one column despite differing task ids', () => {
    // Each slice named its tasks differently (s1-task-0 vs s2-task-0), but the
    // task is the same task.
    expect(sliceOne.tasks[0].id).not.toBe(sliceTwo.tasks[0].id);
    expect(merged.model.tasks).toHaveLength(2);
    expect(merged.model.tasks.map((t) => t.name)).toEqual(['Gathering Facts', 'Restart application service']);
    expect(merged.model.tasks.map((t) => t.index)).toEqual([0, 1]);
  });

  it('keeps every host result reachable under the merged task id', () => {
    const restart = merged.model.tasks[1];
    expect(resultFor(merged.model, 'web01', restart.id)?.status).toBe('changed');
    expect(resultFor(merged.model, 'web04', restart.id)?.status).toBe('failed');
    // All four hosts ran both tasks.
    for (const host of merged.model.hosts) {
      for (const task of merged.model.tasks) {
        expect(resultFor(merged.model, host, task.id)).toBeDefined();
      }
    }
  });

  it('sums the totals across slices', () => {
    expect(merged.model.totals.failed).toBe(1);
    expect(merged.model.totals.changed).toBe(sliceOne.totals.changed + sliceTwo.totals.changed);
    expect(merged.model.totals.ok).toBe(sliceOne.totals.ok + sliceTwo.totals.ok);
    expect(Object.keys(merged.model.statsByHost ?? {}).sort()).toEqual(['web01', 'web02', 'web03', 'web04']);
  });

  it('puts the merged stream on one clock', () => {
    expect(merged.model.streamLines).toHaveLength(sliceOne.streamLines.length + sliceTwo.streamLines.length);
    const times = merged.model.streamLines.map((line) => line.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // Every stream line's task id points at a merged column.
    const columnIds = new Set(merged.model.tasks.map((t) => t.id));
    for (const line of merged.model.streamLines) {
      if (line.taskId) expect(columnIds.has(line.taskId)).toBe(true);
    }
  });

  it('spans the whole launch, earliest start to latest end', () => {
    expect(merged.model.startMs).toBe(Math.min(sliceOne.startMs, sliceTwo.startMs));
    expect(merged.model.endMs).toBe(Math.max(sliceOne.endMs, sliceTwo.endMs));
  });

  it('reports a per-slice breakdown in slice order', () => {
    expect(merged.slices).toEqual([
      { sliceNumber: 1, jobId: 'job-1', hosts: 2, worst: 'changed' },
      { sliceNumber: 2, jobId: 'job-2', hosts: 2, worst: 'failed' },
    ]);
  });

  it('handles a single slice and an empty set', () => {
    const single = mergeSlices([{ sliceNumber: 1, jobId: 'job-1', model: sliceOne }]);
    expect(single.model.hosts).toEqual(sliceOne.hosts);
    expect(single.model.tasks).toHaveLength(sliceOne.tasks.length);

    const none = mergeSlices([]);
    expect(none.model.hosts).toEqual([]);
    expect(none.model.tasks).toEqual([]);
    expect(none.model.startMs).toBe(0);
    expect(none.slices).toEqual([]);
  });
});
