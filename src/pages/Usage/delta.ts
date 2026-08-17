// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface KpiDelta {
  /** Already-formatted magnitude, e.g. "12%" or "1.8 pt". */
  text: string;
  direction: DeltaDirection;
  /** Whether this direction is good news. Falling duration is good; falling success rate is not. */
  good: boolean;
}

/**
 * Builds a delta from a current and previous value. Returns undefined when there is no previous
 * period to compare against, so a fresh organization shows no change rather than a meaningless
 * "+100%" against a baseline of zero.
 */
export function percentDelta(
  current: number,
  previous: number,
  opts: { lowerIsBetter?: boolean } = {}
): KpiDelta | undefined {
  if (previous <= 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.abs(change) < 0.5 ? 0 : Math.round(change);
  if (rounded === 0) return { text: 'no change', direction: 'flat', good: true };
  const direction: DeltaDirection = rounded > 0 ? 'up' : 'down';
  const good = opts.lowerIsBetter ? rounded < 0 : rounded > 0;
  return { text: `${Math.abs(rounded)}%`, direction, good };
}

/**
 * Point-difference delta for values already expressed as percentages. A null on either side means
 * one of the two periods decided nothing, so there is no comparison to draw.
 */
export function pointDelta(current: number | null, previous: number | null): KpiDelta | undefined {
  if (current === null || previous === null) return undefined;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { text: 'no change', direction: 'flat', good: true };
  return {
    text: `${Math.abs(diff)} pt`,
    direction: diff > 0 ? 'up' : 'down',
    good: diff > 0,
  };
}
