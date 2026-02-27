// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import * as SwitchPrimitives from '@radix-ui/react-switch';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const toggleTheme = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  return (
    <SwitchPrimitives.Root
      checked={isDark}
      onCheckedChange={toggleTheme}
      className={cn(
        'peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Base border styles
        isDark
          ? 'border-gray-600/40 bg-gray-900 dark:bg-gray-950 data-[state=checked]:bg-gray-900'
          : 'border-gray-300/60 bg-gray-100 dark:bg-gray-800 data-[state=unchecked]:bg-gray-100',
        // Hover effect with gradient glow - purple/blue gradient
        'hover:border-purple-400/70 dark:hover:border-purple-400/70',
        'hover:shadow-[0_0_16px_rgba(168,85,247,0.5),0_0_8px_rgba(99,102,241,0.4)]',
        'hover:shadow-purple-500/50 dark:hover:shadow-indigo-500/50'
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none flex h-4 w-4 items-center justify-center rounded-full bg-background shadow-lg ring-0 transition-transform',
          'border border-gray-400/60 dark:border-gray-500/60',
          'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-1'
        )}
      >
        {isDark ? (
          <Moon className="h-3 w-3 text-white" />
        ) : (
          <Sun className="h-3 w-3 text-yellow-600 dark:text-yellow-500" fill="currentColor" />
        )}
      </SwitchPrimitives.Thumb>
      <span className="sr-only">
        {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      </span>
    </SwitchPrimitives.Root>
  );
}

