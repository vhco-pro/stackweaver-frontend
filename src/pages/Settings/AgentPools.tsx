// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Cpu, ArrowLeft, Plus, Trash2, Loader2, Settings2, ChevronDown, ChevronUp, Server, Circle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  agentPoolsApi,
  workspacesApi,
  projectsApi,
  runnersApi,
  type AgentPool,
  type Runner,
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AgentPools() {
  const { orgName } = useParams<{ orgName: string }>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPool, setEditPool] = useState<AgentPool | null>(null);
  const [deletePool, setDeletePool] = useState<AgentPool | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Runners per pool (keyed by pool ID)
  const [poolRunners, setPoolRunners] = useState<Record<string, Runner[]>>({});
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());
  const [loadingRunners, setLoadingRunners] = useState<Set<string>>(new Set());
  const [copiedPoolId, setCopiedPoolId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ name: '', organization_scoped: true });
  const [editForm, setEditForm] = useState<{
    name: string;
    organization_scoped: boolean;
    allowed_workspace_ids: string[];
    allowed_project_ids: string[];
    excluded_workspace_ids: string[];
  }>({ name: '', organization_scoped: true, allowed_workspace_ids: [], allowed_project_ids: [], excluded_workspace_ids: [] });

  const { data: pools = [], isLoading: loading, refetch: refetchPools } = useQuery({
    queryKey: ['agentPools', orgName],
    queryFn: async () => {
      const res = await agentPoolsApi.list(orgName!);
      return res.data || [];
    },
    enabled: !!orgName,
    refetchOnWindowFocus: true,
  });

  const { data: scopeData } = useQuery({
    queryKey: ['agentPoolsScope', orgName],
    queryFn: async () => {
      const [projectsRes, workspacesRes] = await Promise.all([
        projectsApi.list(orgName!),
        workspacesApi.list(orgName!),
      ]);
      return {
        projects: projectsRes?.data || [],
        workspaces: workspacesRes?.data || [],
      };
    },
    enabled: !!orgName,
  });

  const projects = scopeData?.projects ?? [];
  const workspaces = scopeData?.workspaces ?? [];

  // Fetch runners for a specific pool
  const fetchPoolRunners = useCallback(async (poolId: string) => {
    if (!orgName) return;
    setLoadingRunners(prev => new Set(prev).add(poolId));
    try {
      const res = await runnersApi.list(orgName, { agentPoolId: poolId });
      setPoolRunners(prev => ({ ...prev, [poolId]: res.data }));
    } catch (err) {
      console.error('Failed to load runners for pool:', err);
    } finally {
      setLoadingRunners(prev => {
        const next = new Set(prev);
        next.delete(poolId);
        return next;
      });
    }
  }, [orgName]);

  const copyPoolId = (poolId: string) => {
    void navigator.clipboard.writeText(poolId);
    setCopiedPoolId(poolId);
    toast.success('Pool ID copied to clipboard');
    setTimeout(() => setCopiedPoolId(null), 2000);
  };

  // Toggle pool expansion and fetch runners if needed
  const togglePoolExpansion = (poolId: string) => {
    setExpandedPools(prev => {
      const next = new Set(prev);
      if (next.has(poolId)) {
        next.delete(poolId);
      } else {
        next.add(poolId);
        // Fetch runners if not already loaded
        if (!poolRunners[poolId]) {
          void fetchPoolRunners(poolId);
        }
      }
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !createForm.name.trim()) {
      toast.error('Pool name is required');
      return;
    }
    setCreating(true);
    try {
      await agentPoolsApi.create(orgName, {
        name: createForm.name.trim(),
        organization_scoped: createForm.organization_scoped,
      });
      toast.success('Agent pool created');
      setCreateOpen(false);
      setCreateForm({ name: '', organization_scoped: true });
      void refetchPools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create pool');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (pool: AgentPool) => {
    setEditPool(pool);
    setEditForm({
      name: pool.name,
      organization_scoped: pool.organization_scoped,
      allowed_workspace_ids: pool.allowed_workspace_ids || [],
      allowed_project_ids: pool.allowed_project_ids || [],
      excluded_workspace_ids: pool.excluded_workspace_ids || [],
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPool) return;
    if (!editForm.name.trim()) {
      toast.error('Pool name is required');
      return;
    }
    setSaving(true);
    try {
      await agentPoolsApi.update(editPool.id, {
        name: editForm.name.trim(),
        organization_scoped: editForm.organization_scoped,
        allowed_workspace_ids: editForm.allowed_workspace_ids,
        allowed_project_ids: editForm.allowed_project_ids,
        excluded_workspace_ids: editForm.excluded_workspace_ids,
      });
      toast.success('Agent pool updated');
      setEditPool(null);
      void refetchPools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update pool');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePool) return;
    setDeleting(true);
    try {
      await agentPoolsApi.delete(deletePool.id);
      toast.success('Agent pool deleted');
      setDeletePool(null);
      void refetchPools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete pool');
    } finally {
      setDeleting(false);
    }
  };

  const toggleAllowedWorkspace = (id: string) => {
    setEditForm((prev) => {
      const isRemoving = prev.allowed_workspace_ids.includes(id);
      const newAllowed = isRemoving
        ? prev.allowed_workspace_ids.filter((x) => x !== id)
        : [...prev.allowed_workspace_ids, id];
      // Auto-disable org-scoped when adding allowed workspaces (user is restricting access)
      const shouldDisableOrgScoped = !isRemoving && prev.organization_scoped;
      return {
        ...prev,
        allowed_workspace_ids: newAllowed,
        // Also remove from excluded if adding to allowed (can't be in both)
        excluded_workspace_ids: isRemoving ? prev.excluded_workspace_ids : prev.excluded_workspace_ids.filter((x) => x !== id),
        organization_scoped: shouldDisableOrgScoped ? false : prev.organization_scoped,
      };
    });
  };
  const toggleAllowedProject = (id: string) => {
    setEditForm((prev) => {
      const isRemoving = prev.allowed_project_ids.includes(id);
      const newAllowed = isRemoving
        ? prev.allowed_project_ids.filter((x) => x !== id)
        : [...prev.allowed_project_ids, id];
      // Auto-disable org-scoped when adding allowed projects (user is restricting access)
      const shouldDisableOrgScoped = !isRemoving && prev.organization_scoped;
      return {
        ...prev,
        allowed_project_ids: newAllowed,
        organization_scoped: shouldDisableOrgScoped ? false : prev.organization_scoped,
      };
    });
  };
  const toggleExcludedWorkspace = (id: string) => {
    setEditForm((prev) => {
      const isRemoving = prev.excluded_workspace_ids.includes(id);
      return {
        ...prev,
        excluded_workspace_ids: isRemoving
          ? prev.excluded_workspace_ids.filter((x) => x !== id)
          : [...prev.excluded_workspace_ids, id],
        // Also remove from allowed if adding to excluded (can't be in both)
        allowed_workspace_ids: isRemoving ? prev.allowed_workspace_ids : prev.allowed_workspace_ids.filter((x) => x !== id),
      };
    });
  };

  // Filter workspaces for allowed selector: hide those already in allowed or excluded lists
  const availableForAllowed = workspaces.filter(
    (w) => !editForm.allowed_workspace_ids.includes(w.id) && !editForm.excluded_workspace_ids.includes(w.id)
  );
  // Filter workspaces for excluded selector: hide those already in excluded or allowed lists
  const availableForExcluded = workspaces.filter(
    (w) => !editForm.excluded_workspace_ids.includes(w.id) && !editForm.allowed_workspace_ids.includes(w.id)
  );
  // Filter projects for allowed selector: hide those already selected
  const availableProjects = projects.filter((p) => !editForm.allowed_project_ids.includes(p.id));

  const formatDate = (s: string) => (s ? new Date(s).toLocaleDateString() : '—');

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'a few seconds ago';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) !== 1 ? 's' : ''} ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Link to={orgName ? `/app/${orgName}/settings` : '/settings'}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">
                Agent Pools
              </h1>
              <p className="text-muted-foreground">
                Manage agent pools for self-hosted runners (TFE-compatible)
              </p>
            </div>
            <div className="relative inline-flex rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500 p-[2px]">
              <Button
                variant="ghost"
                onClick={() => setCreateOpen(true)}
                className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add pool
              </Button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {pools.length === 0 ? (
            <div
              className={cn(
                'rounded-2xl border border-dashed border-white/20 dark:border-white/10',
                'p-8 text-center text-muted-foreground'
              )}
            >
              <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No agent pools yet. Create one to scope self-hosted runners.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add pool
              </Button>
            </div>
          ) : (
            pools.map((pool) => {
              const isExpanded = expandedPools.has(pool.id);
              const runners = poolRunners[pool.id] || [];
              const isLoadingRunners = loadingRunners.has(pool.id);

              return (
                <div
                  key={pool.id}
                  className={cn(
                    'rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                    'dark:from-black/10 dark:via-black/5',
                    'backdrop-blur-md border border-white/20 dark:border-white/10',
                    'shadow-lg overflow-hidden'
                  )}
                >
                  {/* Pool Header */}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <button
                          onClick={() => togglePoolExpansion(pool.id)}
                          className="flex items-center gap-2 hover:text-primary transition-colors text-left"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                          <h3 className="text-lg font-semibold underline underline-offset-2">{pool.name}</h3>
                        </button>
                        <div className="flex items-center gap-1.5 mt-1 ml-7">
                          <span className="text-xs text-muted-foreground font-mono select-all cursor-text" title="Agent Pool ID">
                            ID: {pool.id}
                          </span>
                          <button
                            onClick={() => { copyPoolId(pool.id); }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy Pool ID"
                          >
                            {copiedPoolId === pool.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 ml-7">
                          <Badge
                            variant="outline"
                            className={pool.organization_scoped
                              ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
                              : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                            }
                          >
                            {pool.organization_scoped ? 'Organization-scoped' : 'Restricted'}
                          </Badge>
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                            {pool.agent_count} agent{pool.agent_count !== 1 ? 's' : ''}
                          </Badge>
                          {pool.allowed_workspace_ids.length > 0 && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              {pool.allowed_workspace_ids.length} allowed
                            </Badge>
                          )}
                          {pool.excluded_workspace_ids.length > 0 && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                              {pool.excluded_workspace_ids.length} excluded
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 ml-7">Created {formatDate(pool.created_at)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(pool)}>
                          <Settings2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletePool(pool)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Runners Table (expandable) */}
                  {isExpanded && (
                    <div className="border-t border-white/10 dark:border-white/5">
                      {isLoadingRunners ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : runners.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Server className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-muted-foreground">No agents in this pool</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10 dark:border-white/5 bg-muted/30">
                                <th scope="col" className="text-left py-3 px-4 font-medium text-muted-foreground">Agent Name</th>
                                <th scope="col" className="text-left py-3 px-4 font-medium text-muted-foreground">Version</th>
                                <th scope="col" className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                                <th scope="col" className="text-left py-3 px-4 font-medium text-muted-foreground">IP Address</th>
                                <th scope="col" className="text-left py-3 px-4 font-medium text-muted-foreground">Last Seen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {runners.map((runner) => (
                                <tr key={runner.id} className="border-b border-white/5 dark:border-white/5 last:border-0 hover:bg-muted/20">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <Circle
                                        className={cn(
                                          'h-2.5 w-2.5 fill-current',
                                          runner.status === 'online' && 'text-green-500',
                                          runner.status === 'busy' && 'text-yellow-500',
                                          runner.status === 'offline' && 'text-gray-400',
                                          runner.status === 'error' && 'text-red-500'
                                        )}
                                      />
                                      <div>
                                        <Link
                                          to={`/app/${orgName}/settings/runners/${runner.id}`}
                                          className="font-medium hover:underline"
                                        >
                                          {runner.name}
                                        </Link>
                                        <p className="text-xs text-muted-foreground capitalize">{runner.status}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-muted-foreground">
                                    {runner.terraform_version || runner.ansible_version || runner.agent_version || '-'}
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                                    {runner.id.slice(0, 8)}...
                                  </td>
                                  <td className="py-3 px-4 text-muted-foreground">
                                    {runner.ip_address || '-'}
                                  </td>
                                  <td className="py-3 px-4 text-muted-foreground">
                                    {runner.last_heartbeat_at
                                      ? formatTimeAgo(runner.last_heartbeat_at)
                                      : 'Never'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create agent pool</DialogTitle>
            <DialogDescription>Pools group runners and scope which workspaces can use them.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. prod-pool"
                disabled={creating}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="create-org-scoped"
                checked={createForm.organization_scoped}
                onCheckedChange={(v) => setCreateForm((p) => ({ ...p, organization_scoped: v }))}
              />
              <Label htmlFor="create-org-scoped">Organization-scoped (available to all workspaces unless excluded)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !createForm.name.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editPool} onOpenChange={(open) => { if (!open) setEditPool(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit agent pool</DialogTitle>
            <DialogDescription>Update name, scoping, and allowed/excluded workspaces and projects.</DialogDescription>
          </DialogHeader>
          {editPool && (
            <form onSubmit={(e) => { void handleUpdate(e); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-org-scoped"
                  checked={editForm.organization_scoped}
                  onCheckedChange={(v) => setEditForm((p) => ({ ...p, organization_scoped: v }))}
                />
                <Label htmlFor="edit-org-scoped">Organization-scoped</Label>
              </div>
              <div className="space-y-2">
                <Label>Allowed workspaces {editForm.organization_scoped && <span className="text-xs text-muted-foreground">(selecting disables org-scoped)</span>}</Label>
                <Select value="" onValueChange={(v) => v && toggleAllowedWorkspace(v)} disabled={availableForAllowed.length === 0}>
                  <SelectTrigger><SelectValue placeholder={availableForAllowed.length === 0 ? 'No workspaces available' : 'Add workspace…'} /></SelectTrigger>
                  <SelectContent>
                    {availableForAllowed.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-1">
                  {editForm.allowed_workspace_ids.map((id) => {
                    const w = workspaces.find((x) => x.id === id);
                    return (
                      <Badge
                        key={id}
                        variant="outline"
                        className="cursor-pointer bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        onClick={() => toggleAllowedWorkspace(id)}
                      >
                        {w?.name ?? id} ×
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allowed projects {editForm.organization_scoped && <span className="text-xs text-muted-foreground">(selecting disables org-scoped)</span>}</Label>
                <Select value="" onValueChange={(v) => v && toggleAllowedProject(v)} disabled={availableProjects.length === 0}>
                  <SelectTrigger><SelectValue placeholder={availableProjects.length === 0 ? 'No projects available' : 'Add project…'} /></SelectTrigger>
                  <SelectContent>
                    {availableProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-1">
                  {editForm.allowed_project_ids.map((id) => {
                    const p = projects.find((x) => x.id === id);
                    return (
                      <Badge
                        key={id}
                        variant="outline"
                        className="cursor-pointer bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        onClick={() => toggleAllowedProject(id)}
                      >
                        {p?.name ?? id} ×
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Excluded workspaces <span className="text-xs text-muted-foreground">(only applies when org-scoped)</span></Label>
                <Select value="" onValueChange={(v) => v && toggleExcludedWorkspace(v)} disabled={availableForExcluded.length === 0}>
                  <SelectTrigger><SelectValue placeholder={availableForExcluded.length === 0 ? 'No workspaces available' : 'Add workspace…'} /></SelectTrigger>
                  <SelectContent>
                    {availableForExcluded.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-1">
                  {editForm.excluded_workspace_ids.map((id) => {
                    const w = workspaces.find((x) => x.id === id);
                    return (
                      <Badge
                        key={id}
                        variant="outline"
                        className="cursor-pointer bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/30 hover:border-red-500/40 transition-colors"
                        onClick={() => toggleExcludedWorkspace(id)}
                      >
                        {w?.name ?? id} ×
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditPool(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !editForm.name.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deletePool} onOpenChange={(open) => { if (!open) setDeletePool(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent pool</DialogTitle>
            <DialogDescription>
              {deletePool && (
                <>Delete &quot;{deletePool.name}&quot;? This cannot be undone. Runners in this pool will need to re-register.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePool(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
