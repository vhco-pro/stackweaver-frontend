// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RAMPS, useRamp } from '@/lib/ramps';
import { cn } from '@/lib/utils';

/**
 * What the page knows about its list, which decides where the primary action shows.
 *
 * - `ready`   there is something to list, or the page has no list: the action is in the header.
 * - `empty`   nothing exists yet and no filter is applied: the header shows no action, because
 *             the empty-state card carries it.
 * - `loading` the first load is pending: a skeleton holds the action's place, so the button
 *             neither flashes in nor leaves a gap.
 * - `error`   the load failed: emptiness is unknown, so the action is shown.
 *
 * A list that is empty only because of a search or filter is `ready`, not `empty`.
 */
export type PageListState = 'ready' | 'empty' | 'loading' | 'error';

interface PageHeaderProps {
  /** The page's sidebar icon, its Settings hub card icon, or its section's icon for a detail page. */
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  /** One line under the title. Detail pages pass their metadata line here. */
  subtitle?: ReactNode;
  /**
   * A page one level below another: a Settings sub-page returns to the Settings hub, a detail
   * page to its list or its parent. The label names the destination ("Back to jobs").
   */
  backTo?: { to: string; label: string };
  /** An optional row of figures under the subtitle. */
  stats?: ReactNode;
  /** The page's one primary action. Omit it for a user who may not create. */
  action?: ReactNode;
  /** Other header actions, rendered before the primary one and always shown. */
  actions?: ReactNode;
  listState?: PageListState;
  className?: string;
}

/**
 * The title block every page shares: icon, theme-paired gradient title, subtitle, and the
 * actions on the right. Colours come from the enclosing `Page`'s ramp, never from the call
 * site, so a title and its button cannot disagree.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  backTo,
  stats,
  action,
  actions,
  listState = 'ready',
  className,
}: PageHeaderProps) {
  const ramp = RAMPS[useRamp()];
  const showAction = action && listState !== 'empty' && listState !== 'loading';
  const showSkeleton = action && listState === 'loading';

  return (
    <div data-page-header className={cn('flex items-start gap-4', className)}>
      {backTo && (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
        >
          <Link to={backTo.to} aria-label={backTo.label}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4">
        {/* basis-72: the title block shrinks beside the actions, and they wrap under it only
            when less than that is left for it. Without a basis a long stats row would claim
            the whole line and push the actions below on any screen. */}
        <div className="min-w-0 flex-1 basis-72">
          <h1
            className={cn(
              'mb-2 flex items-center gap-3 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent',
              ramp.title
            )}
          >
            <Icon className={cn('h-7 w-7 shrink-0', ramp.icon)} />
            <span className="min-w-0 break-words">{title}</span>
          </h1>
          {subtitle && <div className="text-muted-foreground">{subtitle}</div>}
          {stats && <div className="mt-2 flex flex-wrap gap-4 text-sm">{stats}</div>}
        </div>
        {(actions || showAction || showSkeleton) && (
          <div data-page-header-actions className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
            {showAction && action}
            {showSkeleton && <Skeleton data-testid="page-header-action-skeleton" className="h-10 w-36 rounded-xl" />}
          </div>
        )}
      </div>
    </div>
  );
}
