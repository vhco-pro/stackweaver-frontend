// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GradientButtonProps = Omit<ButtonProps, 'variant'> & {
  wrapperClassName?: string;
};

export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, wrapperClassName, children, disabled, ...props }, ref) => {
    return (
      <div
        className={cn(
          'relative inline-flex w-full rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 p-[3px] dark:p-[2.5px] transition-opacity',
          disabled && 'opacity-50 pointer-events-none',
          wrapperClassName
        )}
      >
        <Button
          ref={ref}
          variant="ghost"
          disabled={disabled}
          className={cn(
            'w-full bg-white dark:bg-slate-900/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-3px)] dark:rounded-[calc(0.75rem-2.5px)] transition-colors duration-200 disabled:opacity-100',
            className
          )}
          {...props}
        >
          {children}
        </Button>
      </div>
    );
  }
);
GradientButton.displayName = 'GradientButton';
