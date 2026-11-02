// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins what a job says about the playbook it ran: a link while the playbook exists, the name it
// recorded at launch once the playbook is deleted, and never a deleted playbook for an ad hoc job,
// which has no playbook link either.

import { describe, it, expect } from 'vitest';
import { canRelaunchJob, jobPlaybookState } from './jobPlaybook';

const playbook = { id: 'pb-1', name: 'site' };

describe('jobPlaybookState', () => {
  it('links a playbook that still exists', () => {
    expect(jobPlaybookState({ playbook_id: 'pb-1', playbook_name: 'site', job_type: 'run' }, playbook))
      .toEqual({ kind: 'linked', id: 'pb-1', name: 'site' });
  });

  it('shows the current name of a renamed playbook', () => {
    expect(jobPlaybookState({ playbook_id: 'pb-1', playbook_name: 'old-site', job_type: 'run' }, playbook))
      .toEqual({ kind: 'linked', id: 'pb-1', name: 'site' });
  });

  it('keeps the recorded name of a deleted playbook', () => {
    expect(jobPlaybookState({ playbook_id: '', playbook_name: 'site', job_type: 'check' }, null))
      .toEqual({ kind: 'deleted', name: 'site' });
  });

  it('marks a deleted playbook with no recorded name as deleted', () => {
    expect(jobPlaybookState({ playbook_id: '', playbook_name: undefined, job_type: 'run' }, null))
      .toEqual({ kind: 'deleted', name: '' });
  });

  it('never calls an ad hoc job one of a deleted playbook', () => {
    expect(jobPlaybookState({ playbook_id: '', playbook_name: '', job_type: 'adhoc' }, null))
      .toEqual({ kind: 'adhoc' });
  });

  it('falls back to the recorded name when the playbook could not be loaded', () => {
    expect(jobPlaybookState({ playbook_id: 'pb-1', playbook_name: 'site', job_type: 'run' }, null))
      .toEqual({ kind: 'unavailable', name: 'site' });
  });
});

describe('canRelaunchJob', () => {
  it('relaunches a job whose playbook exists, and an ad hoc job', () => {
    expect(canRelaunchJob({ playbook_id: 'pb-1', job_type: 'run' })).toBe(true);
    expect(canRelaunchJob({ playbook_id: '', job_type: 'adhoc' })).toBe(true);
  });

  it('does not relaunch a job whose playbook was deleted', () => {
    expect(canRelaunchJob({ playbook_id: '', job_type: 'run' })).toBe(false);
  });
});
