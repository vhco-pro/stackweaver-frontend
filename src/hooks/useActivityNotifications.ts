// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useRef } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { activitiesApi } from '@/api/client';
import { formatActivityNotification } from '@/utils/activityFormat';

export function useActivityNotifications(enabled: boolean = true, pollInterval: number = 30000) {
  const { showNotification } = useNotifications();
  const lastActivityIdRef = useRef<string | null>(null);
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    // Request notification permission on mount
    if ('Notification' in window && window.Notification.permission === 'default') {
      void window.Notification.requestPermission().catch(err => {
        console.warn('Failed to request notification permission:', err);
      });
    }

    const pollForNewActivities = async () => {
      try {
        // Fetch more activities to catch any we might have missed
        const response = await activitiesApi.getRecent({ limit: 5 });
        const activities = response.data || [];
        
        if (activities.length === 0) return;

        // On first poll, just initialize the seen set
        if (!isInitializedRef.current) {
          activities.forEach(activity => {
            seenActivityIdsRef.current.add(activity.id);
          });
          if (activities.length > 0) {
            lastActivityIdRef.current = activities[0].id;
          }
          isInitializedRef.current = true;
          return;
        }

        // Check for new activities (ones we haven't seen before)
        const newActivities = activities.filter(
          activity => !seenActivityIdsRef.current.has(activity.id)
        );

        if (newActivities.length > 0) {
          console.log(`[ActivityNotifications] Found ${newActivities.length} new activity/activities`);
        }

        // Process new activities in reverse order (oldest first) to show them chronologically
        newActivities.reverse().forEach(activity => {
          const attrs = activity.attributes;

          // Format notification message (pure mapping — see utils/activityFormat.ts)
          const { title, message, type } = formatActivityNotification(attrs);

          // Show notification
          console.log(`[ActivityNotifications] Showing notification: ${title} - ${message}`);
          showNotification(title, message, type, 5000);
          
          // Mark as seen
          seenActivityIdsRef.current.add(activity.id);
        });

        // Update last seen activity ID
        if (activities.length > 0) {
          lastActivityIdRef.current = activities[0].id;
        }

        // Clean up old seen IDs to prevent memory leak (keep last 100)
        if (seenActivityIdsRef.current.size > 100) {
          const idsArray = Array.from(seenActivityIdsRef.current);
          const toKeep = new Set(idsArray.slice(-50));
          seenActivityIdsRef.current = toKeep;
        }
      } catch (err: unknown) {
        // Silently fail - don't spam errors
        // Only log if it's not a 404 (endpoint might not exist yet) or 401 (not authenticated)
        const status = (err as { status?: number })?.status;
        if (status !== 404 && status !== 401) {
          console.error('Failed to poll for activities:', err);
        }
      }
    };

    // Poll immediately, then at intervals
    void pollForNewActivities();
    pollIntervalRef.current = setInterval(() => { void pollForNewActivities(); }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [enabled, pollInterval, showNotification]);
}

