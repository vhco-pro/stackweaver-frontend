// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Host x task matrix: one row per host, one column per task, one glyph per
 * result. The whole run fits on one screen at fleet size, so a single failed
 * host inside an otherwise green task is visible without scrolling or
 * expanding anything.
 *
 * The host column and the task header stay pinned while the grid scrolls; rows
 * virtualize past `VIRTUALIZE_ABOVE_HOSTS` so a 500-host run renders as cheaply
 * as a 20-host one. With filters active, cells that do not match dim and hosts
 * with nothing left drop out of the grid entirely.
 */

import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { hostWorstStatus, resultFor, taskAggregate, type RunModel, type TaskMeta } from './model';
import { cellMatches, isFiltering, NO_FILTERS, type RunFilters } from './filters';
import { DID_NOT_RUN_GLYPH, STATUS_META, formatDuration, shortPath } from './status';
import { HostStatusIcon } from '@/components/ansible/HostStatus';

/** Below this many hosts, plain rows are cheaper than virtualizing them. */
const VIRTUALIZE_ABOVE_HOSTS = 60;
const ROW_HEIGHT = 30;

/** Column widths in px: default, and the range a drag may take them to. */
const TASK_COLUMN_WIDTH = 100;
const HOST_COLUMN_WIDTH = 140;
const MIN_COLUMN_WIDTH = 56;
const MAX_COLUMN_WIDTH = 520;
/** How far one arrow-key press moves a column edge. */
const KEYBOARD_RESIZE_STEP = 16;

const AGGREGATE_ORDER = ['failed', 'unreachable', 'changed', 'ok', 'skipped'] as const;

