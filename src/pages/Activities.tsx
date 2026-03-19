// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Loader2, Clock, Zap, CheckCircle2, XCircle, AlertCircle, Activity } from 'lucide-react';
import { activitiesApi, type Activity as ActivityData } from '@/api/client';
import { Button } from '@/components/ui/button';

export default function Activities() {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchActivities = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await activitiesApi.list({
        limit,
        offset: reset ? 0 : offset,
      });

      const newActivities = response.data || [];
      
      if (reset) {
        setActivities(newActivities);
      } else {
        setActivities(prev => [...prev, ...newActivities]);
      }

      setHasMore(newActivities.length === limit);
      setOffset(reset ? limit : offset + newActivities.length);
    } catch (err: unknown) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useMountEffect(() => {
    void fetchActivities(true);
  });

  const formatActivityDescription = (activity: ActivityData): string => {
    const attrs = activity.attributes;
    const details = attrs.details || {};
    const resourceName = details.resource_name || attrs.resource_type;
    let resourceNameStr = '';
    if (resourceName) {
      if (typeof resourceName === 'string') {
        resourceNameStr = resourceName;
      } else if (typeof resourceName !== 'object' && resourceName !== null) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        resourceNameStr = String(resourceName);
      } else {
        // Handle object types that might be passed
        resourceNameStr = typeof resourceName === 'object' ? JSON.stringify(resourceName) : String(resourceName);
      }
    }
    const operationRaw = details.operation || attrs.action;
    let operationStr = '';
    if (operationRaw) {
      if (typeof operationRaw === 'string') {
        operationStr = operationRaw;
      } else if (typeof operationRaw !== 'object' && operationRaw !== null) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        operationStr = String(operationRaw);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        operationStr = String(operationRaw);
      }
    }
    const statusRaw = details.status || 'started';
    let statusStr = '';
    if (statusRaw) {
      if (typeof statusRaw === 'string') {
        statusStr = statusRaw;
      } else if (typeof statusRaw !== 'object' && statusRaw !== null) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        statusStr = String(statusRaw);
      }
    }
    if (!statusStr) statusStr = 'started';
    
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

  const getActivityIcon = (activity: ActivityData) => {
    const attrs = activity.attributes;
    const status = attrs.details?.status;

    if (attrs.action?.includes('run')) {
      if (status === 'completed' || status === 'success') {
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      } else if (status === 'failed' || status === 'error') {
        return <XCircle className="h-5 w-5 text-red-500" />;
      } else if (status === 'running' || status === 'pending') {
        return <Clock className="h-5 w-5 text-yellow-500" />;
      }
    }

    switch (attrs.action) {
      case 'create':
        return <Zap className="h-5 w-5 text-blue-500" />;
      case 'update':
        return <Activity className="h-5 w-5 text-purple-500" />;
      case 'delete':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTimestamp = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
          Activity Log
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          View all activities and events across your infrastructure
        </p>
      </div>

      {/* Activities List */}
      <div className="rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-purple-400/30 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">No activities found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Activities will appear here as you use the platform
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200 dark:divide-white/10">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-4 hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      {getActivityIcon(activity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatActivityDescription(activity)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {formatTimestamp(activity.attributes.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="p-4 border-t border-gray-200 dark:border-white/10">
                <Button
                  variant="outline"
                  onClick={() => { void fetchActivities(false); }}
                  disabled={loadingMore}
                  className="w-full"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

