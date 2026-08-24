// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GradientButtonProps = Omit<ButtonProps, 'variant'> & {
  /**
   * Color ramp of the ring.
   * - `brand`: blue → indigo → purple (public surface, login flow). Default.
   * - `app`: violet → indigo → blue (in-app pages; the Job Templates ramp).
   */
  ramp?: 'brand' | 'app';
  /** Kept for API compatibility with the former login-only component; merged into the button classes. */
  wrapperClassName?: string;
  /**
   * Visual weight. `primary` (default) is the decided 3px ring + glow + spin;
   * `secondary` is the P2 pairing variant - 1px faded ring, static, no glow -
   * for when two actions sit together and only one should move.
   */
  emphasis?: 'primary' | 'secondary';
};

/**
 * THE gradient-ring button (design decision 2026-08-20, see
 * docs/internal/design/heading-button-design-decisions.md). All styling lives in
 * the `.gradient-ring-btn` block in index.css - change it there, it changes
 * everywhere. Single element: 3px conic ring + glow, rotates on hover, pixel-even.
 *
 * Defaults to full width (login-form semantics); pass `className="w-auto"` for inline use.
 * Radius follows rounded-xl; override with `[--sw-ring-radius:0.375rem]` etc.
 */
export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, wrapperClassName, ramp = 'brand', emphasis = 'primary', children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        className={cn(
          'gradient-ring-btn w-full whitespace-nowrap',
          ramp === 'brand' && 'gradient-ring-brand',
          emphasis === 'secondary' && 'gradient-ring-secondary',
          wrapperClassName,
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
GradientButton.displayName = 'GradientButton';
