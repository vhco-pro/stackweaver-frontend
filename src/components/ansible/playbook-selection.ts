// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { ansiblePlaybooksApi } from '@/api/ansible';

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
