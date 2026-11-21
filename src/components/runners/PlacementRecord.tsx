// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { ChevronDown, Clock, MapPin, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { hasPlacement, placementImageRef, queueReasonText, type Placement } from '@/lib/placement';
import { metaChipActionClass, metaChipClass, metaIconTone } from '@/lib/metaChip';

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
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-muted-foreground sm:w-32">{label}</dt>
      <dd className={cn('min-w-0 break-all', mono && 'font-mono text-xs')}>{value || '-'}</dd>
    </div>
  );
}

const IMAGE_LEVELS: Record<string, string> = {
  platform: 'Platform default',
};

const iconClass = cn('h-3.5 w-3.5 shrink-0', metaIconTone.launcher);

/**
 * Where the latest attempt of a run, job or work item ran (#933, D4, AC77). A compact, read-only
 * chip for the page's metadata: it names the launcher (or the driver) and opens the full record on
 * demand, so the record never takes room above the work itself. Before the work has been placed it
 * shows only the launcher, and nothing when there is none.
 */
export function PlacementRecord({
  placement,
  runnerName,
  className,
}: {
  placement: Placement | undefined;
  /** The launcher that ran the work, the chip's label when known. */
  runnerName?: string;
  className?: string;
}) {
  const Icon = runnerName ? Server : MapPin;
  if (!hasPlacement(placement)) {
    if (!runnerName) return null;
    return (
      <span className={cn(metaChipClass, className)}>
        <Icon className={iconClass} />
        {runnerName}
      </span>
    );
  }
  const summary = `Attempt ${placement.attempt} on the ${placement.driver} driver`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="placement-record"
          title={`${summary}: show placement`}
          aria-label={`Placement: ${summary.toLowerCase()}`}
          className={cn(metaChipClass, metaChipActionClass, className)}
        >
          <Icon className={iconClass} />
          {runnerName ?? `${placement.driver} driver`}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl rounded-2xl" data-testid="placement-details">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Placement
          </DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border/60 text-sm">
          {runnerName && <Row label="Launcher" value={runnerName} />}
          <Row label="Attempt" value={String(placement.attempt)} />
          <Row label="Driver" value={placement.driver} />
          <Row label="Placement" value={placement.placement_id} mono />
          <Row label="Image" value={placementImageRef(placement)} mono />
          <Row label="Image from" value={IMAGE_LEVELS[placement.image_level] ?? placement.image_level} />
          <Row label="Identity binding" value={placement.identity_binding_id ?? 'Platform token'} mono={!!placement.identity_binding_id} />
          <Row label="Node" value={placement.node} mono />
        </dl>
      </DialogContent>
    </Dialog>
  );
}
