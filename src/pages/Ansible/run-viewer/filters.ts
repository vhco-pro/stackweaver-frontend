// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * One filter state, shared by every pivot.
 *
 * Statuses are OR-ed within themselves and AND-ed with the search query, so
 * "failed or unreachable, mentioning timeout" is one expression. The same
 * predicate decides whether a matrix cell dims and whether a stream line
 * shows, which is what keeps the three views talking about the same run.
 */

import type { HostResult, ModuleResult, RunStatus, StreamLine, TaskMeta } from './model';

export interface RunFilters {
  statuses: Set<RunStatus>;
  /** Already trimmed and lower-cased - build it with `normalizeQuery`. */
  query: string;
}

export const NO_FILTERS: RunFilters = { statuses: new Set<RunStatus>(), query: '' };

export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isFiltering(filters: RunFilters): boolean {
  return filters.statuses.size > 0 || filters.query.length > 0;
}

/**
 * Search covers the whole module result, not just the fields we chose to
 * render, so "timed out" finds the host whose message only appears deep in a
 * module's return value. Serializing is not free, so each result's text is
 * built once and kept for as long as the result object lives.
 */
const searchTextCache = new WeakMap<object, string>();

function cachedText(key: object, build: () => string): string {
  const cached = searchTextCache.get(key);
  if (cached !== undefined) return cached;
  let text: string;
  try {
    text = build().toLowerCase();
  } catch {
    text = '';
  }
  searchTextCache.set(key, text);
  return text;
}

export function resultSearchText(result: ModuleResult): string {
  return cachedText(result, () => JSON.stringify(result) ?? '');
}

export function streamLineSearchText(line: StreamLine): string {
  return cachedText(line, () => `${line.label} ${line.host} ${line.message} ${JSON.stringify(line.event.event_data) ?? ''}`);
}

/** Does this matrix cell survive the current filters? */
export function cellMatches(filters: RunFilters, host: string, task: TaskMeta, result: HostResult): boolean {
  if (filters.statuses.size > 0 && !filters.statuses.has(result.status)) return false;
  if (!filters.query) return true;
  return (
    host.toLowerCase().includes(filters.query) ||
    task.name.toLowerCase().includes(filters.query) ||
    resultSearchText(result.result).includes(filters.query)
  );
}

/**
 * Does this stream line survive? A status filter is a statement about host
 * results, so with one active the play/task/recap/raw lines step aside.
 */
export function streamLineMatches(filters: RunFilters, line: StreamLine): boolean {
  if (filters.statuses.size > 0 && (!line.status || !filters.statuses.has(line.status))) return false;
  if (!filters.query) return true;
  return streamLineSearchText(line).includes(filters.query);
}
