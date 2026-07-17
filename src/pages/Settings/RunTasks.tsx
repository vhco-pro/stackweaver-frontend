// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { runTasksApi, type RunTask, type TaskStageName, type TaskEnforcementLevel } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Zap, Plus, Loader2, Globe2, Pencil, Trash2, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ALL_STAGES: TaskStageName[] = ['pre_plan', 'post_plan', 'pre_apply', 'post_apply'];
const STAGE_LABELS: Record<TaskStageName, string> = {
  pre_plan: 'Pre-plan',
  post_plan: 'Post-plan',
  pre_apply: 'Pre-apply',
  post_apply: 'Post-apply',
};

interface TaskForm {
  name: string;
  url: string;
  description: string;
  hmac_key: string;
  enabled: boolean;
  global_enabled: boolean;
  global_stages: TaskStageName[];
  global_enforcement_level: TaskEnforcementLevel;
}

const emptyForm: TaskForm = {
  name: '', url: '', description: '', hmac_key: '', enabled: true,
  global_enabled: false, global_stages: ['post_plan'], global_enforcement_level: 'advisory',
};

/**
 * RunTasks is the org settings page for run tasks (tfe_organization_run_task): external services
 * that receive signed webhooks at run stage boundaries and gate the run. Tasks defined here are
 * attached per workspace (workspace detail -> Run Tasks tab) or applied to every workspace via
 * their global configuration.
 */
