// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Box, KeyRound, Loader2, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Page, PageDialogContent } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ansibleCredentialsApi } from '@/api/ansible';
import { runImagesApi, type RunImage, type RunImageKind } from '@/api/runPlacement';
import { getAnsibleCredentialFromJsonApi } from '@/utils/ansible-jsonapi';
import { useRunImages } from '@/hooks/useRunPlacement';
import { cn } from '@/lib/utils';
import { dangerGhostIcon, glassSurface } from '@/lib/surfaces';

const KINDS: { value: RunImageKind; label: string; hint: string }[] = [
  { value: 'tofu', label: 'OpenTofu', hint: 'Runs of workspaces that select it' },
  { value: 'ansible', label: 'Ansible', hint: 'Jobs and syncs that select it (an execution environment)' },
];

/** The select value for "pull without a credential". */
const NO_CREDENTIAL = '__none__';

interface FormState {
  name: string;
  kind: RunImageKind;
  image: string;
  digest: string;
  credentialId: string;
  description: string;
}

const EMPTY_FORM: FormState = { name: '', kind: 'tofu', image: '', digest: '', credentialId: '', description: '' };

function formFrom(img: RunImage): FormState {
  return {
    name: img.name,
    kind: img.kind,
    image: img.image,
    digest: img.digest,
    credentialId: img.registry_credential_id ?? '',
    description: img.description,
  };
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * RunImages lists the organization's run images (#933, D6, D15): images its OpenTofu runs and
 * Ansible jobs may run in instead of the platform image, each optionally pinned to a digest and
 * pulled with a registry credential. A workspace, job template, inventory source, project or the
 * organization then selects one.
 */
export default function RunImages() {
  const { orgName = '' } = useParams<{ orgName: string }>();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; image: RunImage } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [toDelete, setToDelete] = useState<RunImage | null>(null);

  const { data: images = [], isLoading, isError, refetch } = useRunImages(orgName);

  const { data: credentials = [] } = useQuery({
    queryKey: ['registryCredentials', orgName],
    queryFn: async () => {
      const res = await ansibleCredentialsApi.list(orgName, 'registry', { pageSize: 100 });
      return (res.data ?? []).map(getAnsibleCredentialFromJsonApi);
    },
    enabled: !!orgName,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['runImages', orgName] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const input = {
        name: form.name.trim(),
        kind: form.kind,
        image: form.image.trim(),
        digest: form.digest.trim(),
        registry_credential_id: form.credentialId || null,
        description: form.description.trim(),
      };
      if (dialog?.mode === 'edit') {
        // The kind is fixed once levels may select the image.
        return runImagesApi.update(dialog.image.id, { ...input, kind: undefined });
      }
      return runImagesApi.create(orgName, input);
    },
    onSuccess: () => {
      toast.success(dialog?.mode === 'edit' ? 'Run image updated' : 'Run image created');
      setDialog(null);
      invalidate();
    },
    onError: (e: unknown) => { toast.error(errorText(e, 'Failed to save the run image')); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => runImagesApi.delete(id),
    onSuccess: () => {
      toast.success('Run image deleted');
      setToDelete(null);
      invalidate();
    },
    onError: (e: unknown) => { toast.error(errorText(e, 'Failed to delete the run image')); },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialog({ mode: 'create' });
  };
  const openEdit = (image: RunImage) => {
    setForm(formFrom(image));
    setDialog({ mode: 'edit', image });
  };

  const credentialName = (id: string | null) => credentials.find(c => c.id === id)?.name;
  const canSave = form.name.trim() !== '' && form.image.trim() !== '' && !save.isPending;

  const addAction = (
    <GradientButton ramp="app" onClick={openCreate} className="w-auto px-4 py-2">
      <Plus className="h-4 w-4 mr-2" />
      Add run image
    </GradientButton>
  );
  const listState = isLoading ? 'loading' : isError ? 'error' : images.length === 0 ? 'empty' : 'ready';

  return (
    <Page ramp="runImages" className="space-y-8">
      <PageHeader
        icon={Box}
        title="Run Images"
        subtitle="Images your OpenTofu runs and Ansible jobs run in instead of the platform image"
        backTo={{ to: `/app/${orgName}/settings`, label: 'Back to Settings' }}
        action={addAction}
        listState={listState}
      />

      {isLoading ? (
        <div className="space-y-4" data-testid="run-images-loading">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : isError ? (
        <div className={cn(glassSurface, 'p-6 flex items-center justify-between gap-3')}>
          <span className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4" /> Could not load the run images.
          </span>
          <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </div>
      ) : images.length === 0 ? (
        <PageEmptyState
          icon={Box}
          title="No run images yet"
          description="Add an image with the tools your runs need, or an Ansible execution environment."
          action={addAction}
        />
      ) : (
        <ul className="space-y-4" aria-label="Run images">
          {images.map(img => (
            <li key={img.id} className={cn(glassSurface, 'p-6')} data-testid="run-image-row">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{img.name}</h3>
                    <Badge
                      variant="outline"
                      className={img.kind === 'tofu'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'}
                    >
                      {img.kind === 'tofu' ? 'OpenTofu' : 'Ansible'}
                    </Badge>
                    {img.digest && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        Pinned
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-sm break-all text-muted-foreground">
                    {img.image}{img.digest ? `@${img.digest}` : ''}
                  </p>
                  {img.description && <p className="text-sm text-muted-foreground">{img.description}</p>}
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                    {img.registry_credential_id
                      ? <>Pulled with {credentialName(img.registry_credential_id) ?? 'a registry credential'}</>
                      : 'Pulled without a credential'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => { openEdit(img); }}>
                    <Settings2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(dangerGhostIcon, 'h-9 w-9')}
                    onClick={() => { setToDelete(img); }}
                    aria-label={`Delete run image ${img.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}>
        <PageDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit run image' : 'Add run image'}</DialogTitle>
            <DialogDescription>
              The image must come from a registry the platform allows. Pin a digest to run exactly that image.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => { e.preventDefault(); if (canSave) save.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="run-image-name">Name</Label>
              <Input
                id="run-image-name"
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); }}
                placeholder="e.g. tofu-aws-tools"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-image-kind">Engine</Label>
              <Select
                value={form.kind}
                onValueChange={v => { setForm(f => ({ ...f, kind: v === 'ansible' ? 'ansible' : 'tofu' })); }}
                disabled={dialog?.mode === 'edit'}
              >
                <SelectTrigger id="run-image-kind" aria-label="Engine"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map(k => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{KINDS.find(k => k.value === form.kind)?.hint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-image-image">Image</Label>
              <Input
                id="run-image-image"
                value={form.image}
                onChange={e => { setForm(f => ({ ...f, image: e.target.value })); }}
                placeholder="ghcr.io/acme/tofu-aws:1.9"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-image-digest">Digest (optional)</Label>
              <Input
                id="run-image-digest"
                value={form.digest}
                onChange={e => { setForm(f => ({ ...f, digest: e.target.value })); }}
                placeholder="sha256:..."
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-image-credential">Registry credential</Label>
              <Select
                value={form.credentialId || NO_CREDENTIAL}
                onValueChange={v => { setForm(f => ({ ...f, credentialId: v === NO_CREDENTIAL ? '' : v })); }}
              >
                <SelectTrigger id="run-image-credential" aria-label="Registry credential"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CREDENTIAL}>None (a public image)</SelectItem>
                  {credentials.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A container registry credential from Settings &gt; Credentials. Only the launcher uses it to pull; jobs never see it.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-image-description">Description</Label>
              <Textarea
                id="run-image-description"
                value={form.description}
                onChange={e => { setForm(f => ({ ...f, description: e.target.value })); }}
              />
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

      <Dialog open={toDelete !== null} onOpenChange={open => { if (!open) setToDelete(null); }}>
        <PageDialogContent>
          <DialogHeader>
            <DialogTitle>Delete run image</DialogTitle>
            <DialogDescription>
              {toDelete && <>Delete &quot;{toDelete.name}&quot;? Workspaces, templates and projects that select it fall back to the image they inherit.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setToDelete(null); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (toDelete) remove.mutate(toDelete.id); }}
              disabled={remove.isPending}
            >
              {remove.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </PageDialogContent>
      </Dialog>
    </Page>
  );
}
