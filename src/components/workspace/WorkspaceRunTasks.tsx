// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { runTasksApi, type TaskStageName, type TaskEnforcementLevel, type WorkspaceRunTask } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Plus, Loader2, Trash2, ShieldAlert, Info } from 'lucide-react';
import { toast } from 'sonner';

const ALL_STAGES: TaskStageName[] = ['pre_plan', 'post_plan', 'pre_apply', 'post_apply'];
const STAGE_LABELS: Record<TaskStageName, string> = {
  pre_plan: 'Pre-plan',
  post_plan: 'Post-plan',
  pre_apply: 'Pre-apply',
  post_apply: 'Post-apply',
};

/**
 * WorkspaceRunTasks is the workspace detail tab that attaches org run tasks to this workspace
 * (tfe_workspace_run_task): pick a task defined under Settings -> Run Tasks, choose the stages it
 * gates and whether a failure blocks the run (mandatory) or is informational (advisory).
 */
export function WorkspaceRunTasks({ workspaceId, orgName }: { workspaceId: string; orgName: string }) {
  const queryClient = useQueryClient();
  const [attachOpen, setAttachOpen] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [enforcement, setEnforcement] = useState<TaskEnforcementLevel>('advisory');
  const [stages, setStages] = useState<TaskStageName[]>(['post_plan']);
  const [detaching, setDetaching] = useState<WorkspaceRunTask | null>(null);

  const { data: attachments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['workspaceRunTasks', workspaceId],
    queryFn: () => runTasksApi.listForWorkspace(workspaceId),
    enabled: !!workspaceId,
  });
  const { data: orgTasks } = useQuery({
    queryKey: ['runTasks', orgName],
    queryFn: () => runTasksApi.list(orgName, { pageSize: 100 }),
    enabled: !!orgName,
  });
  const taskNames = new Map((orgTasks?.data ?? []).map(t => [t.id, t.name]));
  const attachable = (orgTasks?.data ?? []).filter(t => !attachments.some(a => a.task_id === t.id));

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['workspaceRunTasks', workspaceId] });

  const attachMutation = useMutation({
    mutationFn: () => runTasksApi.attach(workspaceId, { task_id: taskId, enforcement_level: enforcement, stages }),
    onSuccess: () => {
      invalidate();
      setAttachOpen(false);
      toast.success('Run task attached');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to attach run task'); },
  });

  const detachMutation = useMutation({
    mutationFn: (a: WorkspaceRunTask) => runTasksApi.detach(workspaceId, a.id),
    onSuccess: () => {
      invalidate();
      setDetaching(null);
      toast.success('Run task detached');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to detach run task'); },
  });

  const toggleStage = (stage: TaskStageName) => {
    setStages(prev => {
      const next = prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage];
      return ALL_STAGES.filter(s => next.includes(s));
    });
  };

  const openAttach = () => {
    setTaskId(attachable[0]?.id ?? '');
    setEnforcement('advisory');
    setStages(['post_plan']);
    setAttachOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
        <p className="text-red-500 mb-4">Failed to load run tasks</p>
        <Button variant="outline" onClick={() => { void refetch(); }}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Run tasks</h3>
          <p className="text-sm text-muted-foreground">
            External checks that run at stage boundaries of this workspace's runs.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAttach} disabled={attachable.length === 0}>
          <Plus className="h-4 w-4" />
          Attach task
        </Button>
      </div>

      {attachments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 dark:border-white/10 p-8 text-center text-muted-foreground">
          <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No run tasks attached.</p>
          <p className="text-sm mt-1">
            Define tasks under{' '}
            <Link to={`/app/${orgName}/settings/run-tasks`} className="underline underline-offset-2">
              Settings → Run Tasks
            </Link>
            , then attach them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {attachments.map(a => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 dark:bg-black/10 p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{taskNames.get(a.task_id) ?? a.task_id}</span>
                  {a.enforcement_level === 'mandatory' ? (
                    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0">
                      <ShieldAlert className="h-3 w-3 mr-1" />
                      Mandatory
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
                      <Info className="h-3 w-3 mr-1" />
                      Advisory
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Stages: {a.stages.map(s => STAGE_LABELS[s]).join(', ')}
                </p>
              </div>
              <Button
                variant="ghost" size="icon" aria-label={`Detach ${taskNames.get(a.task_id) ?? a.task_id}`}
                className="text-red-500 hover:text-red-600 shrink-0"
                onClick={() => { setDetaching(a); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach run task</DialogTitle>
            <DialogDescription>
              The task's service is called at each selected stage; a mandatory failure blocks the run
              until overridden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger><SelectValue placeholder="Pick a run task" /></SelectTrigger>
                <SelectContent>
                  {attachable.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stages</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_STAGES.map(stage => (
                  <Button
                    key={stage} type="button" size="sm"
                    variant={stages.includes(stage) ? 'default' : 'outline'}
                    onClick={() => { toggleStage(stage); }}
                  >
                    {STAGE_LABELS[stage]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Enforcement</Label>
              <Select value={enforcement} onValueChange={v => { setEnforcement(v as TaskEnforcementLevel); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="advisory">Advisory (never blocks the run)</SelectItem>
                  <SelectItem value="mandatory">Mandatory (failure blocks, can be overridden)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAttachOpen(false); }}>Cancel</Button>
            <Button
              disabled={taskId === '' || stages.length === 0 || attachMutation.isPending}
              onClick={() => { attachMutation.mutate(); }}
            >
              {attachMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detaching !== null} onOpenChange={open => { if (!open) setDetaching(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detach run task</DialogTitle>
            <DialogDescription>
              "{detaching ? (taskNames.get(detaching.task_id) ?? detaching.task_id) : ''}" will stop gating new runs
              of this workspace. In-flight runs are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDetaching(null); }}>Cancel</Button>
            <Button
              variant="destructive" disabled={detachMutation.isPending}
              onClick={() => { if (detaching) detachMutation.mutate(detaching); }}
            >
              {detachMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Detach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
