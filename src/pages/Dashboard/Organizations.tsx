// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import { ArrowRight, Building2 } from 'lucide-react';
import type { DashboardOrgStats, DashboardStats } from '@/api/client';
import { AnalyticsCard, ErrorState } from '@/components/ui/analytics-card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Every organization the reader belongs to, with what it holds and what it is doing.
 *
 * This doubles as the page's navigation. There is no shortcut row on the dashboard because a
 * cross-organization page has no single organization to send "Workspaces" to; selecting the
 * organization you actually mean is the step that has to come first, so it *is* the affordance.
 */
export function Organizations({
  stats,
  isLoading,
  isError,
  onRetry,
}: {
  stats: DashboardStats | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const organizations = stats?.organizations ?? [];

  return (
    <CollapsibleSection
      id="organizations"
      title="Your organizations"
      hint={
        stats
          ? `${stats.projects} projects · ${stats.terraform_workspaces} workspaces · ${stats.ansible_playbooks} playbooks`
          : undefined
      }
      action={
        <Link
          to="/organizations"
          className="whitespace-nowrap text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        >
          Manage organizations →
        </Link>
      }
    >
      {isError ? (
        <AnalyticsCard>
          <ErrorState
            title="Could not load your organizations"
            message="The cross-organization roll-up did not load."
            onRetry={onRetry}
          />
        </AnalyticsCard>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You do not belong to any organization yet.{' '}
          <Link to="/organizations" className="text-purple-600 hover:underline dark:text-purple-400">
            Create one
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map(org => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

function OrgCard({ org }: { org: DashboardOrgStats }) {
  const running = org.active_terraform_runs + org.active_ansible_jobs;
  // Counts the standing problems, both platforms, so the card agrees with the attention list above
  // it. Recent failures and change requests are excluded here on purpose: they are events and
  // notes, and the card is about whether the organization is currently in a bad state.
  const needsAttention =
    org.awaiting_approval +
    org.pending_workflow_approvals +
    org.errored_workspaces +
    org.errored_job_templates +
    org.failed_inventory_syncs +
    (org.runners_offline ?? 0);

  return (
    <Link
      to={`/app/${org.name}/workspaces`}
      className={cn(
        'group flex flex-col rounded-2xl p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:shadow-xl',
        'bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5',
        needsAttention > 0
          ? 'border border-amber-400/60 dark:border-amber-400/40'
          : 'border border-white/20 hover:border-blue-300 dark:border-white/10 dark:hover:border-white/20',
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 transition-all duration-300 group-hover:from-blue-500/30 group-hover:to-indigo-500/30"
          aria-hidden="true"
        >
          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground transition-colors group-hover:text-primary">
            {org.name}
          </span>
          {org.description && (
            <span className="block truncate text-xs text-muted-foreground">{org.description}</span>
          )}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <Count label="Projects" value={org.projects} />
        <Count label="Workspaces" value={org.terraform_workspaces} />
        <Count label="Playbooks" value={org.ansible_playbooks} />
      </dl>

      {/* One line of state, so the card says what the organization is *doing* and not only what it
          holds. The attention list above is the actionable version; this is the at-a-glance one. */}
      <p className="mt-4 text-xs">
        {needsAttention > 0 ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {needsAttention} {needsAttention === 1 ? 'item needs' : 'items need'} attention
            {running > 0 ? ` · ${running} running` : ''}
          </span>
        ) : running > 0 ? (
          <span className="font-medium text-blue-600 dark:text-blue-400">{running} running</span>
        ) : (
          <span className="text-muted-foreground">
            {org.completed_terraform_runs_this_month + org.completed_ansible_jobs_this_month} succeeded this month
          </span>
        )}
      </p>

      <span className="mt-4 flex items-center justify-between text-xs text-purple-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-purple-400">
        <span>Open workspaces</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="text-xl font-bold tracking-tight text-foreground">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
