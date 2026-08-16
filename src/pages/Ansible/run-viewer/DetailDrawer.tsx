// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The one detail surface behind every pivot. A cell, a host row, or a task
 * column all open the same drawer, and its host and task views link back into
 * cell views, so "which host failed, and what did it say" is a couple of
 * clicks from anywhere in the run.
 */

import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ansibleJobsApi } from '@/api/ansible';
import { getAnsibleJobEventFromJsonApi } from '@/utils/ansible-jsonapi';
import { cn } from '@/lib/utils';
import { JsonSyntaxHighlighter } from '@/components/code/JsonSyntaxHighlighter';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  hostWorstStatus,
  resultFor,
  RUN_STATUSES,
  STATUS_SEVERITY,
  type HostResult,
  type ModuleResult,
  type RunModel,
  type DrawerTarget,
  type RunStatus,
  type TaskMeta,
} from './model';
import { STATUS_META, asText, formatDuration, formatOffset, shortPath } from './status';

interface DetailDrawerProps {
  model: RunModel;
  target: DrawerTarget | null;
  /** Drill into a related view (host -> cell, task -> cell), keeping history. */
  onNavigate: (target: DrawerTarget) => void;
  onClose: () => void;
  /**
   * Return to the view this one was opened from. Absent at the root of the
   * drawer's history - a host or task view opened straight from the grid has
   * nowhere to go back to but out.
   */
  onBack?: () => void;
  /** What Back returns to, so the control names its destination. */
  backLabel?: string;
  jobId: string;
  /**
   * The page loaded the run in the server's summary projection, so a cell's
   * result is the reduced one - the drawer fetches the full event it is about
   * to show.
   */
  summaryMode?: boolean;
}

interface DiffPair {
  header?: string;
  before: string;
  after: string;
}

/** `diff` is either one before/after pair or a list of them, per module. */
function parseDiffs(raw: unknown): DiffPair[] {
  const entries = Array.isArray(raw) ? raw : [raw];
  const pairs: DiffPair[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const before = asText(record.before) ?? '';
    const after = asText(record.after) ?? '';
    if (!before && !after) continue;
    const header = typeof record.after_header === 'string' ? record.after_header : undefined;
    pairs.push({ header, before, after });
  }
  return pairs;
}

function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xs">{children}</dd>
    </>
  );
}

function OutputBlock({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</h4>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-mono text-xs">{text}</pre>
    </div>
  );
}

/**
 * JSON always renders through the platform's shared highlighter - the same
 * colouring the state viewer and plan diffs use - never as plain text.
 */
function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</h4>
      <div className="max-h-64 overflow-auto rounded-lg bg-muted/60">
        <JsonSyntaxHighlighter json={JSON.stringify(value, null, 2)} maxHeight="none" className="text-xs" />
      </div>
    </div>
  );
}

