// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { DEFAULT_GRACE_HOURS, GRACE_OPTIONS, expiryStatus } from './agentTokenRotation';

describe('agent token rotation helpers', () => {
  it('offers only grace periods the server accepts, including the default', () => {
    for (const o of GRACE_OPTIONS) {
      expect(o.hours).toBeGreaterThanOrEqual(0);
      expect(o.hours).toBeLessThanOrEqual(168);
    }
    expect(GRACE_OPTIONS.map((o) => o.hours)).toContain(DEFAULT_GRACE_HOURS);
  });

  it('reports no expiry for a token that was never rotated', () => {
    expect(expiryStatus(undefined)).toBeNull();
    expect(expiryStatus('not a date')).toBeNull();
  });

  it('distinguishes a retiring token from one that has stopped working', () => {
    const now = new Date('2026-09-29T12:00:00Z');
    expect(expiryStatus('2026-09-30T12:00:00Z', now)?.expired).toBe(false);
    expect(expiryStatus('2026-09-28T12:00:00Z', now)?.expired).toBe(true);
    expect(expiryStatus('2026-09-29T12:00:00Z', now)?.expired).toBe(true);
  });
});
