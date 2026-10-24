// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Loader2, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Page, PageDialogContent } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { Input } from '@/components/ui/input';
import { adminTerraformVersionsApi, type TerraformVersionResource } from '@/api/client';
import { PlatformNotFound } from '@/components/platform/PlatformNotFound';
import { isNotFound, retryUnlessNotFound } from '@/components/platform/notFound';
import { toast } from 'sonner';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { dangerGhostIcon } from '@/lib/surfaces';
import { compareVersionsDesc } from '@/lib/semver';

// The install-wide OpenTofu versions, a platform settings page. An organization's default
// version is an organization setting and lives on Settings -> Organization.
export default function TofuVersions() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newURL, setNewURL] = useState('');
  const [adding, setAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  // The version the confirmation dialog is about. Nothing is deleted until it is confirmed.
  // It stays set after the dialog closes, so the wording does not change while it fades out.
  const [pendingDelete, setPendingDelete] = useState<TerraformVersionResource | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Fetch paginated versions for the table
  const { data: versionsData, isLoading: loading, isError: loadFailed, error: loadError, refetch: refetchVersions } = useQuery({
    queryKey: ['tofuVersions', currentPage, searchQuery],
    queryFn: async () => {
      const res = await adminTerraformVersionsApi.list({
        page: currentPage,
        pageSize: 20,
        search: searchQuery || undefined,
      });
      const sorted = [...(res.data || [])].sort((a, b) => compareVersionsDesc(a.attributes.version, b.attributes.version));
      return {
        versions: sorted,
        totalPages: res.meta?.pagination?.['total-pages'] || 1,
        totalCount: res.meta?.pagination?.['total-count'] || 0,
      };
    },
    retry: retryUnlessNotFound,
  });

  const versions = versionsData?.versions ?? [];
  const totalPages = versionsData?.totalPages ?? 1;
  const totalCount = versionsData?.totalCount ?? 0;

  const refreshAll = () => {
    void refetchVersions();
  };

  const handleToggleEnabled = async (version: TerraformVersionResource) => {
    try {
      await adminTerraformVersionsApi.update(version.id, { enabled: !version.attributes.enabled });
      toast.success(`OpenTofu ${version.attributes.version} ${version.attributes.enabled ? 'disabled' : 'enabled'}`);
      refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update version');
    }
  };

  const handleDelete = async (version: TerraformVersionResource) => {
    try {
      await adminTerraformVersionsApi.delete(version.id);
      toast.success(`OpenTofu ${version.attributes.version} deleted`);
      refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cannot delete this version');
    }
  };

  const confirmDelete = async () => {
    setConfirmingDelete(false);
    if (!pendingDelete) return;
    await handleDelete(pendingDelete);
  };

  const handleAdd = async () => {
    if (!newVersion.trim()) return;
    setAdding(true);
    try {
      const url = newURL.trim() || undefined;
      await adminTerraformVersionsApi.create({ version: newVersion.trim(), url, enabled: true });
      toast.success(`OpenTofu ${newVersion} added`);
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

  // Defined once and handed to both the header and the empty-state card: the header does not
  // render it while there is nothing to list, so the action never appears twice.
  const addVersionAction = (
    <GradientButton ramp="app" onClick={() => { setAddDialogOpen(true); }} className="w-auto px-4 py-2">
      <Plus className="h-4 w-4 mr-2" />
      Add OpenTofu Version
    </GradientButton>
  );
  // The query key carries the search and the page, so `loading` is true again on every new
  // search or page. Only the first, unfiltered load counts as loading for the header, and a
  // list that is empty because of a search is not an empty list.
  const filtered = searchQuery !== '';
  const listState =
    loading && !filtered && currentPage === 1
      ? 'loading'
      : loadFailed
        ? 'error'
        : !loading && !filtered && versions.length === 0
          ? 'empty'
          : 'ready';

  // The admin route answers 404 to anyone who is not a platform administrator: show the
  // not-found state and nothing of the page.
  if (isNotFound(loadError)) {
    return (
      <Page ramp="tofuVersions" className="space-y-8">
        <PageHeader icon={Tag} title="OpenTofu Versions" backTo={{ to: '/settings', label: 'Back to Settings' }} />
        <PlatformNotFound />
      </Page>
    );
  }

  return (
    <Page ramp="tofuVersions" className="space-y-8">
      <PageHeader
        icon={Tag}
        title="OpenTofu Versions"
        subtitle="Manage the OpenTofu versions available to every workspace on this installation."
        backTo={{ to: '/settings', label: 'Back to Settings' }}
        action={addVersionAction}
        listState={listState}
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search versions..."
          aria-label="Search versions"
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
        filtered ? (
          <PageEmptyState
            icon={Tag}
            title="No OpenTofu versions"
            description="No versions match your search."
            filtered
            onClearFilters={() => { setSearchQuery(''); setCurrentPage(1); }}
          />
        ) : (
          <PageEmptyState
            icon={Tag}
            title="No OpenTofu versions"
            description="Add a version to get started."
            action={loadFailed ? undefined : addVersionAction}
          />
        )
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Version</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Usage</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
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
                            size="icon"
                            aria-label={`Delete OpenTofu ${v.attributes.version}`}
                            onClick={() => {
                              setPendingDelete(v);
                              setConfirmingDelete(true);
                            }}
                            className={cn(dangerGhostIcon, 'h-8 w-8')}
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
        <PageDialogContent>
          <DialogHeader>
            <DialogTitle>Add OpenTofu Version</DialogTitle>
            <DialogDescription>
              Add a new OpenTofu version to make it available for workspaces.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="tf-new-version" className="text-sm font-medium">Version</label>
              <Input
                id="tf-new-version"
                placeholder="e.g. 1.14.0"
                value={newVersion}
                onChange={(e) => { setNewVersion(e.target.value); }}
              />
            </div>
            <div>
              <label htmlFor="tf-new-url" className="text-sm font-medium">Download URL (optional)</label>
              <Input
                id="tf-new-url"
                placeholder="Auto-generated from the OpenTofu release source"
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
            <GradientButton
              ramp="app"
              className="w-auto px-4 py-2"
              onClick={() => { void handleAdd(); }}
              disabled={adding || !newVersion.trim()}
            >
              {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Version
            </GradientButton>
          </DialogFooter>
        </PageDialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete OpenTofu ${pendingDelete?.attributes.version ?? ''}?`}
        description={`OpenTofu ${pendingDelete?.attributes.version ?? ''} will no longer be available to workspaces. You can add it again later.`}
        confirmLabel="Delete version"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
