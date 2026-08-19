// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { AnalyticsCard, EmptyState, ErrorState } from '@/components/ui/analytics-card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Skeleton } from '@/components/ui/skeleton';
import { formatActivityDescription } from '@/utils/activityFormat';
import { useRecentActivity } from './useDashboardData';

/** The signed-in user's latest actions, across every organization they belong to. */
export function RecentActivityCard() {
  return (
    <CollapsibleSection
      id="recent-activity"
      title="Recent activity"
      hint="Your latest actions across every organization"
      action={
        <Link
          to="/activities"
          className="whitespace-nowrap text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        >
          View all →
        </Link>
      }
    >
      {/* The query lives in the body, so folding the section away stops it. */}
      <RecentActivityList />
    </CollapsibleSection>
  );
}

function RecentActivityList() {
  const { data, isLoading, isError, refetch } = useRecentActivity();
  const activities = data ?? [];

  return (
    <AnalyticsCard>
        {isError ? (
          <ErrorState
            title="Could not load your activity"
            message="The activity feed did not load."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <EmptyState message="No recent activity. Create a project or start a run to see it here." />
        ) : (
          <ul className="space-y-2">
            {activities.map(activity => (
              <li
                key={activity.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 p-3"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-purple-500 to-violet-500"
                  aria-hidden="true"
                >
                  <Zap className="h-4 w-4 text-white" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">
                    {formatActivityDescription(activity.attributes)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(activity.attributes.created_at).toLocaleString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
    </AnalyticsCard>
  );
}
