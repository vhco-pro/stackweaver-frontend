// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { runsApi, workspacesApi, type Workspace } from '@/api/client';
import { getRunFromJsonApi } from '@/utils/jsonapi';
import { OutputViewer } from '@/components/runs/OutputViewer';
import { ApplyOutputViewer } from '@/components/runs/ApplyOutputViewer';
import { RunSourceDisplay } from '@/components/runs/RunSourceDisplay';
import { UnifiedPhaseTimeline } from '@/components/runs/UnifiedPhaseTimeline';
import { ErrorDisplay } from '@/components/runs/ErrorDisplay';
import { WarningDisplay } from '@/components/runs/WarningDisplay';
import { useRunPolling } from '@/hooks/useRunPolling';
import { useRunDisplayPreferences } from '@/contexts/RunDisplayPreferencesContext';
import { TerminalOutput } from '@/components/runs/TerminalOutput';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  PlayCircle,
  X,
  Copy,
  Check,
  Loader2,
  XCircle,
  CheckCircle2,
  Server
} from 'lucide-react';
import { StatusBadge } from '@/components/runs/StatusBadge';
import { computeDisplayStatus } from '@/utils/runStatus';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function RunDetail() {
  const { runId, orgName, workspaceName } = useParams<{
    runId: string;
    orgName: string;
    workspaceName: string;
  }>();
  const id = runId;
  const org = orgName;
  const wsName = workspaceName;
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [applying, setApplying] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const runStatusRef = useRef<string | null>(null);
  const applyPhaseRef = useRef<HTMLDivElement | null>(null);
  const actionButtonsRef = useRef<HTMLDivElement | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const [isApplyStarting, setIsApplyStarting] = useState(false); // Track when apply button is clicked
  const [workspaceData, setWorkspaceData] = useState<Workspace | null>(null);
  const [copiedRunId, setCopiedRunId] = useState(false);
  const [runOutputs, setRunOutputs] = useState<Array<{ key: string; value: unknown; type?: string; sensitive?: boolean }> | undefined>(undefined);
  const runOutputsFetchedForRunIdRef = useRef<string | null>(null);

  // Fetch workspace info for commit links
  useEffect(() => {
    if (!org || !wsName) return;

    void workspacesApi.get(org, wsName)
      .then(setWorkspaceData)
      .catch((err) => {
        console.error('Failed to fetch workspace:', err);
        // Don't show error, just don't show commit links
      });
  }, [org, wsName]);

  // Reset run outputs when navigating to a different run
  useEffect(() => {
    if (!id) return;
    runOutputsFetchedForRunIdRef.current = null;
    setRunOutputs(undefined);
  }, [id]);

  // Use real-time polling hook (TFE-like experience)
  // Poll more frequently during apply phase for better real-time updates
  const [pollInterval, setPollInterval] = useState(2000);
  
  const {
    run: polledRun,
    planOutput: polledPlanOutput,
    logs: polledLogs,
    planLogs: polledPlanLogs,
    applyState: polledApplyState,
    loading: pollingLoading,
    refetch: refetchRun,
  } = useRunPolling({
    runId: id || null,
    enabled: !!id,
    pollInterval, // Dynamic polling interval based on run status
    onStatusChange: (updatedRun) => {
      runStatusRef.current = updatedRun.status;
      // Show toast notification on status change
      if (updatedRun.status === 'completed') {
        toast.success(`${updatedRun.operation.charAt(0).toUpperCase() + updatedRun.operation.slice(1)} run completed`);
      } else if (updatedRun.status === 'failed') {
        toast.error('Run failed');
      }
    },
    onPlanOutputChange: () => {
      // Plan output updated - will be set automatically by hook
    },
    onLogsChange: () => {
      // Logs updated (for apply/destroy runs) - will be set automatically by hook
    },
    onPlanLogsChange: () => {
      // Plan logs updated - will be set automatically by hook
    },
  });

  // Use polled data if available
  const run = polledRun;
  const planOutput = polledPlanOutput;
  const runLogs = polledLogs;
  const planLogs = polledPlanLogs;
  const loading = pollingLoading;

  // Fetch run outputs from state (TFE-aligned) when apply completes. 404 falls back to log parsing in ApplyOutputViewer.
  useEffect(() => {
    if (!id || !run) return;
    if (run.status !== 'applied' || run.operation !== 'plan-and-apply') return;
    if (runOutputsFetchedForRunIdRef.current === id) return;

    runOutputsFetchedForRunIdRef.current = id;
    void runsApi.getOutputs(id)
      .then((data) => {
        setRunOutputs(data);
      })
      .catch((e: { status?: number }) => {
        if (e?.status === 404) {
          setRunOutputs(undefined); // fall back to log parsing in ApplyOutputViewer
        }
        // on other errors, leave runOutputs undefined
      });
  }, [id, run?.status, run?.operation, run]);

  // Adjust polling frequency based on run status
  // Poll more frequently (750ms) during apply phase for better real-time resource updates
  useEffect(() => {
    if (run?.status === 'applying') {
      setPollInterval(750); // 750ms = 1.33x per second during apply
    } else {
      setPollInterval(2000); // 2 seconds for other phases
    }
  }, [run?.status]);

  // Get user preferences for run display
  const { preferences: runDisplayPrefs } = useRunDisplayPreferences();
  const preferenceShowTerminal = runDisplayPrefs.showTerminalDuringPlanning;

  // Local state to track terminal view (can override preference)
  const [showTerminalView, setShowTerminalView] = useState<boolean>(preferenceShowTerminal);

  // Sync with preference when it changes (but allow local override)
  useEffect(() => {
    setShowTerminalView(preferenceShowTerminal);
  }, [preferenceShowTerminal]);

  // Local state for plan logs during planning (for terminal view streaming)
  // Once plan completes, use planLogs from polling hook (which persists on reload)
  const [streamingPlanLogs, setStreamingPlanLogs] = useState<string>('');
  const planLogsLengthRef = useRef<number>(0);

  // Poll logs during planning if terminal view is enabled
  // After plan completes, use planLogs from polling hook (persisted)
  useEffect(() => {
    if (!id) return;

    // During planning: poll logs if terminal view is enabled
    if (run?.status === 'planning' && !planOutput && showTerminalView) {
      // Poll logs endpoint every 1 second during planning (faster than status polling)
      // Use incremental updates with offset for better performance
      const interval = setInterval(() => {
        void (async () => {
          try {
            const newLogs = await runsApi.getLogs(id, { offset: planLogsLengthRef.current });
            if (newLogs) {
              setStreamingPlanLogs(prev => {
                const updated = prev + newLogs;
                planLogsLengthRef.current = updated.length;
                return updated;
              });
            }
          } catch (err) {
            // Log error but don't show to user (logs may not be available yet)
            console.error('Failed to fetch plan logs:', err);
          }
        })();
      }, 1000);

      return () => clearInterval(interval);
    }

    // Clear streaming logs when plan completes (use persisted logs from hook instead)
    if (planOutput && streamingPlanLogs) {
      setStreamingPlanLogs('');
      planLogsLengthRef.current = 0;
    }
  }, [id, run?.status, planOutput, showTerminalView, streamingPlanLogs]);

  // Use streaming logs during planning, or persisted logs from hook after plan completes
  // Always use polled plan logs if available (persists on reload)
  // Only use streaming logs during active planning phase
  const displayPlanLogs = (run?.status === 'planning' && !planOutput && streamingPlanLogs) 
    ? streamingPlanLogs 
    : (planLogs || '');

  // Check if plan has changes (add/change/destroy/outputs) — used for apply button and "No changes" message
  const planHasChanges = useMemo(() => {
    if (!planOutput) return false;
    // Summary counts from API (hyphenated) or stored plan (PascalCase)
    const add = (planOutput['resource-additions'] as number) ?? (planOutput.AddCount as number) ?? 0;
    const change = (planOutput['resource-changes'] as number) ?? (planOutput.ChangeCount as number) ?? 0;
    const destroy = (planOutput['resource-destructions'] as number) ?? (planOutput.DestroyCount as number) ?? 0;
    if (add > 0 || change > 0 || destroy > 0) return true;
    // Fallback: derive from resource_changes array
    const resourceChanges = (planOutput.resource_changes as Array<{ change?: { actions?: string[] } }>) ?? [];
    const hasResourceChanges = resourceChanges.some(resource => {
      const actions = resource.change?.actions ?? [];
      return actions.length > 0 && !actions.every(a => a === 'no-op');
    });
    if (hasResourceChanges) return true;
    // Check for output changes
    const outputChangeCount = (planOutput.OutputChangeCount as number) ?? 0;
    if (outputChangeCount > 0) return true;
    // Fallback: derive from output_changes map
    const outputChanges = planOutput.output_changes as Record<string, { actions?: string[] }> | undefined;
    if (outputChanges && typeof outputChanges === 'object') {
      return Object.values(outputChanges).some(change => {
        const actions = change?.actions ?? [];
        return actions.length > 0 && !actions.every(a => a === 'no-op');
      });
    }
    return false;
  }, [planOutput]);

  // Note: For plan-and-apply runs, the polling hook handles fetching both plan output and apply logs for the same run

  // Update ref when run status changes
  useEffect(() => {
    if (run) {
      runStatusRef.current = run.status;

      // When status changes to 'applying', clear the isApplyStarting flag (status has updated)
      if (run.status === 'applying') {
        setIsApplyStarting(false);
      }

      // Auto-scroll to action buttons when plan completes
      if (run.operation === 'plan-and-apply' &&
        previousStatusRef.current !== 'planned' &&
        run.status === 'planned' &&
        actionButtonsRef.current) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          actionButtonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }

      // Auto-scroll to apply phase when it starts (status changes from 'planned' to 'applying')
      if (run.operation === 'plan-and-apply' &&
        previousStatusRef.current === 'planned' &&
        run.status === 'applying' &&
        applyPhaseRef.current) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          applyPhaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }

      previousStatusRef.current = run.status;
    }
  }, [run]);

  const handleCancel = async () => {
    if (!run || !id) return;

    // Allow cancellation of pending, running, planning, and applying runs
    const cancellableStatuses = ['pending', 'running', 'planning', 'applying'];
    if (!cancellableStatuses.includes(run.status)) {
      toast.error('Run cannot be cancelled in current state');
      return;
    }

    setCancelling(true);
    try {
      await runsApi.cancel(id);
      toast.success('Run cancelled successfully');
      // Refetch run to get updated status (polling hook will pick it up on next poll)
      refetchRun();
    } catch (err: unknown) {
      console.error('Failed to cancel run:', err);
      let errorMessage = 'Failed to cancel run';
      if (err && typeof err === 'object') {
        const error = err as { response?: { data?: { errors?: Array<{ detail?: string }> } } };
        errorMessage = error.response?.data?.errors?.[0]?.detail || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setCancelling(false);
    }
  };

  // Compute display status using unified utility
  // Handles optimistic update for "Applying" state when apply button is clicked
  // This is the authoritative computation - planOutput is the source of truth for hasChanges
  const displayStatus = useMemo(() => {
    if (!run) return 'pending';

    // Optimistic update: show "Applying" immediately when apply is starting
    if (run.operation === 'plan-and-apply' && (isApplyStarting || run.status === 'applying')) {
      return 'applying';
    }

    // Compute has-changes from plan output (source of truth)
    let hasChanges: boolean | undefined;
    if (planOutput) {
      if ('has-changes' in planOutput) {
        hasChanges = planOutput['has-changes'] as boolean;
      } else {
        // Summary counts (destroy plans have resource-destructions / DestroyCount)
        const add = (planOutput['resource-additions'] as number) ?? (planOutput.AddCount as number) ?? 0;
        const change = (planOutput['resource-changes'] as number) ?? (planOutput.ChangeCount as number) ?? 0;
        const destroy = (planOutput['resource-destructions'] as number) ?? (planOutput.DestroyCount as number) ?? 0;
        if (add > 0 || change > 0 || destroy > 0) {
          hasChanges = true;
        } else {
          const resourceChanges = (planOutput.resource_changes as Array<{ change?: { actions?: string[] } }>) ?? [];
          hasChanges = resourceChanges.some(resource => {
            const actions = resource.change?.actions ?? [];
            return actions.length > 0 && !actions.every(a => a === 'no-op');
          });
        }
      }
    } else {
      hasChanges = run['has-changes'];
    }

    return computeDisplayStatus({
      status: run.status,
      operation: run.operation,
      planOnly: run.plan_only,
      hasChanges,
      canApply: run.permissions?.['can-apply'],
    });
  }, [run, planOutput, isApplyStarting]);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading run details...</p>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4 p-12 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5 backdrop-blur-md border border-white/20 dark:border-white/10">
          <h3 className="text-2xl font-semibold mb-2">Run not found</h3>
          <p className="text-muted-foreground mb-6">
            The run you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button variant="outline" asChild>
            <Link to="/workspaces">Back to Workspaces</Link>
          </Button>
        </div>
      </div>
    );
  }

  // TFE-compatible: Handle new statuses and operation types
  const canCancel = run.status === 'pending' || run.status === 'planning' || run.status === 'applying' || run.status === 'running';

  // TFE-compatible: Use permissions.can-apply from API response (backend is source of truth)
  // For plan-and-apply runs: can-apply is true when plan phase is completed (status="planned")
  // For plan-only runs: can-apply is always false
  // Also check if plan has changes - don't allow apply if no changes detected
  const canApply = run.permissions?.['can-apply'] === true && planHasChanges;

  // Can discard plan-and-apply and destroy runs that are in "planned" status (plan phase completed, waiting for confirmation)
  // Hide discard button if plan has been applied (status="applying" or "applied")
  const canDiscard = (run.operation === 'plan-and-apply' || run.operation === 'destroy')
    && (run.status === 'planned' || run.status === 'completed')
    && !run.error_message
    && run.permissions?.['can-apply'] === true; // Only show if can still be applied

  const handleApplyClick = () => {
    if (!run || !id || applying) return;
    setApplyDialogOpen(true);
  };

  const handleApply = () => {
    if (!run || !id || applying) return;

    setApplyDialogOpen(false);
    setApplying(true);
    setIsApplyStarting(true); // Mark that apply is starting

    void runsApi.apply(id)
      .then((applyRunRes) => {
        const updatedRun = getRunFromJsonApi(applyRunRes.data);
        toast.success(run.operation === 'destroy' ? 'Destroy phase started' : 'Apply phase started');

        // Plan-and-apply/destroy run: Same run transitions to applying phase
        // Check if the response already has 'applying' status
        if (updatedRun.status === 'applying') {
          // Backend already updated status, clear the flag
          setIsApplyStarting(false);
        }
        // Otherwise, keep isApplyStarting true until polling updates the status

        // Refetch to get updated status (polling hook will pick it up on next poll)
        refetchRun();
        // Immediately scroll to apply phase
        setTimeout(() => {
          applyPhaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        setApplying(false);
      })
      .catch((err) => {
        console.error('Failed to apply run:', err);
        toast.error('Failed to apply run');
        setIsApplyStarting(false); // Clear flag on error
        setApplying(false);
      });
  };

  const handleDiscardClick = () => {
    if (!run || !id || discarding) return;
    setDiscardDialogOpen(true);
  };

  const handleDiscard = () => {
    if (!run || !id || discarding) return;

    setDiscardDialogOpen(false);
    setDiscarding(true);
    void runsApi.discard(id)
      .then(() => {
        toast.success('Plan discarded successfully');
        // Refetch run to get updated status (polling hook will pick it up on next poll)
        refetchRun();
      })
      .catch((err) => {
        console.error('Failed to discard run:', err);
        toast.error('Failed to discard run');
      })
      .finally(() => {
        setDiscarding(false);
      });
  };

  if (!run || !run.id) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading run...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {org && wsName ? (
          <>
            <Link to={`/app/${org}/workspaces`} className="hover:text-foreground transition-colors">
              {org}
            </Link>
            <span>/</span>
            <Link to={`/app/${org}/workspaces/${wsName}`} className="hover:text-foreground transition-colors">
              {wsName}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{run.id}</span>
          </>
        ) : (
          <>
            <Link to="/workspaces" className="hover:text-foreground transition-colors">
              Workspaces
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{run.id}</span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30">
              <PlayCircle className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2 truncate">
                {run.operation === 'plan-and-apply' ? 'Plan and Apply' :
                  run.operation === 'plan-only' ? 'Plan Only' :
                    run.operation === 'destroy' ? 'Destroy' :
                      run.operation.charAt(0).toUpperCase() + run.operation.slice(1)}
              </h1>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <StatusBadge status={displayStatus} />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {formatTimeAgo(run.created_at)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                <RunSourceDisplay run={run} workspace={workspaceData || undefined} />
                {planOutput && 'terraform_version' in planOutput && (() => {
                  const version = planOutput.terraform_version;
                  return version ? (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 backdrop-blur-sm">
                        {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
                        v{typeof version === 'string' ? version : String(version)}
                      </span>
                    </>
                  ) : null;
                })()}
                {/* Self-hosted runner info - only show which runner executed */}
                {run.runner_name && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="px-2 py-1 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 backdrop-blur-sm flex items-center gap-1">
                      <Server className="h-3 w-3" />
                      {run.runner_name}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-mono text-xs">{run.id}</span>
                  <button
                    onClick={() => {
                      void (async () => {
                        try {
                          await navigator.clipboard.writeText(run.id);
                          setCopiedRunId(true);
                          toast.success('Run ID copied to clipboard');
                          setTimeout(() => setCopiedRunId(false), 2000);
                        } catch {
                          toast.error('Failed to copy run ID');
                        }
                      })();
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Copy run ID"
                  >
                    {copiedRunId ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleCancel(); }}
              disabled={cancelling}
              className="text-destructive hover:text-destructive whitespace-nowrap"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Cancelling...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Cancel Run</span>
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (org && wsName) {
                void navigate(`/organizations/${org}/workspaces/${wsName}`);
              } else {
                void navigate(-1);
              }
            }}
            className="whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </div>
      </div>

      {/* Unified Timeline and Content */}
      <div className="flex-1 min-w-0 space-y-6 overflow-hidden">
        {/* Warnings Banner */}
        <WarningDisplay
          planOutput={planOutput}
          planLogs={displayPlanLogs}
        />

        {/* Unified Phase Timeline */}
        <UnifiedPhaseTimeline
          run={run}
          planOutput={planOutput}
          applyOutput={runLogs || null}
          planOutputLoading={loading && !planOutput}
          applyOutputLoading={loading && !runLogs}
          isApplyStarting={isApplyStarting}
          canApply={canApply}
          canDiscard={canDiscard}
          onApplyClick={handleApplyClick}
          onDiscardClick={handleDiscardClick}
          applying={applying}
          discarding={discarding}
          actionButtonsRef={actionButtonsRef}
          applyPhaseRef={applyPhaseRef}
          planHasChanges={planHasChanges}
          children={{
            planPhaseContent: (
              <>
                {/* Show cancelled indicator when plan was cancelled before completion */}
                {run.status === 'canceled' && !run['status-timestamps']?.['planned-at'] && (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <XCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-lg font-medium mb-1">Plan Cancelled</p>
                    <p className="text-sm">The plan operation was cancelled before completion.</p>
                  </div>
                )}
                {/* Show terminal view when planning and terminal view enabled, otherwise show spinner */}
                {run.status === 'planning' && !planOutput && showTerminalView && displayPlanLogs ? (
                  <TerminalOutput content={displayPlanLogs} isStreaming={true} />
                ) : (run.status === 'pending' || run.status === 'planning') && !planOutput ? (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <Loader2 className={cn("h-6 w-6 animate-spin mx-auto mb-2", run.status === 'planning' ? "text-blue-500" : "text-muted-foreground")} />
                    <p>{run.status === 'pending' ? 'Waiting to start...' : 'Planning in progress...'}</p>
                  </div>
                ) : null}
                {/* Show errors if plan failed - only when plan has NOT completed (no planned-at timestamp) */}
                {run.status === 'failed' &&
                  !run['status-timestamps']?.['planned-at'] &&
                  (run.error_message || runLogs) && (
                    <ErrorDisplay logs={run.error_message || runLogs || ''} title="Plan Error" />
                  )}
                {/* Hide OutputViewer if plan failed (no planned-at timestamp) to avoid showing "No changes detected" alongside errors */}
                {/* Only show plan output/no changes message when plan has actually completed (has planned-at timestamp) */}
                {/* This ensures we don't show "No changes detected" while plan is still pending/planning */}
                {run['status-timestamps']?.['planned-at'] && !(run.status === 'failed' && !run['status-timestamps']?.['planned-at']) && (
                  planOutput ? (
                    <OutputViewer
                      data={planOutput}
                      showJsonViewer={true}
                      title="Terraform Plan"
                      logs={displayPlanLogs || undefined}
                      runId={id || undefined}
                    />
                  ) : !loading && !run.error_message && !runLogs && !pollingLoading ? (
                    // Plan completed (has planned-at) but no planOutput - likely means no changes
                    // Show "No changes detected" message instead of "No plan output available"
                    // Only show this if we're not still loading (pollingLoading check prevents showing during initial load)
                    <div className="border rounded-lg p-8 text-center text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No changes detected</p>
                      <p className="text-sm mt-1">This plan would make no changes to your infrastructure.</p>
                    </div>
                  ) : null
                )}
                {/* Show "No plan output available" only if plan completed but we're still loading or in unexpected state */}
                {run['status-timestamps']?.['planned-at'] && !planOutput && loading && (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p>Loading plan output...</p>
                  </div>
                )}
              </>
            ),
            applyPhaseContent: (
              <>
                {/* Show cancelled indicator when apply/destroy was cancelled during execution */}
                {run.status === 'canceled' && run['status-timestamps']?.['applying-at'] && (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <XCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-lg font-medium mb-1">{run.operation === 'destroy' ? 'Destroy Cancelled' : 'Apply Cancelled'}</p>
                    <p className="text-sm">The {run.operation === 'destroy' ? 'destroy' : 'apply'} operation was cancelled during execution.</p>
                  </div>
                )}
                {/* Show errors if apply/destroy failed - when plan phase completed (has planned-at timestamp) */}
                {run.status === 'failed' &&
                  run['status-timestamps']?.['planned-at'] &&
                  (run.error_message || runLogs) && (
                    <ErrorDisplay logs={run.error_message || runLogs || ''} title={run.operation === 'destroy' ? 'Destroy Error' : 'Apply Error'} />
                  )}
                {/* Show ApplyOutputViewer if we have planOutput, runLogs, or applyState (for cancelled runs) */}
                {/* Only pass apply logs (runLogs) - never pass plan logs to ApplyOutputViewer */}
                {(planOutput || runLogs || polledApplyState) ? (
                  <ApplyOutputViewer
                    logs={runLogs || ''}
                    showJsonViewer={true}
                    planOutput={planOutput || undefined}
                    isApplying={run.status === 'applying' || isApplyStarting}
                    isCancelled={run.status === 'canceled' && run['status-timestamps']?.['applying-at'] !== undefined}
                    isFailed={run.status === 'failed' && run['status-timestamps']?.['applying-at'] !== undefined}
                    applyState={polledApplyState || undefined}
                    runId={id || undefined}
                    runOutputs={runOutputs}
                    isDestroyRun={run.operation === 'destroy'}
                  />
                ) : (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p>Loading apply output...</p>
                  </div>
                )}
              </>
            ),
          }}
        />
      </div>

      {/* Apply/Destroy Confirmation Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{run?.operation === 'destroy' ? 'Confirm Destroy' : 'Apply Plan'}</DialogTitle>
            <DialogDescription>
              {run?.operation === 'destroy'
                ? 'Are you sure you want to destroy the planned resources? This action cannot be undone.'
                : 'Are you sure you want to apply this plan? This will execute the infrastructure changes.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApplyDialogOpen(false)}
              disabled={applying}
            >
              Cancel
            </Button>
            <Button
              variant={run?.operation === 'destroy' ? 'destructive' : 'default'}
              onClick={() => { void handleApply(); }}
              disabled={applying}
            >
              {applying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {run?.operation === 'destroy' ? 'Destroying...' : 'Applying...'}
                </>
              ) : (
                run?.operation === 'destroy' ? 'Confirm Destroy' : 'Apply Plan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Plan Confirmation Dialog */}
      <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to discard this plan? This will cancel the plan and allow you to make changes before creating a new plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDiscardDialogOpen(false)}
              disabled={discarding}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDiscard(); }}
              disabled={discarding}
            >
              {discarding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Discarding...
                </>
              ) : (
                'Discard Plan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

