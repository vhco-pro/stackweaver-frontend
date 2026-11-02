// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { AnsibleJob, AnsiblePlaybook } from '@/api/ansible';

/**
 * What a job page can say about the playbook a job ran.
 *
 * - `linked`: the playbook still exists and was loaded, so the page links to it.
 * - `deleted`: the job ran a playbook that has since been deleted. The job keeps its history with
 *   the playbook link cleared, and `name` is the playbook name recorded at launch (empty for a job
 *   older than that record).
 * - `adhoc`: an ad hoc command, which runs a transient playbook and never had one.
 * - `unavailable`: the job names a playbook that could not be loaded (no permission, or a failed
 *   request). `name` is the recorded name, when there is one.
 */
export type JobPlaybookState =
  | { kind: 'linked'; id: string; name: string }
  | { kind: 'deleted'; name: string }
  | { kind: 'adhoc' }
  | { kind: 'unavailable'; name: string };

export function jobPlaybookState(
  job: Pick<AnsibleJob, 'playbook_id' | 'playbook_name' | 'job_type'>,
  playbook: Pick<AnsiblePlaybook, 'id' | 'name'> | null,
): JobPlaybookState {
  if (job.job_type === 'adhoc') return { kind: 'adhoc' };
  const recorded = job.playbook_name ?? '';
  if (!job.playbook_id) return { kind: 'deleted', name: recorded };
  if (playbook && playbook.id === job.playbook_id) {
    return { kind: 'linked', id: playbook.id, name: playbook.name || recorded };
  }
  return { kind: 'unavailable', name: recorded };
}

/** A job can be relaunched only while it has a playbook to run, or when it is ad hoc. */
export function canRelaunchJob(job: Pick<AnsibleJob, 'playbook_id' | 'job_type'>): boolean {
  return job.job_type === 'adhoc' || !!job.playbook_id;
}
