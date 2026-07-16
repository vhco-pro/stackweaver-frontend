// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi, type AgentPool } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cpu, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'remote' | 'agent' | 'local';

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'remote', label: 'Remote', hint: 'Runs execute on Stackweaver-managed infrastructure.' },
  { value: 'agent', label: 'Agent', hint: 'Runs are dispatched to an agent pool you host.' },
  { value: 'local', label: 'Local', hint: 'Runs execute wherever the CLI is invoked.' },
];

/**
 * OrgDefaultExecution edits the organization's default workspace execution settings
 * (tfe_organization_default_settings). These sit at the top of TFE's inheritance chain: a run resolves
 * workspace -> project -> organization, so this applies to every workspace whose project has not
 * overwritten its settings and which has not set its own.
 *
 * It lives on the Agent Pools page because choosing the pool that workspaces default to belongs beside
 * the pools themselves; TFE keeps it under organization settings, but we have no general-settings page
 * and this needs no new one.
 */
export function OrgDefaultExecution({ orgName, pools }: { orgName: string; pools: AgentPool[] }) {
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState<{ mode: Mode; poolId: string | null } | null>(null);

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', orgName],
    queryFn: () => organizationsApi.get(orgName),
    enabled: !!orgName,
  });

  const saved: { mode: Mode; poolId: string | null } = {
    mode: org?.default_execution_mode ?? 'remote',
    poolId: org?.default_agent_pool_id ?? null,
  };
  const current = dirty ?? saved;

  const save = useMutation({
    mutationFn: () => organizationsApi.updateDefaultSettings(orgName, current.mode, current.poolId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organization', orgName] });
      setDirty(null);
      toast.success('Default execution settings saved');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to save default execution settings'); },
  });

  // The server rejects agent mode without a pool, so do not offer to send it.
  const needsPool = current.mode === 'agent' && !current.poolId;
  const changed = dirty !== null && (dirty.mode !== saved.mode || dirty.poolId !== saved.poolId);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="h-5 w-5 text-teal-500" />
        <div>
          <h3 className="text-lg font-semibold">Default execution</h3>
          <p className="text-sm text-muted-foreground">
            Applies to every workspace that has not set its own execution mode, and whose project has not
            overridden it.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Execution mode</Label>
              <Select
                value={current.mode}
                onValueChange={(v) => {
                  const mode = v as Mode;
                  // Leaving agent mode drops the pool, mirroring the server.
                  setDirty({ mode, poolId: mode === 'agent' ? current.poolId : null });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{MODES.find(m => m.value === current.mode)?.hint}</p>
            </div>

            {current.mode === 'agent' && (
              <div className="space-y-2">
                <Label>Default agent pool</Label>
                <Select
                  value={current.poolId ?? ''}
                  onValueChange={(v) => { setDirty({ mode: current.mode, poolId: v }); }}
                >
                  <SelectTrigger><SelectValue placeholder="Select an agent pool" /></SelectTrigger>
                  <SelectContent>
                    {pools.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {pools.length === 0 && (
                  <p className="text-xs text-muted-foreground">Create an agent pool below first.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            {changed && (
              <Button variant="ghost" size="sm" onClick={() => { setDirty(null); }}>Cancel</Button>
            )}
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!changed || needsPool || save.isPending}
              onClick={() => { save.mutate(); }}
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {needsPool ? 'Select a pool' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
