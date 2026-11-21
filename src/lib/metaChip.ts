// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The icon colour of each fact type in a run's meta row. Only the icon carries colour: the chip's
 * text, border and surface stay neutral, so the run status stays the strongest colour in the header.
 * Pull requests are pink, not orange, so they never read as the orange Planned status. Rule: "Coloured icons are the lighter option"
 * in the pinned conventions/interface-colour.md; design record: docs/internal/design/run-header-meta-decisions.md.
 */
export const metaIconTone = {
  trigger: 'text-sky-600 dark:text-sky-400',
  vcs: 'text-violet-600 dark:text-violet-400',
  pullRequest: 'text-pink-600 dark:text-pink-400',
  commit: 'text-indigo-600 dark:text-indigo-400',
  person: 'text-slate-500 dark:text-slate-400',
  launcher: 'text-teal-600 dark:text-teal-400',
} as const;

/** The neutral chip every run fact shares. */
export const metaChipClass = [
  'inline-flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap backdrop-blur-sm',
  'border-gray-200 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300',
].join(' ');

/** Hover and focus for a chip that opens something. */
export const metaChipActionClass = [
  'cursor-pointer transition-colors duration-150',
  'hover:border-gray-300 hover:text-slate-900 dark:hover:border-white/20 dark:hover:text-slate-100',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
].join(' ');
