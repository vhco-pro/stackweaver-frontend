// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for the Workspaces `refs` warning fix: the manual setInterval poll kept a
// `workspacesRef` synced during render; it was replaced by a React Query
// refetchInterval driven by this pure predicate. This pins the polling decision
// the refetchInterval depends on.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hasActiveWorkspaceRun,
  evaluatePendingCreateDialog,
  latestRunResource,
  workspaceStatusCategory,
  workspaceMatchesStatus,
  countWorkspacesByStatus,
} from './Workspaces.helpers';
import type { JsonApiResource } from '@/utils/jsonapi';

const run = (status: string): JsonApiResource => ({
  id: 'r1',
  type: 'runs',
  attributes: { status },
});

describe('hasActiveWorkspaceRun', () => {
  it('is true when any workspace has an in-progress run', () => {
    for (const status of ['pending', 'planning', 'planned', 'applying', 'running']) {
      expect(hasActiveWorkspaceRun([{ latestRun: run(status) }])).toBe(true);
    }
  });

  it('is false when all runs are terminal or absent', () => {
    expect(hasActiveWorkspaceRun([])).toBe(false);
    expect(hasActiveWorkspaceRun([{}])).toBe(false);
    expect(hasActiveWorkspaceRun([{ latestRun: run('applied') }, { latestRun: run('errored') }])).toBe(false);
  });

  it('is true if even one of several workspaces is active', () => {
    expect(
      hasActiveWorkspaceRun([
        { latestRun: run('applied') },
        { latestRun: run('applying') },
        {},
      ]),
    ).toBe(true);
  });
});

// Net for the Workspaces `set-state-in-effect` fix: the GitHub-redirect "reopen
// Create Workspace dialog" effect now derives its decision from this pure reader,
// and the mount effect only applies the indicated open + cleanup. This pins the
// URL-param (primary) and localStorage-fallback (org/recency-scoped) precedence.
describe('evaluatePendingCreateDialog', () => {
  const setSearch = (search: string) => {
    window.history.replaceState({}, '', `/app/acme/workspaces${search}`);
  };

  beforeEach(() => {
    setSearch('');
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    setSearch('');
  });

  it('does nothing when org context is not ready', () => {
    setSearch('?openDialog=true');
    expect(evaluatePendingCreateDialog('', 'acme')).toEqual({
      open: false,
      clearUrl: false,
      clearStorage: false,
    });
    expect(evaluatePendingCreateDialog('acme', undefined)).toEqual({
      open: false,
      clearUrl: false,
      clearStorage: false,
    });
  });

  it('opens and clears both URL and storage when the openDialog param is set', () => {
    setSearch('?openDialog=true');
    localStorage.setItem('pendingWorkspaceDialog', JSON.stringify({ orgName: 'acme', timestamp: 0 }));
    expect(evaluatePendingCreateDialog('acme', 'acme')).toEqual({
      open: true,
      clearUrl: true,
      clearStorage: true,
    });
  });

  it('opens from a recent, org-matching localStorage entry (no URL change)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'));
    const recent = Date.now() - 60_000;
    localStorage.setItem('pendingWorkspaceDialog', JSON.stringify({ orgName: 'acme', timestamp: recent }));
    expect(evaluatePendingCreateDialog('acme', 'acme')).toEqual({
      open: true,
      clearUrl: false,
      clearStorage: true,
    });
  });

  it('clears but does not open a stale localStorage entry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'));
    const stale = Date.now() - 10 * 60 * 1000;
    localStorage.setItem('pendingWorkspaceDialog', JSON.stringify({ orgName: 'acme', timestamp: stale }));
    expect(evaluatePendingCreateDialog('acme', 'acme')).toEqual({
      open: false,
      clearUrl: false,
      clearStorage: true,
    });
  });

  it('clears but does not open an entry for a different org', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'));
    localStorage.setItem('pendingWorkspaceDialog', JSON.stringify({ orgName: 'other', timestamp: Date.now() }));
    expect(evaluatePendingCreateDialog('acme', 'acme')).toEqual({
      open: false,
      clearUrl: false,
      clearStorage: true,
    });
  });

  it('clears a corrupt localStorage entry without throwing', () => {
    localStorage.setItem('pendingWorkspaceDialog', '{not json');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(evaluatePendingCreateDialog('acme', 'acme')).toEqual({
      open: false,
      clearUrl: false,
      clearStorage: true,
    });
    spy.mockRestore();
  });

  it('does nothing when there is no signal at all', () => {
    expect(evaluatePendingCreateDialog('acme', 'acme')).toEqual({
      open: false,
      clearUrl: false,
      clearStorage: false,
    });
  });
});