function clampWidth(width: number): number {
  return Math.min(Math.max(width, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH);
}

/**
 * The drag handle on a column's trailing edge. Pointer capture keeps the drag
 * alive outside the handle, and the arrow keys move the same edge for anyone
 * not using a pointer; double-click restores the default width.
 */
function ColumnResizer({
  label,
  width,
  onResize,
  onReset,
}: {
  label: string;
  width: number;
  onResize: (width: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize the ${label} column`}
      aria-valuenow={width}
      aria-valuemin={MIN_COLUMN_WIDTH}
      aria-valuemax={MAX_COLUMN_WIDTH}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { startX: event.clientX, startWidth: width };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onResize(clampWidth(drag.current.startWidth + (event.clientX - drag.current.startX)));
      }}
      onPointerUp={(event) => {
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          onResize(clampWidth(width + KEYBOARD_RESIZE_STEP));
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onResize(clampWidth(width - KEYBOARD_RESIZE_STEP));
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onReset();
        }
      }}
      className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none select-none bg-transparent transition-colors duration-200 hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none"
      title="Drag to resize · double-click to reset"
    />
  );
}

interface MatrixViewProps {
  model: RunModel;
  filters?: RunFilters;
  /** Task currently executing, if any - gets a live marker on its column. */
  runningTaskId?: string;
  /**
   * Animate cells as they arrive. Only on while a job runs: keying each cell by
   * its event counter means a result mounts exactly once, so the animation
   * plays when the host reports and never again - but on a finished job that
   * would fire for the whole grid at load, which is noise rather than signal.
   */
  animateArrivals?: boolean;
  /** Opening the detail drawer. Cells are inert (but still labelled) without it. */
  onSelectCell?: (host: string, task: TaskMeta) => void;
  onSelectHost?: (host: string) => void;
  onSelectTask?: (task: TaskMeta) => void;
  className?: string;
}

function TaskHeader({
  model,
  task,
  running,
  width,
  onResize,
  onReset,
  onSelect,
}: {
  model: RunModel;
  task: TaskMeta;
  running: boolean;
  width: number;
  onResize: (width: number) => void;
  onReset: () => void;
  onSelect?: (task: TaskMeta) => void;
}) {
  const counts = taskAggregate(model, task.id);
  const title = task.path ? `${task.name} — ${shortPath(task.path)}` : task.name;
  // A fixed-width inner block keeps long task names from widening the column:
  // the table lays out to content, so `truncate` needs a bound to truncate to.
  // Dragging the handle on the column edge changes that bound.
  const content = (
    <div style={{ width }}>
      <span className="flex items-center gap-1 text-xs font-medium text-foreground">
        {running && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-500 motion-reduce:animate-none"
          />
        )}
        <span className="truncate">{task.name}</span>
      </span>
      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>{running ? 'running' : formatDuration(task.endMs - task.startMs)}</span>
        {AGGREGATE_ORDER.filter((status) => counts[status] > 0).map((status) => (
          <span key={status} className={cn('flex items-center gap-0.5 tabular-nums', STATUS_META[status].text)}>
            {counts[status]}
            <HostStatusIcon status={status} className="h-3 w-3" labelled={false} />
          </span>
        ))}
      </span>
    </div>
  );

  return (
    <th
      scope="col"
      className="sticky top-0 z-20 border-b border-border/60 bg-card/95 px-2 py-2 text-left align-bottom backdrop-blur-sm"
    >
      <div className="relative">
        {onSelect ? (
          <button
            type="button"
            onClick={() => { onSelect(task); }}
            title={title}
            aria-label={`${task.name}. Open task details.`}
            className="w-full cursor-pointer rounded-md px-1 py-0.5 text-left transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {content}
          </button>
        ) : (
          <div title={title} className="px-1 py-0.5">
            {content}
          </div>
        )}
        <ColumnResizer label={task.name} width={width} onResize={onResize} onReset={onReset} />
      </div>
    </th>
  );
}

export function MatrixView({
  model,
  filters = NO_FILTERS,
  runningTaskId,
  animateArrivals = false,
  onSelectCell,
  onSelectHost,
  onSelectTask,
  className,
}: MatrixViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtering = isFiltering(filters);
  // Per-column overrides; anything not dragged keeps the default width.
  const [taskWidths, setTaskWidths] = useState<Readonly<Record<string, number>>>({});
  const [hostWidth, setHostWidth] = useState(HOST_COLUMN_WIDTH);

  const setTaskWidth = (taskId: string, width: number) => {
    setTaskWidths((previous) => ({ ...previous, [taskId]: width }));
  };
  const resetTaskWidth = (taskId: string) => {
    setTaskWidths((previous) => {
      const next = { ...previous };
      delete next[taskId];
      return next;
    });
  };

  // A host with no matching cell leaves the grid rather than sitting there as
  // an empty row - which is what makes "show me the failures" a short list.
  const hosts = useMemo(() => {
    if (!filtering) return model.hosts;
    return model.hosts.filter((host) =>
      model.tasks.some((task) => {
        const result = resultFor(model, host, task.id);
        return result ? cellMatches(filters, host, task, result) : false;
      }),
    );
  }, [model, filters, filtering]);

  const virtualize = hosts.length > VIRTUALIZE_ABOVE_HOSTS;
  const rowVirtualizer = useVirtualizer({
    count: hosts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const visibleHosts = virtualize ? virtualRows.map((row) => hosts[row.index]) : hosts;
  const padTop = virtualize && virtualRows.length > 0 ? virtualRows[0].start : 0;
  const padBottom =
    virtualize && virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  if (hosts.length === 0) {
    return (
      <div className={cn('rounded-xl border border-border/60 py-16 text-center text-sm text-muted-foreground', className)}>
        No host matches the current filters.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        'max-h-[calc(100vh-380px)] min-h-[320px] overflow-auto rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm',
        className,
      )}
    >
      <table className="w-max border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Results of {model.tasks.length} tasks across {hosts.length} hosts
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-30 border-b border-r border-border/60 bg-card/95 px-3 py-2 text-left align-bottom text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur-sm"
            >
              <div className="relative">
                <div style={{ width: hostWidth }}>Host → task</div>
                <ColumnResizer
                  label="host"
                  width={hostWidth}
                  onResize={setHostWidth}
                  onReset={() => { setHostWidth(HOST_COLUMN_WIDTH); }}
                />
              </div>
            </th>
            {model.tasks.map((task) => (
              <TaskHeader
                key={task.id}
                model={model}
                task={task}
                running={task.id === runningTaskId}
                width={taskWidths[task.id] ?? TASK_COLUMN_WIDTH}
                onResize={(width) => { setTaskWidth(task.id, width); }}
                onReset={() => { resetTaskWidth(task.id); }}
                onSelect={onSelectTask}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={model.tasks.length + 1} style={{ height: padTop }} />
            </tr>
          )}
          {visibleHosts.map((host) => {
            const worst = hostWorstStatus(model, host);
            return (
              <tr key={host} style={{ height: ROW_HEIGHT }} className="group">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-r border-border/60 bg-card/95 px-3 text-left font-normal backdrop-blur-sm group-hover:bg-muted/60"
                >
                  {onSelectHost ? (
                    <button
                      type="button"
                      onClick={() => { onSelectHost(host); }}
                      title={`Everything that ran on ${host}`}
                      aria-label={`${host}${worst ? `, worst result: ${STATUS_META[worst].label}` : ''}. Open host details.`}
                      style={{ width: hostWidth }}
                      className="flex cursor-pointer items-center gap-2 rounded-sm font-mono text-xs transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        aria-hidden="true"
                        className={cn('h-2 w-2 shrink-0 rounded-full', worst ? STATUS_META[worst].dot : 'bg-muted-foreground/40')}
                      />
                      <span className="truncate">{host}</span>
                    </button>
                  ) : (
                    <span style={{ width: hostWidth }} className="flex items-center gap-2 font-mono text-xs">
                      <span
                        aria-hidden="true"
                        className={cn('h-2 w-2 shrink-0 rounded-full', worst ? STATUS_META[worst].dot : 'bg-muted-foreground/40')}
                      />
                      <span className="truncate">{host}</span>
                      <span className="sr-only">{worst ? `worst result: ${STATUS_META[worst].label}` : 'no results'}</span>
                    </span>
                  )}
                </th>
                {model.tasks.map((task) => {
                  const result = resultFor(model, host, task.id);
                  if (!result) {
                    return (
                      <td key={task.id} className="border-b border-border/40 px-1 text-center">
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground/40"
                          title={`${task.name} did not run on ${host}`}
                          aria-label={`${host}, ${task.name}: did not run`}
                        >
                          {DID_NOT_RUN_GLYPH}
                        </span>
                      </td>
                    );
                  }
                  const meta = STATUS_META[result.status];
                  const dim = filtering && !cellMatches(filters, host, task, result);
                  const label = `${host}, ${task.name}: ${meta.label}`;
                  const cellClass = cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs leading-none',
                    meta.cell,
                    dim && 'opacity-20',
                    animateArrivals && 'animate-in zoom-in-50 fade-in duration-300 motion-reduce:animate-none',
                  );
                  return (
                    <td key={task.id} className="border-b border-border/40 px-1 text-center">
                      {onSelectCell ? (
                        <button
                          key={result.eventCounter}
                          type="button"
                          onClick={() => { onSelectCell(host, task); }}
                          title={`${host} · ${task.name} — ${meta.label}`}
                          aria-label={`${label}. Open details.`}
                          className={cn(
                            cellClass,
                            'cursor-pointer transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none',
                          )}
                        >
                          <HostStatusIcon status={result.status} className="h-3.5 w-3.5" labelled={false} />
                        </button>
                      ) : (
                        <span key={result.eventCounter} className={cellClass} title={`${host} · ${task.name} — ${meta.label}`} aria-label={label} role="img">
                          <HostStatusIcon status={result.status} className="h-3.5 w-3.5" labelled={false} />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {padBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={model.tasks.length + 1} style={{ height: padBottom }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
