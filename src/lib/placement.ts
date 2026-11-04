// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The placement record of a run, an Ansible job or a work item (#933, D4, AC77): where its latest
 * attempt ran. While the work waits on a hosted pool, the queue fields say why (D9, AC56).
 */
export interface Placement {
  attempt: number;
  driver: string;
  placement_id: string;
  image: string;
  image_digest: string;
  image_level: string;
  identity_binding_id: string | null;
  node: string;
  /** hosted_capacity_cap or no_hosted_capacity_in_group while waiting on a hosted pool, else empty. */
  queue_reason: string;
  queue_cap: number | null;
  queue_in_flight: number | null;
  /** The work's place in the hosted pool's queue, 1 for the next to start; null when unknown. */
  queue_position: number | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

/** Reads the wire attributes (`placement-id`, `image-digest`, ...) of a placement record. */
export function placementFromAttributes(raw: unknown): Placement | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as Record<string, unknown>;
  const binding = a['identity-binding-id'];
  return {
    attempt: typeof a['attempt'] === 'number' ? a['attempt'] : 0,
    driver: str(a['driver']),
    placement_id: str(a['placement-id']),
    image: str(a['image']),
    image_digest: str(a['image-digest']),
    image_level: str(a['image-level']),
    identity_binding_id: typeof binding === 'string' ? binding : null,
    node: str(a['node']),
    queue_reason: str(a['queue-reason']),
    queue_cap: numOrNull(a['queue-cap']),
    queue_in_flight: numOrNull(a['queue-in-flight']),
    queue_position: numOrNull(a['queue-position']),
  };
}

/** Whether the work has been placed at least once: a placement always names its driver. */
export function hasPlacement(p: Placement | undefined): p is Placement {
  return !!p && p.driver !== '';
}

/** The timeline copy for work waiting on hosted capacity, or '' when it is not waiting on it. */
export function queueReasonText(p: Placement | undefined): string {
  if (!p) return '';
  const position = p.queue_position ? `, position ${p.queue_position} in the queue` : '';
  switch (p.queue_reason) {
    case 'hosted_capacity_cap':
      return `Waiting for hosted capacity (${p.queue_in_flight ?? 0} of ${p.queue_cap ?? 0} slots in use${position})`;
    case 'no_hosted_capacity_in_group':
      return `Waiting for hosted capacity (no hosted launcher is online${position})`;
    default:
      return '';
  }
}

/** A launcher's network mode (D5) as the pool page shows it. */
export function networkModeLabel(mode: string): string {
  switch (mode) {
    case 'platform':
      return 'Platform (egress only, metadata blocked)';
    case 'host-identity':
      return 'Host identity (metadata reachable)';
    case '':
      return '-';
    default:
      return mode;
  }
}