export default function RunTasks() {
  const { orgName } = useParams<{ orgName: string }>();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RunTask | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [deleting, setDeleting] = useState<RunTask | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['runTasks', orgName],
    queryFn: () => runTasksApi.list(orgName ?? '', { pageSize: 100 }),
    enabled: !!orgName,
  });
  const tasks = data?.data ?? [];

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['runTasks', orgName] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return runTasksApi.update(editing.id, {
          name: form.name,
          url: form.url,
          description: form.description,
          enabled: form.enabled,
          ...(form.hmac_key !== '' ? { hmac_key: form.hmac_key } : {}),
          global: {
            enabled: form.global_enabled,
            stages: form.global_stages,
            enforcement_level: form.global_enforcement_level,
          },
        });
      }
      const created = await runTasksApi.create(orgName ?? '', {
        name: form.name,
        url: form.url,
        description: form.description,
        enabled: form.enabled,
        ...(form.hmac_key !== '' ? { hmac_key: form.hmac_key } : {}),
      });
      if (form.global_enabled) {
        await runTasksApi.update(created.id, {
          global: { enabled: true, stages: form.global_stages, enforcement_level: form.global_enforcement_level },
        });
      }
      return created;
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? 'Run task updated' : 'Run task created');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to save run task'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runTasksApi.delete(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast.success('Run task deleted');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to delete run task'); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t: RunTask) => {
    setEditing(t);
    setForm({
      name: t.name, url: t.url, description: t.description, hmac_key: '', enabled: t.enabled,
      global_enabled: t.global_enabled,
      global_stages: t.global_stages.length > 0 ? t.global_stages : ['post_plan'],
      global_enforcement_level: t.global_enforcement_level || 'advisory',
    });
    setDialogOpen(true);
  };

  const toggleStage = (stage: TaskStageName) => {
    setForm(f => {
      const next = f.global_stages.includes(stage)
        ? f.global_stages.filter(s => s !== stage)
        : [...f.global_stages, stage];
      // Keep lifecycle order regardless of click order.
      return { ...f, global_stages: ALL_STAGES.filter(s => next.includes(s)) };
    });
  };

  const formValid = form.name.trim() !== '' && /^https?:\/\/.+/.test(form.url) &&
    (!form.global_enabled || form.global_stages.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Link to={orgName ? `/app/${orgName}/settings` : '/settings'}>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground" aria-label="Back to Settings">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-clip-text text-transparent mb-2">
                Run Tasks
              </h1>
              <p className="text-muted-foreground">
                External services that validate runs at stage boundaries (security scans, cost checks, custom gates)
              </p>
            </div>
            <div className="relative inline-flex rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 p-[2px]">
              <Button
                variant="ghost"
                onClick={openCreate}
                className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                New run task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <p className="text-red-500 mb-4">Failed to load run tasks</p>
          <Button variant="outline" onClick={() => { void refetch(); }}>Retry</Button>
        </div>
      ) : tasks.length === 0 ? (
        <div className={cn('rounded-2xl border border-dashed border-white/20 dark:border-white/10', 'p-8 text-center text-muted-foreground')}>
          <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No run tasks yet.</p>
          <p className="text-sm mt-1">
            Create one to hook an external service into your runs, then attach it to workspaces (or enable it globally).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(t => (
            <div
              key={t.id}
              className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm p-5 flex items-start justify-between gap-4 transition-all duration-300 hover:border-white/20"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t.name}</span>
                  {!t.enabled && <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>}
                  {t.global_enabled && (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
                      <Globe2 className="h-3 w-3 mr-1" />
                      Global · {t.global_stages.map(s => STAGE_LABELS[s]).join(', ')} · {t.global_enforcement_level}
                    </Badge>
                  )}
                  {t.workspace_task_count > 0 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Link2 className="h-3 w-3 mr-1" />
                      {t.workspace_task_count} workspace{t.workspace_task_count === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate mt-1">{t.url}</p>
                {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" aria-label={`Edit ${t.name}`} onClick={() => { openEdit(t); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${t.name}`} className="text-red-500 hover:text-red-600" onClick={() => { setDeleting(t); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit run task' : 'New run task'}</DialogTitle>
            <DialogDescription>
              The endpoint receives a signed webhook at each configured stage and reports back passed or failed.
              It must answer the verification request with a 2xx when saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rt-name">Name</Label>
              <Input id="rt-name" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); }} placeholder="security-scan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-url">Endpoint URL</Label>
              <Input id="rt-url" value={form.url} onChange={e => { setForm(f => ({ ...f, url: e.target.value })); }} placeholder="https://tasks.example.com/hook" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-desc">Description</Label>
              <Input id="rt-desc" value={form.description} onChange={e => { setForm(f => ({ ...f, description: e.target.value })); }} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-hmac">HMAC key</Label>
              <Input
                id="rt-hmac" type="password" value={form.hmac_key}
                onChange={e => { setForm(f => ({ ...f, hmac_key: e.target.value })); }}
                placeholder={editing ? 'Unchanged unless set' : 'Optional signing secret'}
              />
              <p className="text-xs text-muted-foreground">
                Signs the webhook (X-TFC-Task-Signature) so the service can verify it came from Stackweaver. Write-only.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rt-enabled">Enabled</Label>
              <Switch id="rt-enabled" checked={form.enabled} onCheckedChange={v => { setForm(f => ({ ...f, enabled: v })); }} />
            </div>

            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="rt-global">Apply globally</Label>
                  <p className="text-xs text-muted-foreground">Run on every workspace in the organization, no attachment needed.</p>
                </div>
                <Switch id="rt-global" checked={form.global_enabled} onCheckedChange={v => { setForm(f => ({ ...f, global_enabled: v })); }} />
              </div>
              {form.global_enabled && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {ALL_STAGES.map(stage => (
                      <Button
                        key={stage}
                        type="button"
                        size="sm"
                        variant={form.global_stages.includes(stage) ? 'default' : 'outline'}
                        onClick={() => { toggleStage(stage); }}
                      >
                        {STAGE_LABELS[stage]}
                      </Button>
                    ))}
                  </div>
                  <Select
                    value={form.global_enforcement_level}
                    onValueChange={v => { setForm(f => ({ ...f, global_enforcement_level: v as TaskEnforcementLevel })); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advisory">Advisory (never blocks the run)</SelectItem>
                      <SelectItem value="mandatory">Mandatory (failure blocks, can be overridden)</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); }}>Cancel</Button>
            <Button disabled={!formValid || saveMutation.isPending} onClick={() => { saveMutation.mutate(); }}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete run task</DialogTitle>
            <DialogDescription>
              This detaches "{deleting?.name}" from every workspace and stops it from gating future runs.
              In-flight runs keep their recorded results.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleting(null); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => { if (deleting) deleteMutation.mutate(deleting.id); }}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
