// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { ansiblePlaybooksApi, type AnsiblePlaybook } from '@/api/ansible';

/**
 * Labels a repository file that is already registered. The file names its playbook through a
 * relationship rather than by name, so the name comes from the organization's playbooks the
 * caller already holds; a playbook outside that list is simply "already registered".
 */
export function registeredPlaybookLabel(playbooks: AnsiblePlaybook[], playbookId?: string): string {
  const name = playbooks.find((pb) => pb.id === playbookId)?.name;
  return name ? `registered as “${name}”` : 'already registered';
}

/**
 * What the user picked in the playbook field: an already-registered playbook,
 * or a repository file that will be registered (find-or-create) when the
 * parent form is saved - so cancelling the form never creates anything.
 */
export type PlaybookSelection =
  | { kind: 'registered'; playbookId: string }
  | { kind: 'file'; connectionId: string; repository: string; branch: string; path: string }
  | null;

/**
 * Resolves a selection to a playbook ID, registering the picked repository
 * file via find-or-create when needed. Call this from the parent form's save
 * handler.
 */
export async function resolvePlaybookSelection(
  organizationName: string,
  selection: PlaybookSelection,
  projectId?: string,
): Promise<string> {
  if (!selection) {
    throw new Error('No playbook selected');
  }
  if (selection.kind === 'registered') {
    return selection.playbookId;
  }
  const res = await ansiblePlaybooksApi.findOrCreate(organizationName, {
    project_id: projectId,
    vcs_connection_id: selection.connectionId,
    repository: selection.repository,
    branch: selection.branch,
    path: selection.path,
  });
  return res.data.id;
}
