// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { type ReactNode } from 'react';
import { PhaseBox } from './PhaseBox';
import type { Run } from '@/api/client';

interface UnifiedPhaseTimelineProps {
  run: Run;
  planOutput?: Record<string, unknown> | null;
  applyOutput?: string | null;
  planOutputLoading?: boolean;
  applyOutputLoading?: boolean;
  isApplyStarting?: boolean;
  canApply?: boolean;
  canDiscard?: boolean;
  onApplyClick?: () => void;
  onDiscardClick?: () => void;
  applying?: boolean;
  discarding?: boolean;
  actionButtonsRef?: React.RefObject<HTMLDivElement | null>;
  applyPhaseRef?: React.RefObject<HTMLDivElement | null>;
  planHasChanges?: boolean; // Whether plan has changes (to determine if apply phase should be shown)
  children?: {
    planPhaseContent?: ReactNode;
    applyPhaseContent?: ReactNode;
  };
}

/**
 * UnifiedPhaseTimeline component orchestrates the unified timeline view
 * Combines Created node, phase boxes, and connection lines into a single flow
 */
export function UnifiedPhaseTimeline({
  run,
  planOutput,
  applyOutput, // Required by interface but not used
  planOutputLoading = false, // Required by interface but not used
  applyOutputLoading = false, // Required by interface but not used
  isApplyStarting = false,
  canApply = false,
  canDiscard = false,
  onApplyClick,
  onDiscardClick,
  applying = false,
  discarding = false,
  actionButtonsRef,
  applyPhaseRef,
  planHasChanges,
  children,
}: UnifiedPhaseTimelineProps) {
  // Suppress unused variable warnings for props required by interface
  void applyOutput;
  void planOutputLoading;
  void applyOutputLoading;

  // Extract phase-specific timestamps from status-timestamps (TFE-compatible)
  // IMPORTANT: Must be extracted before functions that use them
  const statusTimestamps = run['status-timestamps'];
  const planningAt = statusTimestamps?.['planning-at'];
  const plannedAt = statusTimestamps?.['planned-at'];
  const applyingAt = statusTimestamps?.['applying-at'];
  const appliedAt = statusTimestamps?.['applied-at'];

  // Determine Plan Phase status and title
  const getPlanPhaseProps = () => {
    let status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' = 'pending';
    let title = 'Plan Phase';

    // Handle cancelled status first - check timestamps to determine which phase was cancelled
    if (run.status === 'canceled') {
      // If plan completed (has planned-at), plan phase succeeded before cancellation
      if (plannedAt) {
        status = 'completed';
        title = 'Plan Finished';
      } else {
        // Plan was cancelled before completion
        status = 'cancelled';
        title = 'Plan Phase';
      }
      return { status, title, timestamp: run.started_at };
    }

    if (run.status === 'planning') {
      status = 'running';
      title = 'Plan Phase';
    } else if (run.status === 'planned' || run.status === 'applying' || run.status === 'applied' || run.status === 'completed') {
      status = 'completed';
      title = 'Plan Finished';
    } else     if (run.status === 'failed') {
      // For plan-and-apply and destroy runs, check if plan phase completed before failure
      // Strictly require plannedAt timestamp (PlanCompletedAt from backend)
      // Weak indicators like planOutput or applyingAt can lead to false positives on failed plans
      const planCompleted = !!plannedAt;
      if ((run.operation === 'plan-and-apply' || run.operation === 'destroy') && planCompleted) {
        status = 'completed';
        title = 'Plan Finished';
      } else if (run.operation === 'plan-only' || run.operation === 'plan-and-apply' || run.operation === 'destroy') {
        status = 'failed';
        title = 'Plan Phase';
      }
    }

    return { status, title, timestamp: run.started_at };
  };

  // Determine Apply Phase status and title
  // TFE-compatible: Destroy runs use the same two-phase flow as plan-and-apply
  const getApplyPhaseProps = () => {
    let status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' = 'pending';
    const isDestroy = run.operation === 'destroy';
    let title = isDestroy ? 'Destroy Phase' : 'Apply Phase';

    // For runs with no changes: backend sets status to 'completed' but apply never ran
    const applyActuallyRan = applyingAt !== undefined;
    const hasNoChanges = planHasChanges === false;
    
    if ((run.operation === 'plan-and-apply' || isDestroy) && run.status === 'completed' && hasNoChanges && !applyActuallyRan) {
      status = 'pending';
      return { status, title, timestamp: run.started_at };
    }

    // Handle cancelled status - the entire run was discarded/cancelled, so apply/destroy phase is also cancelled
    if (run.status === 'canceled') {
      status = 'cancelled';
      return { status, title, timestamp: applyingAt || run.started_at };
    }

    if (run.status === 'applying' || isApplyStarting) {
      status = 'running';
    } else if (run.status === 'applied' || (run.status === 'completed' && (applyActuallyRan || planHasChanges !== false))) {
      status = 'completed';
      title = isDestroy ? 'Destroyed' : 'Applied';
    } else if (run.status === 'failed' && (run.operation === 'plan-and-apply' || isDestroy)) {
      status = 'failed';
    }

    return { status, title, timestamp: run.started_at };
  };

  // Determine default expansion for Plan Phase
  // Expand if pending, planning, planned, or failed (to show errors)
  const getPlanPhaseDefaultExpanded = () => {
    // If cancelled during planning, expand to show cancellation
    if (run.status === 'canceled' && !plannedAt) {
      return true;
    }
    // If failed but plan completed (plannedAt set), collapse plan phase to focus on Apply error
    if (run.status === 'failed' && plannedAt) {
      return false;
    }
    // If completed with no changes, expand plan so user can see "No changes detected"
    if (run.status === 'completed' && planHasChanges === false) {
      return true;
    }
    return run.status === 'pending' || run.status === 'planning' || run.status === 'planned' || run.status === 'failed';
  };

  // Determine default expansion for Apply Phase
  const getApplyPhaseDefaultExpanded = () => {
    // Expand if cancelled during apply (has applying-at timestamp)
    if (run.status === 'canceled' && applyingAt) {
      return true;
    }
    // Expand if failed during apply/destroy
    if (run.status === 'failed' && (run.operation === 'plan-and-apply' || run.operation === 'destroy')) {
      return true;
    }
    return run.status === 'applying' || run.status === 'applied' || run.status === 'completed' || isApplyStarting;
  };

  // Determine if Plan Phase is collapsible
  const isPlanPhaseCollapsible = () => {
    return run.status !== 'pending' && run.status !== 'planning';
  };

  // Render action buttons for plan-and-apply and destroy runs
  const renderActionButtons = () => {
    if ((run.operation !== 'plan-and-apply' && run.operation !== 'destroy') || !canApply || run.status !== 'planned') {
      return null;
    }

    return (
      <div ref={actionButtonsRef} className="flex flex-wrap items-center gap-2 sm:gap-3 py-4">
        {onApplyClick && (
          <button
            onClick={onApplyClick}
            disabled={applying}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
          >
            {applying ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="hidden sm:inline">{run.operation === 'destroy' ? 'Confirming Destroy...' : 'Creating Apply Run...'}</span>
                <span className="sm:hidden">{run.operation === 'destroy' ? 'Destroying...' : 'Applying...'}</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {run.operation === 'destroy' ? 'Confirm Destroy' : 'Apply Plan'}
              </>
            )}
          </button>
        )}
        {canDiscard && onDiscardClick && (
          <button
            onClick={onDiscardClick}
            disabled={discarding}
            className="px-4 py-2 border border-red-500/50 hover:border-red-500 text-red-600 hover:text-red-700 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
          >
            {discarding ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="hidden sm:inline">Discarding...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">Discard Plan</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0">
      {/* Plan-and-Apply Runs */}
      {run.operation === 'plan-and-apply' && (
        <>
          {/* Plan Phase */}
          <PhaseBox
            phase="planning"
            title={getPlanPhaseProps().title}
            timestamp={getPlanPhaseProps().timestamp}
            status={getPlanPhaseProps().status}
            defaultExpanded={getPlanPhaseDefaultExpanded()}
            collapsible={isPlanPhaseCollapsible()}
            actionButtons={renderActionButtons()}
            metadata={{
              terraformVersion: planOutput && 'terraform_version' in planOutput ? String(planOutput.terraform_version) : undefined,
              createdAt: run.created_at,
              // Use phase-specific timestamps from status-timestamps (TFE-compatible)
              // planning-at is when plan phase started, planned-at is when plan phase finished
              startedAt: planningAt || run.started_at,
              finishedAt: plannedAt,
            }}
          >
            {children?.planPhaseContent}
          </PhaseBox>


          {/* Apply Phase - Only show when applying/applied/completed, isApplyStarting, failed during apply, or cancelled after plan completed */}
          {/* Hide apply phase if plan has no changes and apply never ran (no applying-at timestamp) */}
          {/* Backend sets status to 'completed' when no changes, so we check planHasChanges to determine if apply ran */}
          {/* Use multiple indicators: applyingAt, plannedAt timestamps, or planOutput existence to determine if plan completed */}
          {((run.status === 'applying' || run.status === 'applied' || isApplyStarting ||
            (run.status === 'completed' && (applyingAt !== undefined || planHasChanges === true || planHasChanges === undefined)) ||
            (run.status === 'failed' && run.operation === 'plan-and-apply' &&
              (applyingAt || plannedAt)) ||
            (run.status === 'canceled' && run.operation === 'plan-and-apply' && (plannedAt || applyingAt)))) && (
              <>
                <PhaseBox
                  ref={applyPhaseRef}
                  phase="applying"
                  title={getApplyPhaseProps().title}
                  timestamp={getApplyPhaseProps().timestamp}
                  status={getApplyPhaseProps().status}
                  defaultExpanded={getApplyPhaseDefaultExpanded()}
                  collapsible={true}
                  showConnectionLine={false}
                  metadata={{
                    terraformVersion: planOutput && 'terraform_version' in planOutput ? String(planOutput.terraform_version) : undefined,
                    // Use phase-specific timestamps from status-timestamps (TFE-compatible)
                    // applying-at is when the user clicked "Apply Plan" and apply phase started
                    // applied-at is when apply phase finished
                    startedAt: applyingAt,
                    finishedAt: appliedAt,
                  }}
                >
                  {children?.applyPhaseContent}
                </PhaseBox>
              </>
            )}
        </>
      )}

      {/* Plan-Only Runs */}
      {run.operation === 'plan-only' && (
        <>
          {/* Plan Phase */}
          <PhaseBox
            phase="planning"
            title={getPlanPhaseProps().title}
            timestamp={getPlanPhaseProps().timestamp}
            status={getPlanPhaseProps().status}
            defaultExpanded={getPlanPhaseDefaultExpanded()}
            collapsible={isPlanPhaseCollapsible()}
            showConnectionLine={false}
            metadata={{
              terraformVersion: planOutput && 'terraform_version' in planOutput ? String(planOutput.terraform_version) : undefined,
              createdAt: run.created_at,
              // Use phase-specific timestamps from status-timestamps (TFE-compatible)
              startedAt: planningAt || run.started_at,
              finishedAt: plannedAt || (run.status === 'planned' || run.status === 'completed' ? run.completed_at : undefined),
            }}
          >
            {children?.planPhaseContent}
          </PhaseBox>
        </>
      )}

      {/* Destroy Runs - TFE-compatible: uses Plan (destroy plan) + Apply (destroy execution) phases */}
      {run.operation === 'destroy' && (
        <>
          {/* Plan Phase (destroy plan - shows what will be destroyed) */}
          <PhaseBox
            phase="planning"
            title={getPlanPhaseProps().title}
            timestamp={getPlanPhaseProps().timestamp}
            status={getPlanPhaseProps().status}
            defaultExpanded={getPlanPhaseDefaultExpanded()}
            collapsible={isPlanPhaseCollapsible()}
            actionButtons={renderActionButtons()}
            metadata={{
              terraformVersion: planOutput && 'terraform_version' in planOutput ? String(planOutput.terraform_version) : undefined,
              createdAt: run.created_at,
              startedAt: planningAt || run.started_at,
              finishedAt: plannedAt,
            }}
          >
            {children?.planPhaseContent}
          </PhaseBox>

          {/* Destroy Phase (apply the destroy plan - actually destroys resources) */}
          {((run.status === 'applying' || run.status === 'applied' || isApplyStarting ||
            (run.status === 'completed' && (applyingAt !== undefined || planHasChanges === true || planHasChanges === undefined)) ||
            (run.status === 'failed' && run.operation === 'destroy' &&
              (applyingAt || plannedAt)) ||
            (run.status === 'canceled' && run.operation === 'destroy' && (plannedAt || applyingAt)))) && (
              <>
                <PhaseBox
                  ref={applyPhaseRef}
                  phase="applying"
                  title={getApplyPhaseProps().title}
                  timestamp={getApplyPhaseProps().timestamp}
                  status={getApplyPhaseProps().status}
                  defaultExpanded={getApplyPhaseDefaultExpanded()}
                  collapsible={true}
                  showConnectionLine={false}
                  metadata={{
                    terraformVersion: planOutput && 'terraform_version' in planOutput ? String(planOutput.terraform_version) : undefined,
                    startedAt: applyingAt,
                    finishedAt: appliedAt,
                  }}
                >
                  {children?.applyPhaseContent}
                </PhaseBox>
              </>
            )}
        </>
      )}
    </div>
  );
}

