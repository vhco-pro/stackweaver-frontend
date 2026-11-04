// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/surfaces';
import { hasPlacement, queueReasonText, type Placement } from '@/lib/placement';

/**
 * "Waiting for hosted capacity (3 of 5 slots in use)" for work that waits on its organization's
 * hosted pool (#933, D9, AC56). Renders nothing for work that is not waiting on it.
 */
export function QueueReasonNotice({ placement, className }: { placement: Placement | undefined; className?: string }) {
  const text = queueReasonText(placement);
  if (!text) return null;
  return (
    <div
      role="status"
      data-testid="queue-reason"
      className={cn(
        'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm',
        'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        className
      )}
    >
      <Clock className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4 py-1.5">
      <dt className="text-muted-foreground sm:w-40 shrink-0">{label}</dt>
      <dd className={cn('break-all', mono && 'font-mono text-xs sm:text-sm')}>{value || '-'}</dd>
    </div>
  );
}

const IMAGE_LEVELS: Record<string, string> = {
  platform: 'Platform default',
};

/**
 * Where the latest attempt of a run, job or work item ran (#933, D4, AC77): read-only, collapsed by
 * default, and absent until the work has been placed once.
 */
export function PlacementRecord({ placement }: { placement: Placement | undefined }) {
  const [open, setOpen] = useState(false);
  if (!hasPlacement(placement)) return null;
  const image = placement.image_digest ? `${placement.image}@${placement.image_digest}` : placement.image;
  return (
    <section className={cn(glassSurface, 'p-4 sm:p-5')} data-testid="placement-record">
      <button
        type="button"
        onClick={() => { setOpen(v => !v); }}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left min-h-11"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        <span className="font-semibold">Placement</span>
        <span className="text-sm text-muted-foreground">
          attempt {placement.attempt} on the {placement.driver} driver
        </span>
      </button>
      {open && (
        <dl className="mt-3 text-sm">
          <Row label="Attempt" value={String(placement.attempt)} />
          <Row label="Driver" value={placement.driver} />
          <Row label="Placement" value={placement.placement_id} mono />
          <Row label="Image" value={image} mono />
          <Row label="Image from" value={IMAGE_LEVELS[placement.image_level] ?? placement.image_level} />
          <Row label="Identity binding" value={placement.identity_binding_id ?? 'Platform token'} mono={!!placement.identity_binding_id} />
          <Row label="Node" value={placement.node} mono />
        </dl>
      )}
    </section>
  );
}
