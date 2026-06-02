// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useRef, useState } from 'react';
import { runsApi, type Run } from '@/api/client';
import { getRunFromJsonApi } from '@/utils/jsonapi';

interface UseRunPollingOptions {
  runId: string | null;
  enabled?: boolean;
  pollInterval?: number;
  onStatusChange?: (run: Run) => void;
  onPlanOutputChange?: (planOutput: Record<string, unknown>) => void;
  onLogsChange?: (logs: string) => void;
  onPlanLogsChange?: (logs: string) => void;
}

/**
 * useRunPolling hook provides real-time polling for run status and outputs
 * Similar to Terraform Enterprise's real-time run experience
 * 
 * Features:
 * - Polls run status while run is pending/running
 * - Fetches plan output when plan completes
 * - Fetches logs incrementally for apply/destroy runs
 * - Stops polling when run completes/fails/cancels
 */
export function useRunPolling({
  runId,
  enabled = true,
  pollInterval = 2000, // Poll every 2 seconds (TFE-like)
  onStatusChange,
  onPlanOutputChange,
  onLogsChange,
  onPlanLogsChange,
}: UseRunPollingOptions) {
  const [run, setRun] = useState<Run | null>(null);
  const [planOutput, setPlanOutput] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<string | null>(null);
  const [planLogs, setPlanLogs] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<{
    resources?: Array<{
      address: string;
      status: string;
      resource_id?: string;
      created_at?: string;
      action: string;
      error_message?: string;
      details?: string;
    }>;
    summary?: {
      additions: number;
      changes: number;
      destructions: number;
      failed: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const planFetchedRef = useRef(false);
  const planLogsFetchedRef = useRef(false);
  const logsFetchedRef = useRef(false);
  const applyStateFetchedRef = useRef(false);
  const lastLogOffsetRef = useRef(0);
  const currentStatusRef = useRef<string | null>(null); // Use ref to track status across closures
  const currentOperationRef = useRef<string | null>(null); // Track operation for terminal check
  const previousStatusRef = useRef<string | null>(null); // Track previous status for change detection
  const consecutiveErrorsRef = useRef(0); // Track consecutive network errors
  const isMountedRef = useRef(true);

  // Reset refs when runId changes to allow fetching plan output for new runs
  useEffect(() => {
    if (runId) {
      planFetchedRef.current = false;
      planLogsFetchedRef.current = false;
      logsFetchedRef.current = false;
      applyStateFetchedRef.current = false;
      lastLogOffsetRef.current = 0;
      currentStatusRef.current = null;
      currentOperationRef.current = null;
      previousStatusRef.current = null;
      consecutiveErrorsRef.current = 0;
    }
  }, [runId]);

  useEffect(() => {
    if (!runId || !enabled) {
      setLoading(false);
      return;
    }

    isMountedRef.current = true;

    // Helper to check if current run is in a terminal state
    const isInTerminalState = () => {
      const status = currentStatusRef.current;
      const operation = currentOperationRef.current;
      if (!status) return false;
      if (status === 'failed' || status === 'canceled') return true;
      if (status === 'applied') return true;
      if (status === 'planned' && operation === 'plan-only') return true;
      if (status === 'completed') return true;
      return false;
    };

    const fetchRun = async () => {
      // Don't fetch if component is unmounted
      if (!isMountedRef.current) return;

      // Don't fetch if run is already in terminal state
      if (isInTerminalState()) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }

      try {
        const response = await runsApi.get(runId);
        const runData = getRunFromJsonApi(response.data);

        if (!isMountedRef.current) return;

        const previousStatus = currentStatusRef.current;
        currentStatusRef.current = runData.status;
        currentOperationRef.current = runData.operation;
        previousStatusRef.current = previousStatus;
        consecutiveErrorsRef.current = 0; // Reset error count on success
        setRun(runData);
        setError(null);

        // Reset log offset when status changes from planned to applying (for plan-and-apply runs)
        if (runData.operation === 'plan-and-apply' &&
          previousStatus === 'planned' &&
          runData.status === 'applying') {
          // Status just changed from planned to applying, reset log offset to fetch fresh logs
          lastLogOffsetRef.current = 0;
          logsFetchedRef.current = false;
        }

        // Notify status change
        if (previousStatus && previousStatus !== runData.status) {
          onStatusChange?.(runData);
        }

        // Fetch plan output when plan phase completes
        // Plan-and-apply, plan-only, and destroy runs all have a plan phase — fetch plan for all of them
        const shouldFetchPlan = (
          (runData.operation === 'plan-only' || runData.operation === 'plan' || runData.operation === 'plan-and-apply' || runData.operation === 'destroy') &&
          (runData.status === 'planned' || runData.status === 'applying' || runData.status === 'applied' || runData.status === 'failed' || runData.status === 'canceled' ||
            (runData.operation !== 'plan-and-apply' && runData.operation !== 'destroy' && runData.status === 'completed')) &&
          !planFetchedRef.current
        );

        if (shouldFetchPlan) {
          planFetchedRef.current = true;
          try {
            const planResponse = await runsApi.getPlan(runId) as unknown;
            // Check if planResponse is valid (not null/undefined and has content)
            const hasContent = planResponse && (
              (typeof planResponse === 'object' && !Array.isArray(planResponse) && Object.keys(planResponse).length > 0) ||
              (Array.isArray(planResponse) && planResponse.length > 0)
            );
            if (hasContent && isMountedRef.current && typeof planResponse === 'object' && !Array.isArray(planResponse)) {
              const planOutputData = planResponse as Record<string, unknown>;
              setPlanOutput(planOutputData);
              onPlanOutputChange?.(planOutputData);
            }
          } catch (err) {
            console.error('Failed to fetch plan output:', err);
            // Don't retry on 404 (plan doesn't exist yet or was deleted)
            if (err instanceof Error && !err.message.includes('404')) {
              planFetchedRef.current = false; // Allow retry for non-404 errors
            }
          }
        }

        // Fetch plan logs when we have plan output but no plan logs in state
        // Use phase=plan parameter to explicitly request plan logs, even when status is 'applying'/'applied'
        // This allows fetching plan logs on page reload after apply starts
        // Also fetch if plan has completed (has planned-at timestamp) even if planOutput is null (no changes case)
        const hasPlanOutput = (planOutput && typeof planOutput === 'object' && Object.keys(planOutput).length > 0) ||
          (runData.plan_output && typeof runData.plan_output === 'object' && Object.keys(runData.plan_output).length > 0);
        const planHasCompleted = runData['status-timestamps']?.['planned-at'] !== undefined;
        const isPlanOperation = runData.operation === 'plan-only' || runData.operation === 'plan-and-apply' || runData.operation === 'destroy';
        // Fetch plan logs if: (1) we have plan output, OR (2) plan has completed (even with no changes)
        const shouldFetchPlanLogs = (hasPlanOutput || planHasCompleted) && !planLogsFetchedRef.current && isPlanOperation;

        if (shouldFetchPlanLogs) {
          planLogsFetchedRef.current = true;
          try {
            // Use explicit plan logs endpoint (no phase parameter confusion)
            const fetchedLogs = await runsApi.getPlanLogs(runId);
            if (isMountedRef.current && fetchedLogs) {
              setPlanLogs(fetchedLogs);
              onPlanLogsChange?.(fetchedLogs);
            }
          } catch (err) {
            console.error('Failed to fetch plan logs:', err);
            planLogsFetchedRef.current = false; // Allow retry on error
          }
        }

        // Fetch apply state from applies endpoint when apply phase has started or completed
        // This provides stored state for reloads (from database, not re-parsing logs)
        // Check if apply phase has started (applying-at exists) or completed (applied/failed/cancelled status)
        // TFE-compatible: both plan-and-apply and destroy runs follow the same two-phase flow
        const isTwoPhaseRun = runData.operation === 'plan-and-apply' || runData.operation === 'destroy';
        const hasApplyStarted = isTwoPhaseRun && 
          runData['status-timestamps']?.['applying-at'] !== undefined;
        const hasApplyCompleted = isTwoPhaseRun && 
          (runData.status === 'applied' || runData.status === 'failed' || runData.status === 'applying' || runData.status === 'canceled');
        // Also check if run was cancelled but apply phase had started (cancelled during apply/destroy)
        const wasCancelledDuringApply = isTwoPhaseRun && 
          runData.status === 'canceled' && 
          runData['status-timestamps']?.['applying-at'] !== undefined;
        const shouldFetchApplyState = (hasApplyStarted || hasApplyCompleted || wasCancelledDuringApply) && !applyStateFetchedRef.current;

        if (shouldFetchApplyState) {
          applyStateFetchedRef.current = true;
          try {
            const applyResponse = await runsApi.getApply(runId);
            if (isMountedRef.current && applyResponse) {
              const applyResources = applyResponse['apply-resources'] as Array<{
                address: string;
                status: string;
                resource_id?: string;
                created_at?: string;
                action: string;
                error_message?: string;
                details?: string;
              }> | undefined;
              const summary = (applyResponse['apply-summary'] as { additions?: number; changes?: number; destructions?: number; failed?: number } | undefined) || {
                additions: (applyResponse['resource-additions'] as number | undefined) || 0,
                changes: (applyResponse['resource-changes'] as number | undefined) || 0,
                destructions: (applyResponse['resource-destructions'] as number | undefined) || 0,
                failed: 0,
              };
              
              if (applyResources) {
                setApplyState({
                  resources: applyResources,
                  summary: summary as { additions: number; changes: number; destructions: number; failed: number },
                });
              }
            }
          } catch (err) {
            console.error('Failed to fetch apply state:', err);
            // Don't retry on 404 (apply doesn't exist yet)
            if (err instanceof Error && !err.message.includes('404')) {
              applyStateFetchedRef.current = false; // Allow retry for non-404 errors
            }
          }
        }

        // Fetch logs for apply/destroy runs (incrementally)
        // TFE-compatible: Both plan-and-apply and destroy runs follow the same two-phase flow
        // Fetch apply/destroy phase logs when in applying/applied status
        // Also fetch logs when run has failed or was cancelled during apply (to show error/cancellation details)
        const shouldFetchLogs = (
          ((runData.operation === 'plan-and-apply' || runData.operation === 'destroy') &&
            (runData.status === 'applying' || runData.status === 'applied' || wasCancelledDuringApply)) ||
          ((runData.operation === 'apply') &&
            (runData.status === 'running' || runData.status === 'completed')) ||
          runData.status === 'failed' // Fetch logs when run fails to show error details
        );

        if (shouldFetchLogs) {
          try {
            // For plan-and-apply and destroy runs, use explicit apply logs endpoint
            // TFE-compatible: destroy runs use plan + apply phases (apply logs for the destroy execution)
            let currentLogs: string;
            if (runData.operation === 'plan-and-apply' || runData.operation === 'destroy') {
              currentLogs = await runsApi.getApplyLogs(runId);
            } else {
              // For other operations (plan-only), use generic endpoint
              currentLogs = await runsApi.getLogs(runId);
            }
            if (isMountedRef.current) {
              // For applying status, always update logs to show streaming progress
              // For applied/completed status, only update if we have new content
              const isApplying = (runData.operation === 'plan-and-apply' || runData.operation === 'destroy') && runData.status === 'applying';

              // Always update logs if we're applying (to show real-time progress)
              // or if we have new content (longer logs)
              // For cancelled/failed runs, always update if we have logs (to show what happened)
              // IMPORTANT: Only set apply logs here - never set plan logs to the logs state
              const isCancelledOrFailed = runData.status === 'canceled' || runData.status === 'failed';
              if (isApplying || isCancelledOrFailed) {
                // During apply, cancelled, or failed - always update logs to trigger re-parsing and status updates
                // For cancelled runs, if no apply logs exist, set to empty string (don't show plan logs)
                // getApplyLogs() ensures we only get apply logs, never plan logs (no fallback)
                // CRITICAL: For cancelled runs, explicitly set empty string if no apply logs exist
                // This prevents any plan logs from being shown in the apply phase terminal view
                if (isCancelledOrFailed && (!currentLogs || currentLogs.trim().length === 0)) {
                  // Cancelled/failed with no apply logs - explicitly set empty to prevent plan log leakage
                  setLogs('');
                  onLogsChange?.('');
                  lastLogOffsetRef.current = 0;
                } else {
                  // We have apply logs, use them
                  const applyLogs = currentLogs || '';
                  setLogs(applyLogs);
                  onLogsChange?.(applyLogs);
                  if (applyLogs) {
                    lastLogOffsetRef.current = applyLogs.length;
                  } else {
                    lastLogOffsetRef.current = 0;
                  }
                }
              } else if (currentLogs && currentLogs.trim().length > 0) {
                // For other statuses, only update if we have new content
                if (currentLogs.length > lastLogOffsetRef.current) {
                  setLogs(currentLogs);
                  onLogsChange?.(currentLogs);
                  lastLogOffsetRef.current = currentLogs.length;
                }
              }
            }
            // Only mark as fetched if we're not actively applying (to allow continuous polling)
            if (runData.status !== 'applying') {
              logsFetchedRef.current = true;
            }
          } catch (err) {
            console.error('Failed to fetch logs:', err);
            // Don't mark as fetched on error if we're applying, allow retry
            if (runData.status !== 'applying') {
              logsFetchedRef.current = true;
            }
          }
        }

        // Stop polling if run is in terminal state
        // For plan-and-apply runs: 'applied' is terminal
        // For plan-only runs: 'planned' is terminal
        // For legacy runs: 'completed', 'failed', 'canceled' are terminal
        const isTerminal = (
          runData.status === 'failed' ||
          runData.status === 'canceled' ||
          (runData.operation === 'plan-and-apply' && runData.status === 'applied') ||
          (runData.operation === 'plan-only' && runData.status === 'planned') ||
          (runData.operation === 'destroy' && (runData.status === 'applied' || runData.status === 'completed')) ||
          ((runData.operation === 'apply' || runData.operation === 'plan') && runData.status === 'completed')
        );
        if (isTerminal && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        consecutiveErrorsRef.current += 1;
        setError(err instanceof Error ? err : new Error('Failed to fetch run'));
        console.error('Failed to fetch run:', err);
        // Stop polling after 3 consecutive network errors
        if (consecutiveErrorsRef.current >= 3 && pollIntervalRef.current) {
          console.warn('Stopping run polling after 3 consecutive errors');
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    void fetchRun();

    // Set up polling for non-terminal states
    if (!isInTerminalState()) {
      pollIntervalRef.current = setInterval(() => {
        if (isInTerminalState()) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }
        void fetchRun();
      }, pollInterval);
    }

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
     
    // planLogs and planOutput are intentionally omitted - they're state set by this effect,
    // and adding them would cause infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, enabled, pollInterval, onStatusChange, onPlanOutputChange, onLogsChange, onPlanLogsChange]);

  return {
    run,
    planOutput,
    logs,
    planLogs,
    applyState,
    loading,
    error,
    refetch: () => {
      if (runId && isMountedRef.current) {
        void runsApi.get(runId)
          .then((response) => {
            if (isMountedRef.current) {
              const runData = getRunFromJsonApi(response.data);
              setRun(runData);
              currentStatusRef.current = runData.status;
            }
          })
          .catch((err) => {
            if (isMountedRef.current) {
              setError(err instanceof Error ? err : new Error('Failed to refetch run'));
            }
          });
      }
    },
  };
}
