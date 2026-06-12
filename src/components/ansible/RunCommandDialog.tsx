// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ansibleAdHocApi, type AnsibleCredential } from '@/api/ansible';
import { agentPoolsApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Terminal } from 'lucide-react';
import { toast } from 'sonner';

interface RunCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryId: string;
  orgName: string;
  projectId?: string;
  credentials: AnsibleCredential[];
  /** Prefill for the limit field (e.g. a selected host). */
  initialLimit?: string;
}

/**
 * AWX-style "Run Command": run one module from the org allowlist against the
 * inventory through the normal job pipeline. Navigates to the job detail page
 * on launch.
 */
export function RunCommandDialog({ open, onOpenChange, inventoryId, orgName, projectId, credentials, initialLimit }: RunCommandDialogProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    module: 'ping',
    module_args: '',
    limit: initialLimit || '',
    credential_id: '',
    agent_pool_id: '',
    verbosity: 0,
    forks: 5,
    become_enabled: false,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['adhocModules', orgName],
    queryFn: async () => {
      const res = await ansibleAdHocApi.listModules(orgName);
      return res.data.attributes.modules;
    },
    enabled: !!orgName && open,
  });

  const machineCredentials = credentials.filter((c) => c.type === 'ssh' || c.type === 'machine-ssh');

  const { data: agentPools = [] } = useQuery({
    queryKey: ['agentPools', orgName],
    queryFn: async () => {
      const res = await agentPoolsApi.list(orgName);
      return res.data || [];
    },
    enabled: !!orgName && open,
  });

  const handleRun = async () => {
    if (!form.module) {
      toast.error('Pick a module');
      return;
    }
    setBusy(true);
    try {
      const res = await ansibleAdHocApi.runCommand(inventoryId, {
        module: form.module,
        module_args: form.module_args,
        limit: form.limit,
        project_id: projectId,
        credential_id: form.credential_id || undefined,
        agent_pool_id: form.agent_pool_id || undefined,
        verbosity: form.verbosity,
        forks: form.forks,
        become_enabled: form.become_enabled,
      });
      toast.success('Ad hoc command launched');
      onOpenChange(false);
      void navigate(`/app/${orgName}/ansible/jobs/${res.data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to launch command');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Run Command
          </DialogTitle>
          <DialogDescription>
            Run a single Ansible module against this inventory. Results show up as a normal job.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="adhoc-module">Module *</Label>
              <Select value={form.module} onValueChange={(v) => { setForm({ ...form, module: v }); }}>
                <SelectTrigger id="adhoc-module">
                  <SelectValue placeholder="Pick a module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adhoc-limit">Limit</Label>
              <Input
                id="adhoc-limit"
                placeholder="all"
                value={form.limit}
                onChange={(e) => { setForm({ ...form, limit: e.target.value }); }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adhoc-args">Arguments</Label>
            <Input
              id="adhoc-args"
              placeholder={form.module === 'shell' || form.module === 'command' ? 'uptime' : 'key=value key2=value2'}
              value={form.module_args}
              onChange={(e) => { setForm({ ...form, module_args: e.target.value }); }}
            />
            <p className="text-xs text-muted-foreground">
              Free-form for command/shell; key=value pairs for other modules.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adhoc-credential">Machine credential</Label>
            <Select value={form.credential_id || 'none'} onValueChange={(v) => { setForm({ ...form, credential_id: v === 'none' ? '' : v }); }}>
              <SelectTrigger id="adhoc-credential">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {machineCredentials.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adhoc-pool">Runner</Label>
            <Select value={form.agent_pool_id || 'platform'} onValueChange={(v) => { setForm({ ...form, agent_pool_id: v === 'platform' ? '' : v }); }}>
              <SelectTrigger id="adhoc-pool">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="platform">Platform runner</SelectItem>
                {agentPools.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} (agent pool)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="adhoc-verbosity">Verbosity</Label>
              <Select value={String(form.verbosity)} onValueChange={(v) => { setForm({ ...form, verbosity: Number(v) }); }}>
                <SelectTrigger id="adhoc-verbosity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <SelectItem key={v} value={String(v)}>{v === 0 ? '0 (normal)' : `${v} (-${'v'.repeat(Math.min(v, 4))})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adhoc-forks">Forks</Label>
              <Input
                id="adhoc-forks"
                type="number"
                min={1}
                value={form.forks}
                onChange={(e) => { setForm({ ...form, forks: Number(e.target.value) || 5 }); }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="adhoc-become" className="text-sm cursor-pointer">Privilege escalation (become)</Label>
            <Switch
              id="adhoc-become"
              checked={form.become_enabled}
              onCheckedChange={(v) => { setForm({ ...form, become_enabled: v }); }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); }}>Cancel</Button>
          <Button disabled={busy || !form.module} onClick={() => { void handleRun(); }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Terminal className="h-4 w-4 mr-2" />}
            Run
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
