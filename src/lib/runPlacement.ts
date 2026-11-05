// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Shared helpers of the run placement controls (#933, D0, D15).

import type { RunImage } from '@/api/runPlacement';
import type { BindingOption } from '@/hooks/useRunPlacement';

/** The select value that means "inherit": an empty attribute on save. */
export const INHERIT = '__inherit__';

/** The name a run image is shown by, or the platform image for none. */
export function runImageLabel(images: RunImage[] | undefined, id: string | null): string {
  if (!id) return 'the platform image';
  return images?.find(i => i.id === id)?.name ?? 'a run image';
}

/** The name a binding is shown by, or the platform identity for none. */
export function bindingLabel(options: BindingOption[] | undefined, id: string | null): string {
  if (!id) return 'the platform identity';
  const o = options?.find(b => b.binding.id === id);
  return o ? `${o.binding.name} (${o.poolName})` : 'an identity binding';
}

/** A duration in seconds, written the short way (90 minutes is "1h 30m"). */
export function formatSeconds(seconds: number): string {
  if (seconds <= 0) return 'none';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : '', s ? `${s}s` : ''].filter(Boolean).join(' ');
}

/** A byte count in the largest binary unit that keeps it whole or near it. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${units[u]}`;
}

/** The annotations of a form, one key=value per line; lines without a key are skipped. */
export function parseAnnotations(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    if (key) out[key] = line.slice(i + 1).trim();
  }
  return out;
}

/**
 * Why the annotations text cannot be saved as written, or undefined: a non-blank line that is not
 * key=value with a key would be dropped by parseAnnotations, so the form names it instead.
 */
export function annotationProblem(text: string): string | undefined {
  const lines = text.split('\n');
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (line === '') continue;
    const i = line.indexOf('=');
    if (i <= 0 || line.slice(0, i).trim() === '') return `Annotation line ${n + 1} is not key=value: ${line}`;
  }
  return undefined;
}

/** Annotations as the form shows them, one key=value per line. */
export function formatAnnotations(annotations: Record<string, string>): string {
  return Object.entries(annotations).map(([k, v]) => `${k}=${v}`).join('\n');
}

/** A size entered in GiB as bytes (empty is 0, the platform default), or why it cannot be saved. */
export function parseGiB(text: string): { bytes: number; error?: undefined } | { bytes?: undefined; error: string } {
  const t = text.trim();
  if (t === '') return { bytes: 0 };
  const n = Number(t);
  if (!Number.isFinite(n)) return { error: 'Enter a number of GiB.' };
  if (n < 0) return { error: 'A size cannot be negative. Leave the field empty for the platform default.' };
  return { bytes: Math.round(n * 1024 ** 3) };
}

/**
 * The bindings an object may select: those of the pool it runs on when that pool is chosen on the
 * object itself, since a pool only offers its own bindings (the API refuses any other); every
 * binding while the pool is inherited.
 */
export function bindingsForPool<T extends { binding: { agent_pool_id: string } }>(options: T[], poolId: string | undefined): T[] {
  return poolId ? options.filter(o => o.binding.agent_pool_id === poolId) : options;
}
