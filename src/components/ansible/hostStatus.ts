// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The one vocabulary for "what happened to a host" across the Ansible views.
 *
 * Every surface that reports per-host outcomes - the job list, a template's run
 * history, a job's host facts, and the run viewer's matrix, stream, timeline
 * and drawer - reads its icon, colour and label from here. Before this, three
 * pages hand-rolled the same row of icons and the run viewer used a fourth set
 * of its own, so the same outcome looked different depending on where you saw
 * it.
 *
 * The icons are deliberately the Ansible ones, not Terraform's: a run status
 * (`components/runs/StatusBadge.tsx`) and a host result are different questions
 * and should not share a glyph.
 *
 * Colours pair with a distinct icon everywhere, never colour alone, and both
 * palettes were contrast validated against the app's white and slate-950
 * surfaces.
 */

import { AlertCircle, Ban, CheckCircle, CircleDot, EyeOff, RefreshCw, Zap, type LucideIcon } from 'lucide-react';

/** Per-host outcome of one task, plus the two recap-only counters. */
export type HostStatus = 'ok' | 'changed' | 'failed' | 'unreachable' | 'skipped' | 'rescued' | 'ignored';

/** The five a task result can actually be; rescued/ignored only appear in the recap. */
export const HOST_RESULT_STATUSES = ['ok', 'changed', 'failed', 'unreachable', 'skipped'] as const;

/** Every status, in the order the summary rows read them out. */
export const ANSIBLE_HOST_STATUSES: readonly HostStatus[] = [
  'ok',
  'changed',
  'failed',
  'unreachable',
  'rescued',
  'skipped',
  'ignored',
];

/** The per-status counters a finished job carries, by status. */
export interface HostStatusCounts {
  hosts_ok: number;
  hosts_changed: number;
  hosts_failed: number;
  hosts_unreachable: number;
  hosts_skipped: number;
  hosts_rescued?: number;
  hosts_ignored?: number;
}

/** Read one status's count off a job, so callers never re-map the field names. */
export function hostStatusCount(job: HostStatusCounts, status: HostStatus): number {
  switch (status) {
    case 'ok':
      return job.hosts_ok;
    case 'changed':
      return job.hosts_changed;
    case 'failed':
      return job.hosts_failed;
    case 'unreachable':
      return job.hosts_unreachable;
    case 'skipped':
      return job.hosts_skipped;
    case 'rescued':
      return job.hosts_rescued ?? 0;
    case 'ignored':
      return job.hosts_ignored ?? 0;
  }
}

export interface HostStatusMeta {
  label: string;
  Icon: LucideIcon;
  /** Foreground colour for the icon and its count. */
  text: string;
  /** Tinted background + border + text, for a chip or a matrix cell. */
  cell: string;
  /** Solid fill, for a status dot. */
  dot: string;
}

export const HOST_STATUS_META: Record<HostStatus, HostStatusMeta> = {
  ok: {
    label: 'ok',
    Icon: CheckCircle,
    text: 'text-green-600 dark:text-emerald-500',
    cell: 'bg-green-600/10 text-green-600 border-green-600/25 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    dot: 'bg-green-600 dark:bg-emerald-500',
  },
  changed: {
    label: 'changed',
    Icon: RefreshCw,
    text: 'text-amber-600 dark:text-amber-500',
    cell: 'bg-amber-600/10 text-amber-700 border-amber-600/25 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    dot: 'bg-amber-600 dark:bg-amber-500',
  },
  failed: {
    label: 'failed',
    Icon: AlertCircle,
    text: 'text-red-600 dark:text-red-500',
    cell: 'bg-red-600/10 text-red-600 border-red-600/25 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
    dot: 'bg-red-600 dark:bg-red-500',
  },
  unreachable: {
    label: 'unreachable',
    Icon: Zap,
    text: 'text-fuchsia-800 dark:text-fuchsia-500',
    cell: 'bg-fuchsia-800/10 text-fuchsia-800 border-fuchsia-800/25 dark:bg-fuchsia-500/15 dark:text-fuchsia-400 dark:border-fuchsia-500/30',
    dot: 'bg-fuchsia-800 dark:bg-fuchsia-500',
  },
  skipped: {
    label: 'skipped',
    Icon: Ban,
    text: 'text-cyan-600 dark:text-sky-500',
    cell: 'bg-cyan-600/10 text-cyan-700 border-cyan-600/25 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
    dot: 'bg-cyan-600 dark:bg-sky-500',
  },
  rescued: {
    label: 'rescued',
    Icon: CircleDot,
    text: 'text-purple-600 dark:text-purple-400',
    cell: 'bg-purple-600/10 text-purple-600 border-purple-600/25 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
    dot: 'bg-purple-600 dark:bg-purple-400',
  },
  ignored: {
    label: 'ignored',
    Icon: EyeOff,
    text: 'text-slate-500 dark:text-slate-400',
    cell: 'bg-slate-500/10 text-slate-600 border-slate-500/25 dark:bg-slate-400/15 dark:text-slate-300 dark:border-slate-400/30',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
};

/**
 * How bad a status is when collapsing many into one (a host's worst result, a
 * task's aggregate). Deriving a *single* result's status is a different
 * question - see the run viewer's `deriveStatus`, where `unreachable` wins.
 */
export const HOST_STATUS_SEVERITY: Record<HostStatus, number> = {
  failed: 6,
  unreachable: 5,
  rescued: 4,
  changed: 3,
  ok: 2,
  skipped: 1,
  ignored: 0,
};

/**
 * Shown where a task never reached a host at all - not a status Ansible
 * reports, so it stays a quiet dot rather than borrowing an icon that would
 * imply a decision was made.
 */
export const DID_NOT_RUN_GLYPH = '·';
