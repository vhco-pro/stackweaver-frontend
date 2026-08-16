// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import type { AnsibleJobEvent } from '@/api/ansible';
import { buildRunModel } from './adapter';
import { cellMatches, isFiltering, normalizeQuery, streamLineMatches, type RunFilters } from './filters';
import { resultFor, type RunStatus } from './model';
import demoEvents from './__fixtures__/demo-run-events.json';

interface FixtureRow {
  counter: number;
  event: string;
  event_data: Record<string, unknown>;
  task: string;
  play: string;
  created_at: string;
}

const DEMO_EVENTS: AnsibleJobEvent[] = (demoEvents as FixtureRow[]).map((row) => ({
  id: `evt-${row.counter}`,
  job_id: 'demo',
  event_type: row.event,
  event_data: row.event_data,
  task: row.task,
  play: row.play,
  counter: row.counter,
  created_at: row.created_at,
}));

const model = buildRunModel(DEMO_EVENTS);

function filters(statuses: RunStatus[], query = ''): RunFilters {
  return { statuses: new Set(statuses), query: normalizeQuery(query) };
}

/** Every host x task cell that survives the filters. */
function matchingCells(f: RunFilters): { host: string; task: string }[] {
  const hits: { host: string; task: string }[] = [];
  for (const host of model.hosts) {
    for (const task of model.tasks) {
      const result = resultFor(model, host, task.id);
      if (result && cellMatches(f, host, task, result)) hits.push({ host, task: task.name });
    }
  }
  return hits;
}

describe('isFiltering', () => {
  it('is false only when nothing is set', () => {
    expect(isFiltering(filters([]))).toBe(false);
    expect(isFiltering(filters([], '   '))).toBe(false);
    expect(isFiltering(filters(['failed']))).toBe(true);
    expect(isFiltering(filters([], 'web07'))).toBe(true);
  });
});

describe('cellMatches', () => {
  it('isolates the failed host with the failed tile alone', () => {
    const hits = matchingCells(filters(['failed']));
    expect(hits).toEqual([{ host: 'api03', task: 'Restart application service' }]);
  });

  it('ORs statuses within the tile row', () => {
    const hosts = new Set(matchingCells(filters(['failed', 'unreachable'])).map((hit) => hit.host));
    expect([...hosts].sort()).toEqual(['api03', 'web07']);
  });

  it('searches host names, task names, and the full module result', () => {
    // Host name.
    expect(matchingCells(filters([], 'api03')).every((hit) => hit.host === 'api03')).toBe(true);
    // Task name.
    const byTask = matchingCells(filters([], 'database migrations'));
    expect(new Set(byTask.map((hit) => hit.task))).toEqual(new Set(['Run database migrations']));
    // Deep inside a module result - "timed out" only appears in web07's ssh error.
    expect(matchingCells(filters([], 'timed out'))).toEqual([
      { host: 'web07', task: 'Verify connectivity and sudo access' },
    ]);
  });

  it('is case-insensitive through normalizeQuery', () => {
    expect(matchingCells(filters([], '  TIMED OUT  '))).toEqual([
      { host: 'web07', task: 'Verify connectivity and sudo access' },
    ]);
  });

  it('ANDs the status tiles with the search query', () => {
    // api03 fails, but not on a task mentioning nginx.
    expect(matchingCells(filters(['failed'], 'nginx'))).toEqual([]);
    expect(matchingCells(filters(['failed'], 'systemd'))).toEqual([
      { host: 'api03', task: 'Restart application service' },
    ]);
  });

  it('matches nothing for a query no result contains', () => {
    expect(matchingCells(filters([], 'definitely-not-in-this-run'))).toEqual([]);
  });
});

describe('streamLineMatches', () => {
  it('keeps every line when nothing is filtered', () => {
    const kept = model.streamLines.filter((line) => streamLineMatches(filters([]), line));
    expect(kept).toHaveLength(model.streamLines.length);
  });

  it('drops non-result lines while a status filter is on', () => {
    const kept = model.streamLines.filter((line) => streamLineMatches(filters(['unreachable']), line));
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ kind: 'result', host: 'web07', status: 'unreachable' });
  });

  it('searches the raw event, not just the rendered message', () => {
    // "AddAuditIndexes" appears only inside db01's migration stdout.
    const kept = model.streamLines.filter((line) => streamLineMatches(filters([], 'AddAuditIndexes'), line));
    expect(kept.map((line) => line.host)).toEqual(['db01']);
  });

  it('finds the play recap by name', () => {
    const kept = model.streamLines.filter((line) => streamLineMatches(filters([], 'recap'), line));
    expect(kept.map((line) => line.kind)).toEqual(['recap']);
  });
});
