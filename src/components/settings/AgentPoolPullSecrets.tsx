// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ansibleCredentialsApi } from '@/api/ansible';
import { pullSecretsApi, type PullSecret, type PullSecretInput } from '@/api/runPlacement';
import { PageDialogContent } from '@/components/layout/Page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { dangerOutline } from '@/lib/surfaces';
import { getAnsibleCredentialFromJsonApi } from '@/utils/ansible-jsonapi';

/** How the pool's launcher provides the Secret. */
type SecretMode = 'create' | 'reference';

const SECRET_MODES: { value: SecretMode; label: string; hint: string }[] = [
  { value: 'create', label: 'Create it', hint: 'The launcher creates the Secret from the registry credential and keeps it current.' },
  { value: 'reference', label: 'Reference an existing one', hint: 'The Secret is declared elsewhere (in git, a Helm value or a manifest); the launcher never writes it.' },
];

interface Form {
  name: string;
  registry: string;
  secretName: string;
  credentialId: string;
  mode: SecretMode;
}

const EMPTY: Form = { name: '', registry: '', secretName: '', credentialId: '', mode: 'create' };

function formFrom(p: PullSecret): Form {
  return { name: p.name, registry: p.registry, secretName: p.secret_name, credentialId: p.registry_credential_id ?? '', mode: p.reference ? 'reference' : 'create' };
}

function inputFrom(f: Form): PullSecretInput {
  return {
    name: f.name.trim(),
    registry: f.registry.trim(),
    secret_name: f.secretName.trim(),
    reference: f.mode === 'reference',
    registry_credential_id: f.mode === 'reference' ? null : (f.credentialId || null),
  };
}

/**
 * AgentPoolPullSecrets manages the registry pull Secrets a pool's job pods use (#933, D8, D15):
 * each names a registry and a Kubernetes Secret, created by the pool's launcher from a registry
 * credential or referenced as declared elsewhere. A job whose run image comes from that registry
 * pulls with it. A Secret a GitOps controller declares is shown read-only. Rendered inside the
 * expanded Agent Pools row, beside the identity bindings.
 */
