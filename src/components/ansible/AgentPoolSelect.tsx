// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { AgentPool } from '@/api/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const HOSTED = '__hosted__';

interface AgentPoolSelectProps {
  id: string;
  agentPools: AgentPool[];
  /** The chosen pool's ID; empty runs the job template on Hosted capacity. */
  value: string;
  onChange: (agentPoolId: string) => void;
}

/**
 * AgentPoolSelect chooses where a job template's jobs run: Hosted capacity, or one of the
 * organization's agent pools. The job template create and edit dialogs share it.
 */
export function AgentPoolSelect({ id, agentPools, value, onChange }: AgentPoolSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Agent pool (optional)</Label>
      <Select value={value || HOSTED} onValueChange={(v) => { onChange(v === HOSTED ? '' : v); }}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Hosted capacity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={HOSTED}>Hosted capacity</SelectItem>
          {agentPools.map((pool) => (
            <SelectItem key={pool.id} value={pool.id}>{pool.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Choose an agent pool to run on your own launchers, or leave Hosted capacity to run on the installation&apos;s hosted launchers.
      </p>
    </div>
  );
}
