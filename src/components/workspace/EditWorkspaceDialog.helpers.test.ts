// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for the EditWorkspaceDialog `set-state-in-effect` fixes: the cascading VCS
// connection -> repository -> branch effects were replaced by React Query for the
// fetches plus derive-during-render for the branch default. These pure helpers
// carry the logic that used to live inside those effects, so they are unit-pinned.

import { describe, it, expect } from 'vitest';
import {
  defaultBranchName,
  resolveEffectiveBranch,
  dedupeVcsConnections,
  vcsConnectionExists,
  hasStateInvalidatingChanges,
} from './EditWorkspaceDialog.helpers';
import type { Branch, VCSConnection } from '@/api/client';

const branch = (name: string): Branch => ({
  name,
  commit: { sha: 'sha', url: 'url' },
  protected: false,
});

const conn = (id: string, provider: VCSConnection['provider'], account: string, type: VCSConnection['account_type'] = 'organization'): VCSConnection => ({
  id,
  organization_id: 'org',
  provider,
  account_name: account,
  account_type: type,
  created_at: '',
  updated_at: '',
});

describe('defaultBranchName', () => {
  it('prefers main', () => {
    expect(defaultBranchName([branch('dev'), branch('main'), branch('master')])).toBe('main');
  });
  it('falls back to master when no main', () => {
    expect(defaultBranchName([branch('dev'), branch('master')])).toBe('master');
  });
  it('falls back to the first branch when neither main nor master', () => {
    expect(defaultBranchName([branch('dev'), branch('feature')])).toBe('dev');
  });
  it('is empty for an empty list', () => {
    expect(defaultBranchName([])).toBe('');
  });
});

describe('resolveEffectiveBranch', () => {
  it('uses an explicit selection over the default', () => {
    expect(resolveEffectiveBranch('feature', [branch('main'), branch('feature')])).toBe('feature');
  });
  it('derives the default when nothing is selected', () => {
    expect(resolveEffectiveBranch('', [branch('dev'), branch('main')])).toBe('main');
  });
  it('is empty when nothing selected and no branches loaded', () => {
    expect(resolveEffectiveBranch('', [])).toBe('');
  });
});

describe('dedupeVcsConnections', () => {
  it('collapses same provider/account/type, keeping the last seen', () => {
    const result = dedupeVcsConnections([
      conn('1', 'github', 'acme'),
      conn('2', 'github', 'acme'),
      conn('3', 'gitlab', 'acme'),
    ]);
    expect(result.map((c) => c.id)).toEqual(['2', '3']);
  });
  it('keeps distinct accounts/types', () => {
    const result = dedupeVcsConnections([
      conn('1', 'github', 'acme', 'organization'),
      conn('2', 'github', 'acme', 'user'),
    ]);
    expect(result).toHaveLength(2);
  });
});

describe('vcsConnectionExists', () => {
  const list = [conn('10', 'github', 'acme')];
  it('matches an id present in the list (string-normalized)', () => {
    expect(vcsConnectionExists(list, '10')).toBe(true);
  });
  it('is false for an empty id', () => {
    expect(vcsConnectionExists(list, '')).toBe(false);
  });
  it('is false for an id not in the list', () => {
    expect(vcsConnectionExists(list, '99')).toBe(false);
  });
});

describe('hasStateInvalidatingChanges', () => {
  const original = { vcsConnectionId: 'c1', selectedRepository: 'owner/repo', branch: 'main' };
  it('is false when nothing changed', () => {
    expect(
      hasStateInvalidatingChanges(
        { vcsConnectionId: 'c1', selectedRepository: 'owner/repo', effectiveBranch: 'main' },
        original,
      ),
    ).toBe(false);
  });
  it('flags a connection change', () => {
    expect(
      hasStateInvalidatingChanges(
        { vcsConnectionId: 'c2', selectedRepository: 'owner/repo', effectiveBranch: 'main' },
        original,
      ),
    ).toBe(true);
  });
  it('flags a repository change', () => {
    expect(
      hasStateInvalidatingChanges(
        { vcsConnectionId: 'c1', selectedRepository: 'owner/other', effectiveBranch: 'main' },
        original,
      ),
    ).toBe(true);
  });
  it('flags an effective-branch change (e.g. auto-defaulted after repo switch)', () => {
    expect(
      hasStateInvalidatingChanges(
        { vcsConnectionId: 'c1', selectedRepository: 'owner/repo', effectiveBranch: 'develop' },
        original,
      ),
    ).toBe(true);
  });
});
