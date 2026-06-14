// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for the Workspaces `refs` warning fix: the manual setInterval poll kept a
// `workspacesRef` synced during render; it was replaced by a React Query
// refetchInterval driven by this pure predicate. This pins the polling decision
// the refetchInterval depends on.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hasActiveWorkspaceRun, evaluatePendingCreateDialog } from './Workspaces.helpers';
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
