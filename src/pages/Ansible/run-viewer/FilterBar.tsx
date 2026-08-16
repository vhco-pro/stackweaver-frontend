// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Status tiles, one search box, and the pivot switch - the whole control
 * surface for the run. The tiles double as filters, so the number you noticed
 * is also the way to see what it is made of.
 *
 * The pivot triggers are `TabsList`/`TabsTrigger` from the surrounding `Tabs`
 * in `RunView`, which is what gives them roving-focus keyboard navigation.
 */

import { useRef } from 'react';
import { Check, Copy, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMountEffect } from '@/hooks/useMountEffect';
import { cn } from '@/lib/utils';
import { RUN_STATUSES, type RunModel, type RunStatus } from './model';
import { DID_NOT_RUN_GLYPH, STATUS_META } from './status';
import { HostStatusIcon } from '@/components/ansible/HostStatus';
import type { RunFilters } from './filters';

export type RunPivot = 'matrix' | 'timeline' | 'stream';

interface FilterBarProps {
  model: RunModel;
  filters: RunFilters;
  /** Raw (un-normalized) search text, so the input stays what the user typed. */
  searchInput: string;
  onSearchInput: (value: string) => void;
  onClear: () => void;
  matchCount: { hosts: number; results: number } | null;
  /** Recap-only counters that have no cell of their own. */
  extraTotals?: { rescued: number; ignored: number };
  onCopyOutput?: () => void;
  outputCopied?: boolean;
}

/**
 * The legend doubles as the filter control: the glyph key a reader needs anyway
 * is the same vocabulary they want to filter by, so pressing one narrows the
 * run. Keeping it here (rather than duplicating the counts as buttons) leaves
 * the status strip above as a clean read-out.
 */
export function StatusToggles({
  filters,
  onToggleStatus,
  className,
}: {
  filters: RunFilters;
  onToggleStatus: (status: RunStatus) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)} role="group" aria-label="Filter by result status">
      {/* A legend is conventionally passive, so one word says these are also
          controls - without it the filtering is only discoverable by hovering. */}
      <span className="mr-0.5 text-xs text-muted-foreground">Filter:</span>
      {RUN_STATUSES.map((status) => {
        const meta = STATUS_META[status];
        const active = filters.statuses.has(status);
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            aria-label={`Filter to ${meta.label} results`}
            onClick={() => { onToggleStatus(status); }}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? cn(meta.cell, 'font-medium')
                : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md border', meta.cell)}
            >
              <meta.Icon className="h-3 w-3" />
            </span>
            {meta.label}
          </button>
        );
      })}
      <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
        <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground/40">
          {DID_NOT_RUN_GLYPH}
        </span>
        did not run
      </span>
    </div>
  );
}

export function FilterBar({
  model,
  filters,
  searchInput,
  onSearchInput,
  onClear,
  matchCount,
  extraTotals,
  onCopyOutput,
  outputCopied,
}: FilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // `/` focuses search, the way it does in a terminal pager - but never while
  // the user is already typing somewhere.
  useMountEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLElement && active.isContentEditable) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  });

  const filtering = filters.statuses.size > 0 || filters.query.length > 0;

  return (
    <div className="space-y-3">
      {/* One status strip, not a card per status: glyph + count, no labels.
          The words live on the legend toggles, which is also where filtering
          happens - so this row stays a read-out and nothing competes with it. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2 backdrop-blur-sm">
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums">{model.hosts.length}</span>
          <span className="text-xs text-muted-foreground">hosts</span>
        </span>
        <span aria-hidden="true" className="h-5 w-px bg-border/60" />
        {RUN_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const count = model.totals[status];
          return (
            <span
              key={status}
              title={`${count} ${meta.label}`}
              className={cn('flex items-center gap-1.5', count === 0 && 'opacity-40')}
            >
              <HostStatusIcon status={status} className="h-4 w-4" labelled={false} />
              <span className={cn('text-lg font-semibold tabular-nums', meta.text)}>{count}</span>
              <span className="sr-only">{meta.label}</span>
            </span>
          );
        })}
        {extraTotals?.rescued ? (
          <span className="flex items-baseline gap-1.5 text-muted-foreground">
            <span className="text-lg font-semibold tabular-nums">{extraTotals.rescued}</span>
            <span className="text-xs">rescued</span>
          </span>
        ) : null}
        {extraTotals?.ignored ? (
          <span className="flex items-baseline gap-1.5 text-muted-foreground">
            <span className="text-lg font-semibold tabular-nums">{extraTotals.ignored}</span>
            <span className="text-xs">ignored</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TabsList>
          <TabsTrigger value="matrix">Matrix</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="stream">Stream</TabsTrigger>
        </TabsList>

        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={searchInput}
            onChange={(event) => { onSearchInput(event.target.value); }}
            placeholder="Search hosts, tasks, and results…  (press /)"
            aria-label="Search hosts, tasks, and results"
            className="h-9 pl-9 pr-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { onSearchInput(''); }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {filtering && (
          <>
            <span className="text-xs text-muted-foreground" role="status">
              {matchCount
                ? `${matchCount.results} result${matchCount.results === 1 ? '' : 's'} on ${matchCount.hosts} host${matchCount.hosts === 1 ? '' : 's'}`
                : ''}
            </span>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          </>
        )}

        {onCopyOutput && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyOutput}
            aria-label="Copy the job's raw output"
            title="Copy the job's raw output"
          >
            {outputCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
