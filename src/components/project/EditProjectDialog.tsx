// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { agentPoolsApi, projectsApi, type Project } from '@/api/client';
import { PageDialogContent } from '@/components/layout/Page';
import { IdentityBindingSelect, RunImageSelect } from '@/components/settings/RunPlacementFields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MAX_RUN_TIMEOUT_MINUTES, minutesText, parseTimeoutMinutes } from '@/lib/runTimeout';

/** The execution mode select value that means "inherit the organization's defaults". */
const INHERIT_MODE = '__inherit__';

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  project: Project;
  onUpdated: (project: Project) => void;
}

/**
 * EditProjectDialog edits a project's own settings (#933, D0, D15): its name and description, the
 * default execution mode and pool its workspaces inherit (tfe_project_settings), and its level of
 * the level rule - the run images, identity binding and run timeout its workspaces, job templates
 * and inventory sources inherit when they set none.
 */
export function EditProjectDialog({ open, onOpenChange, orgName, project, onUpdated }: EditProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PageDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Workspaces, job templates and inventory sources in this project inherit these when they set none.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted fresh on each open, so the form starts from the saved project. */}
        {open && <EditProjectForm orgName={orgName} project={project} onOpenChange={onOpenChange} onUpdated={onUpdated} />}
      </PageDialogContent>
    </Dialog>
  );
}

function EditProjectForm({ orgName, project, onOpenChange, onUpdated }: Omit<EditProjectDialogProps, 'open'>) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [mode, setMode] = useState(project.settings_overwritten ? (project.default_execution_mode ?? 'remote') : INHERIT_MODE);
  const [poolId, setPoolId] = useState(project.default_agent_pool_id ?? '');
  const [timeoutMinutes, setTimeoutMinutes] = useState(minutesText(project.run_timeout));
  const [tofuImage, setTofuImage] = useState(project.tofu_run_image_id ?? '');
  const [ansibleImage, setAnsibleImage] = useState(project.ansible_run_image_id ?? '');
  const [bindingId, setBindingId] = useState(project.identity_binding_id ?? '');

  const timeout = parseTimeoutMinutes(timeoutMinutes);

  const { data: pools = [] } = useQuery({
    queryKey: ['agentPools', orgName],
    queryFn: async () => (await agentPoolsApi.list(orgName)).data ?? [],
    enabled: !!orgName,
  });

  const save = useMutation({
    mutationFn: () => {
      return projectsApi.update(orgName, project.name, {
        name: name.trim(),
        description: description.trim(),
        ...(mode === INHERIT_MODE
          ? { settings_overwritten: false }
          : { default_execution_mode: mode, default_agent_pool_id: mode === 'agent' ? poolId : '' }),
        run_timeout: timeout.seconds ?? 0,
        tofu_run_image_id: tofuImage,
        ansible_run_image_id: ansibleImage,
        identity_binding_id: bindingId,
      });
    },
    onSuccess: (updated: Project) => {
      toast.success('Project updated');
      onUpdated(updated);
      onOpenChange(false);
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to update the project'); },
  });

  const needsPool = mode === 'agent' && !poolId;
  const canSave = name.trim() !== '' && !needsPool && !timeout.error && !save.isPending;

  return (
    <form onSubmit={e => { e.preventDefault(); if (canSave) save.mutate(); }} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project-name">Name</Label>
        <Input id="project-name" value={name} onChange={e => { setName(e.target.value); }} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea id="project-description" value={description} onChange={e => { setDescription(e.target.value); }} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-execution-mode">Default execution mode</Label>
        <Select value={mode} onValueChange={v => { setMode(v); if (v !== 'agent') setPoolId(''); }}>
          <SelectTrigger id="project-execution-mode" aria-label="Default execution mode"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={INHERIT_MODE}>Inherit from the organization</SelectItem>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="local">Local</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'agent' && (
        <div className="space-y-2">
          <Label htmlFor="project-agent-pool">Default agent pool</Label>
          <Select value={poolId} onValueChange={setPoolId}>
            <SelectTrigger id="project-agent-pool" aria-label="Default agent pool"><SelectValue placeholder="Select an agent pool..." /></SelectTrigger>
            <SelectContent emptyMessage="No agent pools yet">
              {pools.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {needsPool && <p className="text-xs text-red-600 dark:text-red-400">Agent mode needs a pool.</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="project-run-timeout">Run timeout (minutes)</Label>
        <Input
          id="project-run-timeout"
          type="number"
          min={0}
          max={MAX_RUN_TIMEOUT_MINUTES}
          step="any"
          aria-invalid={!!timeout.error}
          inputMode="numeric"
          value={timeoutMinutes}
          onChange={e => { setTimeoutMinutes(e.target.value); }}
          placeholder="Inherit from the organization"
        />
        <p className="text-xs text-muted-foreground">Empty or 0 inherits the organization's, then the platform default.</p>
        {timeout.error && <p data-testid="project-run-timeout-error" className="text-xs text-red-600 dark:text-red-400">{timeout.error}</p>}
      </div>
      <RunImageSelect
        id="project-tofu-run-image"
        label="OpenTofu run image"
        orgName={orgName}
        kind="tofu"
        value={tofuImage}
        onChange={setTofuImage}
        inheritLabel="Inherit from the organization"
      />
      <RunImageSelect
        id="project-ansible-run-image"
        label="Ansible execution environment"
        orgName={orgName}
        kind="ansible"
        value={ansibleImage}
        onChange={setAnsibleImage}
        inheritLabel="Inherit from the organization"
      />
      <IdentityBindingSelect
        id="project-identity-binding"
        orgName={orgName}
        value={bindingId}
        onChange={setBindingId}
        inheritLabel="Inherit from the organization"
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => { onOpenChange(false); }}>Cancel</Button>
        <GradientButton ramp="app" type="submit" className="w-auto px-4 py-2" disabled={!canSave}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save
        </GradientButton>
      </DialogFooter>
    </form>
  );
}
