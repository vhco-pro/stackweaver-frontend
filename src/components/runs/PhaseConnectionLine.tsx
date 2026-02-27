// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { cn } from '@/lib/utils';

interface PhaseConnectionLineProps {
  fromStatus: 'pending' | 'running' | 'completed' | 'failed';
  toStatus?: 'pending' | 'running' | 'completed' | 'failed';
  className?: string;
}

/**
 * PhaseConnectionLine component displays a vertical line connecting phase boxes
 * Line color matches the state of the phase it connects from
 */
export function PhaseConnectionLine({ fromStatus, className }: PhaseConnectionLineProps) {
  const getLineColor = () => {
    switch (fromStatus) {
      case 'running':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      case 'completed':
        return 'bg-gray-300 dark:bg-gray-600';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  };

  return (
    <div className={cn('flex justify-center', className)}>
      <div className={cn('w-0.5 min-h-[40px]', getLineColor())} />
    </div>
  );
}

