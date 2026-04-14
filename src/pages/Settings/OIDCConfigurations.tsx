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
  type AzureOIDCConfiguration,
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

export default function OIDCConfigurations() {
  const { orgName } = useParams<{ orgName: string }>();
  const { data: configs = [], isLoading: loading, refetch: refetchConfigs } = useQuery({
    queryKey: ['oidc-configs', orgName],
    queryFn: async () => {
      const res = await azureOIDCConfigApi.list(orgName!);
      return res.data || [];
    },
    enabled: !!orgName,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<AzureOIDCConfiguration | null>(null);
  const [deleteConfig, setDeleteConfig] = useState<AzureOIDCConfiguration | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (value: string, key: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedField(key);
      setTimeout(() => { setCopiedField(null); }, 2000);
    });
  };

  const [createForm, setCreateForm] = useState({
    client_id: '',
    subscription_id: '',
    tenant_id: '',
  });
  const [editForm, setEditForm] = useState({
    client_id: '',
    subscription_id: '',
    tenant_id: '',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName) return;
    if (!createForm.client_id.trim() || !createForm.subscription_id.trim() || !createForm.tenant_id.trim()) {
      toast.error('All fields are required');
      return;
    }
    setCreating(true);
    try {
      await azureOIDCConfigApi.create(orgName, {
        client_id: createForm.client_id.trim(),
        subscription_id: createForm.subscription_id.trim(),
        tenant_id: createForm.tenant_id.trim(),
      });
      toast.success('Azure OIDC configuration created');
      setCreateOpen(false);
      setCreateForm({ client_id: '', subscription_id: '', tenant_id: '' });
      void refetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create OIDC configuration');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (config: AzureOIDCConfiguration) => {
    setEditConfig(config);
    setEditForm({
      client_id: config.client_id,
      subscription_id: config.subscription_id,
      tenant_id: config.tenant_id,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editConfig) return;
    if (!editForm.client_id.trim() || !editForm.subscription_id.trim() || !editForm.tenant_id.trim()) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      await azureOIDCConfigApi.update(editConfig.id, {
        client_id: editForm.client_id.trim(),
        subscription_id: editForm.subscription_id.trim(),
        tenant_id: editForm.tenant_id.trim(),
      });
      toast.success('Azure OIDC configuration updated');
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
      await azureOIDCConfigApi.delete(deleteConfig.id);
      toast.success('Azure OIDC configuration deleted');
      setDeleteConfig(null);
      void refetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete OIDC configuration');
    } finally {
      setDeleting(false);
    }
  };

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
              onClick={() => { setCreateOpen(true); }}
              className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Azure OIDC
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
            Create an Azure OIDC configuration to enable keyless authentication from Terraform runs to Azure.
            This eliminates the need to store Azure credentials as variables.
          </p>
          <Button onClick={() => { setCreateOpen(true); }} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Azure OIDC Configuration
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-500">
                      <Shield className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Azure OIDC</h3>
                      <p className="text-xs text-muted-foreground font-mono">{config.id}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    {([
                      { label: 'Client ID', value: config.client_id, key: `${config.id}-client` },
                      { label: 'Subscription ID', value: config.subscription_id, key: `${config.id}-sub` },
                      { label: 'Tenant ID', value: config.tenant_id, key: `${config.id}-tenant` },
                    ] as { label: string; value: string; key: string }[]).map(({ label, value, key }) => (
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
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setDeleteConfig(config); }}
                    className="h-8 w-8 text-destructive hover:text-destructive"
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
            <DialogTitle>Add Azure OIDC Configuration</DialogTitle>
            <DialogDescription>
              Configure keyless authentication from Terraform runs to Azure using OIDC workload identity.
              You&apos;ll need to set up a federated credential in Azure Entra ID that trusts tokens from this platform.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { void handleCreate(e); }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-client-id">Client ID</Label>
                <Input
                  id="create-client-id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={createForm.client_id}
                  onChange={(e) => { setCreateForm((prev) => ({ ...prev, client_id: e.target.value })); }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The Application (client) ID of the Azure Entra ID app registration
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-subscription-id">Subscription ID</Label>
                <Input
                  id="create-subscription-id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={createForm.subscription_id}
                  onChange={(e) => { setCreateForm((prev) => ({ ...prev, subscription_id: e.target.value })); }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The Azure subscription ID for resource access
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-tenant-id">Tenant ID</Label>
                <Input
                  id="create-tenant-id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={createForm.tenant_id}
                  onChange={(e) => { setCreateForm((prev) => ({ ...prev, tenant_id: e.target.value })); }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The Directory (tenant) ID of the Azure Entra ID tenant
                </p>
              </div>
            </div>
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
            <DialogTitle>Edit Azure OIDC Configuration</DialogTitle>
            <DialogDescription>
              Update the Azure OIDC configuration. Changes will take effect on the next Terraform run.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { void handleUpdate(e); }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-client-id">Client ID</Label>
                <Input
                  id="edit-client-id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={editForm.client_id}
                  onChange={(e) => { setEditForm((prev) => ({ ...prev, client_id: e.target.value })); }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subscription-id">Subscription ID</Label>
                <Input
                  id="edit-subscription-id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={editForm.subscription_id}
                  onChange={(e) => { setEditForm((prev) => ({ ...prev, subscription_id: e.target.value })); }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tenant-id">Tenant ID</Label>
                <Input
                  id="edit-tenant-id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={editForm.tenant_id}
                  onChange={(e) => { setEditForm((prev) => ({ ...prev, tenant_id: e.target.value })); }}
                  required
                />
              </div>
            </div>
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
            <DialogTitle>Delete Azure OIDC Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this Azure OIDC configuration? Terraform runs will no longer be able to
              authenticate to Azure using workload identity. This action cannot be undone.
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
