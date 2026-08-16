// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The rendering half of the shared host-status vocabulary (`hostStatus.ts`).
 * Import these rather than assembling an icon and a colour by hand - that is
 * how the four different versions of this row came about.
 */

import { cn } from '@/lib/utils';
import { HOST_STATUS_META, type HostStatus } from './hostStatus';

/** One status icon, coloured, with its label available to assistive tech. */
export function HostStatusIcon({
  status,
  className,
  labelled = true,
}: {
  status: HostStatus;
  className?: string;
  /** Set false when a visible label sits next to it, to avoid saying it twice. */
  labelled?: boolean;
}) {
  const { Icon, text, label } = HOST_STATUS_META[status];
  return (
    <>
      <Icon aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0', text, className)} />
      {labelled && <span className="sr-only">{label}</span>}
    </>
  );
}

/**
 * Icon + count, the row every Ansible list uses to summarise a run. Zero counts
 * dim rather than disappear, so the row keeps a stable shape between jobs.
 */
export function HostStatusCount({
  status,
  count,
  className,
}: {
  status: HostStatus;
  count: number;
  className?: string;
}) {
  const meta = HOST_STATUS_META[status];
  return (
    <span
      title={`${count} ${meta.label}`}
      className={cn('flex items-center gap-1', count === 0 && 'opacity-40', className)}
    >
      <HostStatusIcon status={status} labelled={false} />
      <span className={cn('text-xs font-medium tabular-nums', meta.text)}>{count}</span>
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}

/** Icon + visible label in a tinted pill - for a legend, a filter, or a header. */
export function HostStatusChip({
  status,
  className,
  children,
}: {
  status: HostStatus;
  className?: string;
  children?: React.ReactNode;
}) {
  const meta = HOST_STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs', meta.cell, className)}>
      <meta.Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {children ?? meta.label}
    </span>
  );
}
