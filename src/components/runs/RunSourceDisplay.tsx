// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import React from 'react';
import { Terminal, Globe, GitBranch, GitPullRequest, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVcsCommitUrl, getVcsBranchUrl, getVcsPullRequestUrl } from '@/lib/vcs';
import type { Run, Workspace } from '@/api/client';

interface RunSourceDisplayProps {
  run: Run;
  workspace?: Workspace; // Optional workspace info for constructing commit links
  className?: string;
}

/**
 * RunSourceDisplay component shows context-aware run trigger information
 * - CLI: "Triggered via CLI"
 * - UI: "Triggered via UI"
 * - VCS: "Triggered via VCS" with commit hash, committer, PR number, and source branch
 */
export function RunSourceDisplay({ run, workspace, className }: RunSourceDisplayProps) {
  // Determine the actual trigger source from configuration version source
  // If run has a configuration version, use its source to determine the trigger
  // Otherwise, fall back to run.source
  const configVersionSource = run['configuration-version-source'];
  const runSource = run.source;
  
  // Determine display source: prefer config version source for more specific context
  let displaySource: 'cli' | 'ui' | 'vcs' | 'api' | null = null;
  let commitHash: string | undefined;
  let committer: string | undefined;
  let prNumber: number | undefined;
  let sourceBranch: string | undefined;

  if (configVersionSource) {
    // Configuration version source tells us how the config was created
    if (configVersionSource === 'tfe-vcs') {
      displaySource = 'vcs';
      commitHash = run['commit-hash'];
      committer = run.committer;
      prNumber = run['pr-number'];
      sourceBranch = run['source-branch'];
    } else if (configVersionSource === 'tfe-cli') {
      displaySource = 'cli';
    } else if (configVersionSource === 'tfe-ui') {
      displaySource = 'ui';
    } else {
      displaySource = 'api';
    }
  } else if (runSource) {
    // Fallback to run source if no config version source
    if (runSource === 'tfe-ui') {
      displaySource = 'ui';
    } else if (runSource === 'tfe-api') {
      displaySource = 'api';
    } else if (runSource === 'tfe-configuration-version') {
      // If source is tfe-configuration-version but no config version source, default to API
      displaySource = 'api';
    }
  }

  // If we couldn't determine source, don't render anything
  if (!displaySource) {
    return null;
  }

  const getIcon = () => {
    switch (displaySource) {
      case 'cli':
        return <Terminal className="h-3.5 w-3.5" />;
      case 'ui':
        return <Globe className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />;
      case 'vcs':
        return <GitBranch className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />;
      default:
        return null;
    }
  };

  // Construct commit URL based on repository and provider (delegated to shared utility)
  const getCommitUrl = (hash: string): string | null => {
    if (!workspace?.vcs_repository || !hash) return null;
    return getVcsCommitUrl(workspace.vcs_provider ?? '', workspace.vcs_repository, hash, workspace.vcs_account_name);
  };

  // Construct branch URL based on repository and provider
  const getBranchUrl = (branch: string): string | null => {
    if (!workspace?.vcs_repository || !branch) return null;
    return getVcsBranchUrl(workspace.vcs_provider ?? '', workspace.vcs_repository, branch, workspace.vcs_account_name);
  };

  // Construct PR URL based on repository and provider
  const getPrUrl = (pr: number): string | null => {
    if (!workspace?.vcs_repository || !pr) return null;
    return getVcsPullRequestUrl(workspace.vcs_provider ?? '', workspace.vcs_repository, pr, workspace.vcs_account_name);
  };

  const getLabel = () => {
    switch (displaySource) {
      case 'cli':
        return 'Triggered via CLI';
      case 'ui':
        return 'Triggered via UI';
      case 'vcs':
        return 'Triggered via VCS';
      default:
        return 'Triggered via API';
    }
  };

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <div className="flex items-center gap-1.5">
        {getIcon()}
        <span>{getLabel()}</span>
      </div>
      {displaySource === 'vcs' && (commitHash || committer || prNumber) && (
        <>
          <span>•</span>
          <div className="flex items-center gap-2 flex-wrap">
            {prNumber != null && prNumber > 0 && (() => {
              const prUrl = getPrUrl(prNumber);
              return prUrl ? (
                <button
                  type="button"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    e.preventDefault();
                    window.open(prUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                >
                  <GitPullRequest className="h-3 w-3" />
                  #{prNumber}
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                  <GitPullRequest className="h-3 w-3" />
                  #{prNumber}
                </span>
              );
            })()}
            {sourceBranch && (() => {
              const branchUrl = getBranchUrl(sourceBranch);
              return (
                <>
                  {prNumber != null && prNumber > 0 && <span>•</span>}
                  {branchUrl ? (
                    <button
                      type="button"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        e.preventDefault();
                        window.open(branchUrl, '_blank', 'noopener,noreferrer');
                      }}
                      className="inline-flex items-center gap-1 font-mono text-xs text-purple-600 dark:text-purple-400 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                    >
                      <GitBranch className="h-3 w-3" />
                      {sourceBranch}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-purple-600 dark:text-purple-400">
                      <GitBranch className="h-3 w-3" />
                      {sourceBranch}
                    </span>
                  )}
                </>
              );
            })()}
            {commitHash && (() => {
              const commitUrl = getCommitUrl(commitHash);
              const shortHash = commitHash.slice(0, 7);
              
              if (commitUrl) {
                return (
                  <>
                    {(prNumber || sourceBranch) && <span>•</span>}
                    <button
                      type="button"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        // Stop event propagation to prevent parent link from being triggered
                        e.stopPropagation();
                        e.preventDefault();
                        window.open(commitUrl, '_blank', 'noopener,noreferrer');
                      }}
                      className="font-mono text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
                    >
                      {shortHash}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </>
                );
              }
              
              return (
                <>
                  {(prNumber || sourceBranch) && <span>•</span>}
                  <span className="font-mono text-xs">{shortHash}</span>
                </>
              );
            })()}
            {committer && <span>•</span>}
            {committer && <span>{committer}</span>}
          </div>
        </>
      )}
    </div>
  );
}