// Nets for the bucketing lifted out of Workspaces.tsx so the dashboard's attention strip and the
// list's counters/filter derive a workspace's status from one definition.
describe('latestRunResource', () => {
  const workspace = {
    id: 'ws-1',
    project_id: 'p-1',
    name: 'payments-prod',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  };

  it('is undefined for a workspace that has never run', () => {
    expect(latestRunResource(workspace)).toBeUndefined();
  });

  it('maps the flat run onto the kebab-case attributes the run helpers read', () => {
    const resource = latestRunResource({
      ...workspace,
      latest_run: {
        id: 'run-1',
        status: 'planned',
        operation: 'plan-and-apply',
        is_destroy: false,
        plan_only: false,
        has_changes: true,
        created_at: '2026-08-02T10:00:00Z',
      },
    });
    expect(resource).toEqual({
      id: 'run-1',
      type: 'runs',
      attributes: {
        'status': 'planned',
        'operation': 'plan-and-apply',
        'is-destroy': false,
        'plan-only': false,
        'has-changes': true,
        'created-at': '2026-08-02T10:00:00Z',
        'completed-at': null,
        'permissions': { 'can-apply': true },
      },
    });
  });

  it('does not offer apply on a plan-only run', () => {
    const resource = latestRunResource({
      ...workspace,
      latest_run: {
        id: 'run-2',
        status: 'planned',
        operation: 'plan-only',
        is_destroy: false,
        plan_only: true,
        has_changes: true,
        created_at: '2026-08-02T10:00:00Z',
        completed_at: '2026-08-02T10:04:00Z',
      },
    });
    expect(resource?.attributes['permissions']).toEqual({ 'can-apply': false });
    expect(resource?.attributes['completed-at']).toBe('2026-08-02T10:04:00Z');
  });
});

const runWith = (attributes: Record<string, unknown>): JsonApiResource => ({
  id: 'r1',
  type: 'runs',
  attributes,
});

describe('workspaceStatusCategory', () => {
  it('leaves a workspace that has never run uncategorised', () => {
    // Not "success": a workspace with no runs has no outcome to report.
    expect(workspaceStatusCategory(undefined)).toBeNull();
  });

  it('buckets failures', () => {
    expect(workspaceStatusCategory(runWith({ status: 'failed' }))).toBe('errored');
    expect(workspaceStatusCategory(runWith({ status: 'errored' }))).toBe('errored');
  });

  it('buckets executing runs', () => {
    for (const status of ['running', 'planning', 'applying']) {
      expect(workspaceStatusCategory(runWith({ status }))).toBe('running');
    }
  });

  it('buckets queued runs and plans waiting on an apply as needing attention', () => {
    expect(workspaceStatusCategory(runWith({ status: 'pending' }))).toBe('needs_attention');
    expect(
      workspaceStatusCategory(runWith({ status: 'planned', operation: 'plan-and-apply' })),
    ).toBe('needs_attention');
  });

  it('treats a finished plan-only run as a success, not an approval', () => {
    expect(workspaceStatusCategory(runWith({ status: 'planned', 'plan-only': true }))).toBe('success');
    expect(workspaceStatusCategory(runWith({ status: 'applied' }))).toBe('success');
    expect(workspaceStatusCategory(runWith({ status: 'completed' }))).toBe('success');
  });

  it('leaves a cancelled run uncategorised', () => {
    expect(workspaceStatusCategory(runWith({ status: 'canceled' }))).toBeNull();
  });
});

describe('workspaceMatchesStatus', () => {
  it('matches everything under the "all" filter, including workspaces with no runs', () => {
    expect(workspaceMatchesStatus(undefined, 'all')).toBe(true);
    expect(workspaceMatchesStatus(runWith({ status: 'applied' }), 'all')).toBe(true);
  });

  it('excludes workspaces with no runs from every specific filter', () => {
    for (const filter of ['needs_attention', 'errored', 'running', 'on_hold', 'success'] as const) {
      expect(workspaceMatchesStatus(undefined, filter)).toBe(false);
    }
  });

  it('lets a queued run match both needs_attention and on_hold', () => {
    // The two filters describe the same set; the categoriser resolves the overlap in favour of
    // needs_attention, but filtering by either must still find the run.
    const pending = runWith({ status: 'pending' });
    expect(workspaceMatchesStatus(pending, 'needs_attention')).toBe(true);
    expect(workspaceMatchesStatus(pending, 'on_hold')).toBe(true);
  });

  it('keeps a finished plan-only run out of the on-hold filter', () => {
    const planOnly = runWith({ status: 'planned', 'plan-only': true });
    expect(workspaceMatchesStatus(planOnly, 'on_hold')).toBe(false);
    expect(workspaceMatchesStatus(planOnly, 'success')).toBe(true);
  });
});

describe('countWorkspacesByStatus', () => {
  it('counts workspaces, not the runs inside them', () => {
    expect(
      countWorkspacesByStatus([
        { latestRun: runWith({ status: 'pending' }) },
        { latestRun: runWith({ status: 'planned', operation: 'plan-and-apply' }) },
        { latestRun: runWith({ status: 'failed' }) },
        { latestRun: runWith({ status: 'applying' }) },
        { latestRun: runWith({ status: 'applied' }) },
        {},
      ]),
    ).toEqual({ needsAttention: 2, errored: 1, running: 1, onHold: 0, success: 1 });
  });

  it('is all zeroes for an organization with no workspaces', () => {
    expect(countWorkspacesByStatus([])).toEqual({
      needsAttention: 0,
      errored: 0,
      running: 0,
      onHold: 0,
      success: 0,
    });
  });
});
