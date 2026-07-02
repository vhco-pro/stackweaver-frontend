// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Shield, ArrowLeft, Plus, Trash2, Loader2, Settings2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  azureOIDCConfigApi,
  awsOIDCConfigApi,
  oidcConfigApi,
  type OIDCConfiguration,
  type OIDCProvider,
} from '@/api/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Per-provider presentation + form metadata. Adding GCP/Vault later is a matter of extending this map.
const PROVIDERS: Record<OIDCProvider, {
  label: string;
  gradient: string;
  fields: { key: 'client_id' | 'subscription_id' | 'tenant_id' | 'role_arn'; label: string; placeholder: string; hint: string }[];
}> = {
  azure: {
    label: 'Azure OIDC',
    gradient: 'from-sky-500 to-blue-500',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: '00000000-0000-0000-0000-000000000000', hint: 'The Application (client) ID of the Azure Entra ID app registration' },
      { key: 'subscription_id', label: 'Subscription ID', placeholder: '00000000-0000-0000-0000-000000000000', hint: 'The Azure subscription ID for resource access' },
      { key: 'tenant_id', label: 'Tenant ID', placeholder: '00000000-0000-0000-0000-000000000000', hint: 'The Directory (tenant) ID of the Azure Entra ID tenant' },
    ],
  },
  aws: {
    label: 'AWS OIDC',
    gradient: 'from-amber-500 to-orange-500',
    fields: [
      { key: 'role_arn', label: 'Role ARN', placeholder: 'arn:aws:iam::123456789012:role/my-role', hint: 'The IAM role Terraform runs assume via OIDC web identity' },
    ],
  },
};

type OIDCForm = { client_id: string; subscription_id: string; tenant_id: string; role_arn: string };
const EMPTY_FORM: OIDCForm = { client_id: '', subscription_id: '', tenant_id: '', role_arn: '' };

