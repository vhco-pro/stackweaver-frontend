// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { VCSConnection, Branch } from '@/api/client';

/**
 * Pick the default branch from a loaded branch list: prefer `main`, then
 * `master`, then the first branch; `''` when the list is empty. Used to derive
 * the effective branch when none is explicitly selected (replaces the old
 * "set default branch after branches load" effect).
 */
export function defaultBranchName(branches: Branch[]): string {
  const main = branches.find((b) => b.name === 'main' || b.name === 'master');
  if (main) return main.name;
  return branches.length > 0 ? branches[0].name : '';
}

/**
 * The branch to actually use: an explicit selection wins, otherwise fall back to
 * the default branch of the loaded list. Derived during render so the branch
 * never has to be written into state from an effect when the list arrives.
 */
export function resolveEffectiveBranch(selectedBranch: string, branches: Branch[]): string {
  return selectedBranch || defaultBranchName(branches);
}

/**
 * Collapse VCS connections that are the same provider/account into one entry.
 * Mirrors the dialog's original `Map`-based de-duplication, where the last entry
 * with a given provider/account/type key wins.
 */
export function dedupeVcsConnections(connections: VCSConnection[]): VCSConnection[] {
  return Array.from(
    new Map(
      connections.map((conn) => [
        `${conn.provider}-${conn.account_name}-${conn.account_type}`,
        conn,
      ]),
    ).values(),
  );
}

/** Whether `id` matches a connection present in the list (string-normalized). */
export function vcsConnectionExists(connections: VCSConnection[], id: string): boolean {
  return !!id && connections.some((conn) => String(conn.id) === String(id));
}

export interface WorkspaceVcsSelection {
  vcsConnectionId: string;
  selectedRepository: string;
  effectiveBranch: string;
}

/**
 * Whether the VCS connection, repository, or branch differ from the workspace's
 * persisted values - the dialog warns the user these changes can invalidate
 * existing state. Compares the effective (derived) branch so an auto-defaulted
 * branch after a repo change is detected too.
 */
export function hasStateInvalidatingChanges(
  current: WorkspaceVcsSelection,
  original: { vcsConnectionId: string; selectedRepository: string; branch: string },
): boolean {
  return (
    current.vcsConnectionId !== original.vcsConnectionId ||
    current.selectedRepository !== original.selectedRepository ||
    current.effectiveBranch !== original.branch
  );
}
