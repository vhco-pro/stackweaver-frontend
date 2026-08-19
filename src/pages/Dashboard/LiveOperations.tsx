// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import { PlayCircle, Server } from 'lucide-react';
import type { DashboardOperation } from '@/api/client';
import { AnalyticsCard, ErrorState } from '@/components/ui/analytics-card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/runs/StatusBadge';
import { useNow } from '@/hooks/useNow';
import { computeDisplayStatus, type DisplayStatus } from '@/utils/runStatus';
import { useDashboardOperations } from './useDashboardData';

/**
 * What is executing right now, everywhere the reader can see.
 *
 * Nothing else in the product shows this. The Usage page reports a *count* of executions from the
 * selected window that are still running; the workspace and job lists show one organization's
 * resources. A live, cross-organization list of work in flight exists only here.
 */
export function LiveOperations() {
  return (
    <CollapsibleSection
      id="live-operations"
      title="Live operations"
      hint="Terraform runs and Ansible jobs executing across your organizations"
    >
      {/* The polling query lives in the body, not here, so folding the section away stops it. */}
      <LiveOperationsList />
    </CollapsibleSection>
  );
}

function LiveOperationsList() {
  const { data, isLoading, isError, refetch } = useDashboardOperations();
  const executions = data?.executions ?? [];
  // The elapsed column only ticks while something is running, so an idle dashboard re-renders never.
  const now = useNow(executions.length > 0);

  return (
    <AnalyticsCard>
      {isError ? (
        <ErrorState
          title="Could not load live operations"
          message="The list of executions in flight did not load."
          onRetry={() => {
            void refetch();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : executions.length === 0 ? (
        // Compact rather than the tall shared empty state: an idle estate is the common case, and
        // it should not claim a screenful of the fold.
        <p className="py-4 text-center text-sm text-muted-foreground">Nothing is running right now.</p>
      ) : (
        <>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            {executions.length} running
          </p>
          <ul className="space-y-2">
            {executions.map(execution => (
              <li key={`${execution.platform}-${execution.id}`}>
                <OperationRow execution={execution} now={now} />
              </li>
            ))}
          </ul>
          {data?.truncated && (
            // Saying so beats implying the list is everything.
            <p className="mt-3 text-xs text-muted-foreground">
              Showing the {executions.length} longest-running; more are in flight.
            </p>
          )}
        </>
      )}
    </AnalyticsCard>
  );
}

function OperationRow({ execution, now }: { execution: DashboardOperation; now: number }) {
  const isAnsible = execution.platform === 'ansible';
  return (
    <Link
      to={hrefFor(execution)}
      className="flex items-center gap-3 rounded-xl border border-white/10 p-3 transition-colors hover:bg-white/5"
    >
      <span
        className={
          isAnsible
            ? 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
            : 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400'
        }
        aria-hidden="true"
      >
        {isAnsible ? <PlayCircle className="h-4 w-4" /> : <Server className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {/* Organization first, because on a cross-organization page the workspace name alone
              leaves the reader guessing which tenant they are looking at. */}
          <span className="text-muted-foreground">{execution.organization_name} / </span>
          {execution.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {detailLabel(execution)} · {elapsed(execution.started_at, now)}
        </span>
      </span>
      <StatusBadge status={displayStatus(execution)} variant="outline" />
    </Link>
  );
}

/** Ansible jobs are keyed by id; a run's detail page lives under its workspace. */
function hrefFor(execution: DashboardOperation): string {
  return execution.platform === 'ansible'
    ? `/app/${execution.organization_name}/ansible/jobs/${execution.id}`
    : `/app/${execution.organization_name}/workspaces/${execution.name}/runs/${execution.id}`;
}

function detailLabel(execution: DashboardOperation): string {
  if (execution.platform === 'ansible') return 'Ansible job';
  switch (execution.detail) {
    case 'destroy':
      return 'Destroy';
    case 'plan-only':
      return 'Plan only';
    default:
      return 'Plan and apply';
  }
}

function displayStatus(execution: DashboardOperation): DisplayStatus {
  if (execution.platform === 'ansible') return execution.status === 'running' ? 'running' : 'pending';
  return computeDisplayStatus({ status: execution.status, operation: execution.detail });
}

/** How long an operation has been going, as a compact "for 4m 12s". */
function elapsed(startedAt: string, now: number): string {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return 'just started';
  const seconds = Math.max(0, Math.round((now - started) / 1000));
  if (seconds < 60) return `for ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `for ${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `for ${hours}h ${minutes % 60}m`;
}