export default function OIDCConfigurations() {
  const { orgName } = useParams<{ orgName: string }>();
  const { data: configs = [], isLoading: loading, refetch: refetchConfigs } = useQuery({
    queryKey: ['oidc-configs', orgName],
    queryFn: () => oidcConfigApi.list(orgName!),
    enabled: !!orgName,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createProvider, setCreateProvider] = useState<OIDCProvider>('azure');
  const [editConfig, setEditConfig] = useState<OIDCConfiguration | null>(null);
  const [deleteConfig, setDeleteConfig] = useState<OIDCConfiguration | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<OIDCForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<OIDCForm>(EMPTY_FORM);

  const copyToClipboard = (value: string, key: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedField(key);
      setTimeout(() => { setCopiedField(null); }, 2000);
    });
  };

  // Returns the label/value pairs to show for a config, by provider.
  const detailFields = (config: OIDCConfiguration): { label: string; value: string; key: string }[] => {
    if (config.provider === 'aws') {
      return [{ label: 'Role ARN', value: config.role_arn, key: `${config.id}-role` }];
    }
    return [
      { label: 'Client ID', value: config.client_id, key: `${config.id}-client` },
      { label: 'Subscription ID', value: config.subscription_id, key: `${config.id}-sub` },
      { label: 'Tenant ID', value: config.tenant_id, key: `${config.id}-tenant` },
    ];
  };

  const missingRequired = (provider: OIDCProvider, form: OIDCForm): boolean =>
    PROVIDERS[provider].fields.some((f) => !form[f.key].trim());

  const openCreate = () => {
    setCreateProvider('azure');
    setCreateForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName) return;
    if (missingRequired(createProvider, createForm)) {
      toast.error('All fields are required');
      return;
    }
    setCreating(true);
    try {
      if (createProvider === 'aws') {
        await awsOIDCConfigApi.create(orgName, { role_arn: createForm.role_arn.trim() });
      } else {
        await azureOIDCConfigApi.create(orgName, {
          client_id: createForm.client_id.trim(),
          subscription_id: createForm.subscription_id.trim(),
          tenant_id: createForm.tenant_id.trim(),
        });
      }
      toast.success(`${PROVIDERS[createProvider].label} configuration created`);
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      void refetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create OIDC configuration');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (config: OIDCConfiguration) => {
    setEditConfig(config);
    setEditForm(
      config.provider === 'aws'
        ? { ...EMPTY_FORM, role_arn: config.role_arn }
        : { ...EMPTY_FORM, client_id: config.client_id, subscription_id: config.subscription_id, tenant_id: config.tenant_id },
    );
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editConfig) return;
    if (missingRequired(editConfig.provider, editForm)) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      if (editConfig.provider === 'aws') {
        await awsOIDCConfigApi.update(editConfig.id, { role_arn: editForm.role_arn.trim() });
      } else {
        await azureOIDCConfigApi.update(editConfig.id, {
          client_id: editForm.client_id.trim(),
          subscription_id: editForm.subscription_id.trim(),
          tenant_id: editForm.tenant_id.trim(),
        });
      }
      toast.success(`${PROVIDERS[editConfig.provider].label} configuration updated`);
      setEditConfig(null);
      void refetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update OIDC configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfig) return;
    setDeleting(true);
    try {
      if (deleteConfig.provider === 'aws') {
        await awsOIDCConfigApi.delete(deleteConfig.id);
      } else {
        await azureOIDCConfigApi.delete(deleteConfig.id);
      }
      toast.success(`${PROVIDERS[deleteConfig.provider].label} configuration deleted`);
      setDeleteConfig(null);
      void refetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete OIDC configuration');
    } finally {
      setDeleting(false);
    }
  };

  // Shared form body used by both the create and edit dialogs, rendered for a given provider.
  const renderFields = (provider: OIDCProvider, form: OIDCForm, setForm: React.Dispatch<React.SetStateAction<OIDCForm>>, idPrefix: string) => (
    <div className="space-y-4 py-4">
      {PROVIDERS[provider].fields.map((f) => (
        <div key={f.key} className="space-y-2">
          <Label htmlFor={`${idPrefix}-${f.key}`}>{f.label}</Label>
          <Input
            id={`${idPrefix}-${f.key}`}
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={(e) => { setForm((prev) => ({ ...prev, [f.key]: e.target.value })); }}
            required
          />
          <p className="text-xs text-muted-foreground">{f.hint}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={`/app/${orgName}/settings`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-sky-400 via-blue-400 to-sky-400 bg-clip-text text-transparent mb-2">
              OIDC Configurations
            </h1>
            <p className="text-muted-foreground">
              Manage keyless authentication from Terraform runs to cloud providers via OIDC workload identity
            </p>
          </div>
          <div className="relative inline-flex rounded-xl bg-gradient-to-r from-sky-500 via-blue-500 to-sky-500 p-[2px]">
            <Button
              variant="ghost"
              onClick={openCreate}
              className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add OIDC
            </Button>
          </div>
        </div>
      </div>

      {/* Config List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No OIDC configurations</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create an OIDC configuration to enable keyless authentication from Terraform runs to a cloud provider.
            This eliminates the need to store cloud credentials as variables.
          </p>
          <Button onClick={openCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Add OIDC Configuration
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <div
              key={config.id}
              className={cn(
                'rounded-2xl p-6',
                'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                'dark:from-black/10 dark:via-black/5',
                'backdrop-blur-md border border-white/20 dark:border-white/10',
                'shadow-lg shadow-purple-500/5',
                'transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br', PROVIDERS[config.provider].gradient)}>
                      <Shield className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{PROVIDERS[config.provider].label}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{config.id}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    {detailFields(config).map(({ label, value, key }) => (
                      <div key={key} className="min-w-0">
                        <span className="text-muted-foreground">{label}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="font-mono text-xs truncate min-w-0 flex-1">{value}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => { copyToClipboard(value, key); }}
                            title={`Copy ${label}`}
                          >
                            {copiedField === key
                              ? <Check className="h-3 w-3 text-green-500" />
                              : <Copy className="h-3 w-3" />
                            }
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { openEdit(config); }}
                    className="h-8 w-8"
                    aria-label="Edit configuration"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setDeleteConfig(config); }}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label="Delete configuration"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add OIDC Configuration</DialogTitle>
            <DialogDescription>
              Configure keyless authentication from Terraform runs to a cloud provider using OIDC workload identity.
              You&apos;ll need a matching trust/federated credential set up on the provider side.
            </DialogDescription>
          </DialogHeader>
          {/* Provider selector */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1" role="tablist" aria-label="Cloud provider">
            {(Object.keys(PROVIDERS) as OIDCProvider[]).map((p) => (
              <Button
                key={p}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={createProvider === p}
                onClick={() => { setCreateProvider(p); setCreateForm(EMPTY_FORM); }}
                className={cn(
                  'rounded-lg text-sm',
                  createProvider === p
                    ? cn('bg-gradient-to-r text-white', PROVIDERS[p].gradient)
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {PROVIDERS[p].label}
              </Button>
            ))}
          </div>
          <form onSubmit={(e) => { void handleCreate(e); }}>
            {renderFields(createProvider, createForm, setCreateForm, 'create')}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editConfig} onOpenChange={(open) => { if (!open) setEditConfig(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editConfig ? PROVIDERS[editConfig.provider].label : 'OIDC'} Configuration</DialogTitle>
            <DialogDescription>
              Update the configuration. Changes will take effect on the next Terraform run.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { void handleUpdate(e); }}>
            {editConfig && renderFields(editConfig.provider, editForm, setEditForm, 'edit')}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditConfig(null); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfig} onOpenChange={(open) => { if (!open) setDeleteConfig(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteConfig ? PROVIDERS[deleteConfig.provider].label : 'OIDC'} Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this configuration? Terraform runs will no longer be able to
              authenticate to the cloud provider using workload identity. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfig(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