export function AgentPoolPullSecrets({ poolId, orgName }: { poolId: string; orgName: string }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; secret: PullSecret } | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [removing, setRemoving] = useState<PullSecret | null>(null);

  const { data: secrets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['pullSecrets', poolId],
    queryFn: () => pullSecretsApi.list(poolId),
    enabled: !!poolId,
  });
  const { data: credentials = [] } = useQuery({
    queryKey: ['registryCredentials', orgName],
    queryFn: async () => {
      const res = await ansibleCredentialsApi.list(orgName, 'registry', { pageSize: 100 });
      return (res.data ?? []).map(getAnsibleCredentialFromJsonApi);
    },
    enabled: !!orgName,
  });

  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ['pullSecrets', poolId] }); };

  const save = useMutation({
    mutationFn: () => (dialog?.mode === 'edit'
      ? pullSecretsApi.update(dialog.secret.id, inputFrom(form))
      : pullSecretsApi.create(poolId, inputFrom(form))),
    onSuccess: () => {
      toast.success(dialog?.mode === 'edit' ? 'Pull Secret updated' : 'Pull Secret created');
      setDialog(null);
      invalidate();
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to save the pull Secret'); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => pullSecretsApi.delete(id),
    onSuccess: () => {
      toast.success('Pull Secret deleted');
      invalidate();
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to delete the pull Secret'); },
  });

  const credentialName = (id: string | null) => credentials.find(c => c.id === id)?.name;
  const canSave = form.name.trim() !== '' && form.registry.trim() !== '' && form.secretName.trim() !== ''
    && (form.mode === 'reference' || form.credentialId !== '') && !save.isPending;

  return (
    <div className="p-4 space-y-4" data-testid="pool-pull-secrets">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Registry pull Secrets</h4>
          <span className="text-xs text-muted-foreground">- what this pool's job pods pull private run images with</span>
        </div>
        <GradientButton
          ramp="app"
          emphasis="secondary"
          size="sm"
          onClick={() => { setForm(EMPTY); setDialog({ mode: 'create' }); }}
          className="w-auto px-3 py-1.5 text-sm gap-2"
        >
          <Plus className="h-4 w-4" />
          New pull Secret
        </GradientButton>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          Could not load the pull Secrets.
          <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>Retry</Button>
        </div>
      ) : secrets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pull Secrets. A private run image is pulled with a Secret written for each job.</p>
      ) : (
        <ul className="space-y-2" aria-label="Registry pull Secrets">
          {secrets.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-900/10 dark:border-white/5 bg-slate-900/[0.03] dark:bg-black/10 px-3 py-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <Badge variant="outline" className="text-xs font-mono">{p.registry}</Badge>
                  {p.declared_externally && (
                    <Badge variant="outline" className="text-xs bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20">
                      Managed by {p.external_manager || 'GitOps'}
                    </Badge>
                  )}
                  {p.object_present === false && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                      Secret missing
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {p.secret_name}{p.reference ? ' (referenced)' : ` (from ${credentialName(p.registry_credential_id) ?? 'a registry credential'})`}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* A Secret another manager declares keeps its Kubernetes fields; it can only be renamed there. */}
                {!p.declared_externally && (
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { setForm(formFrom(p)); setDialog({ mode: 'edit', secret: p }); }}
                    aria-label={`Edit pull Secret ${p.name}`}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                )}
                <Button variant="outline" size="sm" className={cn(dangerOutline, 'gap-1.5')} onClick={() => { setRemoving(p); }}
                  disabled={remove.isPending} aria-label={`Delete pull Secret ${p.name}`}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}>
        <PageDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit pull Secret' : 'New pull Secret'}</DialogTitle>
            <DialogDescription>
              A job of this pool whose run image comes from the registry below pulls it with this Secret, in the pool's job namespace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (canSave) save.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pull-name">Name</Label>
              <Input id="pull-name" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); }} placeholder="ghcr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pull-registry">Registry</Label>
              <Input id="pull-registry" value={form.registry} onChange={e => { setForm(f => ({ ...f, registry: e.target.value })); }} placeholder="ghcr.io" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pull-secret-name">Secret name</Label>
              <Input id="pull-secret-name" value={form.secretName} onChange={e => { setForm(f => ({ ...f, secretName: e.target.value })); }} placeholder="sw-pull-ghcr" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pull-mode">Secret</Label>
              <Select value={form.mode} onValueChange={v => { setForm(f => ({ ...f, mode: v === 'reference' ? 'reference' : 'create' })); }}>
                <SelectTrigger id="pull-mode" aria-label="Secret mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECRET_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{SECRET_MODES.find(m => m.value === form.mode)?.hint}</p>
            </div>
            {form.mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="pull-credential">Registry credential</Label>
                <Select value={form.credentialId} onValueChange={v => { setForm(f => ({ ...f, credentialId: v })); }}>
                  <SelectTrigger id="pull-credential" aria-label="Registry credential"><SelectValue placeholder="Select a registry credential" /></SelectTrigger>
                  <SelectContent>
                    {credentials.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">A container registry credential from Settings &gt; Credentials. Only the pool's launcher reads it; jobs never see it.</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialog(null); }}>Cancel</Button>
              <GradientButton ramp="app" type="submit" className="w-auto px-4 py-2" disabled={!canSave}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {dialog?.mode === 'edit' ? 'Save' : 'Create'}
              </GradientButton>
            </DialogFooter>
          </form>
        </PageDialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={open => { if (!open) setRemoving(null); }}
        title="Delete pull Secret?"
        description={`Delete "${removing?.name ?? ''}"? Jobs pull its registry with a Secret written for each job again. A Secret the launcher created stays in the namespace for you to remove.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (removing) remove.mutate(removing.id); setRemoving(null); }}
      />
    </div>
  );
}
