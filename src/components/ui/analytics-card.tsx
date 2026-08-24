// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/surfaces';

/**
 * The canonical analytics card shell - the same glass surface used across Settings, so no page
 * invents a second look. Lives here rather than under a page folder because both Usage and the
 * Dashboard build their sections out of it.
 */
export function AnalyticsCard({
  title,
  hint,
  icon,
  action,
  className,
  children,
}: {
  title?: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(glassSurface, 'p-5 sm:p-6', className)}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                {icon}
                {title}
              </h3>
            )}
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Loading placeholder shaped like the content it replaces, so the layout does not jump on arrival. */
export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="w-full" style={{ height }} />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/**
 * Error state with a retry. The page this replaced swallowed every failure into a console message
 * and rendered zeros, which reads as "you have no runs" rather than "we could not load your runs".
 */
export function ErrorState({
  message,
  onRetry,
  title = 'Could not load analytics',
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="rounded-full bg-red-500/10 p-3 text-red-500">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

/** Empty state for a card whose series has no data in the selected window. */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
