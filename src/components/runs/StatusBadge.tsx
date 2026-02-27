// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Unified Status Badge Component
 * 
 * Single component for displaying run status badges consistently across the application.
 * Uses computeDisplayStatus utility for status computation.
 * 
 * Implementation: frontend/src/components/runs/StatusBadge.tsx
 * Status computation: frontend/src/utils/runStatus.ts
 * 
 * @see frontend/src/utils/runStatus.ts - Status computation logic
 */

import { CheckCircle2, XCircle, Loader2, Clock, Trash2, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DisplayStatus } from '@/utils/runStatus';

interface StatusBadgeProps {
  status: DisplayStatus;
  className?: string;
  variant?: 'default' | 'outline';
}

const statusConfig: Record<DisplayStatus, {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
  spinning: boolean;
}> = {
  pending: {
    label: 'Pending',
    className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    icon: Clock,
    spinning: false,
  },
  planning: {
    label: 'Planning',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: Loader2,
    spinning: true,
  },
  planned: {
    label: 'Planned',
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    icon: CheckCircle2,
    spinning: false,
  },
  applying: {
    label: 'Applying',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: Loader2,
    spinning: true,
  },
  applied: {
    label: 'Applied',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    icon: CheckCircle2,
    spinning: false,
  },
  finished: {
    label: 'Finished',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    icon: CheckCircle2,
    spinning: false,
  },
  errored: {
    label: 'Errored',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    icon: XCircle,
    spinning: false,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    icon: XCircle,
    spinning: false,
  },
  running: {
    label: 'Running',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: Loader2,
    spinning: true,
  },
  destroyed: {
    label: 'Destroyed',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    icon: Trash2,
    spinning: false,
  },
  'no-runs': {
    label: 'No runs',
    className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    icon: Minus,
    spinning: false,
  },
};

/**
 * StatusBadge component - Unified status badge display
 * 
 * Displays run status badges with consistent styling and icons.
 * All status badges across the application use this component.
 */
export function StatusBadge({ status, className, variant = 'default' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  
  return (
    <Badge 
      variant={variant} 
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        variant === 'outline' ? config.className : config.className,
        className
      )}
    >
      {config.spinning && <Icon className="h-3 w-3 animate-spin" />}
      {!config.spinning && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

