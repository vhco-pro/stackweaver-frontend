// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for the CreateWorkspaceDialog `set-state-in-effect` fix: the auto-fill-name
// effect (fired on repository selection) was replaced by a selection handler that
// calls this pure decision. Pins the "fill only when empty" + name-extraction rules.

import { describe, it, expect } from 'vitest';
import { autoFillWorkspaceName } from './CreateWorkspaceDialog.helpers';

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
