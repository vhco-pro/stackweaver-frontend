// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { runTasksApi, type TaskStage, type TaskResult, type TaskStageName } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2, XCircle, Loader2, Clock, ShieldAlert, ExternalLink, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STAGE_LABELS: Record<TaskStageName, string> = {
  pre_plan: 'Pre-plan tasks',
  post_plan: 'Post-plan tasks',
  pre_apply: 'Pre-apply tasks',
  post_apply: 'Post-apply tasks',
};

const STATUS_STYLES: Record<string, { className: string; spinning?: boolean; icon: typeof CheckCircle2 }> = {
  pending: { className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400', icon: Clock },
  running: { className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Loader2, spinning: true },
  passed: { className: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
  failed: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: XCircle },
  awaiting_override: { className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', icon: ShieldAlert },
  errored: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: XCircle },
  canceled: { className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400', icon: XCircle },
  unreachable: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: XCircle },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const Icon = cfg.icon;
  return (
    <Badge className={cn('border-0 gap-1', cfg.className)}>
      <Icon className={cn('h-3 w-3', cfg.spinning && 'animate-spin')} />
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

const LEVEL_STYLES: Record<string, string> = {
  error: 'bg-red-500/10 text-red-600 dark:text-red-400',
  warning: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  none: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

function ResultRow({ result }: { result: TaskResult }) {
  const [expanded, setExpanded] = useState(false);
  const { data: outcomes = [], isLoading } = useQuery({
    queryKey: ['taskResultOutcomes', result.id],
    queryFn: () => runTasksApi.listOutcomes(result.id),
    enabled: expanded,
  });

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/10 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            aria-label={expanded ? `Collapse ${result.task_name} details` : `Expand ${result.task_name} details`}
            onClick={() => { setExpanded(v => !v); }}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <span className="font-medium truncate">{result.task_name}</span>
          <Badge variant="outline" className="text-muted-foreground">{result.enforcement_level}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {result.url && (
            <a
              href={result.url} target="_blank" rel="noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Details <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <StatusChip status={result.status} />
        </div>
      </div>
      {result.message && (
        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap break-words">{result.message}</p>
      )}
      {expanded && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : outcomes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No detailed findings reported.</p>
          ) : (
            outcomes.map(o => (
              <div key={o.id} className="rounded-md border border-white/10 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {o.outcome_id && <span className="text-xs font-mono text-muted-foreground">{o.outcome_id}</span>}
                  <span className="text-sm font-medium">{o.description}</span>
                  {o.url && (
                    <a href={o.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(o.tags).flatMap(([group, tags]) =>
                    (tags ?? []).map((tag, i) => (
                      <span
                        key={`${group}-${i}`}
                        className={cn('text-xs px-2 py-0.5 rounded-full', LEVEL_STYLES[tag.level ?? 'none'])}
                      >
                        {tag.label}
                      </span>
                    ))
                  )}
                </div>
                {o.body && (
                  <pre className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                    {o.body}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * RunTaskStages renders a run's task-stage gates (run tasks) on the run detail page: one card per
 * stage with its per-task results, expandable findings (outcomes), and the override action for a
 * failed mandatory stage. Renders nothing for runs without task stages (the common case).
 */
export function RunTaskStages({ runId, runStatus }: { runId: string; runStatus: string }) {
  const queryClient = useQueryClient();
  const [overriding, setOverriding] = useState<TaskStage | null>(null);
  const [comment, setComment] = useState('');

  const inTaskState = runStatus.endsWith('_running') || runStatus.endsWith('_completed');
  const { data: stages = [] } = useQuery({
    queryKey: ['taskStages', runId],
    queryFn: () => runTasksApi.listStagesForRun(runId),
    enabled: !!runId,
    // Poll while a stage can still change; slow poll otherwise (terminal stages never mutate).
    refetchInterval: q => {
      const data = q.state.data;
      const active = data?.some(s => s.status === 'pending' || s.status === 'running' || s.status === 'awaiting_override');
      return active || inTaskState ? 3000 : false;
    },
  });

  const overrideMutation = useMutation({
    mutationFn: (stage: TaskStage) => runTasksApi.overrideStage(stage.id, comment || undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['taskStages', runId] });
      setOverriding(null);
      setComment('');
      toast.success('Task stage overridden; the run continues');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to override task stage'); },
  });

  if (stages.length === 0) return null;

  return (
    <div className="space-y-4">
      {stages.map(stage => (
        <div key={stage.id} className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold">{STAGE_LABELS[stage.stage]}</h3>
              <StatusChip status={stage.status} />
            </div>
            {stage.is_overridable && stage.can_override && (
              <Button size="sm" variant="outline" onClick={() => { setOverriding(stage); }}>
                <ShieldAlert className="h-4 w-4 mr-1.5" />
                Override and continue
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {stage.results.map(r => <ResultRow key={r.id} result={r} />)}
          </div>
        </div>
      ))}

      <Dialog open={overriding !== null} onOpenChange={open => { if (!open) setOverriding(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Override failed tasks</DialogTitle>
            <DialogDescription>
              A mandatory task failed this stage. Overriding records your decision and lets the run continue.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={comment}
            onChange={e => { setComment(e.target.value); }}
            placeholder="Reason (optional, recorded on the stage)"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOverriding(null); }}>Cancel</Button>
            <Button
              disabled={overrideMutation.isPending}
              onClick={() => { if (overriding) overrideMutation.mutate(overriding); }}
            >
              {overrideMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
