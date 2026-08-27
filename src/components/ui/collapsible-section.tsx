// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A page section whose body the reader can fold away, with the choice remembered.
 *
 * Persistence is the point: collapsing a section on a landing page is only worth doing if it stays
 * collapsed on the next visit, otherwise it is a gesture the reader has to repeat forever. State
 * lives in one localStorage entry keyed by section id, so a section that is later renamed or
 * removed simply leaves a dead key rather than corrupting the rest.
 *
 * Everything is open by default. Hiding content behind a closed section by default would mean the
 * page's first impression depends on a preference the reader has not set yet.
 *
 * The body is unmounted while collapsed, not hidden - so a section that owns a polling query stops
 * polling when folded away. That only holds if the caller puts the query *inside* the children: a
 * hook called by the component that renders this one keeps running regardless of the toggle.
 */
const STORAGE_KEY = 'collapsedSections';

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, boolean>) : {};
  } catch {
    // A corrupt entry is a preference, not data: silently start over rather than break the page.
    return {};
  }
}

function writeCollapsed(id: string, collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readCollapsed(), [id]: collapsed }));
  } catch {
    // Storage can be full or blocked (private mode). The section still toggles for this session.
  }
}

export function CollapsibleSection({
  id,
  title,
  hint,
  action,
  className,
  children,
}: {
  /** Stable key for the remembered open/closed state. Also seeds the `aria-controls` target id. */
  id: string;
  title: string;
  /** Short line under the title, describing what the section is scoped to. */
  hint?: string;
  /** Rendered beside the toggle - a link, say. Outside the button, so it stays independently clickable. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed()[id] ?? false);
  const bodyId = `section-${id}`;
  const hintId = `section-${id}-hint`;

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          {/* The WAI-ARIA accordion shape: a heading wrapping the toggle, so the section is both
              navigable as a landmark in a heading list and operable as a button.

              The hint sits outside the heading on purpose. Inside, it became part of the heading's
              accessible name, so "Live operations - OpenTofu runs ... across your organizations"
              was the name a screen reader read out and a heading query matched on. It is attached
              with aria-describedby instead, which is what a supporting description is for. */}
          <h2 className="text-xl font-semibold leading-tight text-foreground">
            <button
              type="button"
              onClick={() => {
                setCollapsed(prev => {
                  writeCollapsed(id, !prev);
                  return !prev;
                });
              }}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              aria-describedby={hint ? hintId : undefined}
              className="-ml-1 flex min-h-[44px] items-center gap-2 rounded-lg px-1 text-left transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:hover:bg-white/5"
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  collapsed && '-rotate-90',
                )}
                aria-hidden="true"
              />
              {title}
            </button>
          </h2>
          {hint && (
            // Indented past the chevron so it lines up with the title rather than the icon.
            <p id={hintId} className="-mt-1 pl-7 text-xs text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
        {action}
      </div>
      {/* Unmounted rather than hidden: the sections behind these headers own polling queries, and a
          display:none section would keep fetching for a reader who has folded it away. */}
      {!collapsed && <div id={bodyId}>{children}</div>}
    </section>
  );
}
