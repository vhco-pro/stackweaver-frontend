// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Activity, Clock, Cpu, Tag, Trash2, Edit2, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { runnersApi, type Runner } from '@/api/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RunnerDetail() {
  const { orgName, runnerId } = useParams<{ orgName: string; runnerId: string }>();
  const navigate = useNavigate();
  const [runner, setRunner] = useState<Runner | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [editForm, setEditForm] = useState({
    description: '',
    labels: '',
  });

  const loadRunner = useCallback(async () => {
    if (!runnerId) return;
    
    try {
      setLoading(true);
      const data = await runnersApi.get(runnerId);
      setRunner(data);
      setEditForm({
        description: data.description || '',
        labels: (data.labels || []).join(', '),
      });
    } catch (err) {
      console.error('Failed to load runner:', err);
      toast.error('Failed to load runner details');
    } finally {
      setLoading(false);
    }
  }, [runnerId]);

  useEffect(() => {
    if (runnerId) {
      void loadRunner();
    }
  }, [runnerId, loadRunner]);

  // Poll for real-time status updates (every 10 seconds)
  const runnerStatus = runner?.status;
  useEffect(() => {
    if (!runnerId || !runnerStatus) return;
    
    // Only poll for runners that might have status changes
    if (runnerStatus !== 'online' && runnerStatus !== 'busy') return;

    const pollInterval = setInterval(() => {
      void runnersApi.get(runnerId).then(data => {
        setRunner(data);
      }).catch(() => {
        // Silently ignore polling errors
      });
    }, 10000); // 10 seconds

    return () => clearInterval(pollInterval);
  }, [runnerId, runnerStatus]);

  const handleSave = async () => {
    if (!runner) return;
    
    try {
      setSaving(true);
      const labels = editForm.labels
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);
      
      await runnersApi.update(runner.id, {
        description: editForm.description,
        labels,
      });
      
      toast.success('Runner updated');
      setEditDialogOpen(false);
      void loadRunner();
    } catch (err) {
      console.error('Failed to update runner:', err);
      toast.error('Failed to update runner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!runner) return;
    
    try {
      setDeleting(true);
      await runnersApi.delete(runner.id);
      toast.success('Runner deleted');
      void navigate(`/app/${orgName}/settings/runners`);
    } catch (err) {
      console.error('Failed to delete runner:', err);
      toast.error('Failed to delete runner');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const getStatusColor = (status: string) => {
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'terraform':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'ansible':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'combined':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  // Compute metrics from job history
  const metrics = useMemo(() => {
    if (!runner?.recent_jobs || runner.recent_jobs.length === 0) {
      return null;
    }

    const jobs = runner.recent_jobs;
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const failedJobs = jobs.filter(j => j.status === 'failed');
    const totalJobs = jobs.length;
    
    // Calculate average duration from completed jobs with duration
    const jobsWithDuration = jobs.filter(j => j.duration_ms > 0);
    const avgDurationMs = jobsWithDuration.length > 0
      ? jobsWithDuration.reduce((sum, j) => sum + j.duration_ms, 0) / jobsWithDuration.length
      : 0;

    const successRate = totalJobs > 0
      ? Math.round((completedJobs.length / totalJobs) * 100)
      : 0;

    return {
      totalJobs,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      avgDurationMs,
      successRate,
    };
  }, [runner?.recent_jobs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!runner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Server className="h-16 w-16 text-muted-foreground/50" />
        <p className="text-muted-foreground">Runner not found</p>
        <Link to={`/app/${orgName}/settings/runners`}>
          <Button variant="outline">Back to Runners</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={`/app/${orgName}/settings/runners`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Back to Runners"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold">{runner.name}</h1>
                <Badge variant="outline" className={cn(getStatusColor(runner.status))}>
                  {runner.status}
                </Badge>
                <Badge variant="outline" className={cn(getTypeColor(runner.runner_type))}>
                  {runner.runner_type}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {runner.description || 'No description'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit2 className="h-4 w-4 mr-2 text-muted-foreground" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              System Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hostname</span>
              <span className="font-mono text-sm">{runner.hostname || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IP Address</span>
              <span className="font-mono text-sm">{runner.ip_address || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">OS</span>
              <span>{runner.os_type} {runner.os_version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agent Version</span>
              <span>{runner.agent_version || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {runner.terraform_version && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Terraform (pre-installed)</span>
                <span>{runner.terraform_version}</span>
              </div>
            )}
            {runner.ansible_version && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ansible</span>
                <span>{runner.ansible_version}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Concurrent Jobs</span>
              <span>{runner.max_concurrent_jobs || 1}</span>
            </div>
            {runner.available_collections && runner.available_collections.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Collections</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {runner.available_collections.slice(0, 5).map((col, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {col}
                    </Badge>
                  ))}
                  {runner.available_collections.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{runner.available_collections.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status & Timing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Heartbeat</span>
              <span>
                {runner.last_heartbeat_at
                  ? new Date(runner.last_heartbeat_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registered</span>
              <span>{new Date(runner.created_at).toLocaleDateString()}</span>
            </div>
            {runner.agent_pool_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent Pool</span>
                <Link
                  to={`/app/${orgName}/settings/agent-pools`}
                  className="text-primary hover:underline"
                >
                  {runner.agent_pool_name}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metrics */}
        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                Metrics
              </CardTitle>
              <CardDescription>Recent job execution statistics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Jobs (Recent)</span>
                <span className="font-medium">{metrics.totalJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="text-green-600 dark:text-green-400 font-medium">{metrics.completedJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed</span>
                <span className="text-red-600 dark:text-red-400 font-medium">{metrics.failedJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Success Rate</span>
                <span className={cn(
                  "font-medium",
                  metrics.successRate >= 80 && "text-green-600 dark:text-green-400",
                  metrics.successRate >= 50 && metrics.successRate < 80 && "text-yellow-600 dark:text-yellow-400",
                  metrics.successRate < 50 && "text-red-600 dark:text-red-400"
                )}>
                  {metrics.successRate}%
                </span>
              </div>
              {metrics.avgDurationMs > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Duration</span>
                  <span>
                    {metrics.avgDurationMs < 60000
                      ? `${Math.round(metrics.avgDurationMs / 1000)}s`
                      : `${Math.round(metrics.avgDurationMs / 60000)}m`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Labels */}
      {runner.labels && runner.labels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-sky-500 dark:text-sky-400" />
              Labels
            </CardTitle>
            <CardDescription>
              Labels can be used for job routing and organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {runner.labels.map((label, i) => (
                <Badge key={i} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
            Recent Jobs
          </CardTitle>
          <CardDescription>
            Jobs executed by this runner
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runner.recent_jobs && runner.recent_jobs.length > 0 ? (
            <div className="space-y-3">
              {runner.recent_jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        job.status === 'completed' && 'bg-green-500/10 text-green-600 border-green-500/20',
                        job.status === 'failed' && 'bg-red-500/10 text-red-600 border-red-500/20',
                        job.status === 'running' && 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                        job.status === 'pending' && 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                      )}
                    >
                      {job.status}
                    </Badge>
                    <div>
                      <p className="font-medium">{job.workspace_name || job.job_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.job_type} - {job.job_id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {job.started_at && (
                      <p className="text-muted-foreground">
                        {new Date(job.started_at).toLocaleString()}
                      </p>
                    )}
                    {job.duration_ms > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Duration: {Math.round(job.duration_ms / 1000)}s
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No job history yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Runner</DialogTitle>
            <DialogDescription>
              Update runner description and labels
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Runner description..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labels">Labels</Label>
              <Input
                id="labels"
                value={editForm.labels}
                onChange={(e) => setEditForm({ ...editForm, labels: e.target.value })}
                placeholder="gpu, high-memory, production"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of labels
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleSave(); }} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Runner</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete runner "{runner.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDelete(); }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
