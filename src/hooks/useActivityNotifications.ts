// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// A genuine dependency-based effect: raise a toast when the shared activity query yields rows this
// hook has not seen. (`**/hooks/**` is exempt from the useEffect import ban - see eslint.config.js.)
import { useEffect, useRef } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useRecentActivity } from '@/pages/Dashboard/useDashboardData';
import { formatActivityNotification } from '@/utils/activityFormat';

const RECENT_ACTIVITY_LIMIT = 5;

/**
 * Raises a toast for each activity that appears after the hook mounts.
 *
 * The rows come from the same React Query entry the dashboard's Recent Activity card reads, so the
 * two share one request instead of each running their own timer against the same endpoint. The
 * first response only seeds the seen-set: everything already in the feed at mount is history, not
 * news.
 */
export function useActivityNotifications(enabled: boolean = true, pollInterval: number = 30000) {
  const { showNotification } = useNotifications();
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef<boolean>(false);

  useMountEffect(() => {
    if (!enabled) return;
    if ('Notification' in window && window.Notification.permission === 'default') {
      void window.Notification.requestPermission().catch(err => {
        console.warn('Failed to request notification permission:', err);
      });
    }
  });

  const { data } = useRecentActivity(RECENT_ACTIVITY_LIMIT, {
    enabled,
    refetchInterval: pollInterval,
  });

  useEffect(() => {
    if (!enabled || !data || data.length === 0) return;

    if (!isInitializedRef.current) {
      data.forEach(activity => seenActivityIdsRef.current.add(activity.id));
      isInitializedRef.current = true;
      return;
    }

    const fresh = data.filter(activity => !seenActivityIdsRef.current.has(activity.id));
    // Oldest first, so a burst reads chronologically.
    [...fresh].reverse().forEach(activity => {
      const { title, message, type } = formatActivityNotification(activity.attributes);
      showNotification(title, message, type, 5000);
      seenActivityIdsRef.current.add(activity.id);
    });

    // Bound the seen-set so a long-lived tab does not grow one entry per activity forever.
    if (seenActivityIdsRef.current.size > 100) {
      seenActivityIdsRef.current = new Set(Array.from(seenActivityIdsRef.current).slice(-50));
    }
  }, [enabled, data, showNotification]);
}
