// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe, expect, it } from 'vitest';
import { isRunSettled } from './runSettled';

describe('isRunSettled', () => {
  it('treats a finished plan-only run, which the API reports as planned, as settled', () => {
    expect(isRunSettled({ status: 'planned', operation: 'plan-only' })).toBe(true);
  });

  it('keeps a plan-and-apply run waiting for confirmation unsettled: its apply is still to be placed', () => {
    expect(isRunSettled({ status: 'planned', operation: 'plan-and-apply' })).toBe(false);
  });

  it.each(['applied', 'planned_and_finished', 'errored', 'failed', 'canceled', 'discarded', 'force_canceled'])('treats %s as settled', (status) => {
    expect(isRunSettled({ status, operation: 'plan-and-apply' })).toBe(true);
  });

  it.each(['pending', 'planning', 'applying', 'post_plan_running'])('keeps %s unsettled', (status) => {
    expect(isRunSettled({ status, operation: 'plan-and-apply' })).toBe(false);
  });

  it('is unsettled with no run yet', () => {
    expect(isRunSettled(undefined)).toBe(false);
  });
});
