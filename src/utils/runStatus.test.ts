// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { computeDisplayStatus, isCanceledRunStatus, isFinalRunStatus, type RunStatusInput } from './runStatus';

describe('computeDisplayStatus', () => {
  // The TFE run statuses the API reports, and the badge each one shows.
  const cases: Array<[string, RunStatusInput, string]> = [
    ['errored', { status: 'errored' }, 'errored'],
    ['canceled', { status: 'canceled' }, 'cancelled'],
    ['force_canceled', { status: 'force_canceled' }, 'cancelled'],
    ['discarded', { status: 'discarded' }, 'discarded'],
    ['planned_and_finished plan-and-apply (no changes)', { status: 'planned_and_finished', operation: 'plan-and-apply', hasChanges: false }, 'finished'],
    ['planned_and_finished plan-only', { status: 'planned_and_finished', operation: 'plan-only', hasChanges: true }, 'finished'],
    ['planned_and_finished destroy with nothing to destroy', { status: 'planned_and_finished', operation: 'destroy' }, 'finished'],
    ['pending', { status: 'pending' }, 'pending'],
    ['pre_plan_completed', { status: 'pre_plan_completed' }, 'pending'],
    ['planning', { status: 'planning' }, 'planning'],
    ['applying', { status: 'applying' }, 'applying'],
    ['post_apply_completed', { status: 'post_apply_completed' }, 'applying'],
    ['pre_plan_running', { status: 'pre_plan_running' }, 'tasks-running'],
    ['post_plan_running', { status: 'post_plan_running' }, 'tasks-running'],
    ['pre_apply_running', { status: 'pre_apply_running' }, 'tasks-running'],
    ['post_apply_running', { status: 'post_apply_running' }, 'tasks-running'],
    ['planned waiting for confirmation', { status: 'planned', operation: 'plan-and-apply', hasChanges: true, isConfirmable: true }, 'planned'],
    ['post_plan_completed waiting for confirmation', { status: 'post_plan_completed', operation: 'plan-and-apply', hasChanges: true, isConfirmable: true }, 'planned'],
    ['planned destroy waiting for confirmation', { status: 'planned', operation: 'destroy', hasChanges: true }, 'planned'],
    ['applied', { status: 'applied', operation: 'plan-and-apply' }, 'applied'],
    ['applied destroy', { status: 'applied', operation: 'destroy' }, 'destroyed'],
    ['unknown status', { status: 'something-new' }, 'pending'],
  ];
  it.each(cases)('%s', (_name, input, want) => {
    expect(computeDisplayStatus(input)).toBe(want);
  });

  // An older response could hold a finished plan at `planned`; it never reads as awaiting a confirmation.
  it.each([
    ['plan-only operation', { status: 'planned', operation: 'plan-only' }],
    ['plan-only flag', { status: 'planned', planOnly: true }],
    ['no changes', { status: 'planned', operation: 'plan-and-apply', hasChanges: false }],
    ['not confirmable', { status: 'planned', operation: 'plan-and-apply', isConfirmable: false }],
  ] as Array<[string, RunStatusInput]>)('planned with %s is finished', (_name, input) => {
    expect(computeDisplayStatus(input)).toBe('finished');
  });
});

describe('isFinalRunStatus', () => {
  it.each(['applied', 'planned_and_finished', 'errored', 'canceled', 'force_canceled', 'discarded'])('%s is final', (s) => {
    expect(isFinalRunStatus(s)).toBe(true);
  });
  it.each(['pending', 'planning', 'planned', 'post_plan_completed', 'applying', 'post_apply_running', '', undefined])('%s is not final', (s) => {
    expect(isFinalRunStatus(s)).toBe(false);
  });
});

describe('isCanceledRunStatus', () => {
  it.each([['canceled', true], ['force_canceled', true], ['discarded', true], ['errored', false], ['applied', false]] as Array<[string, boolean]>)(
    '%s', (s, want) => {
      expect(isCanceledRunStatus(s)).toBe(want);
    },
  );
});
