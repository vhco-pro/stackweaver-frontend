// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Visual vocabulary for the run viewer: status colours and glyphs, plus the
 * handful of formatters every pivot shares.
 *
 * Colour never carries meaning on its own: every place a status colour appears,
 * its glyph and label appear with it. The light/dark pairs below were contrast
 * validated against the app's white and slate-950 surfaces.
 */

import type { RunStatus } from './model';

export interface StatusMeta {
  /** Distinct shape so status reads without colour. */
  glyph: string;
  label: string;
  /** Foreground colour for the glyph and label. */
  text: string;
  /** Tinted background + border for a matrix cell. */
  cell: string;
  /** Solid fill, for the host row dot. */
  dot: string;
}

export const STATUS_META: Record<RunStatus, StatusMeta> = {
  ok: {
    glyph: '✓',
    label: 'ok',
    text: 'text-green-600 dark:text-emerald-500',
    cell: 'bg-green-600/10 text-green-600 border-green-600/25 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    dot: 'bg-green-600 dark:bg-emerald-500',
  },
  changed: {
    glyph: '~',
    label: 'changed',
    text: 'text-amber-600 dark:text-amber-500',
    cell: 'bg-amber-600/10 text-amber-700 border-amber-600/25 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    dot: 'bg-amber-600 dark:bg-amber-500',
  },
  failed: {
    glyph: '✕',
    label: 'failed',
    text: 'text-red-600 dark:text-red-500',
    cell: 'bg-red-600/10 text-red-600 border-red-600/25 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
    dot: 'bg-red-600 dark:bg-red-500',
  },
  unreachable: {
    glyph: '⚡',
    label: 'unreachable',
    text: 'text-fuchsia-800 dark:text-fuchsia-500',
    cell: 'bg-fuchsia-800/10 text-fuchsia-800 border-fuchsia-800/25 dark:bg-fuchsia-500/15 dark:text-fuchsia-400 dark:border-fuchsia-500/30',
    dot: 'bg-fuchsia-800 dark:bg-fuchsia-500',
  },
  skipped: {
    glyph: '⊘',
    label: 'skipped',
    text: 'text-cyan-600 dark:text-sky-500',
    cell: 'bg-cyan-600/10 text-cyan-700 border-cyan-600/25 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
    dot: 'bg-cyan-600 dark:bg-sky-500',
  },
};

/** Shown where a task produced no result for a host. */
export const DID_NOT_RUN_GLYPH = '·';

/** `+12.3s` - an offset from the start of the run, as used by the stream and drawer. */
export function formatOffset(atMs: number, startMs: number): string {
  return `+${((atMs - startMs) / 1000).toFixed(1)}s`;
}

/** `7.4s` under ten seconds, `24s` above - compact enough for a column header. */
export function formatDuration(ms: number): string {
  const safe = Math.max(ms, 0);
  return safe >= 10_000 ? `${(safe / 1000).toFixed(0)}s` : `${(safe / 1000).toFixed(1)}s`;
}

/** Drop the runner's checkout prefix so paths read as they do in the repository. */
export function shortPath(path: string): string {
  return path.replace('/runner/project/', '');
}

/** Terminal colour codes are noise in a rendered pane. */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Coerce a module-result field that is usually a string into displayable text. */
export function asText(value: unknown): string | undefined {
  if (typeof value === 'string') return value ? stripAnsi(value) : undefined;
  if (Array.isArray(value)) {
    const lines = value.filter((item): item is string => typeof item === 'string');
    return lines.length > 0 ? stripAnsi(lines.join('\n')) : undefined;
  }
  return undefined;
}

