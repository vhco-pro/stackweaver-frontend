// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The universal lane: the run as chronological lines, the way a terminal would
 * show it, with each line expandable to the event it came from.
 *
 * Everything the adapter could not structure - galaxy installs, runner stderr,
 * ad-hoc output, a future runner's format - lands here verbatim, so this page
 * is never worse than a plain output view no matter what the runner emits.
 */

import { useRef, useState } from 'react';
import { FileCode2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { JsonSyntaxHighlighter } from '@/components/code/JsonSyntaxHighlighter';
import { cn } from '@/lib/utils';
import type { StreamLine } from './model';
import { STATUS_META, formatOffset } from './status';
import { HostStatusIcon } from '@/components/ansible/HostStatus';

interface StreamViewProps {
  lines: StreamLine[];
  startMs: number;
  /** Lower-cased search term, for highlighting. */
  query: string;
  emptyNote: string;
  /**
   * Whether the events carry their raw runner output. False for a very large
   * run, where the summary projection omits stdout - the raw view then has
   * nothing to show and says so rather than rendering blank.
   */
  rawAvailable?: boolean;
}

/**
 * Raw rows never wrap - a log viewer scrolls sideways, and wrapping a 900-char
 * JSONL line into twenty visual lines forces the virtualizer to measure every
 * row, which shifts the total size on every scroll and makes the lane stutter.
 * One line per event means the estimate is exact and no measurement is needed.
 */
const RAW_ROW_HEIGHT = 22;

/**
 * Structure lines are banded so they read as boundaries, and coloured so the text says *which* kind
 * of boundary without the label having to be read.
 *
 * The band alone was ambiguous: PLAY, TASK and the recap were the same shape, so telling them apart
 * meant reading each label. The run-viewer prototype
 * (`docs/internal/design/prototypes/ansible-fleet-run-viewer.html`) separates them by hue - purple
 * opens a play, blue opens a task - which is what the text colours pair with. Light values are
 * darker than the prototype's dark ones (#c084fc purple-400, #93c5fd blue-300); those are too pale
 * to hold contrast on the light surface. The band itself stays neutral so the hue is the signal.
 */
const KIND_STYLES: Record<StreamLine['kind'], string> = {
  play: 'bg-violet-500/10 text-purple-700 dark:text-purple-400 font-bold',
  task: 'bg-muted/60 text-blue-700 dark:text-blue-300 font-semibold',
  recap: 'bg-muted/60',
  result: '',
  raw: 'text-muted-foreground',
};

/** Wrap every occurrence of `query` in a `<mark>`, leaving the rest as text. */
function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(query);
  while (at !== -1) {
    if (at > from) nodes.push(text.slice(from, at));
    nodes.push(
      <mark key={at} className="rounded-xs bg-amber-400/40 text-inherit">
        {text.slice(at, at + query.length)}
      </mark>,
    );
    from = at + query.length;
    at = lower.indexOf(query, from);
  }
  if (from < text.length) nodes.push(text.slice(from));
  return nodes;
}

export function StreamView({ lines, startMs, query, emptyNote, rawAvailable = true }: StreamViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  // Raw is a mode of this lane, not a tab of its own: the stream already IS the
  // chronological view, and the old Output tab's failing was rendering the same
  // events unvirtualized and unsearchable, not showing them raw.
  const [raw, setRaw] = useState(false);
  const showRaw = raw && rawAvailable;

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (showRaw ? RAW_ROW_HEIGHT : 26),
    overscan: 16,
  });

  const toggle = (counter: number) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(counter)) next.add(counter);
      return next;
    });
  };

  if (lines.length === 0) {
    return <div className="rounded-xl border border-border/60 py-16 text-center text-sm text-muted-foreground">{emptyNote}</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">
          {showRaw ? 'Raw runner output, one line per event' : `${lines.length} lines · click one for its raw event`}
        </span>
        <button
          type="button"
          aria-pressed={showRaw}
          disabled={!rawAvailable}
          onClick={() => { setRaw((previous) => !previous); }}
          title={rawAvailable ? 'Show the runner output verbatim' : 'Raw output is not loaded for very large runs'}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            showRaw
              ? 'border-border bg-muted font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60',
            !rawAvailable && 'cursor-not-allowed opacity-50 hover:border-transparent hover:bg-transparent',
          )}
        >
          <FileCode2 className="h-3.5 w-3.5" />
          Raw
        </button>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[calc(100vh-420px)] min-h-[320px] overflow-auto rounded-xl border border-border/60 bg-card/60 font-mono text-xs backdrop-blur-sm"
      >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const line = lines[item.index];
          const meta = line.status ? STATUS_META[line.status] : undefined;
          const isOpen = expanded.has(line.eventCounter);

          if (showRaw) {
            // The runner's own line, verbatim - the same text the old Output
            // tab concatenated, except virtualized, filtered and searchable.
            const rawText = line.event.stdout?.trimEnd() || JSON.stringify(line.event.event_data ?? {});
            return (
              <div
                key={line.eventCounter}
                data-index={item.index}
                className="absolute left-0 top-0 flex w-max items-baseline gap-3 pr-4"
                style={{ transform: `translateY(${item.start}px)`, height: RAW_ROW_HEIGHT, lineHeight: `${RAW_ROW_HEIGHT}px` }}
              >
                <span className="sticky left-0 z-10 w-14 shrink-0 bg-card/95 pl-3 tabular-nums text-muted-foreground backdrop-blur-sm">
                  {formatOffset(line.atMs, startMs)}
                </span>
                <span className="whitespace-pre text-muted-foreground">{highlight(rawText, query)}</span>
              </div>
            );
          }

          return (
            <div
              key={line.eventCounter}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <button
                type="button"
                onClick={() => { toggle(line.eventCounter); }}
                aria-expanded={isOpen}
                aria-label={`${line.label} ${line.host} ${line.message.slice(0, 120)}. Toggle raw event.`}
                className={cn(
                  'flex w-full cursor-pointer items-baseline gap-3 px-3 py-1 text-left transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  KIND_STYLES[line.kind],
                )}
              >
                <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{formatOffset(line.atMs, startMs)}</span>
                <span className={cn('flex w-28 shrink-0 items-center gap-1 truncate uppercase', meta?.text)}>
                  {line.status && <HostStatusIcon status={line.status} className="h-3 w-3" labelled={false} />}
                  {line.label}
                </span>
                {/* One hue for every hostname, so the column scans as "who" without being read as
                    a status. Paired against the prototype's #a78bfa (violet-400). */}
                <span className="w-24 shrink-0 truncate text-violet-600 dark:text-violet-400">
                  {highlight(line.host, query)}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{highlight(line.message, query)}</span>
              </button>
              {isOpen && (
                <div className="mx-3 mb-2 max-h-72 overflow-auto rounded-lg bg-muted/60">
                  <JsonSyntaxHighlighter
                    json={JSON.stringify(line.event.event_data ?? {}, null, 2)}
                    maxHeight="none"
                    className="text-[11px]"
                  />
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
