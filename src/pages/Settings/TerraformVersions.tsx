// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Loader2, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  adminTerraformVersionsApi,
  organizationsApi,
  type TerraformVersionResource,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function TerraformVersions() {
  const { orgName } = useParams<{ orgName: string }>();
  const [versions, setVersions] = useState<TerraformVersionResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newURL, setNewURL] = useState('');
  const [adding, setAdding] = useState(false);
  const [orgDefaultVersion, setOrgDefaultVersion] = useState('');
  const [savingDefault, setSavingDefault] = useState(false);
  const [allEnabledVersions, setAllEnabledVersions] = useState<TerraformVersionResource[]>([]);

  // Semver sort: properly compares version strings like 1.13.0 > 1.9.8 > 1.5.0
  const semverCompare = useCallback((a: string, b: string): number => {
    const pa = a.replace(/^v/, '').split(/[-.]/).map(p => (/^\d+$/.test(p) ? parseInt(p, 10) : p));
    const pb = b.replace(/^v/, '').split(/[-.]/).map(p => (/^\d+$/.test(p) ? parseInt(p, 10) : p));
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const va = pa[i] ?? (typeof pb[i] === 'string' ? '' : -1);
      const vb = pb[i] ?? (typeof pa[i] === 'string' ? '' : -1);
      if (typeof va === 'number' && typeof vb === 'number') {
        if (va !== vb) return vb - va; // descending
      } else {
        const cmp = String(vb).localeCompare(String(va));
        if (cmp !== 0) return cmp;
      }
    }
    return 0;
  }, []);

  // Fetch paginated versions for the table
  const fetchVersions = useCallback(() => {
    setLoading(true);
    void adminTerraformVersionsApi.list({
      page: currentPage,
      pageSize: 20,
      search: searchQuery || undefined,
    })
      .then((res) => {
        const sorted = [...(res.data || [])].sort((a, b) => semverCompare(a.attributes.version, b.attributes.version));
        setVersions(sorted);
        if (res.meta?.pagination) {
          setTotalPages(res.meta.pagination['total-pages'] || 1);
          setTotalCount(res.meta.pagination['total-count'] || 0);
        }
      })
      .catch((err) => {
        console.error('Failed to load terraform versions:', err);
        toast.error('Failed to load terraform versions');
      })
      .finally(() => { setLoading(false); });
  }, [currentPage, searchQuery, semverCompare]);

  // Fetch ALL enabled versions for the org default dropdown (not just current page)
  const fetchAllEnabledVersions = useCallback(() => {
    void adminTerraformVersionsApi.list({ pageSize: 100 })
      .then((res) => {
        const enabled = (res.data || [])
          .filter(v => v.attributes.enabled && !v.attributes.deprecated)
          .sort((a, b) => semverCompare(a.attributes.version, b.attributes.version));
        setAllEnabledVersions(enabled);
      })
      .catch(() => { /* ignore */ });
  }, [semverCompare]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  useEffect(() => {
    fetchAllEnabledVersions();
  }, [fetchAllEnabledVersions]);

  // Load org default terraform version
  useEffect(() => {
    if (!orgName) return;
    void organizationsApi.get(orgName)
      .then((res) => {
        const org = res as unknown as { data?: { attributes?: Record<string, unknown> } };
        const defaultVersion = org.data?.attributes?.['default-terraform-version'];
        if (typeof defaultVersion === 'string') {
          setOrgDefaultVersion(defaultVersion);
        }
      })
      .catch(() => { /* ignore */ });
  }, [orgName]);

  const refreshAll = () => {
    fetchVersions();
    fetchAllEnabledVersions();
  };

  const handleToggleEnabled = async (version: TerraformVersionResource) => {
    try {
      await adminTerraformVersionsApi.update(version.id, { enabled: !version.attributes.enabled });
      toast.success(`Terraform ${version.attributes.version} ${version.attributes.enabled ? 'disabled' : 'enabled'}`);
      refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update version');
    }
  };

  const handleDelete = async (version: TerraformVersionResource) => {
    try {
      await adminTerraformVersionsApi.delete(version.id);
      toast.success(`Terraform ${version.attributes.version} deleted`);
      refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cannot delete this version');
    }
  };

  const handleAdd = async () => {
    if (!newVersion.trim()) return;
    setAdding(true);
    try {
      const url = newURL.trim() || undefined;
      await adminTerraformVersionsApi.create({ version: newVersion.trim(), url, enabled: true });
      toast.success(`Terraform ${newVersion} added`);
      setAddDialogOpen(false);
      setNewVersion('');
      setNewURL('');
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add version';
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleSetOrgDefault = async (version: string) => {
    if (!orgName) return;
    setSavingDefault(true);
    try {
      await organizationsApi.update(orgName, {
        data: {
          type: 'organizations',
          attributes: { 'default-terraform-version': version },
        },
      });
      setOrgDefaultVersion(version);
      toast.success(version ? `Organization default set to Terraform ${version}` : 'Organization default version cleared');
    } catch {
      toast.error('Failed to update organization default');
    } finally {
      setSavingDefault(false);
    }
  };

  // Use allEnabledVersions for the dropdown (all versions, not just current page)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={`/app/${orgName || ''}/settings`}>
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
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 bg-clip-text text-transparent mb-2">
              Terraform Versions
            </h1>
            <p className="text-muted-foreground">
              Manage the available Terraform versions for workspaces in this organization.
            </p>
          </div>
          <div className="relative inline-flex rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 p-[2px]">
            <Button
              variant="ghost"
              onClick={() => { setAddDialogOpen(true); }}
              className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Terraform Version
            </Button>
          </div>
        </div>
      </div>

      {/* Org default version selector */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Organization Default Version</h3>
            <p className="text-sm text-muted-foreground">
              Used when a workspace does not specify a Terraform version.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={orgDefaultVersion || 'none'}
              onValueChange={(val) => { void handleSetOrgDefault(val === 'none' ? '' : val); }}
              disabled={savingDefault}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select version..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Not set</span>
                </SelectItem>
                {allEnabledVersions.map((v) => (
                  <SelectItem key={v.id} value={v.attributes.version}>
                    {v.attributes.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingDefault && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search versions..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="pl-10"
        />
      </div>

      {/* Versions table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Tag className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No Terraform versions</h3>
          <p className="text-sm text-muted-foreground">Add a version to get started.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Usage</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{v.attributes.version}</span>
                        {v.attributes.beta && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            Beta
                          </span>
                        )}
                        {v.attributes.official && (
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                            Official
                          </span>
                        )}
                        {v.attributes.version === orgDefaultVersion && (
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                            Org Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={v.attributes.enabled}
                          onCheckedChange={() => { void handleToggleEnabled(v); }}
                          aria-label={v.attributes.enabled ? 'Disable version' : 'Enable version'}
                          className="data-[state=checked]:bg-green-500"
                        />
                        {v.attributes.deprecated && (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                            Deprecated
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      in {v.attributes.usage} workspace{v.attributes.usage !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!v.attributes.official && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { void handleDelete(v); }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{totalCount} version{totalCount !== 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => { setCurrentPage(p => p - 1); }}
                >
                  Previous
                </Button>
                <span className="flex items-center px-2">Page {currentPage} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => { setCurrentPage(p => p + 1); }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Version Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Terraform Version</DialogTitle>
            <DialogDescription>
              Add a new Terraform version to make it available for workspaces.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Version</label>
              <Input
                placeholder="e.g. 1.14.0"
                value={newVersion}
                onChange={(e) => { setNewVersion(e.target.value); }}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Download URL (optional)</label>
              <Input
                placeholder="Auto-generated from releases.hashicorp.com"
                value={newURL}
                onChange={(e) => { setNewURL(e.target.value); }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave empty to use the official HashiCorp release URL.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); }} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={() => { void handleAdd(); }} disabled={adding || !newVersion.trim()}>
              {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
