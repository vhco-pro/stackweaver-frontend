// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { cn } from '@/lib/utils';

export type StatusTone = 'purple' | 'orange' | 'red' | 'blue' | 'gray' | 'green';

// Whole class strings, so Tailwind sees every one of them.
const TONES: Record<StatusTone, { active: string; idle: string }> = {
  purple: { active: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', idle: 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/20' },
  orange: { active: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', idle: 'text-orange-600 dark:text-orange-400 hover:bg-orange-500/20' },
  red: { active: 'bg-red-500/10 text-red-600 dark:text-red-400', idle: 'text-red-600 dark:text-red-400 hover:bg-red-500/20' },
  blue: { active: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', idle: 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/20' },
  gray: { active: 'bg-gray-500/10 text-gray-600 dark:text-gray-400', idle: 'text-gray-600 dark:text-gray-400 hover:bg-gray-500/20' },
  green: { active: 'bg-green-500/10 text-green-600 dark:text-green-400', idle: 'text-green-600 dark:text-green-400 hover:bg-green-500/20' },
};

const Compact = createContext(false);

/**
 * A row of status filter chips that shows every label while the labelled row fits on one line, and
 * only the icon and count of each chip once it no longer does. Whether it fits is measured, not
 * guessed from a breakpoint: an invisible copy of the labelled row gives its natural width, which
 * is compared with the room the row has, so it follows the sidebar, the controls beside it and
 * counts of any length. The label stays for screen readers and the tooltip either way.
 */
export function StatusFilterChips({ children, className }: { children: ReactNode; className?: string }) {
  const roomRef = useRef<HTMLDivElement>(null);
  const labelledRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useMountEffect(() => {
    const room = roomRef.current;
    const labelled = labelledRef.current;
    if (!room || !labelled || typeof ResizeObserver === 'undefined') return;
    const update = () => { setCompact(labelled.offsetWidth > room.clientWidth); };
    const observer = new ResizeObserver(update);
    observer.observe(room);
    observer.observe(labelled);
    update();
    return () => { observer.disconnect(); };
  });

  return (
    <div className={cn('min-w-0', className)}>
      <div ref={roomRef} className="min-w-0">
        <Compact.Provider value={compact}>
          <div role="group" aria-label="Filter by status" className={cn('flex flex-wrap items-center', compact ? 'gap-1' : 'gap-2')}>
            {children}
          </div>
        </Compact.Provider>
      </div>
      {/* The labelled row at its natural width, measured only: clipped, hidden and inert. */}
      <div aria-hidden="true" inert className="invisible h-0 overflow-hidden">
        <Compact.Provider value={false}>
          <div ref={labelledRef} className="flex w-max items-center gap-2">
            {children}
          </div>
        </Compact.Provider>
      </div>
    </div>
  );
}

export function StatusFilterChip({
  icon: Icon,
  iconClassName,
  label,
  count,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  count: number;
  tone: StatusTone;
  active: boolean;
  onClick: () => void;
}) {
  const compact = useContext(Compact);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}: ${count}`}
      title={label}
      className={cn(
        'flex min-h-9 items-center whitespace-nowrap rounded-md py-1.5 text-sm font-medium transition-colors',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        compact ? 'gap-1.5 px-2' : 'gap-2 px-3',
        active ? TONES[tone].active : TONES[tone].idle
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} aria-hidden="true" />
      {!compact && <span>{label}</span>}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
