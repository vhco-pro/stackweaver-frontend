// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import type { EffectiveSetting, RunImageKind, SettingLevel } from '@/api/runPlacement';
import { useIdentityBindingOptions, useRunImages } from '@/hooks/useRunPlacement';
import { INHERIT, bindingsForPool } from '@/lib/runPlacement';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LEVEL_LABELS: Record<SettingLevel, string> = {
  workspace: 'the workspace',
  'job-template': 'the job template',
  'inventory-source': 'the inventory source',
  project: 'the project',
  organization: 'the organization',
  deployment: 'the platform default',
};

/**
 * InheritedHint names the value a launching object gets when it sets none, and the level it comes
 * from, in the "Inherited from ..." pattern of the workspace tags. It renders nothing when the
 * object's own level supplies the value.
 */
export function InheritedHint<T>({
  setting,
  ownLevel,
  describe,
  testId,
}: {
  setting: EffectiveSetting<T> | undefined;
  ownLevel: SettingLevel;
  describe: (value: T) => string;
  testId?: string;
}) {
  if (!setting || setting.level === ownLevel) return null;
  const from = setting.level ? LEVEL_LABELS[setting.level] : 'nothing';
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={testId}>
      <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Inherited from {from}: <span className="font-medium text-foreground">{describe(setting.value)}</span>
      </span>
    </p>
  );
}

interface RunImageSelectProps {
  id: string;
  orgName: string;
  kind: RunImageKind;
  /** The selected run image id, or '' to inherit. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** The hint under the control: what an inherit resolves to. */
  hint?: ReactNode;
  inheritLabel?: string;
}

/** RunImageSelect picks one of the organization's run images of one engine, or inherits. */
export function RunImageSelect({ id, orgName, kind, value, onChange, label = 'Run image', hint, inheritLabel = 'Inherit' }: RunImageSelectProps) {
  const { data: images = [], isLoading } = useRunImages(orgName);
  const ofKind = images.filter(i => i.kind === kind);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || INHERIT} onValueChange={v => { onChange(v === INHERIT ? '' : v); }} disabled={isLoading}>
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue placeholder={isLoading ? 'Loading run images...' : inheritLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT}>{inheritLabel}</SelectItem>
          {ofKind.map(img => (
            <SelectItem key={img.id} value={img.id}>
              {img.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint}
      {!isLoading && ofKind.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No {kind === 'tofu' ? 'OpenTofu' : 'Ansible'} run images yet. Add one in Settings &gt; Run Images.
        </p>
      )}
    </div>
  );
}

interface IdentityBindingSelectProps {
  id: string;
  orgName: string;
  /** The pool the object runs on when it chooses one itself; only that pool's bindings are offered. */
  poolId?: string;
  /** The selected binding id, or '' to inherit. */
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  inheritLabel?: string;
}

/** IdentityBindingSelect picks an identity binding one of the organization's pools offers, or inherits. */
export function IdentityBindingSelect({ id, orgName, poolId, value, onChange, hint, inheritLabel = 'Inherit' }: IdentityBindingSelectProps) {
  const { data: all = [], isLoading } = useIdentityBindingOptions(orgName);
  const options = bindingsForPool(all, poolId);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Identity binding</Label>
      <Select value={value || INHERIT} onValueChange={v => { onChange(v === INHERIT ? '' : v); }} disabled={isLoading}>
        <SelectTrigger id={id} aria-label="Identity binding">
          <SelectValue placeholder={isLoading ? 'Loading identity bindings...' : inheritLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT}>{inheritLabel}</SelectItem>
          {options.map(o => (
            <SelectItem key={o.binding.id} value={o.binding.id}>
              {o.binding.name} ({o.poolName})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint}
      <p className="text-xs text-muted-foreground">
        The cloud identity jobs run as. A binding belongs to a pool and applies when the job runs on that pool.
      </p>
    </div>
  );
}
