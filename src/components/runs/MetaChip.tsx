// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { metaChipActionClass, metaChipClass } from '@/lib/metaChip';

interface MetaChipProps {
  /** A 14px icon, coloured with a `metaIconTone` from `@/lib/metaChip`, or a brand mark. */
  icon?: ReactNode;
  children: ReactNode;
  /** Tooltip and accessible description, such as "Triggered via CLI". */
  title?: string;
  /**
   * Opens this URL in a new tab. Rendered as a button, not a link, because run cards wrap the
   * whole row in a link and anchors cannot nest.
   */
  href?: string | null;
  /** A control at the chip's end, such as a copy button. */
  trailing?: ReactNode;
  className?: string;
}

/** One fact about a run (trigger, version, launcher, identifier) in the shared neutral chip. */
export function MetaChip({ icon, children, title, href, trailing, className }: MetaChipProps) {
  const body = (
    <>
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </>
  );

  if (href) {
    return (
      <button
        type="button"
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        }}
        className={cn(metaChipClass, metaChipActionClass, className)}
      >
        {body}
      </button>
    );
  }

  return (
    <span title={title} className={cn(metaChipClass, trailing ? 'pr-1' : undefined, className)}>
      {body}
      {trailing}
    </span>
  );
}
