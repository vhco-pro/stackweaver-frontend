// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Link, useNavigate } from 'react-router-dom';
import { organizationsApi, type Organization } from '@/api/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/animate-ui/components/buttons/copy';
import { toast } from 'sonner';
import { Loader2, Building2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [organizationToDelete, setOrganizationToDelete] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [formData, setFormData] = useState({ name: '', description: '' });
  const navigate = useNavigate();
  const { refreshOrganizations, switchOrganization } = useOrganization();

  const fetchOrganizations = () => {
    void organizationsApi.list()
      .then((res) => {
        setOrganizations(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load organizations:', err);
        setLoading(false);
        setOrganizations([]);
      });
  };

  useMountEffect(() => {
    fetchOrganizations();
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Organization name is required');
      return;
    }

    setCreating(true);
    
    try {
      const newOrg = await organizationsApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });

      // Backend creates default project with owners team access automatically

      // Refresh organization context so the new org appears in the selector
      await refreshOrganizations();

      // Refresh local state
      fetchOrganizations();

      toast.success('Organization and default project created successfully');
      
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '' });
      
      // Switch to the new organization and navigate to workspaces
      // This will set the current org in context and navigate
      switchOrganization(newOrg.name);
    } catch (err: unknown) {
      let errorMessage = 'Failed to create organization';
      if (err && typeof err === 'object') {
        const error = err as { message?: string; error?: string };
        errorMessage = error.message || error.error || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, org: Organization) => {
    e.preventDefault();
    e.stopPropagation();
    setOrganizationToDelete(org);
    setConfirmName('');
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!organizationToDelete) return;

    // Verify the name matches
    if (confirmName !== organizationToDelete.name) {
      toast.error('Organization name does not match');
      return;
    }

    setDeleting(true);
    try {
      await organizationsApi.delete(organizationToDelete.name);
      toast.success('Organization deleted successfully');
      setDeleteDialogOpen(false);
      setOrganizationToDelete(null);
      setConfirmName('');
      await refreshOrganizations();
      fetchOrganizations();
      // If we deleted the current org, redirect to organizations page
      void Promise.resolve(navigate('/organizations'));
    } catch (err: unknown) {
      let errorMessage = 'Failed to delete organization';
      if (err && typeof err === 'object') {
        const error = err as { message?: string; error?: string };
        errorMessage = error.message || error.error || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Organizations
        </h1>
        <p className="text-muted-foreground">
          Manage and organize your infrastructure organizations
        </p>
      </div>

      {/* Organizations Grid */}
      {organizations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-6">
          {organizations.map((org) => (
            <Link
              key={org.id}
              to={`/app/${org.name}/workspaces`}
              className={cn(
                'group relative overflow-hidden rounded-2xl',
                'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
                'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
                'p-6 shadow-lg shadow-blue-500/10',
                'transition-all duration-300',
                'hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02]',
                'hover:border-blue-500/30'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 group-hover:from-blue-500/30 group-hover:to-indigo-500/30 transition-all duration-300 shrink-0">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-200 truncate">
                      {org.name}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
                      "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                      "hover:border-destructive/20"
                    )}
                    onClick={(e) => handleDeleteClick(e, org)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {org.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {org.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>View Details</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center space-y-6 p-12 rounded-2xl bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent backdrop-blur-md border border-gray-300/80 dark:border-white/10 shadow-xl shadow-blue-500/10 max-w-2xl">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30">
                <Building2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-semibold mb-2">No Organizations Found</h3>
              <p className="text-muted-foreground text-lg mb-6">
                Get started by creating your first organization.
              </p>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={(e) => { void handleCreate(e); }}>
                    <DialogHeader>
                      <DialogTitle>Create Organization</DialogTitle>
                      <DialogDescription>
                        Create a new organization to group your projects and manage access.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="My Organization"
                          required
                          maxLength={200}
                          disabled={creating}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Optional description"
                          maxLength={500}
                          disabled={creating}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                        disabled={creating}
                      >
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
            </div>
          </div>
        </div>
      )}

      {/* Create Organization Dialog - Floating Button */}
      {organizations.length > 0 && (
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="fixed bottom-8 right-8 h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-110 z-50"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(e) => { void handleCreate(e); }}>
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
                <DialogDescription>
                  Create a new organization to group your projects and manage access.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Organization"
                    required
                    maxLength={200}
                    disabled={creating}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    maxLength={500}
                    disabled={creating}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={creating}
                >
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
      )}

      {/* Delete Organization Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete the organization &quot;{organizationToDelete?.name}&quot;
                and all associated resources including:
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>All projects and workspaces</li>
                  <li>All runs, state versions, and configuration versions</li>
                  <li>All VCS connections</li>
                  <li>All variable sets</li>
                  <li>All registry modules and providers</li>
                  <li>All Ansible resources (workflows, inventories, credentials, schedules)</li>
                  <li>All GPG keys and API keys</li>
                </ul>
                <p className="mt-4 font-semibold">To confirm, please type the organization name below:</p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-300/70 bg-slate-100/80 py-1 pl-3 pr-1 dark:border-white/10 dark:bg-white/5">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {organizationToDelete?.name}
                  </code>
                  <CopyButton
                    content={organizationToDelete?.name ?? ''}
                    variant="ghost"
                    size="xs"
                    aria-label="Copy organization name"
                    onCopiedChange={(isCopied) => {
                      if (isCopied) toast.success('Organization name copied');
                    }}
                  />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="confirm-name">Organization Name</Label>
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={organizationToDelete?.name}
                disabled={deleting}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setOrganizationToDelete(null);
                setConfirmName('');
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDelete(); }}
              disabled={deleting || confirmName !== organizationToDelete?.name}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
