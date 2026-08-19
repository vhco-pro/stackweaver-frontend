// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import {
  activitiesApi,
  dashboardApi,
  type Activity,
  type DashboardOperations,
  type DashboardStats,
} from '@/api/client';

/**
 * Data layer for the dashboard.
 *
 * Two requests back the whole page, both cross-organization: a roll-up of counts and a list of what
 * is executing right now. Neither takes an organization, because the page exists to tell you
 * *which* organization needs you - asking it about one organization at a time would mean already
 * knowing the answer.
 *
 * They are separate queries rather than one because they have different lifetimes: the counts are
 * fine for a minute, the live list is not.
 */

/** Cross-organization counts, plus the per-organization breakdown behind the attention list. */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => (await dashboardApi.getStats()).data,
    staleTime: 60_000,
    // Counts change when work finishes, so a dashboard left open should notice - just not urgently.
    refetchInterval: 60_000,
  });
}

/**
 * Runs and jobs executing right now, across every organization.
 *
 * Polls every 5 seconds while anything is running and every 30 when the estate is idle: fast enough
 * to feel live, slow enough that an abandoned tab is not a load generator, and still ticking so
 * work started elsewhere appears without a manual refresh.
 */
export function useDashboardOperations() {
  return useQuery<DashboardOperations>({
    queryKey: ['dashboard', 'operations'],
    queryFn: () => dashboardApi.getOperations(),
    refetchInterval: query => ((query.state.data?.executions.length ?? 0) > 0 ? 5_000 : 30_000),
  });
}

/**
 * The signed-in user's most recent activity, across every organization they belong to.
 *
 * Shares its key with the activity-notification poller so the two do not each fetch the same five
 * rows on their own schedule.
 */
export function useRecentActivity(
  limit = 5,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  return useQuery<Activity[]>({
    queryKey: ['activities', 'recent', limit],
    queryFn: async () => (await activitiesApi.getRecent({ limit })).data || [],
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
    ...(options?.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}
