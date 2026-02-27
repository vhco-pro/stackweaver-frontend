// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, type ReactNode, forwardRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Clock, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhaseBoxProps {
  phase: 'planning' | 'applying' | 'destroying';
  title: string; // May change based on status (e.g., "Plan Phase" → "Plan Finished")
  timestamp?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  children: ReactNode;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  className?: string;
  actionButtons?: React.ReactNode; // Optional action buttons (e.g., Apply/Discard)
  headerActions?: React.ReactNode; // Optional header action buttons/icons (e.g., terminal toggle)
  showConnectionLine?: boolean; // Show line extending from bottom
  metadata?: {
    terraformVersion?: string;
    agent?: string;
    startedAt?: string;
    finishedAt?: string;
    createdAt?: string;
  };
}

/**
 * PhaseBox component displays a phase with status-based styling
 * Border color and icon change based on status:
 * - running: blue (spinner icon)
 * - completed: green (checkmark icon)
 * - failed: red (X icon) - indicates an error occurred
 * - cancelled: grey (X icon) - indicates user-initiated cancellation
 * - pending: grey (clock icon) - waiting to start
 * Same component instance transitions its appearance as status changes
 */
export const PhaseBox = forwardRef<HTMLDivElement | null, PhaseBoxProps>(({
  phase, // Required by interface but not used in component
  title,
  timestamp,
  status,
  children,
  defaultExpanded = true,
  collapsible = true,
  className,
  actionButtons,
  headerActions,
  showConnectionLine = true, // Required by interface but not used in component
  metadata,
}, ref) => {
  // Suppress unused variable warnings for props required by interface
  void phase;
  void showConnectionLine;
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Sync expanded state with defaultExpanded prop when it changes
  useEffect(() => {
    if (defaultExpanded !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpanded(defaultExpanded);
    }
  }, [defaultExpanded]);

  const handleToggle = () => {
    if (!collapsible) return;
    const newExpanded = !expanded;
    setExpanded(newExpanded);
  };

  // Determine left border color based on status (glossy/translucent style)
  // Background only when collapsed, plain when expanded for syntax highlighting
  const getBorderStyle = () => {
    switch (status) {
      case 'running':
        return {
          border: 'border-l-4 border-blue-500',
          bg: expanded ? '' : 'bg-blue-500/5',
        };
      case 'completed':
        return {
          border: 'border-l-4 border-green-500',
          bg: expanded ? '' : 'bg-green-500/5',
        };
      case 'failed':
        return {
          border: 'border-l-4 border-red-500',
          bg: expanded ? '' : 'bg-red-500/5',
        };
      case 'cancelled':
        return {
          border: 'border-l-4 border-gray-400',
          bg: expanded ? '' : 'bg-gray-400/5',
        };
      default:
        return {
          border: 'border-l-4 border-gray-500',
          bg: expanded ? '' : 'bg-gray-500/5',
        };
    }
  };

  // Determine status icon (glossy/translucent style)
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

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

  const borderStyle = getBorderStyle();

  return (
    <div className={cn('relative', className)}>
      <div 
        ref={ref} 
        className={cn(
          'rounded-lg overflow-hidden transition-colors',
          borderStyle.border,
          borderStyle.bg,
          !expanded && 'backdrop-blur-sm'
        )}
      >
        {/* Header */}
        <button
          onClick={handleToggle}
          disabled={!collapsible}
          className={cn(
            'w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors',
            !collapsible && 'cursor-default'
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{title}</h2>
            {/* Show started/finished timeline in header with color icons */}
            {metadata?.startedAt && metadata?.finishedAt && metadata.startedAt !== metadata.finishedAt ? (
              <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span>{formatTime(metadata.startedAt)}</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{formatTime(metadata.finishedAt)}</span>
                </div>
              </div>
            ) : metadata?.startedAt ? (
              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
                <PlayCircle className="h-3.5 w-3.5" />
                <span>Started {formatTime(metadata.startedAt)}</span>
              </div>
            ) : metadata?.finishedAt ? (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 whitespace-nowrap">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Finished {formatTime(metadata.finishedAt)}</span>
              </div>
            ) : metadata?.createdAt ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {(() => {
                  const date = new Date(metadata.createdAt);
                  return date.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false 
                  }) + ' ' + date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  });
                })()}
              </span>
            ) : timestamp ? (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {formatTime(timestamp)}
              </span>
            ) : null}
            {/* Show agent info in header */}
            {metadata?.agent && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Agent: {metadata.agent}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {headerActions}
              </div>
            )}
            {getStatusIcon()}
            {collapsible && (
              <div className="flex items-center">
                {expanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        </button>

        {/* Content */}
        {expanded && (
          <div className="px-4 pb-4">
            {children}
            {actionButtons && (
              <div className="mt-4 pt-4 border-t">
                {actionButtons}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
});

PhaseBox.displayName = 'PhaseBox';