function DiffBlock({ diffs }: { diffs: DiffPair[] }) {
  if (diffs.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Diff</h4>
      {diffs.map((diff, index) => {
        const before = diff.before.split('\n');
        const after = diff.after.split('\n');
        const beforeSet = new Set(before);
        const afterSet = new Set(after);
        return (
          <div key={index} className="overflow-hidden rounded-lg border border-border/60 font-mono text-xs">
            {diff.header && (
              <div className="border-b border-border/60 bg-muted/60 px-3 py-1.5 text-[10px] text-muted-foreground">
                {shortPath(diff.header)}
              </div>
            )}
            <div className="max-h-64 overflow-auto p-2">
              {before.map((line, i) =>
                line === '' ? null : (
                  <div
                    key={`b${i}`}
                    className={cn(
                      'whitespace-pre-wrap px-1',
                      afterSet.has(line) ? 'text-muted-foreground' : 'bg-red-500/10 text-red-700 dark:text-red-400',
                    )}
                  >
                    {afterSet.has(line) ? '  ' : '− '}
                    {line}
                  </div>
                ),
              )}
              {after.map((line, i) =>
                line === '' || beforeSet.has(line) ? null : (
                  <div key={`a${i}`} className="whitespace-pre-wrap bg-green-500/10 px-1 text-green-700 dark:text-emerald-400">
                    + {line}
                  </div>
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const FACT_ROWS: { label: string; from: (facts: Record<string, unknown>) => string | undefined }[] = [
  {
    label: 'OS',
    from: (f) =>
      typeof f.ansible_distribution === 'string'
        ? `${f.ansible_distribution} ${typeof f.ansible_distribution_version === 'string' ? f.ansible_distribution_version : ''}`.trim()
        : undefined,
  },
  { label: 'Kernel', from: (f) => (typeof f.ansible_kernel === 'string' ? f.ansible_kernel : undefined) },
  { label: 'vCPUs', from: (f) => (typeof f.ansible_processor_vcpus === 'number' ? String(f.ansible_processor_vcpus) : undefined) },
  {
    label: 'Memory',
    from: (f) => (typeof f.ansible_memtotal_mb === 'number' ? `${(f.ansible_memtotal_mb / 1024).toFixed(1)} GB` : undefined),
  },
  {
    label: 'IP',
    from: (f) => {
      const ipv4 = f.ansible_default_ipv4;
      if (typeof ipv4 !== 'object' || ipv4 === null) return undefined;
      const address = (ipv4 as Record<string, unknown>).address;
      return typeof address === 'string' ? address : undefined;
    },
  },
  {
    label: 'Uptime',
    from: (f) =>
      typeof f.ansible_uptime_seconds === 'number' ? `${Math.round(f.ansible_uptime_seconds / 86400)} days` : undefined,
  },
];

function FactsGrid({ facts }: { facts: Record<string, unknown> }) {
  const rows = FACT_ROWS.map((row) => ({ label: row.label, value: row.from(facts) })).filter((row) => row.value);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Gathered facts</h4>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{row.label}</div>
            <div className="text-xs">{row.value}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {Object.keys(facts).length} facts gathered - the full set is in the raw event below.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: RunStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs', meta.cell)}>
      <span aria-hidden="true">{meta.glyph}</span>
      {meta.label}
    </span>
  );
}

function RawEvent({ result }: { result: ModuleResult }) {
  return (
    <details className="rounded-lg border border-border/60">
      <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Raw event JSON</summary>
      <div className="max-h-72 overflow-auto border-t border-border/60">
        <JsonSyntaxHighlighter
          json={JSON.stringify(result, null, 2)}
          maxHeight="none"
          className="text-[11px]"
        />
      </div>
    </details>
  );
}

/**
 * Fetch the one event the drawer is showing in full. Only runs in summary mode;
 * the result is cached per counter, so reopening a cell is free.
 */
function useFullResult(jobId: string, host: string, counter: number, enabled: boolean): ModuleResult | undefined {
  const { data } = useQuery({
    queryKey: ['jobEventFull', jobId, counter],
    queryFn: async () => {
      const response = await ansibleJobsApi.getEvents(jobId, { filter: { counter } });
      const resource = response.data?.[0];
      return resource ? getAnsibleJobEventFromJsonApi(resource) : null;
    },
    enabled,
    staleTime: Infinity,
  });

  const hosts = data?.event_data?.hosts;
  if (typeof hosts !== 'object' || hosts === null) return undefined;
  const full = (hosts as Record<string, unknown>)[host];
  return typeof full === 'object' && full !== null ? (full as ModuleResult) : undefined;
}

function CellDetail({
  model,
  host,
  task,
  result,
  jobId,
  summaryMode,
}: {
  model: RunModel;
  host: string;
  task: TaskMeta;
  result: HostResult;
  jobId: string;
  summaryMode: boolean;
}) {
  // A cell from a sibling slice belongs to that slice's job, and sibling events
  // are always fetched as summaries - so those fetch their full event too.
  const ownerJobId = result.jobId ?? jobId;
  const fromSibling = result.jobId !== undefined && result.jobId !== jobId;
  const full = useFullResult(ownerJobId, host, result.eventCounter, summaryMode || fromSibling);
  // Until the full event lands, the summary result already carries the header
  // fields, so the drawer opens instantly and fills in.
  const module: ModuleResult = full ?? result.result;
  const command = Array.isArray(module.cmd) ? module.cmd.join(' ') : typeof module.cmd === 'string' ? module.cmd : undefined;
  const warnings = Array.isArray(module.warnings)
    ? module.warnings.filter((w): w is string => typeof w === 'string')
    : [];

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
        <KeyValue label="Status">
          <StatusPill status={result.status} />
        </KeyValue>
        {module.action && (
          <KeyValue label="Module">
            <code className="font-mono">{module.action}</code>
          </KeyValue>
        )}
        {task.path && (
          <KeyValue label="Source">
            <code className="font-mono">{shortPath(task.path)}</code>
          </KeyValue>
        )}
        <KeyValue label="Finished">{formatOffset(result.atMs, model.startMs)}</KeyValue>
        {typeof module.rc === 'number' && (
          <KeyValue label="Return code">
            <code className="font-mono">rc={module.rc}</code>
          </KeyValue>
        )}
        {typeof module.attempts === 'number' && <KeyValue label="Attempts">{module.attempts}</KeyValue>}
        {command && (
          <KeyValue label="Command">
            <code className="font-mono break-all">{command}</code>
          </KeyValue>
        )}
        {module.skip_reason && <KeyValue label="Skip reason">{module.skip_reason}</KeyValue>}
      </dl>

      {module.ansible_facts && <FactsGrid facts={module.ansible_facts} />}
      <OutputBlock label="Message" text={asText(module.msg)} />
      <OutputBlock label="stdout" text={asText(module.stdout) ?? asText(module.stdout_lines)} />
      <OutputBlock label="stderr" text={asText(module.stderr) ?? asText(module.stderr_lines)} />
      <DiffBlock diffs={parseDiffs(module.diff)} />
      {warnings.length > 0 && <OutputBlock label="Warnings" text={warnings.join('\n')} />}
      {Array.isArray(module.results) && module.results.length > 0 && (
        <JsonBlock label={`Loop results (${module.results.length})`} value={module.results} />
      )}
      <RawEvent result={module} />
    </div>
  );
}

function HostDetail({
  model,
  host,
  onOpenCell,
}: {
  model: RunModel;
  host: string;
  onOpenCell: (taskId: string) => void;
}) {
  const rows = model.tasks
    .map((task) => ({ task, result: resultFor(model, host, task.id) }))
    .filter((row): row is { task: TaskMeta; result: HostResult } => row.result !== undefined);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has run on this host yet.</p>;
  }

  return (
    <ol className="space-y-1">
      {rows.map(({ task, result }) => {
        const meta = STATUS_META[result.status];
        const summary =
          asText(result.result.msg)?.split('\n')[0].slice(0, 90) ??
          (result.result.skip_reason ? `skipped - ${result.result.skip_reason}` : meta.label);
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => { onOpenCell(task.id); }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', meta.dot)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{task.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatOffset(result.atMs, model.startMs)} · <span className="sr-only">{meta.label}: </span>
                  {summary}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function TaskDetail({
  model,
  task,
  onOpenCell,
}: {
  model: RunModel;
  task: TaskMeta;
  onOpenCell: (host: string) => void;
}) {
  const byStatus = new Map<RunStatus, string[]>();
  for (const host of model.hosts) {
    const result = resultFor(model, host, task.id);
    if (!result) continue;
    const bucket = byStatus.get(result.status);
    if (bucket) bucket.push(host);
    else byStatus.set(result.status, [host]);
  }
  const covered = [...byStatus.values()].reduce((sum, hosts) => sum + hosts.length, 0);
  const ordered = [...RUN_STATUSES].sort((a, b) => STATUS_SEVERITY[b] - STATUS_SEVERITY[a]);

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
        {task.path && (
          <KeyValue label="Source">
            <code className="font-mono">{shortPath(task.path)}</code>
          </KeyValue>
        )}
        <KeyValue label="Duration">{formatDuration(task.endMs - task.startMs)}</KeyValue>
        <KeyValue label="Window">
          {formatOffset(task.startMs, model.startMs)} → {formatOffset(task.endMs, model.startMs)}
        </KeyValue>
        <KeyValue label="Hosts">
          {covered} of {model.hosts.length}
        </KeyValue>
      </dl>

      {ordered.map((status) => {
        const hosts = byStatus.get(status);
        if (!hosts || hosts.length === 0) return null;
        const meta = STATUS_META[status];
        return (
          <div key={status} className="space-y-2">
            <h4 className={cn('flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider', meta.text)}>
              <span aria-hidden="true">{meta.glyph}</span>
              {meta.label} · {hosts.length}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {hosts.map((host) => (
                <button
                  key={host}
                  type="button"
                  onClick={() => { onOpenCell(host); }}
                  aria-label={`${host}: ${meta.label}. Open details.`}
                  className={cn(
                    'rounded-lg border px-2 py-0.5 font-mono text-xs transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none',
                    meta.cell,
                  )}
                >
                  {host}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DetailDrawer({ model, target, onNavigate, onClose, onBack, backLabel, jobId, summaryMode }: DetailDrawerProps) {
  const task = target && 'taskId' in target ? model.tasks.find((t) => t.id === target.taskId) : undefined;
  const cellResult =
    target?.kind === 'cell' && task ? resultFor(model, target.host, task.id) : undefined;

  let title = '';
  let description = '';
  let status: RunStatus | undefined;
  let body: React.ReactNode = null;

  if (target?.kind === 'cell' && task && cellResult) {
    title = task.name;
    description = `${target.host}${model.playName ? ` · ${model.playName}` : ''}`;
    status = cellResult.status;
    body = (
      <CellDetail
        model={model}
        host={target.host}
        task={task}
        result={cellResult}
        jobId={jobId}
        summaryMode={summaryMode ?? false}
      />
    );
  } else if (target?.kind === 'host') {
    const worst = hostWorstStatus(model, target.host);
    const count = model.results.get(target.host)?.size ?? 0;
    title = target.host;
    description = `${count} task result${count === 1 ? '' : 's'}${worst ? ` · worst: ${STATUS_META[worst].label}` : ''}`;
    status = worst;
    body = (
      <HostDetail
        model={model}
        host={target.host}
        onOpenCell={(taskId) => { onNavigate({ kind: 'cell', host: target.host, taskId }); }}
      />
    );
  } else if (target?.kind === 'task' && task) {
    title = task.name;
    description = model.playName;
    body = (
      <TaskDetail
        model={model}
        task={task}
        onOpenCell={(host) => { onNavigate({ kind: 'cell', host, taskId: task.id }); }}
      />
    );
  }

  return (
    <Sheet open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <SheetHeader className="space-y-1 border-b border-border/60 p-6 pb-4 text-left">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 mb-1 flex w-fit cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="max-w-[22rem] truncate">Back to {backLabel}</span>
            </button>
          )}
          <div className="flex items-start gap-3">
            {status && (
              <span
                aria-hidden="true"
                className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', STATUS_META[status].cell)}
              >
                {STATUS_META[status].glyph}
              </span>
            )}
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">{title}</SheetTitle>
              <SheetDescription className="truncate font-mono text-xs">{description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-auto p-6 pt-4">{body}</div>
      </SheetContent>
    </Sheet>
  );
}
