// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { organizationsApi, platformSettingsApi, type Organization } from '@/api/client';
import { IdentityBindingSelect, RunImageSelect } from '@/components/settings/RunPlacementFields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatBytes, formatSeconds } from '@/lib/runPlacement';

const GIB = 1024 ** 3;

interface Form {
  timeoutMinutes: string;
  tofuImage: string;
  ansibleImage: string;
  bindingId: string;
  cacheGiB: string;
}

function formFrom(org: Organization): Form {
  return {
    timeoutMinutes: org.run_timeout ? String(Math.round(org.run_timeout / 60)) : '',
    tofuImage: org.tofu_run_image_id ?? '',
    ansibleImage: org.ansible_run_image_id ?? '',
    bindingId: org.identity_binding_id ?? '',
    cacheGiB: org.cache_size_limit ? String(Math.round((org.cache_size_limit / GIB) * 10) / 10) : '',
  };
}

/** A non-negative whole number from a text field, or 0 for empty or unreadable. */
function whole(text: string, factor: number): number {
  const n = Number(text);
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? 0 : Math.round(n * factor);
}

/**
 * OrgRunDefaults edits the organization's level of the level rule (#933, D0, D7, D15): the run
 * timeout, run images and identity binding every project, workspace, job template and inventory
 * source inherits when it sets none, and the bound on the organization's cache. An empty field
 * defers to the platform default, which is shown beside it.
 */
export function OrgRunDefaults({ orgName, org }: { orgName: string; org: Organization }) {
  const queryClient = useQueryClient();
  // Keyed by the saved values, so a save or another tab's edit resets the form.
  const savedKey = JSON.stringify(formFrom(org));
  const [state, setState] = useState<{ key: string; form: Form }>({ key: savedKey, form: formFrom(org) });
  const form = state.key === savedKey ? state.form : formFrom(org);
  const set = (patch: Partial<Form>) => { setState({ key: savedKey, form: { ...form, ...patch } }); };

  const { data: platform } = useQuery({
    queryKey: ['platformSettings'],
    queryFn: () => platformSettingsApi.get(),
  });

  const save = useMutation({
    mutationFn: () =>
      organizationsApi.update(orgName, {
        data: {
          type: 'organizations',
          attributes: {
            'run-timeout': whole(form.timeoutMinutes, 60),
            'tofu-run-image-id': form.tofuImage,
            'ansible-run-image-id': form.ansibleImage,
            'identity-binding-id': form.bindingId,
            'cache-size-limit': whole(form.cacheGiB, GIB),
          },
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orgSettings', orgName] });
      void queryClient.invalidateQueries({ queryKey: ['organization', orgName] });
      toast.success('Run defaults saved');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to save the run defaults'); },
  });

  const dirty = JSON.stringify(form) !== savedKey;
  const deployment = platform?.deployment;

  return (
    <Card data-testid="org-run-defaults">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="h-5 w-5" />
          Run Defaults
        </CardTitle>
        <CardDescription>
          What runs, jobs and syncs use when neither they nor their project set it. Leave a field empty for the platform default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-run-timeout">Run timeout (minutes)</Label>
            <Input
              id="org-run-timeout"
              type="number"
              min={0}
              inputMode="numeric"
              value={form.timeoutMinutes}
              onChange={e => { set({ timeoutMinutes: e.target.value }); }}
              placeholder={deployment ? `Platform default: ${formatSeconds(deployment.run_timeout_default)}` : 'Platform default'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-cache-size-limit">Cache size limit (GiB)</Label>
            <Input
              id="org-cache-size-limit"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              value={form.cacheGiB}
              onChange={e => { set({ cacheGiB: e.target.value }); }}
              placeholder={deployment ? `Platform default: ${formatBytes(deployment.cache_size_limit)}` : 'Platform default'}
            />
            <p className="text-xs text-muted-foreground">
              The most the organization's cache of providers, OpenTofu releases and collections may hold. The oldest entries go first.
            </p>
          </div>
          <RunImageSelect
            id="org-tofu-run-image"
            label="OpenTofu run image"
            orgName={orgName}
            kind="tofu"
            value={form.tofuImage}
            onChange={v => { set({ tofuImage: v }); }}
            inheritLabel="The platform image"
          />
          <RunImageSelect
            id="org-ansible-run-image"
            label="Ansible execution environment"
            orgName={orgName}
            kind="ansible"
            value={form.ansibleImage}
            onChange={v => { set({ ansibleImage: v }); }}
            inheritLabel="The platform image"
          />
          <IdentityBindingSelect
            id="org-identity-binding"
            orgName={orgName}
            value={form.bindingId}
            onChange={v => { set({ bindingId: v }); }}
            inheritLabel="The platform identity"
          />
        </div>
        <div className="flex justify-end">
          <GradientButton
            ramp="app"
            className="w-auto px-4 py-2"
            onClick={() => { save.mutate(); }}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save run defaults
          </GradientButton>
        </div>
      </CardContent>
    </Card>
  );
}
