// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Run status vocabulary and the unified status badge computation.
 *
 * The API reports the TFE run statuses
 * (https://developer.hashicorp.com/terraform/enterprise/api-docs/run#run-states). This module is
 * the single place the frontend interprets them: which statuses are final, and which badge a run
 * shows.
 *
 * @see frontend/src/components/runs/StatusBadge.tsx - Badge component
 * @see frontend/src/pages/RunDetail.tsx - Run detail page usage
 * @see frontend/src/pages/WorkspaceDetail.tsx - Workspace detail page usage
 * @see frontend/src/pages/Workspaces.tsx - Workspaces list page usage
 */

/**
 * The statuses after which a run never moves again: applied, planned and finished (a plan-only run,
 * or a plan with nothing to apply), errored, canceled, force-canceled or discarded.
 */
export const FINAL_RUN_STATUSES: readonly string[] = [
  'applied',
  'planned_and_finished',
  'errored',
  'canceled',
  'force_canceled',
  'discarded',
];

/** Whether a run status is final. */
export function isFinalRunStatus(status: string | undefined | null): boolean {
  return !!status && FINAL_RUN_STATUSES.includes(status);
}

/** Whether a run ended canceled, forcefully or not, or discarded. */
export function isCanceledRunStatus(status: string | undefined | null): boolean {
  return status === 'canceled' || status === 'force_canceled' || status === 'discarded';
}

export interface RunStatusInput {
  status: string;
  operation?: string;
  planOnly?: boolean;
  hasChanges?: boolean;
  /** actions.is-confirmable: the run waits for a confirmation of its plan. */
  isConfirmable?: boolean;
}

export type DisplayStatus =
  | 'pending'
  | 'planning'
  | 'planned'
  | 'applying'
  | 'applied'
  | 'finished'
  | 'errored'
  | 'cancelled'
  | 'discarded'
  | 'running'
  | 'destroyed'
  | 'tasks-running'
  | 'no-runs';

/**
 * Computes the badge a run shows from its TFE attributes (status, operation, plan-only,
 * has-changes, actions.is-confirmable).
 */
export function computeDisplayStatus(input: RunStatusInput): DisplayStatus {
  const { status, operation, planOnly, hasChanges, isConfirmable } = input;

  switch (status) {
    case 'errored':
      return 'errored';
    case 'canceled':
    case 'force_canceled':
      return 'cancelled';
    case 'discarded':
      return 'discarded';
    case 'planned_and_finished':
      // A plan-only run, or a plan with nothing to apply: the run is complete.
      return 'finished';
    case 'pending':
    case 'pre_plan_completed': // the pre-plan tasks passed; the run waits to plan like a pending one
      return 'pending';
    case 'planning':
      return 'planning';
    case 'applying':
    case 'post_apply_completed':
      return 'applying';
    case 'pre_plan_running':
    case 'post_plan_running':
    case 'pre_apply_running':
    case 'post_apply_running':
      return 'tasks-running';
    case 'planned':
    case 'post_plan_completed':
      // Waiting for a confirmation: post_plan_completed is `planned` when a post-plan task stage
      // exists. A plan-only run never rests here, and a plan with no changes is
      // planned_and_finished; the checks below only keep an older response readable.
      if (operation === 'plan-only' || planOnly || hasChanges === false || isConfirmable === false) {
        return 'finished';
      }
      return 'planned';
    case 'applied':
      return operation === 'destroy' ? 'destroyed' : 'applied';
    default:
      return 'pending';
  }
}
