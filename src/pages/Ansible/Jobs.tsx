// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ansibleJobsApi, type AnsibleJob, type AnsibleJobStatus } from '@/api/ansible';
import { getAnsibleJobFromJsonApi } from '@/utils/ansible-jsonapi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Play,
  Search,
  MoreVertical,
  XCircle,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Ban,
  Eye,
  Trash2,
  WifiOff,
  CircleDot,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Simple relative time formatter
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export default function Jobs() {
  const { orgName } = useParams<{ orgName: string }>();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';

  const [jobs, setJobs] = useState<AnsibleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AnsibleJobStatus | 'all'>('all');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [jobToCancel, setJobToCancel] = useState<AnsibleJob | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [relaunching, setRelaunching] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<AnsibleJob | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch jobs
  useEffect(() => {
    if (!selectedOrg) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void ansibleJobsApi
      .listByOrganization(selectedOrg)
      .then((res) => {
        setJobs((res.data || []).map(getAnsibleJobFromJsonApi));
      })
      .catch((err) => {
        console.error('Failed to load jobs:', err);
        toast.error('Failed to load jobs');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedOrg]);

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = 
      job.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCancel = async () => {
    if (!jobToCancel) return;

    setCanceling(true);
    try {
      await ansibleJobsApi.cancel(jobToCancel.id);
      setJobs(jobs.map((j) => 
        j.id === jobToCancel.id ? { ...j, status: 'canceled' as AnsibleJobStatus } : j
      ));
      setCancelDialogOpen(false);
      setJobToCancel(null);
      toast.success('Job canceled successfully');
    } catch (err) {
      console.error('Failed to cancel job:', err);
      toast.error('Failed to cancel job');
    } finally {
      setCanceling(false);
    }
  };

  const handleRelaunch = async (job: AnsibleJob) => {
    setRelaunching(job.id);
    try {
      const response = await ansibleJobsApi.relaunch(job.id);
      const newJob = getAnsibleJobFromJsonApi(response.data);
      setJobs([newJob, ...jobs]);
      toast.success('Job relaunched successfully');
    } catch (err) {
      console.error('Failed to relaunch job:', err);
      toast.error('Failed to relaunch job');
    } finally {
      setRelaunching(null);
    }
  };

  const handleDelete = async () => {
    if (!jobToDelete) return;

    setDeleting(true);
    try {
      await ansibleJobsApi.delete(jobToDelete.id);
      setJobs(jobs.filter((j) => j.id !== jobToDelete.id));
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      toast.success('Job deleted successfully');
    } catch (err: unknown) {
      console.error('Failed to delete job:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusIcon = (status: AnsibleJobStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'successful':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'canceled':
        return <Ban className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: AnsibleJobStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'running':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'successful':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'failed':
      case 'error':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'canceled':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const formatDuration = (startedAt?: string, finishedAt?: string) => {
    if (!startedAt) return '-';
    const start = new Date(startedAt);
    const end = finishedAt ? new Date(finishedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Check if job has warnings (will use backend field when available)
  const hasWarnings = (job: AnsibleJob): boolean => {
    return job.has_warnings || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ansible Jobs</h1>
          <p className="text-muted-foreground">
            View and manage Ansible job executions for {selectedOrg}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as AnsibleJobStatus | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="successful">Successful</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs Table */}
      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No jobs found</h3>
            <p className="text-muted-foreground text-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'No jobs match your filters.'
                : 'Launch a playbook to create your first job.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.id} className="group">
                  <TableCell>
                    <Link
                      to={`/app/${selectedOrg}/ansible/jobs/${job.id}`}
                      className="font-medium hover:underline"
                    >
                      {job.name || `Job ${job.id.slice(0, 8)}`}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {job.id.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", getStatusColor(job.status))}
                    >
                      {getStatusIcon(job.status)}
                      <span className="ml-1">{job.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.started_at
                      ? formatRelativeTime(job.started_at)
                      : job.created_at
                      ? formatRelativeTime(job.created_at)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDuration(job.started_at, job.finished_at)}
                  </TableCell>
                  <TableCell>
                    {(job.status === 'successful' || job.status === 'failed') && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1" title="OK">
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-xs font-medium text-green-600">{job.hosts_ok}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Changed">
                          <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-xs font-medium text-blue-600">{job.hosts_changed}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Failed">
                          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                          <span className="text-xs font-medium text-red-600">{job.hosts_failed}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Unreachable">
                          <WifiOff className="h-3.5 w-3.5 text-orange-600" />
                          <span className="text-xs font-medium text-orange-600">{job.hosts_unreachable}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Rescued">
                          <CircleDot className="h-3.5 w-3.5 text-purple-600" />
                          <span className="text-xs font-medium text-purple-600">{job.hosts_rescued || 0}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Skipped">
                          <Ban className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-400">{job.hosts_skipped}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Ignored">
                          <EyeOff className="h-3.5 w-3.5 text-gray-600" />
                          <span className="text-xs font-medium text-gray-600">{job.hosts_ignored || 0}</span>
                        </div>
                        {hasWarnings(job) && (
                          <div className="flex items-center gap-1 ml-4 pl-3 border-l border-border" title={`${job.warnings_count || 0} Warning${(job.warnings_count || 0) !== 1 ? 's' : ''}`}>
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                            <span className="text-xs font-medium text-yellow-600">{job.warnings_count || 0}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/app/${selectedOrg}/ansible/jobs/${job.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {(job.status === 'successful' || job.status === 'failed' || job.status === 'canceled') && (
                          <DropdownMenuItem
                            onClick={() => { void handleRelaunch(job); }}
                            disabled={relaunching === job.id}
                          >
                            {relaunching === job.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Relaunch
                          </DropdownMenuItem>
                        )}
                        {(job.status === 'pending' || job.status === 'running') && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setJobToCancel(job);
                              setCancelDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setJobToDelete(job);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this job? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Running
            </Button>
            <Button variant="destructive" onClick={() => { void handleCancel(); }} disabled={canceling}>
              {canceling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this job? This action cannot be undone. All job events and output will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setJobToDelete(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
