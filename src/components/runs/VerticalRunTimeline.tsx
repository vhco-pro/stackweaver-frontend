// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Clock, CheckCircle2, Loader2, XCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Run } from '@/api/client';

interface VerticalRunTimelineProps {
  run: Run;
  className?: string;
}

interface TimelineNode {
  label: string;
  timestamp?: string;
  status: string;
  isActive: boolean;
  phase?: 'created' | 'planning' | 'planned' | 'applying' | 'applied' | 'completed' | 'failed';
}

/**
 * VerticalRunTimeline component displays run phases in a vertical timeline format
 * Creates a "time lapse" experience showing the run's progression from top to bottom
 */
export function VerticalRunTimeline({ run, className }: VerticalRunTimelineProps) {
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

  const getStatusIcon = (phase: TimelineNode['phase'], isActive: boolean, nextPhase?: TimelineNode['phase']) => {
    void nextPhase; // Suppress unused parameter warning
    if (isActive) {
      if (phase === 'planning' || phase === 'applying') {
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />;
      }
      return <PlayCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
    // Only Planned and Applied phases show green checkmarks
    // Planning and Applying show grey clocks when completed (not green)
    if (phase === 'planned') {
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    }
    if (phase === 'applied') {
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    }
    if (phase === 'completed') {
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    }
    if (phase === 'failed') {
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
    // Planning and Applying show grey clocks when completed
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getLineColor = (phase: TimelineNode['phase'], isActive: boolean, nextPhase?: TimelineNode['phase']): string => {
    // Active phases show blue line
    if (isActive) {
      return 'bg-blue-500';
    }
    
    // Failed phases show red line (only for actual failed runs)
    if (phase === 'failed') {
      return 'bg-red-500';
    }
    
    // STRICT: ONLY these two specific transitions are green, nothing else:
    // 1. Planning → Planned (leading to green Planned)
    const isPlanningToPlanned = phase === 'planning' && nextPhase === 'planned';
    // 2. Applying → Applied (leading to green Applied)
    const isApplyingToApplied = phase === 'applying' && nextPhase === 'applied';
    
    if (isPlanningToPlanned || isApplyingToApplied) {
      return 'bg-slate-500';
    }

    // EVERYTHING ELSE is grey - no exceptions
    // This includes: Created → Planning, Planned → Applying, Applied → anything, etc.
    return 'bg-slate-300 dark:bg-slate-600';
  };

  // Build timeline nodes based on run status and operation
  const timelineNodes: TimelineNode[] = [];

  // Created - always present
  timelineNodes.push({
    label: 'Created',
    timestamp: run.created_at,
    status: 'pending',
    isActive: run.status === 'pending',
    phase: 'created',
  });

  // For plan-and-apply runs, show planning phase
  if (run.operation === 'plan-and-apply' || run.operation === 'plan-only' || run.operation === 'plan') {
    if (run.status === 'planning' || run.status === 'planned' || run.status === 'applying' || run.status === 'applied' || run.status === 'completed') {
      timelineNodes.push({
        label: 'Planning',
        timestamp: run.started_at,
        status: run.status,
        isActive: run.status === 'planning',
        phase: 'planning',
      });
    }

    // Planned phase (plan completed) - turns green when plan completes
    if (run.status === 'planned' || run.status === 'applying' || run.status === 'applied' || run.status === 'completed') {
      timelineNodes.push({
        label: 'Planned',
        timestamp: run.started_at, // Use started_at as approximation, could use planned-at if available
        status: 'planned',
        isActive: false,
        phase: 'planned', // This will show green checkmark
      });
    }

    // Applying phase (for plan-and-apply runs) - blue spinner when applying
    if (run.operation === 'plan-and-apply' && (run.status === 'applying' || run.status === 'applied' || run.status === 'completed')) {
      timelineNodes.push({
        label: 'Applying',
        timestamp: run.started_at, // Use started_at as approximation, could use applying-at if available
        status: run.status,
        isActive: run.status === 'applying',
        phase: 'applying',
      });
    }

    // Applied phase (for plan-and-apply runs) - green checkmark when apply completes
    // Only show for plan-and-apply runs, and don't show "Completed" after it
    if (run.operation === 'plan-and-apply' && (run.status === 'applied' || run.status === 'completed')) {
      timelineNodes.push({
        label: 'Applied',
        timestamp: run.completed_at,
        status: run.status,
        isActive: false,
        phase: 'applied', // This will show green checkmark
      });
    }
  } else {
    // For other run types (destroy, apply), show started and completed
    if (run.started_at) {
      timelineNodes.push({
        label: 'Started',
        timestamp: run.started_at,
        status: run.status,
        isActive: run.status === 'running' || run.status === 'applying',
        phase: run.status === 'failed' ? 'failed' : 'planning',
      });
    }
  }

  // Completed/Failed - Only show for destroy/apply runs (not plan-only or plan-and-apply)
  // For plan-only runs: "Planned" is the final state (no "Completed" needed)
  // For plan-and-apply runs: "Applied" is the final state (no "Completed" needed)
  if (run.completed_at && run.operation !== 'plan-and-apply' && run.operation !== 'plan-only' && run.operation !== 'plan') {
    timelineNodes.push({
      label: run.status === 'failed' ? 'Failed' : run.status === 'canceled' ? 'Cancelled' : 'Completed',
      timestamp: run.completed_at,
      status: run.status,
      isActive: false,
      phase: run.status === 'failed' ? 'failed' : 'completed',
    });
  }

  if (timelineNodes.length === 0) return null;

  return (
    <div className={cn('relative flex flex-col', className)}>
      {timelineNodes.map((node, index) => {
        const isLast = index === timelineNodes.length - 1;
        const nextNode = !isLast ? timelineNodes[index + 1] : undefined;
        // Only show line if there's a next node
        const showLine = !isLast;
        // Get line color: only green if leading to Planned or Applied, otherwise grey
        const lineColor = showLine ? getLineColor(node.phase, node.isActive, nextNode?.phase) : 'bg-slate-300 dark:bg-slate-600';
        
        // Debug: Log the line color decision
        if (showLine && process.env.NODE_ENV === 'development') {
          console.log(`Timeline line: ${node.phase} → ${nextNode?.phase}, color: ${lineColor}, isActive: ${node.isActive}`);
        }

        return (
          <div key={`${node.phase}-${index}`} className="relative flex items-start gap-4">
            {/* Timeline line and node */}
            <div className="flex flex-col items-center">
              {/* Timeline node */}
              <div className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background',
                node.isActive && 'border-blue-500',
                // Only Planned and Applied have green borders
                !node.isActive && node.phase === 'planned' && 'border-green-500',
                !node.isActive && node.phase === 'applied' && 'border-green-500',
                !node.isActive && node.phase === 'completed' && 'border-green-500',
                !node.isActive && node.phase === 'failed' && 'border-red-500',
                // Planning and Applying have grey borders when completed
                !node.isActive && node.phase !== 'planned' && node.phase !== 'applied' && node.phase !== 'completed' && node.phase !== 'failed' && 'border-muted'
              )}>
                {getStatusIcon(node.phase, node.isActive, nextNode?.phase)}
              </div>
              {/* Vertical line */}
              {showLine && (
                <div 
                  className={cn(
                    'w-0.5 flex-1 min-h-[60px]',
                    // Force grey unless explicitly green or blue - prevent any green bleed
                    lineColor === 'bg-green-500' ? 'bg-green-500' :
                    lineColor === 'bg-blue-500' ? 'bg-blue-500' :
                    lineColor === 'bg-red-500' ? 'bg-red-500' :
                    'bg-slate-300 dark:bg-slate-600' // Force grey for everything else
                  )}
                />
              )}
            </div>

            {/* Timeline content */}
            <div className="flex-1 pb-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{node.label}</span>
              </div>
              {node.timestamp && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatTime(node.timestamp)}</span>
                  {index === 0 && (
                    <span>{formatDate(node.timestamp)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

