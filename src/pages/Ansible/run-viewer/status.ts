// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Visual vocabulary for the run viewer: status colours and glyphs, plus the
 * handful of formatters every pivot shares.
 *
 * Colour never carries meaning on its own: every place a status colour appears,
 * its glyph and label appear with it. The light/dark pairs below were contrast
 * validated against the app's white and slate-950 surfaces.
 */

// The status vocabulary lives in components/ansible/hostStatus.ts so the job
// list, template history, host facts and this viewer all say the same thing.
// Re-exported here because every run-viewer module already imports from this
// file, and a status is a status.
export { HOST_STATUS_META as STATUS_META, DID_NOT_RUN_GLYPH } from '@/components/ansible/hostStatus';
export type { HostStatusMeta as StatusMeta } from '@/components/ansible/hostStatus';

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

