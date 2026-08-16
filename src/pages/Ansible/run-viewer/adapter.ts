// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Builds the `RunModel` from a job's stored event rows.
 *
 * `buildRunModel` is pure and total: it never throws, and every event it is
 * given ends up somewhere in the model. Events it cannot classify (galaxy
 * installs, runner stderr, ad-hoc output, a future runner's format) become
 * `raw` stream lines rather than being dropped, which is what lets the viewer
 * degrade to a plain terminal view for any kind of output.
 *
 * The per-host status derivation matches what the runner's JSONL callback
 * actually emits: the top-level `host`/`changed`/`failed`/`skipped` columns are
 * empty on nearly every row, so everything is read out of
 * `event_data.hosts[<host>]` instead.
 */

import type { AnsibleJobEvent } from '@/api/ansible';
import type {
  HostResult,
  ModuleResult,
  RecapStats,
  RunModel,
  RunStatus,
  StreamLine,
  TaskMeta,
} from './model';
import { shortPath } from './status';

const RESULT_EVENT_PREFIX = 'v2_runner_on_';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Parse an ISO timestamp, falling back when it is absent or unparseable. */
function parseMs(value: unknown, fallback: number): number {
  const raw = asString(value);
  if (!raw) return fallback;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * The status of a single host result. `unreachable` wins over `failed` here
 * because it says something stronger about that one result; collapsing many
 * results into one instead uses `STATUS_SEVERITY`.
 *
 * The `_event` verb is only consulted as a fallback: some modules report an
 * outcome through the verb without setting the matching flag on the result.
 */
export function deriveStatus(result: ModuleResult, verb?: string): RunStatus {
  if (result.unreachable === true || verb?.includes('unreachable')) return 'unreachable';
  if (result.failed === true || verb?.includes('failed')) return 'failed';
  if (result.skipped === true || verb?.includes('skipped')) return 'skipped';
  if (result.changed === true) return 'changed';
  return 'ok';
}

/** A one-line human summary of a result, for the stream lane. */
function summarizeResult(result: ModuleResult, status: RunStatus): string {
  if (typeof result.msg === 'string' && result.msg) return result.msg;
  if (typeof result.stdout === 'string' && result.stdout) return result.stdout;
  if (status === 'skipped' && result.skip_reason) return `skipped: ${result.skip_reason}`;
  if (typeof result.ping === 'string') return `ping: ${result.ping}`;
  if (result.ansible_facts) return `gathered ${Object.keys(result.ansible_facts).length} facts`;
  if (typeof result.dest === 'string') return `→ ${result.dest}`;
  if (typeof result.action === 'string') return result.action;
  return status;
}

function recapStats(raw: Record<string, unknown>): RecapStats {
  return {
    ok: asNumber(raw.ok),
    changed: asNumber(raw.changed),
    failures: asNumber(raw.failures),
    skipped: asNumber(raw.skipped),
    unreachable: asNumber(raw.unreachable),
    rescued: asNumber(raw.rescued),
    ignored: asNumber(raw.ignored),
  };
}

function recapMessage(stats: Record<string, RecapStats>): string {
  return Object.entries(stats)
    .map(
      ([host, s]) =>
        `${host}: ok=${s.ok} changed=${s.changed} failed=${s.failures} unreachable=${s.unreachable} skipped=${s.skipped}`,
    )
    .join('\n');
}

/** Text for a line the adapter could not classify - runner output, verbatim. */
function rawMessage(event: AnsibleJobEvent, data: Record<string, unknown>): string {
  const stdout = event.stdout?.trim();
  if (stdout) return stdout;
  const stderr = event.stderr?.trim();
  if (stderr) return stderr;
  if (Object.keys(data).length > 0) {
    try {
      return JSON.stringify(data);
    } catch {
      return event.event_type || '';
    }
  }
  return event.event_type || '';
}

export function buildRunModel(events: AnsibleJobEvent[]): RunModel {
  const tasks: TaskMeta[] = [];
  const taskById = new Map<string, TaskMeta>();
  const results = new Map<string, Map<string, HostResult>>();
  const hostSet = new Set<string>();
  const streamLines: StreamLine[] = [];
  const derivedTotals: Record<RunStatus, number> = { ok: 0, changed: 0, failed: 0, unreachable: 0, skipped: 0 };

  let playName = '';
  let statsByHost: Record<string, RecapStats> | undefined;
  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  // Timestamp of the previous event, so a row with no usable timestamp of its
  // own still lands in the right place on the run clock.
  let lastMs = 0;

  /**
   * Look up (or create) the task an event refers to. Result events carry the
   * same `task` object as their task-start event, so a model built from a
   * partial window of the stream - a live `?after=` page, an old job whose
   * first events aged out - still gets its columns.
   */
  const ensureTask = (raw: Record<string, unknown> | undefined, atMs: number): TaskMeta | undefined => {
    if (!raw) return undefined;
    const name = asString(raw.name) ?? '';
    // Task identity is the callback's task UUID, not the name: names repeat
    // across plays and loops. Older or hand-rolled callbacks may omit it, in
    // which case the name is the best identity available.
    const id = asString(raw.id) ?? (name ? `name:${name}` : undefined);
    if (!id) return undefined;

    const duration = asRecord(raw.duration);
    const startedMs = parseMs(duration?.start, atMs);
    const existing = taskById.get(id);
    if (existing) {
      if (startedMs < existing.startMs) existing.startMs = startedMs;
      return existing;
    }
    const task: TaskMeta = {
      id,
      name,
      path: asString(raw.path) ?? '',
      index: tasks.length,
      startMs: startedMs,
      endMs: startedMs,
    };
    tasks.push(task);
    taskById.set(id, task);
    return task;
  };

  for (const event of events) {
    const data = asRecord(event.event_data) ?? {};
    const atMs = parseMs(data._timestamp, parseMs(event.created_at, lastMs));
    lastMs = atMs;
    if (atMs < startMs) startMs = atMs;
    if (atMs > endMs) endMs = atMs;

    const verb = asString(data._event) ?? '';
    const base = { atMs, eventCounter: event.counter, event };

    if (verb === 'v2_playbook_on_play_start') {
      const play = asRecord(data.play);
      const name = asString(play?.name) ?? event.play ?? '';
      if (name) playName = name;
      streamLines.push({ ...base, kind: 'play', label: 'PLAY', host: '', message: name });
      continue;
    }

    if (verb === 'v2_playbook_on_task_start' || verb === 'v2_playbook_on_handler_task_start') {
      const task = ensureTask(asRecord(data.task), atMs);
      if (task) {
        const where = task.path ? `  (${shortPath(task.path)})` : '';
        streamLines.push({
          ...base,
          kind: 'task',
          label: 'TASK',
          host: '',
          message: `${task.name}${where}`,
          taskId: task.id,
        });
        continue;
      }
    }

    if (verb === 'v2_playbook_on_stats') {
      const stats = asRecord(data.stats);
      if (stats) {
        const parsed: Record<string, RecapStats> = {};
        for (const [host, raw] of Object.entries(stats)) {
          const hostStats = asRecord(raw);
          if (!hostStats) continue;
          parsed[host] = recapStats(hostStats);
          hostSet.add(host);
        }
        statsByHost = parsed;
        streamLines.push({ ...base, kind: 'recap', label: 'RECAP', host: '', message: recapMessage(parsed) });
        continue;
      }
    }

    if (verb.startsWith(RESULT_EVENT_PREFIX)) {
      const hosts = asRecord(data.hosts);
      const task = ensureTask(asRecord(data.task), atMs);
      const entries = hosts ? Object.entries(hosts) : [];
      if (task && entries.length > 0) {
        let lead: { host: string; status: RunStatus; result: ModuleResult } | undefined;
        for (const [host, rawResult] of entries) {
          const result = (asRecord(rawResult) ?? {}) as ModuleResult;
          const status = deriveStatus(result, verb);
          hostSet.add(host);
          if (atMs > task.endMs) task.endMs = atMs;

          let byTask = results.get(host);
          if (!byTask) {
            byTask = new Map<string, HostResult>();
            results.set(host, byTask);
          }
          byTask.set(task.id, { status, atMs, eventCounter: event.counter, result });

          // Recap semantics: a changed result is counted as both ok and changed.
          if (status === 'failed') derivedTotals.failed++;
          else if (status === 'unreachable') derivedTotals.unreachable++;
          else if (status === 'skipped') derivedTotals.skipped++;
          else {
            derivedTotals.ok++;
            if (status === 'changed') derivedTotals.changed++;
          }

          lead ??= { host, status, result };
        }
        if (lead) {
          streamLines.push({
            ...base,
            kind: 'result',
            label: lead.status,
            host: lead.host,
            message: summarizeResult(lead.result, lead.status),
            status: lead.status,
            taskId: task.id,
          });
        }
        continue;
      }
    }

    streamLines.push({ ...base, kind: 'raw', label: 'raw', host: event.host ?? '', message: rawMessage(event, data) });
  }

  const totals: Record<RunStatus, number> = statsByHost
    ? Object.values(statsByHost).reduce<Record<RunStatus, number>>(
        (acc, s) => ({
          ok: acc.ok + s.ok,
          changed: acc.changed + s.changed,
          failed: acc.failed + s.failures,
          unreachable: acc.unreachable + s.unreachable,
          skipped: acc.skipped + s.skipped,
        }),
        { ok: 0, changed: 0, failed: 0, unreachable: 0, skipped: 0 },
      )
    : derivedTotals;

  return {
    playName,
    startMs: Number.isFinite(startMs) ? startMs : 0,
    endMs: Number.isFinite(endMs) ? endMs : 0,
    tasks,
    hosts: [...hostSet].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
    results,
    totals,
    statsByHost,
    streamLines,
  };
}
