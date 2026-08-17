// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * The width tier a page renders at.
 *
 * Width is a property of what the content *is*, not of how much of it there
 * happens to be. Deriving it from row or column count would mean the same page
 * rendering at two different widths across two runs, and the shell reflowing
 * when a filter is applied - so the tier is declared per route in `App.tsx`
 * and stays put.
 *
 * Every tier is a `max-w-*` on a `w-full` element, so below its cap the layout
 * is identical to an uncapped one. Nothing here changes how a page renders on
 * a small screen; the tiers only decide what happens with room to spare.
 *
 * - `prose`   Single-column forms and text. Capped near the ~60-80 character
 *             measure where reading stops being comfortable.
 * - `default` Card grids, sparse tables, most overviews. A 4-column table
 *             stretched across a 4K display is harder to scan, not easier -
 *             the eye travels further between related cells.
 * - `wide`    Content whose natural width genuinely exceeds `default`: the
 *             Ansible run matrix, host tables, dashboards. Capped rather than
 *             unbounded so an ultrawide doesn't produce a 3000px table row.
 * - `full`    Edge-to-edge. For 2D canvases that own their own viewport.
 */
export type PageWidth = 'prose' | 'default' | 'wide' | 'full';

const pageContainerVariants = cva('w-full', {
  variants: {
    width: {
      prose: 'max-w-3xl',
      default: 'max-w-7xl',
      wide: 'max-w-9xl',
      full: 'max-w-none',
    },
  },
  defaultVariants: {
    width: 'default',
  },
});

interface PageContainerProps extends VariantProps<typeof pageContainerVariants> {
  children: ReactNode;
  /** Extra classes for the inner (capped) element. */
  className?: string;
}

export function PageContainer({ children, width, className }: PageContainerProps) {
  return (
    <div className="w-full px-6 py-8 flex justify-center">
      <div className={cn(pageContainerVariants({ width }), className)}>{children}</div>
    </div>
  );
}
