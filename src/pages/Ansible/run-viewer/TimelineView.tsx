// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Where the run's wall-clock time went: one bar per task, positioned on the
 * job clock from the callback's `task.duration`. A task whose bar is half the
 * run is the answer to "why did this take 49 seconds"; a bar carrying a red
 * cap is where hosts failed.
 */

import { cn } from '@/lib/utils';
import { resultFor, taskAggregate, type RunModel, type TaskMeta } from './model';
import { STATUS_META, formatDuration, shortPath } from './status';

interface TimelineViewProps {
  model: RunModel;
  onSelectTask: (task: TaskMeta) => void;
  /** Tasks to draw; already filtered by the caller. */
  tasks: TaskMeta[];
}

function gridMarks(totalMs: number): number[] {
  const step = totalMs > 60_000 ? 15_000 : totalMs > 20_000 ? 10_000 : 5_000;
  const marks: number[] = [];
  for (let at = 0; at <= totalMs; at += step) marks.push(at);
  return marks;
}

export function TimelineView({ model, tasks, onSelectTask }: TimelineViewProps) {
  const totalMs = Math.max(model.endMs - model.startMs, 1);
  const marks = gridMarks(totalMs);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 py-16 text-center text-sm text-muted-foreground">
        No tasks match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
      {tasks.map((task) => {
        const counts = taskAggregate(model, task.id);
        const hostCount = model.hosts.filter((host) => resultFor(model, host, task.id)).length;
        const badCount = counts.failed + counts.unreachable;
        const left = ((task.startMs - model.startMs) / totalMs) * 100;
        const width = Math.max(((task.endMs - task.startMs) / totalMs) * 100, 0.6);
        const duration = formatDuration(task.endMs - task.startMs);
        const label = `${task.name}, ${duration}, ${hostCount} hosts${badCount > 0 ? `, ${badCount} failed or unreachable` : ''}. Open details.`;

        return (
          <div key={task.id} className="grid grid-cols-[minmax(140px,220px)_1fr_3.5rem] items-center gap-3">
            <div className="min-w-0 py-1">
              <div className="truncate text-xs">{task.name}</div>
              {task.path && <div className="truncate text-[10px] text-muted-foreground">{shortPath(task.path)}</div>}
            </div>
            <div className="relative h-7">
              {marks.map((mark) => (
                <span
                  key={mark}
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-border/50"
                  style={{ left: `${(mark / totalMs) * 100}%` }}
                />
              ))}
              <button
                type="button"
                onClick={() => { onSelectTask(task); }}
                title={label}
                aria-label={label}
                className={cn(
                  'absolute inset-y-1 flex cursor-pointer items-center overflow-hidden rounded-md border transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  badCount > 0 ? STATUS_META.failed.cell : counts.changed > 0 ? STATUS_META.changed.cell : STATUS_META.ok.cell,
                )}
                style={{ left: `${left}%`, width: `${width}%`, minWidth: '6px' }}
              >
                {badCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 right-0 w-1/4 min-w-[4px] bg-red-600/60 dark:bg-red-500/60"
                  />
                )}
              </button>
            </div>
            <div className="text-right text-xs tabular-nums text-muted-foreground">{duration}</div>
          </div>
        );
      })}

      <div className="grid grid-cols-[minmax(140px,220px)_1fr_3.5rem] gap-3 pt-2">
        <div />
        <div className="relative h-4">
          {marks.map((mark) => (
            <span
              key={mark}
              className="absolute top-0 -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ left: `${(mark / totalMs) * 100}%` }}
            >
              {mark / 1000}s
            </span>
          ))}
        </div>
        <div />
      </div>
    </div>
  );
}
