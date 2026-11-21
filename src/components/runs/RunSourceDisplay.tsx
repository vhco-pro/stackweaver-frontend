// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Terminal, Globe, Code, GitFork, GitBranch, GitPullRequest, GitCommitHorizontal, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVcsCommitUrl, getVcsBranchUrl, getVcsPullRequestUrl } from '@/lib/vcs';
import type { Run, Workspace } from '@/api/client';
import { metaIconTone } from '@/lib/metaChip';
import { MetaChip } from './MetaChip';

interface RunSourceDisplayProps {
  run: Run;
  workspace?: Workspace; // Optional workspace info for constructing commit links
  /** Pass `contents` to let the chips join a parent flex row. */
  className?: string;
}

type DisplaySource = 'cli' | 'ui' | 'vcs' | 'api';

const TRIGGERS: Record<DisplaySource, { icon: LucideIcon; label: string; tone: string }> = {
  cli: { icon: Terminal, label: 'CLI', tone: metaIconTone.trigger },
  ui: { icon: Globe, label: 'UI', tone: metaIconTone.trigger },
  api: { icon: Code, label: 'API', tone: metaIconTone.trigger },
  vcs: { icon: GitFork, label: 'VCS', tone: metaIconTone.vcs },
};

const iconClass = 'h-3.5 w-3.5 shrink-0';

/**
 * How a run was triggered, as meta chips: "via CLI", "via UI", "via API", or "via VCS" followed by
 * the pull request, source branch, commit and committer when the run came from a VCS capture.
 */
export function RunSourceDisplay({ run, workspace, className }: RunSourceDisplayProps) {
  // Prefer the configuration version's source, which says how the configuration was created;
  // fall back to the run's own source.
  const configVersionSource = run['configuration-version-source'];
  const runSource = run.source;

  let displaySource: DisplaySource | null = null;
  if (configVersionSource) {
    if (configVersionSource === 'tfe-vcs') displaySource = 'vcs';
    else if (configVersionSource === 'tfe-cli') displaySource = 'cli';
    else if (configVersionSource === 'tfe-ui') displaySource = 'ui';
    else displaySource = 'api';
  } else if (runSource === 'tfe-ui') {
    displaySource = 'ui';
  } else if (runSource === 'tfe-api' || runSource === 'tfe-configuration-version') {
    displaySource = 'api';
  }

  if (!displaySource) {
    return null;
  }

  const isVcs = displaySource === 'vcs';
  const commitHash = isVcs ? run['commit-hash'] : undefined;
  const committer = isVcs ? run.committer : undefined;
  const prNumber = isVcs ? run['pr-number'] : undefined;
  const sourceBranch = isVcs ? run['source-branch'] : undefined;

  const repo = workspace?.vcs_repository;
  const provider = workspace?.vcs_provider ?? '';
  const account = workspace?.vcs_account_name;
  const prUrl = repo && prNumber ? getVcsPullRequestUrl(provider, repo, prNumber, account) : null;
  const branchUrl = repo && sourceBranch ? getVcsBranchUrl(provider, repo, sourceBranch, account) : null;
  const commitUrl = repo && commitHash ? getVcsCommitUrl(provider, repo, commitHash, account) : null;

  const trigger = TRIGGERS[displaySource];
  const TriggerIcon = trigger.icon;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <MetaChip icon={<TriggerIcon className={cn(iconClass, trigger.tone)} />} title={`Triggered via ${trigger.label}`}>
        via {trigger.label}
      </MetaChip>
      {prNumber != null && prNumber > 0 && (
        <MetaChip
          href={prUrl}
          title={prUrl ? `Open pull request #${prNumber}` : `Pull request #${prNumber}`}
          icon={<GitPullRequest className={cn(iconClass, metaIconTone.pullRequest)} />}
        >
          #{prNumber}
        </MetaChip>
      )}
      {sourceBranch && (
        <MetaChip
          href={branchUrl}
          title={branchUrl ? `Open branch ${sourceBranch}` : `Branch ${sourceBranch}`}
          icon={<GitBranch className={cn(iconClass, metaIconTone.vcs)} />}
        >
          <span className="font-mono">{sourceBranch}</span>
        </MetaChip>
      )}
      {commitHash && (
        <MetaChip
          href={commitUrl}
          title={commitUrl ? `Open commit ${commitHash.slice(0, 7)}` : `Commit ${commitHash.slice(0, 7)}`}
          icon={<GitCommitHorizontal className={cn(iconClass, metaIconTone.commit)} />}
        >
          <span className="font-mono">{commitHash.slice(0, 7)}</span>
        </MetaChip>
      )}
      {committer && (
        <MetaChip title="Committer" icon={<User className={cn(iconClass, metaIconTone.person)} />}>
          {committer}
        </MetaChip>
      )}
    </div>
  );
}
