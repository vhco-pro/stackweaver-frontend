// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type Analytics } from '@/api/client';

/**
 * Bounded presets only. The page previously offered "All time", which resolved to `new Date(0)` and
 * asked the server for every run the install had ever recorded; a dashboard has no use for an
 * unbounded window, so the option is gone rather than merely discouraged.
 */
export type TimeRange = '7d' | '30d' | '90d' | 'mtd';

export const TIME_RANGES: { value: TimeRange; label: string; short: string }[] = [
  { value: '7d', label: 'Last 7 days', short: '7d' },
  { value: '30d', label: 'Last 30 days', short: '30d' },
  { value: '90d', label: 'Last 90 days', short: '90d' },
  { value: 'mtd', label: 'Month to date', short: 'MTD' },
];

export interface ResolvedWindow {
  since: Date;
  until: Date;
  /** Human phrase for the comparison shown beside the KPI deltas. */
  comparisonLabel: string;
}

export function resolveWindow(range: TimeRange, now: Date): ResolvedWindow {
  const until = now;
  const since =
    range === '7d'
      ? addDays(until, -7)
      : range === '90d'
        ? addDays(until, -90)
        : range === 'mtd'
          ? new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), 1))
          : addDays(until, -30);

  // The comparison is always the equal-length window immediately before this one - that is what the
  // API computes - so the label is derived from the window rather than written per preset. Month to
  // date used to claim "vs same span last month", which is a different period entirely and made
  // every MTD delta describe a baseline the server never used.
  const days = Math.max(1, Math.round((until.getTime() - since.getTime()) / 86_400_000));
  return { since, until, comparisonLabel: `vs previous ${days} days` };
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Loads the whole page in one request.
 *
 * The window is snapped to the current minute before it reaches the query key: using a raw
 * `new Date()` would mint a new key on every render and refetch forever.
 */
export function useAnalytics(orgName: string | undefined, range: TimeRange) {
  const window = useMemo(() => {
    const now = new Date();
    now.setUTCSeconds(0, 0);
    return resolveWindow(range, now);
  }, [range]);

  const query = useQuery<Analytics>({
    queryKey: ['analytics', orgName, range, window.since.toISOString()],
    queryFn: () => analyticsApi.getForOrganization(orgName!, window.since, window.until),
    enabled: Boolean(orgName),
    staleTime: 60_000,
  });

  return { ...query, window };
}
