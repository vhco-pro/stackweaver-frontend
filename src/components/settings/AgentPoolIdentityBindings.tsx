// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { identityBindingsApi, type IdentityBinding, type IdentityBindingInput } from '@/api/runPlacement';
import { PageDialogContent } from '@/components/layout/Page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { dangerOutline } from '@/lib/surfaces';
import { annotationProblem, formatAnnotations, parseAnnotations } from '@/lib/runPlacement';

const MECHANISMS: { value: string; label: string; hint: string }[] = [
  { value: 'aws-irsa', label: 'AWS IRSA', hint: 'eks.amazonaws.com/role-arn on the service account' },
  { value: 'aws-pod-identity', label: 'EKS Pod Identity', hint: 'An EKS pod identity association names the service account' },
  { value: 'gcp-workload-identity', label: 'GKE Workload Identity', hint: 'iam.gke.io/gcp-service-account on the service account' },
  { value: 'azure-workload-identity', label: 'Azure Workload Identity', hint: 'azure.workload.identity/client-id on the service account' },
];

function mechanismLabel(value: string): string {
  return MECHANISMS.find(m => m.value === value)?.label ?? value;
}

/** How the pool's launcher provides the service account. */
type AccountMode = 'create' | 'per-job' | 'reference';

const ACCOUNT_MODES: { value: AccountMode; label: string; hint: string }[] = [
  { value: 'create', label: 'Create it', hint: 'The launcher creates the service account with these annotations.' },
  { value: 'per-job', label: 'Create one per job', hint: 'The launcher clones the account for every job and removes it after.' },
  { value: 'reference', label: 'Reference an existing one', hint: 'The account is declared elsewhere; the launcher never writes it.' },
];

interface Form {
  name: string;
  mechanism: string;
  serviceAccount: string;
  annotations: string;
  mode: AccountMode;
}

/** A binding's name: letters, digits, '.', '_' and '-', starting with a letter or digit (the API's rule). */
const BINDING_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

const EMPTY: Form = { name: '', mechanism: 'aws-irsa', serviceAccount: '', annotations: '', mode: 'create' };

function formFrom(b: IdentityBinding): Form {
  return {
    name: b.name,
    mechanism: b.mechanism,
    serviceAccount: b.service_account,
    annotations: formatAnnotations(b.annotations),
    mode: b.reference ? 'reference' : b.per_job_sa ? 'per-job' : 'create',
  };
}

function inputFrom(f: Form): IdentityBindingInput {
  return {
    name: f.name.trim(),
    mechanism: f.mechanism,
    service_account: f.serviceAccount.trim(),
    annotations: parseAnnotations(f.annotations),
    per_job_sa: f.mode === 'per-job',
    reference: f.mode === 'reference',
  };
}

/**
 * AgentPoolIdentityBindings manages the cloud identities a pool offers its jobs (#933, D8, D15):
 * each binding names a Kubernetes service account and its annotations, created per job or
 * referenced as it stands. A binding a GitOps controller declares is shown read-only. Rendered
 * inside the expanded Agent Pools row, beside the pool's agent tokens.
 */
