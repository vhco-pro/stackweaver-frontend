// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Multi-select and bulk-action helpers for the Runners settings page. Pure functions so the
// selection rules and the partial-failure accounting are unit-testable without rendering the page.

export type HeaderState = 'none' | 'some' | 'all';

// visibleSelection keeps only selected ids that are still in the list. The list polls, so a runner
// can disappear (deleted elsewhere) while it is selected; acting on it would be acting on a ghost.
export function visibleSelection(selected: ReadonlySet<string>, ids: readonly string[]): string[] {
  return ids.filter((id) => selected.has(id));
}

export function headerState(selected: ReadonlySet<string>, ids: readonly string[]): HeaderState {
  const count = visibleSelection(selected, ids).length;
  if (count === 0) return 'none';
  return count === ids.length ? 'all' : 'some';
}

export function toggleOne(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// toggleAll selects every visible runner, or clears the selection when all are already selected.
export function toggleAll(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  return headerState(selected, ids) === 'all' ? new Set() : new Set(ids);
}

// normalizeLabel applies the same rule as the single-runner label editor.
export function normalizeLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

export function withLabel(labels: readonly string[], label: string): string[] {
  return labels.includes(label) ? [...labels] : [...labels, label];
}

export function withoutLabel(labels: readonly string[], label: string): string[] {
  return labels.filter((l) => l !== label);
}

export interface BulkResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

// runBulk applies op to every id and reports which succeeded and which failed, so one failing
// runner neither aborts the rest nor hides that it failed.
export async function runBulk(ids: readonly string[], op: (id: string) => Promise<unknown>): Promise<BulkResult> {
  const settled = await Promise.allSettled(ids.map((id) => op(id)));
  const result: BulkResult = { succeeded: [], failed: [] };
  settled.forEach((s, i) => {
    const id = ids[i];
    if (s.status === 'fulfilled') {
      result.succeeded.push(id);
    } else {
      const reason: unknown = s.reason;
      result.failed.push({ id, error: reason instanceof Error ? reason.message : String(reason) });
    }
  });
  return result;
}
