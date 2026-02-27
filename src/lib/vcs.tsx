// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Shared VCS provider utilities — icons, labels, and URL builders.
// All provider-specific logic lives here; consuming components just call these functions.

import { GitBranch } from 'lucide-react';

// ─── Public icon / label helpers ─────────────────────────────────────────────

// (string & {}) allows arbitrary provider strings without making the known literals redundant.
export type VcsProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure_devops' | (string & {});

/** Returns a branded provider icon sized via className (default h-4 w-4). */
export function getVcsProviderIcon(provider: VcsProvider, className = 'h-4 w-4') {
  switch (provider) {
    case 'github':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12z" />
        </svg>
      );
    case 'azure_devops':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-blue-500`} xmlns="http://www.w3.org/2000/svg">
          <path d="M0 10.204L2.753 6.678l8.094-3.29V.78l6.986 5.124L2.789 8.985v7.67L0 10.204zm24 3.098l-3 3.294-8.094 3.29v2.614L5.906 17.38l13.044-2.182V7.529L24 13.302z" />
        </svg>
      );
    case 'gitlab':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-orange-500`} xmlns="http://www.w3.org/2000/svg">
          <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
        </svg>
      );
    case 'bitbucket':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-blue-500`} xmlns="http://www.w3.org/2000/svg">
          <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891L.778 1.213zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z" />
        </svg>
      );
    default:
      return <GitBranch className={className} />;
  }
}

/** Returns a human-readable provider label. */
export function getVcsProviderLabel(provider: VcsProvider): string {
  switch (provider) {
    case 'github':      return 'GitHub';
    case 'azure_devops': return 'Azure DevOps';
    case 'gitlab':      return 'GitLab';
    case 'bitbucket':   return 'Bitbucket';
    default:            return provider;
  }
}

// ─── URL builders ─────────────────────────────────────────────────────────────
//
// repo      — the VCS repository path stored in the workspace/playbook/inventory:
//               GitHub / GitLab / Bitbucket → "owner/repo"
//               Azure DevOps                → "project/repo"
// accountName — the VCS connection's account_name field:
//               GitHub      → GitHub org or user name (not needed for URL building — owner is in repo)
//               Azure DevOps → ADO organisation name (required for URL building)
//               GitLab      → not used
//               Bitbucket   → not used
//
// All functions return null when the required information is missing.

function parseADOParts(repo: string, accountName?: string | null): { org: string; project: string; repoName: string } | null {
  if (!accountName) return null;
  const slashIdx = repo.indexOf('/');
  if (slashIdx === -1) return null;
  return { org: accountName, project: repo.slice(0, slashIdx), repoName: repo.slice(slashIdx + 1) };
}

/** Repository root URL. */
export function getVcsRepoUrl(provider: VcsProvider, repo: string, accountName?: string | null): string | null {
  if (!repo) return null;
  switch (provider) {
    case 'github':
      return `https://github.com/${repo}`;
    case 'gitlab':
      return `https://gitlab.com/${repo}`;
    case 'bitbucket':
      return `https://bitbucket.org/${repo}`;
    case 'azure_devops': {
      const parts = parseADOParts(repo, accountName);
      if (!parts) return null;
      return `https://dev.azure.com/${parts.org}/${parts.project}/_git/${parts.repoName}`;
    }
    default:
      return null;
  }
}

/** Branch browse URL. */
export function getVcsBranchUrl(provider: VcsProvider, repo: string, branch: string, accountName?: string | null): string | null {
  if (!repo || !branch) return null;
  switch (provider) {
    case 'github':
      return `https://github.com/${repo}/tree/${branch}`;
    case 'gitlab':
      return `https://gitlab.com/${repo}/-/tree/${branch}`;
    case 'bitbucket':
      return `https://bitbucket.org/${repo}/src/${branch}`;
    case 'azure_devops': {
      const parts = parseADOParts(repo, accountName);
      if (!parts) return null;
      return `https://dev.azure.com/${parts.org}/${parts.project}/_git/${parts.repoName}?version=GB${encodeURIComponent(branch)}`;
    }
    default:
      return null;
  }
}

/** File blob URL. */
export function getVcsFileUrl(provider: VcsProvider, repo: string, branch: string, filePath: string, accountName?: string | null): string | null {
  if (!repo || !filePath) return null;
  const br = branch || 'main';
  switch (provider) {
    case 'github':
      return `https://github.com/${repo}/blob/${br}/${filePath}`;
    case 'gitlab':
      return `https://gitlab.com/${repo}/-/blob/${br}/${filePath}`;
    case 'bitbucket':
      return `https://bitbucket.org/${repo}/src/${br}/${filePath}`;
    case 'azure_devops': {
      const parts = parseADOParts(repo, accountName);
      if (!parts) return null;
      const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
      return `https://dev.azure.com/${parts.org}/${parts.project}/_git/${parts.repoName}?path=${encodeURIComponent(path)}&version=GB${encodeURIComponent(br)}`;
    }
    default:
      return null;
  }
}

/** Commit URL. Returns null when the URL cannot be constructed (e.g. ADO without accountName). */
export function getVcsCommitUrl(provider: VcsProvider, repo: string, commit: string, accountName?: string | null): string | null {
  if (!repo || !commit) return null;
  switch (provider) {
    case 'github':
      return `https://github.com/${repo}/commit/${commit}`;
    case 'gitlab':
      return `https://gitlab.com/${repo}/-/commit/${commit}`;
    case 'bitbucket':
      return `https://bitbucket.org/${repo}/commits/${commit}`;
    case 'azure_devops': {
      const parts = parseADOParts(repo, accountName);
      if (!parts) return null;
      return `https://dev.azure.com/${parts.org}/${parts.project}/_git/${parts.repoName}/commit/${commit}`;
    }
    default:
      return null;
  }
}

/** Pull request / merge request URL. */
export function getVcsPullRequestUrl(provider: VcsProvider, repo: string, prNumber: number, accountName?: string | null): string | null {
  if (!repo || !prNumber) return null;
  switch (provider) {
    case 'github':
      return `https://github.com/${repo}/pull/${prNumber}`;
    case 'gitlab':
      return `https://gitlab.com/${repo}/-/merge_requests/${prNumber}`;
    case 'bitbucket':
      return `https://bitbucket.org/${repo}/pull-requests/${prNumber}`;
    case 'azure_devops': {
      const parts = parseADOParts(repo, accountName);
      if (!parts) return null;
      return `https://dev.azure.com/${parts.org}/${parts.project}/_git/${parts.repoName}/pullrequest/${prNumber}`;
    }
    default:
      return null;
  }
}

/** GitHub App installation management URL (GitHub only — other providers do not have this concept). */
export function getVcsManageUrl(provider: VcsProvider, installationId: string, accountName: string, accountType: string): string | null {
  if (provider !== 'github' || !installationId) return null;
  return accountType === 'organization' && accountName
    ? `https://github.com/organizations/${accountName}/settings/installations/${installationId}`
    : `https://github.com/settings/installations/${installationId}`;
}
