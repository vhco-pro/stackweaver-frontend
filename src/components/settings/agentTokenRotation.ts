// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Agent token rotation helpers: the grace-window choices offered when rotating, and how a retired
// token's expiry reads in the token list. Kept out of the component so they are unit-testable.

export interface GraceOption {
  hours: number;
  label: string;
}

// The server accepts 0..168 hours and defaults to 24 when no value is sent.
export const GRACE_OPTIONS: GraceOption[] = [
  { hours: 0, label: 'Retire the old token immediately' },
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
];

export const DEFAULT_GRACE_HOURS = 24;

// expiryStatus describes a token's expiry for the list: null when the token never expires (it was
// never rotated), otherwise whether it has already stopped working.
export function expiryStatus(expiredAt: string | undefined, now: Date = new Date()): { expired: boolean; at: Date } | null {
  if (!expiredAt) return null;
  const at = new Date(expiredAt);
  if (Number.isNaN(at.getTime())) return null;
  return { expired: at.getTime() <= now.getTime(), at };
}
