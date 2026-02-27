// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreatedNodeProps {
  timestamp: string;
  className?: string;
}

/**
 * CreatedNode component displays the initial "Created" node at the top of the timeline
 * Unique StackWeaver styling element - shows when the run was created
 */
export function CreatedNode({ timestamp, className }: CreatedNodeProps) {
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={cn('relative flex flex-col items-center pb-6', className)}>
      {/* Timeline node */}
      <div className="flex flex-col items-center">
        <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-500 bg-background">
          <Clock className="h-4 w-4 text-gray-500" />
        </div>
        {/* Vertical line extending downward */}
        <div className="w-0.5 flex-1 min-h-[40px] bg-gray-300 dark:bg-gray-600" />
      </div>

      {/* Timeline content - centered */}
      <div className="flex flex-col items-center mt-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">Created</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTime(timestamp)}</span>
          <span>{formatDate(timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

