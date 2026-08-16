// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Typed core of the Fleet Run Viewer.
 *
 * The Ansible runner replaces Ansible's stdout with the `ansible.posix.jsonl`
 * callback, so every stored job event is one JSON document describing a play
 * start, a task start, a single host result, or the final recap. `RunModel` is
 * the host x task pivot over that stream - see `adapter.ts` for how it is built.
 */

import type { AnsibleJobEvent } from '@/api/ansible';

/** Per-host outcome of one task. */
export type RunStatus = 'ok' | 'changed' | 'failed' | 'unreachable' | 'skipped';

export const RUN_STATUSES: readonly RunStatus[] = ['ok', 'changed', 'failed', 'unreachable', 'skipped'];

/**
 * How bad a status is when collapsing many results into one (a host's worst
 * result, a task's aggregate). Note this is a different question than deriving
 * a single result's status - see `deriveStatus` - where `unreachable` wins
 * because it is the strongest signal on that one result.
 */
export const STATUS_SEVERITY: Record<RunStatus, number> = {
  failed: 5,
  unreachable: 4,
  changed: 3,
  ok: 2,
  skipped: 1,
};

/**
 * A module result as emitted inside `event_data.hosts[<host>]`: the module's
 * own return value verbatim, plus `action`. Typed where we rely on a field,
 * open everywhere else - consumers narrow the rest with type guards.
 */
export interface ModuleResult {
  action?: string;
  msg?: string;
  rc?: number;
  cmd?: string | string[];
  stdout?: string;
  stdout_lines?: string[];
  stderr?: string;
  stderr_lines?: string[];
  diff?: unknown;
  ansible_facts?: Record<string, unknown>;
  skip_reason?: string;
  attempts?: number;
  changed?: boolean;
  failed?: boolean;
  skipped?: boolean;
  unreachable?: boolean;
  warnings?: unknown;
  results?: unknown;
  [key: string]: unknown;
}

/** One task column of the matrix. */
export interface TaskMeta {
  /** `task.id` from the callback (a UUID), or `name:<task name>` when the runner omitted one. */
  id: string;
  name: string;
  /** `task.path`, e.g. `/runner/project/roles/app/tasks/main.yml:11`. */
  path: string;
  /** Position in playbook order, matching this task's index in `RunModel.tasks`. */
  index: number;
  startMs: number;
  endMs: number;
}

/** One cell of the matrix: what one task did on one host. */
export interface HostResult {
  status: RunStatus;
  atMs: number;
  eventCounter: number;
  result: ModuleResult;
  /**
   * The job this result came from. Only set on a merged sliced run, where the
   * cells of one grid come from several jobs - a reader opening one needs to
   * know which job to ask for the full event.
   */
  jobId?: string;
}

export type StreamLineKind = 'play' | 'task' | 'result' | 'recap' | 'raw';

/**
 * One chronological line of the universal stream lane. Every event produces
 * exactly one line - events the adapter cannot classify become `raw` lines so
 * no runner output is ever dropped.
 */
export interface StreamLine {
  kind: StreamLineKind;
  atMs: number;
  eventCounter: number;
  /** Badge text: `PLAY`, `TASK`, `RECAP`, `raw`, or the result status. */
  label: string;
  /** Host this line belongs to, `''` for lines that are not host-scoped. */
  host: string;
  message: string;
  /** Set for `result` lines only. */
  status?: RunStatus;
  taskId?: string;
  /** The event this line was synthesized from, for raw-JSON expansion. */
  event: AnsibleJobEvent;
}

/** Per-host counters from `v2_playbook_on_stats` (Ansible's PLAY RECAP). */
export interface RecapStats {
  ok: number;
  changed: number;
  failures: number;
  skipped: number;
  unreachable: number;
  rescued: number;
  ignored: number;
}

export interface RunModel {
  playName: string;
  /** Earliest and latest event timestamp; both 0 when there are no events. */
  startMs: number;
  endMs: number;
  /** Tasks in playbook order. */
  tasks: TaskMeta[];
  /** Every host seen, sorted ascending. */
  hosts: string[];
  /** host -> taskId -> result. A missing entry means the task did not run there. */
  results: Map<string, Map<string, HostResult>>;
  /**
   * Fleet totals, using Ansible recap semantics: `changed` results are counted
   * in both `ok` and `changed`. Taken from the recap event when the job has
   * one, derived by counting results otherwise (running jobs).
   */
  totals: Record<RunStatus, number>;
  /** Present only once the job emitted its recap. */
  statsByHost?: Record<string, RecapStats>;
  streamLines: StreamLine[];
}

/** The result of `task` on `host`, or undefined when it did not run there. */
export function resultFor(model: RunModel, host: string, taskId: string): HostResult | undefined {
  return model.results.get(host)?.get(taskId);
}

/**
 * The worst status across everything that ran on `host`, or undefined when
 * nothing ran there.
 */
export function hostWorstStatus(model: RunModel, host: string): RunStatus | undefined {
  let worst: RunStatus | undefined;
  const byTask = model.results.get(host);
  if (!byTask) return undefined;
  for (const result of byTask.values()) {
    if (!worst || STATUS_SEVERITY[result.status] > STATUS_SEVERITY[worst]) {
      worst = result.status;
    }
  }
  return worst;
}

/** Per-status host counts for one task column. */
export function taskAggregate(model: RunModel, taskId: string): Record<RunStatus, number> {
  const counts: Record<RunStatus, number> = { ok: 0, changed: 0, failed: 0, unreachable: 0, skipped: 0 };
  for (const host of model.hosts) {
    const result = model.results.get(host)?.get(taskId);
    if (result) counts[result.status]++;
  }
  return counts;
}

/** What the detail drawer is currently showing. */
export type DrawerTarget =
  | { kind: 'cell'; host: string; taskId: string }
  | { kind: 'host'; host: string }
  | { kind: 'task'; taskId: string };

/** How a drawer view names itself - the Back control uses it to say where it goes. */
export function drawerTargetLabel(model: RunModel, target: DrawerTarget): string {
  if (target.kind === 'host') return target.host;
  const task = model.tasks.find((candidate) => candidate.id === target.taskId);
  if (target.kind === 'task') return task?.name ?? 'task';
  return `${target.host} · ${task?.name ?? 'result'}`;
}
