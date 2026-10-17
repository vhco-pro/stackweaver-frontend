// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import type { AnsiblePlaybook } from '@/api/ansible';
import { registeredPlaybookLabel } from './playbook-selection';

// A registered playbook file names its playbook through a relationship, not by name, so the
// pickers resolve the name from the organization's playbooks they already hold.
describe('registeredPlaybookLabel', () => {
  const playbooks = [{ id: 'pb-1', name: 'site' }] as AnsiblePlaybook[];

  it('names the playbook the file is registered as', () => {
    expect(registeredPlaybookLabel(playbooks, 'pb-1')).toBe('registered as “site”');
  });

  it('falls back when the playbook is not in the list', () => {
    expect(registeredPlaybookLabel(playbooks, 'pb-2')).toBe('already registered');
    expect(registeredPlaybookLabel(playbooks, undefined)).toBe('already registered');
  });
});
