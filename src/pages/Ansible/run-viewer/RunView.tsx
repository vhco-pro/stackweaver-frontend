// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The Run tab: one pane of glass over a job's event stream.
 *
 * Three pivots over one model - matrix, timeline, stream - sharing one filter
 * state and one detail drawer, so a question asked in one view is answered in
 * whichever view answers it best.
 */

import { useMemo, useState } from 'react';
import { AlertCircle, Layers, Layers3, RefreshCw, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnsibleJobEvent } from '@/api/ansible';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useNow } from '@/hooks/useNow';
import { buildRunModel } from './adapter';
import { mergeSlices, type SliceSource } from './slices';
import { DetailDrawer } from './DetailDrawer';
import { FilterBar, StatusToggles, type RunPivot } from './FilterBar';
import { MatrixView } from './MatrixView';
import { StreamView } from './StreamView';
import { TimelineView } from './TimelineView';
import { cellMatches, isFiltering, normalizeQuery, streamLineMatches, type RunFilters } from './filters';
import { drawerTargetLabel, resultFor, type DrawerTarget, type RunStatus } from './model';
import { STATUS_META, formatDuration } from './status';
import { HostStatusIcon } from '@/components/ansible/HostStatus';

interface RunViewProps {
  events: AnsibleJobEvent[];
  jobStatus: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  jobId: string;
  /**
   * Events of the other slices of this launch, when the job is one slice of a
   * sliced fan-out. Their results are merged into this run so the page shows
   * the fleet rather than a fraction of it.
   */
  siblingSlices?: { sliceNumber: number; jobId: string; events: AnsibleJobEvent[] }[];
  thisSliceNumber?: number;
  /**
   * The events were loaded in the server's reduced projection (a very large
   * run): the drawer fetches the full event it shows.
   */
  summaryMode?: boolean;
  /** Raw runner output, for the copy action the old Output tab used to carry. */
  rawOutput?: string;
  onCopyOutput?: () => void;
  outputCopied?: boolean;
}

function MatrixSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading run results">
      <Skeleton className="h-5 w-72" />
      <div className="space-y-1.5 rounded-xl border border-border/60 p-3">
        {Array.from({ length: 10 }, (_, row) => (
          <div key={row} className="flex items-center gap-2">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 9 }, (_, cell) => (
              <Skeleton key={cell} className="h-5 w-[110px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RunView({
  events,
  jobStatus,
  isLoading,
  isError,
  onRetry,
  jobId,
  siblingSlices,
  thisSliceNumber,
  summaryMode,
  rawOutput,
  onCopyOutput,
  outputCopied,
}: RunViewProps) {
  const [pivot, setPivot] = useState<RunPivot>('matrix');
  const [searchInput, setSearchInput] = useState('');
  const [statuses, setStatuses] = useState<ReadonlySet<RunStatus>>(new Set<RunStatus>());
  // The drawer keeps a history, not a single target: opening a host and then
  // one of its results is a drill-down, and a drill-down without a way back
  // strands the reader - closing and re-finding the host is not "back".
  const [drawerTrail, setDrawerTrail] = useState<DrawerTarget[]>([]);
  const target = drawerTrail.at(-1) ?? null;
  const previous = drawerTrail.length > 1 ? drawerTrail.at(-2) : undefined;

  const ownModel = useMemo(() => buildRunModel(events), [events]);
  // With siblings, the model the whole page reads is the merged fleet view.
  const merged = useMemo(() => {
    if (!siblingSlices || siblingSlices.length === 0) return null;
    const sources: SliceSource[] = [
      { sliceNumber: thisSliceNumber ?? 0, jobId, model: ownModel },
      ...siblingSlices.map((slice) => ({
        sliceNumber: slice.sliceNumber,
        jobId: slice.jobId,
        model: buildRunModel(slice.events),
      })),
    ];
    return mergeSlices(sources);
  }, [siblingSlices, thisSliceNumber, jobId, ownModel]);
  const model = merged?.model ?? ownModel;
  const filters = useMemo<RunFilters>(
    () => ({ statuses: new Set(statuses), query: normalizeQuery(searchInput) }),
    [statuses, searchInput],
  );
  const filtering = isFiltering(filters);

  const matchCount = useMemo(() => {
    if (!filtering) return null;
    let hosts = 0;
    let results = 0;
    for (const host of model.hosts) {
      let hostHit = 0;
      for (const task of model.tasks) {
        const result = resultFor(model, host, task.id);
        if (result && cellMatches(filters, host, task, result)) hostHit++;
      }
      if (hostHit > 0) hosts++;
      results += hostHit;
    }
    return { hosts, results };
  }, [model, filters, filtering]);

  const streamLines = useMemo(
    () => (filtering ? model.streamLines.filter((line) => streamLineMatches(filters, line)) : model.streamLines),
    [model, filters, filtering],
  );

  // Tasks with at least one matching cell, for the timeline.
  const timelineTasks = useMemo(() => {
    if (!filtering) return model.tasks;
    return model.tasks.filter((task) =>
      model.hosts.some((host) => {
        const result = resultFor(model, host, task.id);
        return result ? cellMatches(filters, host, task, result) : false;
      }),
    );
  }, [model, filters, filtering]);

  // Rescued and ignored have no cell of their own - a rescued task still
  // reports its own result - so they ride along as counts when non-zero.
  const extraTotals = useMemo(() => {
    if (!model.statsByHost) return { rescued: 0, ignored: 0 };
    return Object.values(model.statsByHost).reduce(
      (acc, stats) => ({ rescued: acc.rescued + stats.rescued, ignored: acc.ignored + stats.ignored }),
      { rescued: 0, ignored: 0 },
    );
  }, [model]);

  const toggleStatusFilter = (status: RunStatus) => {
    setStatuses((previous) => {
      const next = new Set(previous);
      if (!next.delete(status)) next.add(status);
      return next;
    });
  };

  const jobRunning = ['pending', 'running'].includes(jobStatus);
  // While the job runs the header clock ticks off the run's own start, so the
  // page shows elapsed time rather than a duration frozen at the last poll.
  const now = useNow(jobRunning);
  const elapsedMs = jobRunning && model.startMs > 0 ? now - model.startMs : model.endMs - model.startMs;

  // A started task with nothing reported yet is the one currently executing.
  const runningTaskId = useMemo(() => {
    if (!jobRunning) return undefined;
    for (let index = model.tasks.length - 1; index >= 0; index--) {
      const task = model.tasks[index];
      const started = model.hosts.some((host) => resultFor(model, host, task.id));
      if (!started) return task.id;
    }
    return undefined;
  }, [model, jobRunning]);

  if (isLoading) {
    return <MatrixSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <div>
          <p className="font-medium">Could not load this run</p>
          <p className="text-sm text-muted-foreground">The job events could not be fetched.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (model.streamLines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 py-16 text-center text-muted-foreground">
        <Server className="h-8 w-8 opacity-40" />
        <p>
          {jobStatus === 'pending'
            ? 'Waiting for the job to start…'
            : jobStatus === 'running'
              ? 'Running — results appear here as hosts report back.'
              : 'This job recorded no events.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={pivot} onValueChange={(value) => { setPivot(value as RunPivot); }}>
        <FilterBar
          model={model}
          filters={filters}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          onClear={() => {
            setStatuses(new Set<RunStatus>());
            setSearchInput('');
          }}
          matchCount={matchCount}
          extraTotals={extraTotals}
          onCopyOutput={rawOutput ? onCopyOutput : undefined}
          outputCopied={outputCopied}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {model.playName && <span className="font-medium">{model.playName}</span>}
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              {model.tasks.length} tasks
            </span>
            {elapsedMs > 0 && (
              <span className={cn('tabular-nums text-muted-foreground', jobRunning && 'text-blue-600 dark:text-blue-400')}>
                {formatDuration(elapsedMs)}
                {jobRunning && <span className="ml-1">elapsed</span>}
              </span>
            )}
            {extraTotals.rescued > 0 && <span className="text-muted-foreground">{extraTotals.rescued} rescued</span>}
            {extraTotals.ignored > 0 && <span className="text-muted-foreground">{extraTotals.ignored} ignored</span>}
            {merged && (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Layers3 className="h-3.5 w-3.5" />
                  {merged.slices.length} slices
                </span>
                {merged.slices.map((slice) => (
                  <span
                    key={slice.jobId}
                    title={`Slice ${slice.sliceNumber}: ${slice.hosts} hosts${slice.worst ? `, worst ${STATUS_META[slice.worst].label}` : ''}`}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]',
                      slice.jobId === jobId ? 'border-primary/50' : 'border-border/60',
                      slice.worst ? STATUS_META[slice.worst].cell : 'text-muted-foreground',
                    )}
                  >
                    {slice.worst && <HostStatusIcon status={slice.worst} className="h-3 w-3" labelled={false} />}
                    #{slice.sliceNumber}
                    <span className="opacity-70">{slice.hosts}h</span>
                  </span>
                ))}
              </span>
            )}
          </div>
          <StatusToggles filters={filters} onToggleStatus={toggleStatusFilter} />
        </div>

        <TabsContent value="matrix" className="mt-3">
          <MatrixView
            model={model}
            filters={filters}
            runningTaskId={runningTaskId}
            animateArrivals={jobRunning}
            onSelectCell={(host, task) => { setDrawerTrail([{ kind: 'cell', host, taskId: task.id }]); }}
            onSelectHost={(host) => { setDrawerTrail([{ kind: 'host', host }]); }}
            onSelectTask={(task) => { setDrawerTrail([{ kind: 'task', taskId: task.id }]); }}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-3">
          <TimelineView
            model={model}
            tasks={timelineTasks}
            onSelectTask={(task) => { setDrawerTrail([{ kind: 'task', taskId: task.id }]); }}
          />
        </TabsContent>

        <TabsContent value="stream" className="mt-3">
          <StreamView
            lines={streamLines}
            startMs={model.startMs}
            query={filters.query}
            emptyNote="Nothing matches the current filters."
            rawAvailable={!summaryMode}
          />
        </TabsContent>
      </Tabs>

      <DetailDrawer
        model={model}
        target={target}
        onNavigate={(next) => { setDrawerTrail((trail) => [...trail, next]); }}
        onClose={() => { setDrawerTrail([]); }}
        onBack={previous ? () => { setDrawerTrail((trail) => trail.slice(0, -1)); } : undefined}
        backLabel={previous ? drawerTargetLabel(model, previous) : undefined}
        jobId={jobId}
        summaryMode={summaryMode}
      />
    </div>
  );
}
