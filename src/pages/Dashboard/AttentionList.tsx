// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  DatabaseZap,
  ServerOff,
  XCircle,
} from 'lucide-react';
import type { DashboardStats } from '@/api/client';
import { AnalyticsCard, ErrorState } from '@/components/ui/analytics-card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { attentionItems, type AttentionItem, type AttentionKind } from './attention';

/**
 * What needs a person, across every organization, first thing on the page.
 *
 * A list rather than a row of totals: the question this page answers is *where*, so every row names
 * its organization and links into it. Only non-zero items appear, which makes the length of the
 * list the answer to "how much is wrong" - something a grid of mostly-zero cards cannot do.
 */
export function AttentionList({
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
  const items = attentionItems(stats);
  const organizations = new Set(items.map(item => item.organization)).size;

  return (
    <CollapsibleSection
      id="attention"
      title="Needs your attention"
      hint={
        isLoading || isError
          ? undefined
          : items.length === 0
            ? 'Nothing is waiting on you'
            : `${items.length} ${items.length === 1 ? 'item' : 'items'} across ${organizations} ${organizations === 1 ? 'organization' : 'organizations'}`
      }
    >
      {isError ? (
        <AnalyticsCard>
          <ErrorState
            title="Could not load your attention items"
            // "Nothing needs your attention" is exactly the wrong thing to tell someone whose
            // roll-up failed to load, so a failure is reported rather than rendered as zero.
            message="The cross-organization roll-up did not load."
            onRetry={onRetry}
          />
        </AnalyticsCard>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-gray-300/80 bg-gradient-to-br from-white/90 via-white/75 to-white/60 p-4 text-sm text-muted-foreground shadow-lg backdrop-blur-md dark:border-white/10 dark:from-black/10 dark:via-black/5 dark:to-transparent">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Nothing needs your attention in any of your organizations.
        </p>
      ) : (
        // One surface holding dense rows rather than a stack of cards: this is a list to scan, and
        // an estate of any size produces enough rows that a card each would fill the screen.
        <AnalyticsCard className="p-2 sm:p-2">
          <ul>
            {items.map(item => (
              <li key={item.key}>
                <AttentionRow item={item} />
              </li>
            ))}
          </ul>
        </AnalyticsCard>
      )}
    </CollapsibleSection>
  );
}

const TONES = {
  amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  red: 'text-red-600 dark:text-red-400 bg-red-500/10',
  indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
} as const;

const ICONS: Record<AttentionKind, typeof AlertTriangle> = {
  awaiting_approval: AlertTriangle,
  pending_workflow_approvals: AlertTriangle,
  errored_workspaces: XCircle,
  errored_job_templates: XCircle,
  failed_inventory_syncs: DatabaseZap,
  runners_offline: ServerOff,
  recent_run_failures: XCircle,
  recent_job_failures: XCircle,
  open_change_requests: ClipboardList,
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = ICONS[item.kind];
  return (
    <Link
      to={item.href}
      className={cn(
        'flex min-h-[44px] items-center gap-3 rounded-xl px-2 py-2 sm:px-3',
        'transition-colors hover:bg-black/5 dark:hover:bg-white/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
      )}
    >
      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', TONES[item.tone])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {/* The organization leads the line: on a cross-organization page the reader is scanning for
          which tenant first, and what second. */}
      <span className="w-32 shrink-0 truncate text-sm font-semibold text-foreground sm:w-40">
        {item.organization}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{item.count}</span> {item.label}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
