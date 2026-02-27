// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Clock, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Run } from '@/api/client';

interface RunTimelineProps {
  run: Run;
  className?: string;
}

/**
 * RunTimeline component displays run timestamps in a sleek, interactive timeline format
 * Replaces the bulky card-based timestamp display with a more integrated design
 */
export function RunTimeline({ run, className }: RunTimelineProps) {
  const formatTime = (dateString: string | undefined): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusIcon = (status: Run['status'], isActive: boolean) => {
    if (isActive && status === 'running') {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />;
    }
    if (status === 'completed') {
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    }
    if (status === 'failed') {
      return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
    }
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const timelineItems = [
    {
      label: 'Created',
      timestamp: run.created_at,
      status: 'pending',
      isActive: run.status === 'pending',
    },
    run.started_at ? {
      label: 'Started',
      timestamp: run.started_at,
      status: run.status,
      isActive: run.status === 'running',
    } : null,
    run.completed_at ? {
      label: run.status === 'failed' ? 'Failed' : run.status === 'canceled' ? 'Cancelled' : 'Completed',
      timestamp: run.completed_at,
      status: run.status,
      isActive: false,
    } : null,
  ].filter(Boolean) as Array<{
    label: string;
    timestamp: string;
    status: string;
    isActive: boolean;
  }>;

  if (timelineItems.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-4 text-sm', className)}>
      {timelineItems.map((item, index) => (
        <div key={item.label} className="flex items-center gap-2">
          {index > 0 && (
            <div className="h-px w-4 bg-border" />
          )}
          <div className="flex items-center gap-1.5">
            {getStatusIcon(item.status as Run['status'], item.isActive)}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-xs">{formatTime(item.timestamp)}</span>
                {index === 0 && (
                  <span className="text-xs text-muted-foreground">{formatDate(item.timestamp)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

