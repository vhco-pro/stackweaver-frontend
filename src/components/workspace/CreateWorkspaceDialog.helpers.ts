// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { Branch, Project, Repository } from '@/api/client';

/**
 * The project the workspace is created in: the one the user picked while it is still one of the
 * organization's projects, otherwise the project of the page the dialog was opened from,
 * otherwise the project named `default`, otherwise the first; `''` while there is none.
 *
 * Derived during render and never stored. The Project select sits in a form, so Radix keeps a
 * hidden native select beside it, and when the selected value changes in the same render that
 * brings the project list, that element has no option for the value yet and reports `''` back
 * through `onValueChange`. A default written into state is erased by that report; a derived one
 * is not, because the report only clears a choice the user never made.
 */
export function resolveProjectId(
  selectedProjectId: string,
  pageProjectId: string | undefined,
  projects: Pick<Project, 'id' | 'name'>[],
): string {
  if (selectedProjectId && projects.some((p) => p.id === selectedProjectId)) return selectedProjectId;
  if (pageProjectId) return pageProjectId;
  const named = projects.find((p) => p.name.toLowerCase() === 'default');
  return named?.id ?? projects[0]?.id ?? '';
}

/**
 * The branch the workspace tracks: the one the user picked, otherwise the repository's default
 * branch when the loaded list has it, otherwise the first branch; `''` while there is none.
 * Derived during render for the same reason as `resolveProjectId`.
 */
export function resolveBranch(
  selectedBranch: string,
  repository: Pick<Repository, 'default_branch'> | undefined,
  branches: Pick<Branch, 'name'>[],
): string {
  if (selectedBranch) return selectedBranch;
  const defaultBranch = repository?.default_branch;
  if (defaultBranch && branches.some((b) => b.name === defaultBranch)) return defaultBranch;
  return branches[0]?.name ?? '';
}

/**
 * Decide the workspace name to auto-fill when a repository is selected.
 *
 * Returns the repo's short name (the part after `owner/`) only when the name
 * field is still empty, so typed input is never overwritten; otherwise `null`
 * (leave the name as-is). Pure so the auto-fill behaviour can be unit-tested
 * without rendering the dialog.
 */
export function autoFillWorkspaceName(currentName: string, repoFullName: string): string | null {
  if (currentName.trim()) return null;
  // Extract repo name from full name (e.g., "owner/repo-name" -> "repo-name")
  const [, repoName] = repoFullName.split('/');
  return repoName ? repoName : null;
}
