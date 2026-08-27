// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, CircleDashed, ExternalLink, XCircle } from 'lucide-react';
import {
  analyticsApi,
  type AnalyticsExecution,
  type AnalyticsOutcomeFilter,
} from '@/api/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDay, formatDuration, useChartPalette, type ChartPalette } from '../chartTheme';

/** Which bar the reader clicked: one day, optionally narrowed to one outcome and one platform. */
export interface DaySelection {
  date: string;
  outcome?: AnalyticsOutcomeFilter;
  platform?: 'terraform' | 'ansible';
  /**
   * How that day divides by outcome, taken from the chart row that was clicked. Carrying it here
   * means the filter offers exactly the outcomes the bar was drawn from - no extra request, and no
   * chance of the panel advertising a filter the chart says is empty.
   */
  counts: Record<AnalyticsOutcomeFilter, number>;
}

type OutcomeChip = AnalyticsOutcomeFilter | 'all';

const OUTCOME_LABELS: { value: AnalyticsOutcomeFilter; label: string }[] = [
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'other', label: 'In flight' },
];

/**
 * The drill-down behind a bar of the daily chart.
 *
 * A count answers "how much ran"; the next question is always "which ones", and that is the one a
 * bar chart cannot answer on its own. Clicking a segment opens this panel on that segment, but the
 * whole day stays one click away - the reader clicked a bar to ask about a day, not to be locked
 * into one slice of it.
 */
