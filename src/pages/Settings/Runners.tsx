// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Server, ArrowLeft, Trash2, Loader2, Settings2, Copy, Check, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  runnersApi,
  agentPoolsApi,
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

export default function Runners() {
  const { orgName } = useParams<{ orgName: string }>();
  const [addOpen, setAddOpen] = useState(false);
  const [editRunner, setEditRunner] = useState<Runner | null>(null);
  const [deleteRunner, setDeleteRunner] = useState<Runner | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [copiedCmd, setCopiedCmd] = useState<'ansible' | 'terraform' | null>(null);

  const { data: runnersData, isLoading: loading, refetch: refetchRunners } = useQuery({
    queryKey: ['runners', orgName],
    queryFn: async () => {
      const [runnersRes, poolsRes, statsRes] = await Promise.all([
        runnersApi.list(orgName!),
        agentPoolsApi.list(orgName!),
        runnersApi.getStats(orgName!),
      ]);
      return {
        runners: runnersRes.data || [],
        pools: poolsRes.data || [],
        stats: statsRes as { total: number; online: number; offline: number },
      };
    },
    enabled: !!orgName,
    refetchInterval: (query) => {
      const runners = query.state.data?.runners ?? [];
      const hasActive = runners.some((r: Runner) => r.status === 'online' || r.status === 'busy');
      return hasActive || runners.length === 0 ? 10_000 : false;
    },
  });

  const runners = runnersData?.runners ?? [];
  const pools = runnersData?.pools ?? [];
  const stats = runnersData?.stats ?? null;

  const [editForm, setEditForm] = useState<{
    description: string;
    labels: string[];
  }>({ description: '', labels: [] });
  const [newLabel, setNewLabel] = useState('');

  const openEdit = (runner: Runner) => {
    setEditRunner(runner);
    setEditForm({
      description: runner.description,
      labels: runner.labels || [],
    });
    setNewLabel('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRunner) return;
    setSaving(true);
    try {
      await runnersApi.update(editRunner.id, {
        description: editForm.description,
        labels: editForm.labels,
      });
      toast.success('Runner updated');
      setEditRunner(null);
      void refetchRunners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update runner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRunner) return;
    setDeleting(true);
    try {
      await runnersApi.delete(deleteRunner.id);
      toast.success('Runner deleted');
      setDeleteRunner(null);
      void refetchRunners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete runner');
    } finally {
      setDeleting(false);
    }
  };

  const addLabel = () => {
    if (!newLabel.trim()) return;
    const label = newLabel.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!editForm.labels.includes(label)) {
      setEditForm((prev) => ({ ...prev, labels: [...prev.labels, label] }));
    }
    setNewLabel('');
  };

  const removeLabel = (label: string) => {
    setEditForm((prev) => ({ ...prev, labels: prev.labels.filter((l) => l !== label) }));
  };

  const copyCommand = (type: 'ansible' | 'terraform') => {
    const serverUrl = window.location.origin.replace('http://', 'https://');
    const cmd = `docker run -d --restart unless-stopped \\
  -e RUNNER_MODE=agent \\
  -e RUNNER_AGENT_POOL_ID=${selectedPool || '<pool-uuid>'} \\
  -e STACKWEAVER_TOKEN=<your-api-key> \\
  -e STACKWEAVER_SERVER=${serverUrl} \\
  -e RUNNER_NAME=my-${type}-runner \\
  stackweaver/runner-${type}:latest`;
    void navigator.clipboard.writeText(cmd);
    setCopiedCmd(type);
    toast.success(`${type === 'ansible' ? 'Ansible' : 'Terraform'} runner command copied`);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: Runner['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-400';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusBadgeClass = (status: Runner['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
      case 'busy':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
      case 'offline':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const getRunnerTypeBadgeClass = (type: Runner['runner_type']) => {
    switch (type) {
      case 'terraform':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'ansible':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      case 'combined':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
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
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
                Self-Hosted Runners
              </h1>
              <p className="text-muted-foreground">
                Manage self-hosted runners for Terraform and Ansible workloads
              </p>
              {stats && (
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{stats.total}</span> total
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-green-600 dark:text-green-400">{stats.online}</span> online
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-gray-500">{stats.offline}</span> offline
                  </span>
                </div>
              )}
            </div>
            <div className="relative inline-flex rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 p-[2px]">
              <Button
                variant="ghost"
                onClick={() => setAddOpen(true)}
                className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
              >
                <Terminal className="h-4 w-4 mr-2" />
                Add runner
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
          {runners.length === 0 ? (
            <div
              className={cn(
                'rounded-2xl border border-dashed border-white/20 dark:border-white/10',
                'p-8 text-center text-muted-foreground'
              )}
            >
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No runners registered yet.</p>
              <p className="text-sm mt-1">Register a runner by running the agent on your infrastructure.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setAddOpen(true)}
              >
                <Terminal className="h-4 w-4 mr-2" />
                Add runner
              </Button>
            </div>
          ) : (
            runners.map((runner) => (
              <div
                key={runner.id}
                className={cn(
                  'rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                  'dark:from-black/10 dark:via-black/5',
                  'backdrop-blur-md border border-white/20 dark:border-white/10',
                  'p-6 shadow-lg'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn('w-3 h-3 rounded-full', getStatusColor(runner.status))} />
                      <Link 
                        to={`/app/${orgName}/settings/runners/${runner.id}`}
                        className="text-lg font-semibold hover:text-primary hover:underline transition-colors"
                      >
                        {runner.name}
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline" className={getStatusBadgeClass(runner.status)}>
                        {runner.status}
                      </Badge>
                      <Badge variant="outline" className={getRunnerTypeBadgeClass(runner.runner_type)}>
                        {runner.runner_type}
                      </Badge>
                      {runner.agent_pool_name && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                          {runner.agent_pool_name}
                        </Badge>
                      )}
                      {runner.labels.map((label) => (
                        <Badge key={label} variant="outline" className="bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20">
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        {runner.hostname && <span>{runner.hostname}</span>}
                        {runner.ip_address && <span className="ml-2">({runner.ip_address})</span>}
                      </p>
                      <p>
                        {runner.os_type && runner.os_version && (
                          <span>{runner.os_type} {runner.os_version}</span>
                        )}
                        {runner.terraform_version && (
                          <span className="ml-3">TF {runner.terraform_version}</span>
                        )}
                        {runner.ansible_version && (
                          <span className="ml-3">Ansible {runner.ansible_version}</span>
                        )}
                      </p>
                      <p>
                        Last heartbeat: {formatTimeAgo(runner.last_heartbeat_at)}
                        {runner.status !== 'offline' && (
                          <span className="ml-3">
                            {runner.current_jobs}/{runner.max_concurrent_jobs} jobs
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(runner)}>
                      <Settings2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteRunner(runner)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Runner dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Register a Self-Hosted Runner</DialogTitle>
            <DialogDescription>
              Run the runner container on your infrastructure to register it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>1. Create an API Key</Label>
              <p className="text-sm text-muted-foreground">
                Go to <Link to={`/app/${orgName}/settings/api-keys`} className="text-primary hover:underline">Settings → API Keys</Link> and 
                create a key with <code className="bg-muted px-1 rounded-sm">runner:register</code> scope.
              </p>
            </div>

            <div className="space-y-2">
              <Label>2. Select Agent Pool</Label>
              <Select value={selectedPool} onValueChange={setSelectedPool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pool..." />
                </SelectTrigger>
                <SelectContent>
                  {pools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pools.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No pools found. <Link to={`/app/${orgName}/settings/agent-pools`} className="text-primary hover:underline">Create an agent pool</Link> first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>3. Run the Docker Command</Label>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Ansible Runner</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCommand('ansible')}
                      disabled={!selectedPool}
                    >
                      {copiedCmd === 'ansible' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`docker run -d --restart unless-stopped \\
  -e RUNNER_MODE=agent \\
  -e RUNNER_AGENT_POOL_ID=${selectedPool || '<pool-uuid>'} \\
  -e STACKWEAVER_TOKEN=<your-api-key> \\
  -e STACKWEAVER_SERVER=${window.location.origin.replace('http://', 'https://')} \\
  -e RUNNER_NAME=my-ansible-runner \\
  stackweaver/runner-ansible:latest`}
                  </pre>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Terraform Runner</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCommand('terraform')}
                      disabled={!selectedPool}
                    >
                      {copiedCmd === 'terraform' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`docker run -d --restart unless-stopped \\
  -e RUNNER_MODE=agent \\
  -e RUNNER_AGENT_POOL_ID=${selectedPool || '<pool-uuid>'} \\
  -e STACKWEAVER_TOKEN=<your-api-key> \\
  -e STACKWEAVER_SERVER=${window.location.origin.replace('http://', 'https://')} \\
  -e RUNNER_NAME=my-terraform-runner \\
  stackweaver/runner-terraform:latest`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRunner} onOpenChange={(open) => { if (!open) setEditRunner(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit runner</DialogTitle>
            <DialogDescription>Update description and labels for &quot;{editRunner?.name}&quot;</DialogDescription>
          </DialogHeader>
          {editRunner && (
            <form onSubmit={(e) => { void handleUpdate(e); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Labels</Label>
                <div className="flex gap-2">
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Add label..."
                    disabled={saving}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLabel();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addLabel} disabled={saving || !newLabel.trim()}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {editForm.labels.map((label) => (
                    <Badge
                      key={label}
                      variant="outline"
                      className="cursor-pointer bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      onClick={() => removeLabel(label)}
                    >
                      {label} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditRunner(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteRunner} onOpenChange={(open) => { if (!open) setDeleteRunner(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete runner</DialogTitle>
            <DialogDescription>
              {deleteRunner && (
                <>Delete &quot;{deleteRunner.name}&quot;? The runner will need to re-register to appear again.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRunner(null)}>Cancel</Button>
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