export function AgentPoolIdentityBindings({ poolId }: { poolId: string }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; binding: IdentityBinding } | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [removing, setRemoving] = useState<IdentityBinding | null>(null);

  const { data: bindings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['identityBindings', poolId],
    queryFn: () => identityBindingsApi.list(poolId),
    enabled: !!poolId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['identityBindings', poolId] });
    void queryClient.invalidateQueries({ queryKey: ['identityBindingOptions'] });
  };

  const save = useMutation({
    mutationFn: () => (dialog?.mode === 'edit'
      ? identityBindingsApi.update(dialog.binding.id, inputFrom(form))
      : identityBindingsApi.create(poolId, inputFrom(form))),
    onSuccess: () => {
      toast.success(dialog?.mode === 'edit' ? 'Identity binding updated' : 'Identity binding created');
      setDialog(null);
      invalidate();
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to save the identity binding'); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => identityBindingsApi.delete(id),
    onSuccess: () => {
      toast.success('Identity binding deleted');
      invalidate();
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to delete the identity binding'); },
  });

  const nameProblem = form.name.trim() !== '' && !BINDING_NAME.test(form.name.trim())
    ? "Use letters, digits, '.', '_' or '-', starting with a letter or digit."
    : undefined;
  const annotationsProblem = annotationProblem(form.annotations);
  const canSave = form.name.trim() !== '' && !nameProblem && form.serviceAccount.trim() !== '' && !annotationsProblem && !save.isPending;
  const hint = MECHANISMS.find(m => m.value === form.mechanism)?.hint;

  return (
    <div className="p-4 space-y-4" data-testid="pool-identity-bindings">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Identity bindings</h4>
          <span className="text-xs text-muted-foreground">- cloud identities this pool's jobs may run as</span>
        </div>
        <GradientButton
          ramp="app"
          emphasis="secondary"
          size="sm"
          onClick={() => { setForm(EMPTY); setDialog({ mode: 'create' }); }}
          className="w-auto px-3 py-1.5 text-sm gap-2"
        >
          <Plus className="h-4 w-4" />
          New binding
        </GradientButton>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          Could not load the identity bindings.
          <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>Retry</Button>
        </div>
      ) : bindings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No identity bindings. Jobs on this pool run with the platform identity.</p>
      ) : (
        <ul className="space-y-2" aria-label="Identity bindings">
          {bindings.map(b => (
            <li key={b.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 rounded-lg border border-slate-900/10 dark:border-white/5 bg-slate-900/[0.03] dark:bg-black/10 px-3 py-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium truncate">{b.name}</span>
                  <Badge variant="outline" className="max-w-full min-w-0 truncate text-xs">{mechanismLabel(b.mechanism)}</Badge>
                  {b.declared_externally && (
                    <Badge variant="outline" className="text-xs bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20">
                      Managed by {b.external_manager || 'GitOps'}
                    </Badge>
                  )}
                  {b.object_present === false && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                      Service account missing
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {b.service_account}{b.reference ? ' (referenced)' : b.per_job_sa ? ' (created per job)' : ''}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 shrink-0">
                  {/* A binding another manager declares keeps its Kubernetes fields; it can only be removed. */}
                  {!b.declared_externally && (
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { setForm(formFrom(b)); setDialog({ mode: 'edit', binding: b }); }}
                      aria-label={`Edit identity binding ${b.name}`}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className={cn(dangerOutline, 'gap-1.5')} onClick={() => { setRemoving(b); }}
                    disabled={remove.isPending} aria-label={`Delete identity binding ${b.name}`}>
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
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit identity binding' : 'New identity binding'}</DialogTitle>
            <DialogDescription>
              A job that selects this binding runs as the Kubernetes service account below, so it gets that account's cloud identity.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (canSave) save.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="binding-name">Name</Label>
              <Input id="binding-name" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); }} placeholder="deploy-prod" aria-invalid={!!nameProblem} />
              {nameProblem && <p data-testid="binding-name-error" className="text-xs text-red-600 dark:text-red-400">{nameProblem}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="binding-mechanism">Mechanism</Label>
              <Select value={form.mechanism} onValueChange={v => { setForm(f => ({ ...f, mechanism: v })); }}>
                <SelectTrigger id="binding-mechanism" aria-label="Mechanism"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MECHANISMS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="binding-sa">Service account name</Label>
              <Input id="binding-sa" value={form.serviceAccount} onChange={e => { setForm(f => ({ ...f, serviceAccount: e.target.value })); }} placeholder="sw-deploy" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="binding-annotations">Annotations</Label>
              <Textarea
                id="binding-annotations"
                value={form.annotations}
                onChange={e => { setForm(f => ({ ...f, annotations: e.target.value })); }}
                placeholder="eks.amazonaws.com/role-arn=arn:aws:iam::123456789012:role/deploy"
                className="font-mono text-xs"
                aria-invalid={!!annotationsProblem}
              />
              <p className="text-xs text-muted-foreground">One key=value per line.</p>
              {annotationsProblem && <p data-testid="binding-annotations-error" className="text-xs text-red-600 dark:text-red-400">{annotationsProblem}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="binding-mode">Service account</Label>
              <Select value={form.mode} onValueChange={v => { setForm(f => ({ ...f, mode: ACCOUNT_MODES.find(m => m.value === v)?.value ?? 'create' })); }}>
                <SelectTrigger id="binding-mode" aria-label="Service account mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ACCOUNT_MODES.find(m => m.value === form.mode)?.hint}</p>
            </div>
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
        title="Delete identity binding?"
        description={`Delete "${removing?.name ?? ''}"? Anything that selects it falls back to the identity it inherits.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (removing) remove.mutate(removing.id); setRemoving(null); }}
      />
    </div>
  );
}
