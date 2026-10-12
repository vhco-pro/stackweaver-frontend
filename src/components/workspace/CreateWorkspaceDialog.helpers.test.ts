// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for the CreateWorkspaceDialog `set-state-in-effect` fix: the auto-fill-name
// effect (fired on repository selection) was replaced by a selection handler that
// calls this pure decision. Pins the "fill only when empty" + name-extraction rules.

import { describe, it, expect } from 'vitest';
import { autoFillWorkspaceName, resolveBranch, resolveProjectId } from './CreateWorkspaceDialog.helpers';

// The dialog derives its project and its branch during render instead of storing a default from
// the query function. These pin the order of precedence.
describe('resolveProjectId', () => {
  const projects = [
    { id: 'p-platform', name: 'platform' },
    { id: 'p-default', name: 'default' },
  ];

  it('prefers the project the user picked', () => {
    expect(resolveProjectId('p-platform', 'p-default', projects)).toBe('p-platform');
  });

  it('falls back to the project of the page when the user picked none', () => {
    expect(resolveProjectId('', 'p-platform', projects)).toBe('p-platform');
  });

  it('keeps the project of the page while the list is still loading', () => {
    expect(resolveProjectId('', 'p-platform', [])).toBe('p-platform');
  });

  it('chooses the project named default by name, not by position', () => {
    expect(resolveProjectId('', undefined, projects)).toBe('p-default');
  });

  it('matches the default project case-insensitively', () => {
    expect(resolveProjectId('', undefined, [{ id: 'p-1', name: 'platform' }, { id: 'p-2', name: 'Default' }])).toBe('p-2');
  });

  it('chooses the first project when none is named default', () => {
    expect(resolveProjectId('', undefined, [{ id: 'p-1', name: 'platform' }, { id: 'p-2', name: 'sandbox' }])).toBe('p-1');
  });

  it('is empty while there are no projects', () => {
    expect(resolveProjectId('', undefined, [])).toBe('');
  });

  it('drops a picked project that is not in the list, such as one from another organization', () => {
    expect(resolveProjectId('p-elsewhere', undefined, projects)).toBe('p-default');
  });
});

describe('resolveBranch', () => {
  const branches = [{ name: 'develop' }, { name: 'trunk' }];

  it('prefers the branch the user picked', () => {
    expect(resolveBranch('develop', { default_branch: 'trunk' }, branches)).toBe('develop');
  });

  it('falls back to the default branch of the repository', () => {
    expect(resolveBranch('', { default_branch: 'trunk' }, branches)).toBe('trunk');
  });

  it('chooses the first branch when the default branch is not in the list', () => {
    expect(resolveBranch('', { default_branch: 'main' }, branches)).toBe('develop');
  });

  it('chooses the first branch when the repository is unknown', () => {
    expect(resolveBranch('', undefined, branches)).toBe('develop');
  });

  it('is empty while there are no branches', () => {
    expect(resolveBranch('', { default_branch: 'main' }, [])).toBe('');
  });
});

describe('autoFillWorkspaceName', () => {
  it('returns the repo short name when the name field is empty', () => {
    expect(autoFillWorkspaceName('', 'owner/my-repo')).toBe('my-repo');
  });

  it('treats whitespace-only as empty', () => {
    expect(autoFillWorkspaceName('   ', 'owner/my-repo')).toBe('my-repo');
  });

  it('does not overwrite a name the user already typed', () => {
    expect(autoFillWorkspaceName('custom', 'owner/my-repo')).toBeNull();
  });

  it('returns null when the full name has no owner/ segment', () => {
    expect(autoFillWorkspaceName('', 'no-slash')).toBeNull();
  });

  it('returns null for an empty repo full name', () => {
    expect(autoFillWorkspaceName('', '')).toBeNull();
  });
});
