// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import type { AnalyticsFailure } from '@/api/client';
import { useChartPalette } from '../chartTheme';
import { EmptyState } from './Card';

/**
 * The one list on this page that exists to be acted on, so it leads the Overview tab: what broke,
 * how recently, and a direct link to the run or job that broke.
 */
export function RecentFailures({ failures, orgName }: { failures: AnalyticsFailure[]; orgName: string }) {
  const palette = useChartPalette();

  if (failures.length === 0) {
    return <EmptyState message="Nothing failed in this period." />;
  }

  return (
    <ul className="space-y-2">
      {failures.map(failure => {
        // Terraform run detail lives under its workspace; a run whose workspace name is missing
        // falls back to the workspace list rather than rendering a link that 404s.
        const href =
          failure.platform === 'ansible'
            ? `/app/${orgName}/ansible/jobs/${failure.id}`
            : failure.workspace_name
              ? `/app/${orgName}/workspaces/${failure.workspace_name}/runs/${failure.id}`
              : `/app/${orgName}/workspaces`;
        return (
          <li key={`${failure.platform}-${failure.id}`}>
            <Link
              to={href}
              className="flex items-center gap-3 rounded-xl border border-white/10 p-3 transition-colors hover:bg-white/5"
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                style={{ backgroundColor: `${palette.failed}22`, color: palette.failed }}
                aria-hidden="true"
              >
                <XCircle className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {failure.name}
                  {failure.detail ? (
                    <span className="font-normal text-muted-foreground"> · {failure.detail.replace(/-/g, ' ')}</span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {failure.platform === 'ansible' ? 'Ansible' : 'Terraform'} · {relativeTime(failure.failed_at)}
                  {failure.error_message ? ` · ${failure.error_message}` : ''}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Compact relative time. Falls back to a date once "days ago" stops being useful. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