export function DayExecutionsSheet({
  selection,
  orgName,
  window,
  onOpenChange,
}: {
  selection: DaySelection | null;
  orgName: string;
  /** The window the chart was drawn for. Its edges clip the first and last day buckets. */
  window: { since: Date; until: Date };
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(selection)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-[560px]">
        {selection && (
          // Keyed by the selection so the outcome filter and any collapsed sections reset when a
          // different bar is opened, without an effect watching the selection.
          <DayExecutionsPanel
            key={`${selection.date}-${selection.outcome ?? 'all'}-${selection.platform ?? 'all'}`}
            selection={selection}
            orgName={orgName}
            window={window}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DayExecutionsPanel({
  selection,
  orgName,
  window,
}: {
  selection: DaySelection;
  orgName: string;
  window: { since: Date; until: Date };
}) {
  const palette = useChartPalette();
  // Opens on whichever segment was clicked; "All" restores the full day.
  const [outcome, setOutcome] = useState<OutcomeChip>(selection.outcome ?? 'all');

  // Offer only the outcomes this day actually produced. A "Failed" button on a day that had no
  // failures is a control whose only possible result is an empty list, and the reader has to press
  // it to find that out; leaving it off says the same thing without the detour. "All" earns its
  // place only when there is more than one outcome to combine.
  const present = OUTCOME_LABELS.filter(entry => selection.counts[entry.value] > 0);
  const total = present.reduce((sum, entry) => sum + selection.counts[entry.value], 0);
  const chips: { value: OutcomeChip; label: string; count: number }[] =
    present.length > 1
      ? [{ value: 'all', label: 'All', count: total }, ...present.map(e => ({ ...e, count: selection.counts[e.value] }))]
      : [];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['analytics-executions', orgName, selection.date, outcome, selection.platform],
    queryFn: () => {
      // A day bucket is UTC, matching how the chart's buckets are cut server-side - but the first
      // and last buckets are clipped by the window itself, which starts at the current clock time
      // 30 days back rather than at midnight. Asking for the whole calendar day there would list
      // executions the bar never counted, so the request is the intersection of the two.
      const dayStart = new Date(`${selection.date}T00:00:00Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const since = new Date(Math.max(dayStart.getTime(), window.since.getTime()));
      const until = new Date(Math.min(dayEnd.getTime(), window.until.getTime()));
      return analyticsApi.getExecutions(orgName, {
        since,
        until,
        outcome: outcome === 'all' ? undefined : outcome,
        platform: selection.platform,
      });
    },
    staleTime: 60_000,
  });

  const platformLabel =
    selection.platform === 'terraform' ? 'Terraform runs' : selection.platform === 'ansible' ? 'Ansible jobs' : null;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{formatDay(selection.date, true)}</SheetTitle>
        <SheetDescription>
          {isLoading
            ? 'Loading executions…'
            : data
              ? `${data.count} ${data.count === 1 ? 'execution' : 'executions'}${platformLabel ? ` · ${platformLabel}` : ''}`
              : 'Executions for this day'}
        </SheetDescription>
      </SheetHeader>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by outcome">
          {chips.map(chip => (
            <button
              key={chip.value}
              type="button"
              onClick={() => {
                setOutcome(chip.value);
              }}
              aria-pressed={outcome === chip.value}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                outcome === chip.value
                  ? 'border-purple-500/60 bg-purple-500/15 text-foreground'
                  : 'border-white/15 text-muted-foreground hover:text-foreground'
              )}
            >
              {chip.label}
              <span className="ml-1.5 tabular-nums opacity-60">{chip.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Could not load this day&apos;s executions.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : !data || data.executions.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No executions match this selection.</p>
        ) : (
          <>
            <ExecutionGroups executions={data.executions} orgName={orgName} palette={palette} />
            {data.truncated && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Showing the {data.count} most recent executions of this day.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

/**
 * Splits a mixed day into a Terraform section and an Ansible section, each collapsible.
 *
 * A day that ran both kinds of work is really two stories interleaved by timestamp, and reading one
 * of them means skipping past the other. Sections let a reader fold away the half they do not care
 * about. When the visible set only holds one platform there is nothing to separate, so the list
 * stays flat rather than wrapping a single group in ceremony.
 */
function ExecutionGroups({
  executions,
  orgName,
  palette,
}: {
  executions: AnalyticsExecution[];
  orgName: string;
  palette: ChartPalette;
}) {
  const terraform = executions.filter(e => e.platform === 'terraform');
  const ansible = executions.filter(e => e.platform === 'ansible');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (terraform.length === 0 || ansible.length === 0) {
    return (
      <ul className="space-y-2">
        {executions.map(execution => (
          <ExecutionRow
            key={`${execution.platform}-${execution.id}`}
            execution={execution}
            orgName={orgName}
            palette={palette}
          />
        ))}
      </ul>
    );
  }

  const groups = [
    { id: 'terraform', label: 'OpenTofu', rows: terraform, color: palette.terraform },
    { id: 'ansible', label: 'Ansible', rows: ansible, color: palette.ansible },
  ];

  return (
    <div className="space-y-4">
      {groups.map(group => {
        const isCollapsed = collapsed[group.id] ?? false;
        return (
          <section key={group.id}>
            <button
              type="button"
              onClick={() => {
                setCollapsed(prev => ({ ...prev, [group.id]: !isCollapsed }));
              }}
              aria-expanded={!isCollapsed}
              aria-controls={`executions-${group.id}`}
              className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  isCollapsed && '-rotate-90'
                )}
                aria-hidden="true"
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: group.color }}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-foreground">{group.label}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{group.rows.length}</span>
            </button>
            {!isCollapsed && (
              <ul id={`executions-${group.id}`} className="mt-2 space-y-2">
                {group.rows.map(execution => (
                  <ExecutionRow
                    key={`${execution.platform}-${execution.id}`}
                    execution={execution}
                    orgName={orgName}
                    palette={palette}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ExecutionRow({
  execution,
  orgName,
  palette,
}: {
  execution: AnalyticsExecution;
  orgName: string;
  palette: ChartPalette;
}) {
  const color =
    execution.outcome === 'succeeded'
      ? palette.succeeded
      : execution.outcome === 'failed'
        ? palette.failed
        : palette.other;
  const Icon =
    execution.outcome === 'succeeded' ? CheckCircle2 : execution.outcome === 'failed' ? XCircle : CircleDashed;

  // Terraform run detail is routed under its workspace; a row without one falls back to the
  // workspace list rather than linking somewhere that 404s.
  const href =
    execution.platform === 'ansible'
      ? `/app/${orgName}/ansible/jobs/${execution.id}`
      : execution.workspace_name
        ? `/app/${orgName}/workspaces/${execution.workspace_name}/runs/${execution.id}`
        : `/app/${orgName}/workspaces`;

  const time = new Date(execution.created_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li>
      <Link
        to={href}
        className="group flex items-center gap-3 rounded-xl border border-white/10 p-3 transition-colors hover:bg-white/5"
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `${color}22`, color }}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{execution.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {execution.platform === 'ansible' ? 'Ansible' : 'OpenTofu'}
            {execution.detail ? ` · ${execution.detail.replace(/-/g, ' ')}` : ''} · {time}
            {execution.duration_seconds !== undefined ? ` · ${formatDuration(execution.duration_seconds)}` : ''}
          </span>
        </span>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize"
          style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
        >
          {execution.status.replace(/_/g, ' ')}
        </span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  );
}
