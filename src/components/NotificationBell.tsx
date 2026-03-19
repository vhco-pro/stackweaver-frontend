// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { activitiesApi, type Activity } from '@/api/client';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function NotificationBell() {
  const [lastSeenId, setLastSeenId] = useState<string | null>(() => {
    return localStorage.getItem('lastSeenActivityId');
  });

  const { data: recentActivities = [], isLoading: loading, refetch: refetchActivities } = useQuery({
    queryKey: ['recent-activities', lastSeenId],
    queryFn: async () => {
      const response = await activitiesApi.getRecent({ limit: 10 });
      return response.data || [];
    },
    refetchInterval: 30000,
  });

  const unseenCount = useMemo(() => {
    if (recentActivities.length === 0) return 0;
    const currentLastSeenId = localStorage.getItem('lastSeenActivityId');
    if (!currentLastSeenId) return recentActivities.length;
    const lastSeenIndex = recentActivities.findIndex(a => a.id === currentLastSeenId);
    return lastSeenIndex === -1 ? recentActivities.length : lastSeenIndex;
  }, [recentActivities, lastSeenId]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      void refetchActivities();
    } else if (recentActivities.length > 0) {
      // Mark all as seen when dropdown closes
      const latestId = recentActivities[0].id;
      const currentLastSeen = localStorage.getItem('lastSeenActivityId');
      if (latestId !== currentLastSeen) {
        setLastSeenId(latestId);
        localStorage.setItem('lastSeenActivityId', latestId);
      }
    }
  };

  const formatActivityDescription = (activity: Activity): string => {
    const attrs = activity.attributes;
    const details = attrs.details || {};
    const resourceNameRaw = details.resource_name || attrs.resource_type;
    const resourceNameStr = typeof resourceNameRaw === 'string' 
      ? resourceNameRaw 
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      : (resourceNameRaw != null && typeof resourceNameRaw !== 'object' ? String(resourceNameRaw) : '');
    const operationRaw = details.operation || attrs.action;
    const operationStr = typeof operationRaw === 'string'
      ? operationRaw
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      : (operationRaw != null && typeof operationRaw !== 'object' ? String(operationRaw) : '');
    const statusRaw = details.status || 'started';
    const statusStr = typeof statusRaw === 'string'
      ? statusRaw
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      : (statusRaw != null && typeof statusRaw !== 'object' ? String(statusRaw) : 'started');

    switch (attrs.action) {
      case 'create':
        return `Created ${String(attrs.resource_type)}${resourceNameStr ? ` "${resourceNameStr}"` : ''}`;
      case 'update':
        return `Updated ${String(attrs.resource_type)}${resourceNameStr ? ` "${resourceNameStr}"` : ''}`;
      case 'delete':
        return `Deleted ${String(attrs.resource_type)}${resourceNameStr ? ` "${resourceNameStr}"` : ''}`;
      case 'run_plan':
      case 'run_apply':
      case 'run_destroy':
        return `${operationStr} run ${statusStr}${details.workspace_id ? ` for workspace` : ''}`;
      default:
        return `${String(attrs.action)} ${String(attrs.resource_type)}${resourceNameStr ? ` "${resourceNameStr}"` : ''}`;
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unseenCount > 0 && (
            <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-background animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unseenCount > 0 && (
              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                {unseenCount} new
              </span>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activities</p>
            </div>
          ) : (
            recentActivities.map((activity, index) => {
              // Use localStorage directly to determine if activity is unseen
              const currentLastSeenId = localStorage.getItem('lastSeenActivityId');
              const lastSeenIndex = currentLastSeenId 
                ? recentActivities.findIndex(a => a.id === currentLastSeenId)
                : -1;
              const isUnseen = !currentLastSeenId || lastSeenIndex === -1 || index < lastSeenIndex;
              return (
                <DropdownMenuItem
                  key={activity.id}
                  asChild
                  className={cn(
                    "flex flex-col items-start p-3 cursor-pointer",
                    isUnseen && "bg-blue-50 dark:bg-blue-950/20"
                  )}
                >
                  <div className="w-full">
                    <p className="text-sm text-foreground">{formatActivityDescription(activity)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(activity.attributes.created_at)}
                    </p>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/activities" className="w-full text-center text-sm font-medium py-2">
            View all activities
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

