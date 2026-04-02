// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { computeDisplayStatus, type RunStatusInput } from './runStatus';

describe('computeDisplayStatus', () => {
  // 1. Failed/Canceled (highest priority)
  it('returns errored for failed status', () => {
    expect(computeDisplayStatus({ status: 'failed' })).toBe('errored');
  });

  it('returns cancelled for canceled status', () => {
    expect(computeDisplayStatus({ status: 'canceled' })).toBe('cancelled');
  });

  // 2. In-progress statuses
  it('returns pending for pending status', () => {
    expect(computeDisplayStatus({ status: 'pending' })).toBe('pending');
  });

  it('returns planning for planning status', () => {
    expect(computeDisplayStatus({ status: 'planning' })).toBe('planning');
  });

  it('returns applying for applying status', () => {
    expect(computeDisplayStatus({ status: 'applying' })).toBe('applying');
  });

  it('returns running for running status', () => {
    expect(computeDisplayStatus({ status: 'running' })).toBe('running');
  });

  // 3. Planned status — complex branching
  describe('planned status', () => {
    it('returns finished for plan-only operation', () => {
      expect(computeDisplayStatus({ status: 'planned', operation: 'plan-only' })).toBe('finished');
    });

    it('returns finished when planOnly is true', () => {
      expect(computeDisplayStatus({ status: 'planned', planOnly: true })).toBe('finished');
    });

    it('returns finished when planOnly is true even with plan-and-apply operation', () => {
      expect(computeDisplayStatus({ status: 'planned', operation: 'plan-and-apply', planOnly: true })).toBe('finished');
    });

    it('returns finished when hasChanges is false', () => {
      expect(computeDisplayStatus({ status: 'planned', hasChanges: false })).toBe('finished');
    });

    it('returns planned when hasChanges is true', () => {
      expect(computeDisplayStatus({ status: 'planned', hasChanges: true })).toBe('planned');
    });

    it('returns planned when hasChanges undefined and canApply is true', () => {
      expect(computeDisplayStatus({ status: 'planned', canApply: true })).toBe('planned');
    });

    it('returns finished when hasChanges undefined and canApply is false', () => {
      expect(computeDisplayStatus({ status: 'planned', canApply: false })).toBe('finished');
    });

    it('returns planned when both hasChanges and canApply are undefined', () => {
      expect(computeDisplayStatus({ status: 'planned' })).toBe('planned');
    });

    it('returns planned for plan-and-apply with changes', () => {
      expect(computeDisplayStatus({
        status: 'planned',
        operation: 'plan-and-apply',
        hasChanges: true,
        canApply: true,
      })).toBe('planned');
    });

    it('returns finished for plan-and-apply with no changes', () => {
      expect(computeDisplayStatus({
        status: 'planned',
        operation: 'plan-and-apply',
        hasChanges: false,
      })).toBe('finished');
    });
  });

  // 4. Applied status
  describe('applied status', () => {
    it('returns destroyed for destroy operation', () => {
      expect(computeDisplayStatus({ status: 'applied', operation: 'destroy' })).toBe('destroyed');
    });

    it('returns applied for non-destroy operation', () => {
      expect(computeDisplayStatus({ status: 'applied', operation: 'plan-and-apply' })).toBe('applied');
    });

    it('returns applied when no operation specified', () => {
      expect(computeDisplayStatus({ status: 'applied' })).toBe('applied');
    });
  });

  // 5. Completed status
  describe('completed status', () => {
    it('returns finished for plan-and-apply (no changes)', () => {
      expect(computeDisplayStatus({ status: 'completed', operation: 'plan-and-apply' })).toBe('finished');
    });

    it('returns finished for plan-only', () => {
      expect(computeDisplayStatus({ status: 'completed', operation: 'plan-only' })).toBe('finished');
    });

    it('returns destroyed for destroy operation', () => {
      expect(computeDisplayStatus({ status: 'completed', operation: 'destroy' })).toBe('destroyed');
    });

    it('returns applied for unknown operation (legacy)', () => {
      expect(computeDisplayStatus({ status: 'completed' })).toBe('applied');
    });
  });

  // 6. Fallback
  it('returns pending for unknown status', () => {
    expect(computeDisplayStatus({ status: 'some-unknown-status' })).toBe('pending');
  });

  // 7. Table-driven: all priority combinations
  describe('priority ordering', () => {
    const cases: [RunStatusInput, string][] = [
      [{ status: 'failed', operation: 'destroy' }, 'errored'],
      [{ status: 'canceled', operation: 'plan-and-apply', hasChanges: true }, 'cancelled'],
      [{ status: 'pending', operation: 'plan-and-apply' }, 'pending'],
      [{ status: 'planning', operation: 'destroy' }, 'planning'],
      [{ status: 'applying', operation: 'plan-and-apply' }, 'applying'],
    ];

    for (const [input, expected] of cases) {
      it(`${input.status} with operation=${input.operation} returns ${expected}`, () => {
        expect(computeDisplayStatus(input)).toBe(expected);
      });
    }
  });
});
