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
  const applyStateFetchedRef = useRef(false);
  // Per-phase incremental log cursors. Each phase (plan, apply) is its own log stream and
  // is fetched with ?offset=<bytesReceived> + append, so a poll transfers only the new tail
  // instead of re-downloading the whole (growing) log. Offsets are RAW byte counts (markers
  // included) to match the server's byte-based slicing; the text mirrors hold the assembled
  // log so we can append without reading possibly-stale state; the done flags latch on ETX.
  const planLogOffsetRef = useRef(0);
  const planLogsRef = useRef('');
  const planLogDoneRef = useRef(false);
  const applyLogOffsetRef = useRef(0);
  const applyLogsRef = useRef('');
  const applyLogDoneRef = useRef(false);
  const currentStatusRef = useRef<string | null>(null); // Use ref to track status across closures
  const currentOperationRef = useRef<string | null>(null); // Track operation for terminal check
  const previousStatusRef = useRef<string | null>(null); // Track previous status for change detection
  const consecutiveErrorsRef = useRef(0); // Track consecutive network errors
  const isMountedRef = useRef(true);

  // Reset refs when runId changes to allow fetching plan output for new runs
  useEffect(() => {
    if (runId) {
      planFetchedRef.current = false;
      applyStateFetchedRef.current = false;
      planLogOffsetRef.current = 0;
      planLogsRef.current = '';
      planLogDoneRef.current = false;
      applyLogOffsetRef.current = 0;
      applyLogsRef.current = '';
      applyLogDoneRef.current = false;
      currentStatusRef.current = null;
      currentOperationRef.current = null;
      previousStatusRef.current = null;
      consecutiveErrorsRef.current = 0;
    }
  }, [runId]);

  // When there's nothing to poll, clear the loading flag during render rather than
  // in the effect below (avoids set-state-in-effect). Loading otherwise only flips
  // false once a fetch settles (see the fetch's finally).
  if ((!runId || !enabled) && loading) {
    setLoading(false);
  }

  useEffect(() => {
    if (!runId || !enabled) {
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
      // post_plan_completed is the plan-only rest state when a post-plan run task exists.
      if (status === 'post_plan_completed' && operation === 'plan-only') return true;
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

        // On the plan→apply transition the apply phase begins its own fresh log stream;
        // start its cursor at 0 (plan cursor stays independent and keeps its assembled text).
        if (runData.operation === 'plan-and-apply' &&
          previousStatus === 'planned' &&
          runData.status === 'applying') {
          applyLogOffsetRef.current = 0;
          applyLogsRef.current = '';
          applyLogDoneRef.current = false;
        }

        // Notify status change
        if (previousStatus && previousStatus !== runData.status) {
          onStatusChange?.(runData);
        }

        // Fetch plan output when plan phase completes
        // Plan-and-apply, plan-only, and destroy runs all have a plan phase - fetch plan for all of them
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

        // Stream plan-phase logs incrementally for any plan-having operation, from the start
        // of the plan phase through completion (and on reload of a finished run, where a single
        // offset-0 fetch returns the whole framed log). The explicit plan endpoint never
        // returns apply logs, so there's no phase confusion. Poll with the byte offset, append
        // the new tail, and latch done on ETX so we stop re-requesting once the stream ends.
        const isPlanOperation = runData.operation === 'plan-only' || runData.operation === 'plan' || runData.operation === 'plan-and-apply' || runData.operation === 'destroy';
        if (isPlanOperation && !planLogDoneRef.current) {
          try {
            const chunk = await runsApi.getPlanLogs(runId, { offset: planLogOffsetRef.current });
            if (isMountedRef.current) {
              if (chunk.bytes > 0) {
                planLogOffsetRef.current += chunk.bytes;
                if (chunk.text) {
                  const next = planLogsRef.current + chunk.text;
                  planLogsRef.current = next;
                  setPlanLogs(next);
                  onPlanLogsChange?.(next);
                }
              }
              if (chunk.done) planLogDoneRef.current = true;
            }
          } catch (err) {
            console.error('Failed to fetch plan logs:', err);
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

        // Stream apply/destroy-phase logs incrementally. The apply phase is a separate log
        // stream from plan; getApplyLogs returns apply-phase output only (never plan logs), so
        // a cancelled/failed run with no apply output shows empty rather than leaking the plan
        // log into the apply terminal. Poll with the byte offset, append the new tail, and
        // latch done on ETX. plan-only/apply runs without a distinct apply phase fall back to
        // the generic endpoint.
        const isTwoPhaseOp = runData.operation === 'plan-and-apply' || runData.operation === 'destroy';
        const shouldStreamApply = (
          (isTwoPhaseOp &&
            (runData.status === 'applying' || runData.status === 'applied' || wasCancelledDuringApply)) ||
          (runData.operation === 'apply' &&
            (runData.status === 'running' || runData.status === 'completed')) ||
          runData.status === 'failed' // surface error output when a run fails
        );

        if (shouldStreamApply && !applyLogDoneRef.current) {
          try {
            const chunk = isTwoPhaseOp
              ? await runsApi.getApplyLogs(runId, { offset: applyLogOffsetRef.current })
              : await runsApi.getLogs(runId, { offset: applyLogOffsetRef.current });
            if (isMountedRef.current) {
              if (chunk.bytes > 0) {
                applyLogOffsetRef.current += chunk.bytes;
                if (chunk.text) {
                  const next = applyLogsRef.current + chunk.text;
                  applyLogsRef.current = next;
                  setLogs(next);
                  onLogsChange?.(next);
                }
              } else if ((runData.status === 'canceled' || runData.status === 'failed') &&
                applyLogOffsetRef.current === 0) {
                // Cancelled/failed before any apply output was produced - show empty rather
                // than leaving stale content; never fall back to the plan log.
                applyLogsRef.current = '';
                setLogs('');
                onLogsChange?.('');
              }
              if (chunk.done) applyLogDoneRef.current = true;
            }
          } catch (err) {
            console.error('Failed to fetch logs:', err);
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
          (runData.operation === 'plan-only' && (runData.status === 'planned' || runData.status === 'post_plan_completed')) ||
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
