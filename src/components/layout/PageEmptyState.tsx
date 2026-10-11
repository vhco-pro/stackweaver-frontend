// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ComponentType, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { glassDashedEmpty } from '@/lib/surfaces';
import { cn } from '@/lib/utils';

interface PageEmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  /**
   * The page's primary action: the same element the page hands to `PageHeader`, which does
   * not render it while the list is empty. Omit it for a user who may not create.
   */
  action?: ReactNode;
  /**
   * A second way to make the first item (importing, say), shown beside the primary action.
   * The page keeps it out of the header while the list is empty, so every way to start is in
   * one place.
   */
  secondaryAction?: ReactNode;
  /**
   * The list is empty only because of a search or filter. That is not an empty state: the
   * header keeps the primary action and this card offers to clear the filter instead.
   */
  filtered?: boolean;
  onClearFilters?: () => void;
  className?: string;
}

/**
 * The card a list page shows when it has nothing to list.
 *
 * Named apart from the `EmptyState` in `components/ui/analytics-card.tsx`, which is a one-line
 * message for cards and charts and stays as it is.
 */
export function PageEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  filtered = false,
  onClearFilters,
  className,
}: PageEmptyStateProps) {
  return (
    <div
      data-page-empty={filtered ? 'filtered' : 'empty'}
      className={cn(glassDashedEmpty, 'flex flex-col items-center gap-2 px-6 py-12 text-center', className)}
    >
      <Icon className="mb-2 h-12 w-12 text-muted-foreground/50" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {filtered
        ? onClearFilters && (
            <Button variant="outline" className="mt-4" onClick={onClearFilters}>
              Clear filters
            </Button>
          )
        : (action || secondaryAction) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {action}
              {secondaryAction}
            </div>
          )}
    </div>
  );
}
