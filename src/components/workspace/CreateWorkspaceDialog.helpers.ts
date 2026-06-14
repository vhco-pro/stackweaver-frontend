// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

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
