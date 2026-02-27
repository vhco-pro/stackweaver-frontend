// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { workspacesApi, runsApi, organizationsApi, projectsApi, type Organization, type Project, type Workspace } from '@/api/client';
import { EditWorkspaceDialog } from '@/components/workspace/EditWorkspaceDialog';
import { getRunStatus, getRunOperation, getAttribute, type JsonApiResource } from '@/utils/jsonapi';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/runs/StatusBadge';
import { computeDisplayStatus } from '@/utils/runStatus';
import {
  FolderOpen,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
  Pause,
  Clock,
  MoreVertical,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon, getVcsRepoUrl } from '@/lib/vcs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'needs_attention' | 'errored' | 'running' | 'on_hold' | 'success';

interface WorkspaceWithStats extends Workspace {
  project?: Project;
  organization?: Organization;
  latestRun?: JsonApiResource; // JSON:API format - use helper functions to access properties
  runStatusCounts?: {
    needsAttention: number;
    errored: number;
    running: number;
    onHold: number;
    success: number;
  };
}

export default function Workspaces() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  // Prefer orgName from URL params, fallback to currentOrg from context
  const selectedOrg = orgName || currentOrg?.name || '';
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forceDeleteMode, setForceDeleteMode] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [workspaceToEdit, setWorkspaceToEdit] = useState<WorkspaceWithStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;
  const workspacesRef = useRef<WorkspaceWithStats[]>([]);

  // Check if we should reopen the dialog after GitHub redirect
  useEffect(() => {
    if (!selectedOrg || !orgName) return;
    
    // Check URL parameter first (from GitHubInstalled redirect)
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('openDialog') === 'true') {
      setCreateDialogOpen(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Clear localStorage
      localStorage.removeItem('pendingWorkspaceDialog');
      return;
    }
    
    // Also check localStorage (fallback - in case URL param didn't work)
    const pendingDialog = localStorage.getItem('pendingWorkspaceDialog');
    if (pendingDialog) {
      try {
        const parsed = JSON.parse(pendingDialog) as { orgName: string; timestamp: number };
        const { orgName: pendingOrg, timestamp } = parsed;
        // Only reopen if it's recent (within last 5 minutes) and matches current org
        if (Date.now() - timestamp < 5 * 60 * 1000 && pendingOrg === selectedOrg) {
          setCreateDialogOpen(true);
          // Clear the pending state
          localStorage.removeItem('pendingWorkspaceDialog');
        } else {
          // Clear stale state
          localStorage.removeItem('pendingWorkspaceDialog');
        }
      } catch (err) {
        console.error('Failed to parse pending dialog state:', err);
        localStorage.removeItem('pendingWorkspaceDialog');
      }
    }
  }, [selectedOrg, orgName]);

  // Load organizations (for org selector if multiple orgs)
  useEffect(() => {
    void organizationsApi.list()
      .then((res) => {
        const orgs = res.data || [];
        setOrganizations(orgs);
        // If no org in URL and we have orgs, redirect to first org
        if (!orgName && orgs.length > 0 && !currentOrg) {
          void navigate(`/app/${orgs[0].name}/workspaces`, { replace: true });
        }
      })
      .catch((err) => {
        console.error('Failed to load organizations:', err);
      });
  }, [orgName, navigate, currentOrg]);

  // Reusable function to fetch and enrich workspaces with project info, latest runs, and status counts
  const fetchWorkspaces = useCallback(async (showLoading = true) => {
    if (!selectedOrg) {
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);

    try {
      const [workspacesRes, projectsRes] = await Promise.all([
        workspacesApi.list(selectedOrg),
        projectsApi.list(selectedOrg),
      ]);
      const allWorkspaces = workspacesRes.data || [];
      const projects = projectsRes.data || [];

      // Enrich workspaces with project and organization info
      const enrichedWorkspaces: WorkspaceWithStats[] = await Promise.all(
        allWorkspaces.map(async (workspace) => {
          const project = projects.find(p => p.id === workspace.project_id);
          const org = organizations.find(o => o.name === selectedOrg);

          // Get latest run for each workspace
          let latestRun: JsonApiResource | undefined;
          const runStatusCounts = {
            needsAttention: 0,
            errored: 0,
            running: 0,
            onHold: 0,
            success: 0,
          };

          try {
            const runsRes = await runsApi.list(workspace.id);
            const runs = (Array.isArray(runsRes.data) ? runsRes.data : []);

            if (runs.length > 0) {
              latestRun = runs[0]; // Already sorted by created_at DESC

              // Count run statuses using JSON:API helper functions
              // TFE-style statuses: pending, planning, planned, applying, applied, errored, canceled
              // For plan-only runs, "planned" means finished (success)
              // For plan-and-apply runs, "planned" means waiting for apply (on hold)
              runs.forEach(run => {
                const status = getRunStatus(run);
                const operation = getRunOperation(run);
                const isPlanOnly = operation === 'plan' || getAttribute<boolean>(run, 'plan-only', false);

                switch (status) {
                  case 'errored':
                  case 'canceled':
                  case 'failed': // Legacy status
                    // Errored/canceled runs should NOT be counted as "needs attention"
                    // They can't be applied, so they don't need user action
                    if (status === 'errored' || status === 'failed') runStatusCounts.errored++;
                    break;
                  case 'planning':
                  case 'applying':
                  case 'running': // Legacy status
                    runStatusCounts.running++;
                    break;
                  case 'pending':
                    runStatusCounts.onHold++;
                    break;
                  case 'planned':
                    // Plan-only runs are finished when planned, plan-and-apply runs are waiting for apply
                    if (isPlanOnly) {
                      runStatusCounts.success++;
                    } else {
                      runStatusCounts.onHold++;
                    }
                    break;
                  case 'applied':
                  case 'completed': // Legacy status
                    runStatusCounts.success++;
                    break;
                }
              });
            }
          } catch (err) {
            console.error(`Failed to load runs for workspace ${workspace.id}:`, err);
          }

          return {
            ...workspace,
            project,
            organization: org,
            latestRun,
            runStatusCounts,
          };
        })
      );

      setWorkspaces(enrichedWorkspaces);
      workspacesRef.current = enrichedWorkspaces;
      setTotalPages(Math.ceil(enrichedWorkspaces.length / itemsPerPage));
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, organizations]);

  // Fetch workspaces and their latest runs
  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Poll for active runs updates (running or pending) to refresh latestRun
  useEffect(() => {
    if (!selectedOrg) return;

    const pollInterval = setInterval(() => {
      void (async () => {
        try {
          const currentWorkspaces = workspacesRef.current;
          if (currentWorkspaces.length === 0) return;

          // Check if any workspace has active runs
          // Active statuses: pending, planning, planned (waiting for apply), applying
          const isActiveStatus = (status: string) => 
            ['pending', 'planning', 'planned', 'applying', 'running'].includes(status);
          
          const hasActiveRuns = currentWorkspaces.some(w => {
            if (!w.latestRun) return false;
            const status = getRunStatus(w.latestRun);
            return isActiveStatus(status);
          });
        
          if (!hasActiveRuns) {
            clearInterval(pollInterval);
            return;
          }

          // Refresh latestRun for workspaces with active runs
          const updatedWorkspaces = await Promise.all(
          currentWorkspaces.map(async (workspace) => {
            // Only refresh if latestRun is active
            if (workspace.latestRun) {
              const currentStatus = getRunStatus(workspace.latestRun);
              if (isActiveStatus(currentStatus)) {
                try {
                  const runsRes = await runsApi.list(workspace.id);
                    const runs = (Array.isArray(runsRes.data) ? runsRes.data : []);
                  const updatedLatestRun = runs.length > 0 ? runs[0] : undefined;
                  
                  // Update run status counts using JSON:API helpers
                  // TFE-style statuses: pending, planning, planned, applying, applied, errored, canceled
                  // For plan-only runs, "planned" means finished (success)
                  // For plan-and-apply runs, "planned" means waiting for apply (on hold)
                  const runStatusCounts = {
                    needsAttention: 0,
                    errored: 0,
                    running: 0,
                    onHold: 0,
                    success: 0,
                  };
                  
                  runs.forEach(run => {
                    const status = getRunStatus(run);
                    const operation = getRunOperation(run);
                    const isPlanOnly = operation === 'plan' || getAttribute<boolean>(run, 'plan-only', false);
                    
                    switch (status) {
                      case 'errored':
                      case 'canceled':
                      case 'failed': // Legacy status
                        // Errored/canceled runs should NOT be counted as "needs attention"
                        // They can't be applied, so they don't need user action
                        if (status === 'errored' || status === 'failed') runStatusCounts.errored++;
                        break;
                      case 'planning':
                      case 'applying':
                      case 'running': // Legacy status
                        runStatusCounts.running++;
                        break;
                      case 'pending':
                        runStatusCounts.onHold++;
                        break;
                      case 'planned':
                        // Plan-only runs are finished when planned, plan-and-apply runs are waiting for apply
                        if (isPlanOnly) {
                          runStatusCounts.success++;
                        } else {
                          runStatusCounts.onHold++;
                        }
                        break;
                      case 'applied':
                      case 'completed': // Legacy status
                        runStatusCounts.success++;
                        break;
                    }
                  });
                  
                  return {
                    ...workspace,
                    latestRun: updatedLatestRun,
                    runStatusCounts,
                  };
                } catch (err) {
                  console.error(`Failed to refresh runs for workspace ${workspace.id}:`, err);
                  return workspace;
                }
              }
              return workspace;
            }
            // If no latestRun, return workspace unchanged
            return workspace;
          })
        );

          workspacesRef.current = updatedWorkspaces;
          setWorkspaces(updatedWorkspaces);
          
          // Stop polling if no more active runs
          const stillActive = updatedWorkspaces.some(w => {
            if (!w.latestRun) return false;
            const status = getRunStatus(w.latestRun);
            return isActiveStatus(status);
          });
          if (!stillActive) {
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error('Failed to poll workspaces:', err);
        }
      })();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [selectedOrg]);

  const handleDeleteWorkspace = async (force = false) => {
    if (!workspaceToDelete || !selectedOrg) return;

    // Force delete requires typing the workspace name
    if (force && deleteConfirmName !== workspaceToDelete.name) {
      toast.error('Please type the workspace name to confirm force deletion');
      return;
    }

    setDeleting(true);
    try {
      await workspacesApi.delete(selectedOrg, workspaceToDelete.name, force);
      toast.success('Workspace deleted successfully');
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
      setForceDeleteMode(false);
      setDeleteConfirmName('');
      
      // Optimistically remove the deleted workspace immediately so UI feels snappy
      setWorkspaces(prev => {
        const filtered = prev.filter(w => w.id !== workspaceToDelete.id);
        workspacesRef.current = filtered;
        setTotalPages(Math.ceil(filtered.length / itemsPerPage));
        return filtered;
      });

      // Then do a full re-fetch in background to ensure consistency (with enrichment)
      await fetchWorkspaces(false);
    } catch (error: unknown) {
      console.error('Failed to delete workspace:', error);
      // Check if this is a 409 Conflict (active infrastructure)
      const isConflict = error instanceof Error && 'response' in error &&
        typeof error.response === 'object' && error.response !== null &&
        'status' in error.response && error.response.status === 409;

      if (isConflict && !force) {
        setForceDeleteMode(true);
        setDeleting(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const errorMessage = (error instanceof Error && 'response' in error && typeof error.response === 'object' && error.response !== null && 'data' in error.response && typeof error.response.data === 'object' && error.response.data !== null && 'errors' in error.response.data && Array.isArray(error.response.data.errors) && error.response.data.errors.length > 0 && typeof error.response.data.errors[0] === 'object' && error.response.data.errors[0] !== null && 'detail' in error.response.data.errors[0] && typeof error.response.data.errors[0].detail === 'string')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ? error.response.data.errors[0].detail
        : (error instanceof Error ? error.message : 'Failed to delete workspace');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleOrgChange = (newOrgName: string) => {
    void Promise.resolve(navigate(`/app/${newOrgName}/workspaces`, { replace: true }));
    setCurrentPage(1);
  };

  const getRunStatusBadge = (run?: JsonApiResource) => {
    if (!run) {
      return <StatusBadge status="no-runs" variant="outline" className="text-muted-foreground" />;
    }

    const status = getRunStatus(run);
    const operation = getRunOperation(run);
    const planOnly = getAttribute<boolean>(run, 'plan-only', false);
    const hasChanges = getAttribute<boolean>(run, 'has-changes', undefined);
    const permissions = getAttribute<Record<string, boolean>>(run, 'permissions', {});
    const canApply = permissions?.['can-apply'] ?? false;

    const displayStatus = computeDisplayStatus({
      status,
      operation,
      planOnly,
      hasChanges,
      canApply,
    });

    return <StatusBadge status={displayStatus} variant="outline" />;
  };

  const getLatestChangeTime = (workspace: WorkspaceWithStats) => {
    if (workspace.latestRun) {
      const completedAt = getAttribute<string>(workspace.latestRun, 'completed-at');
      const createdAt = getAttribute<string>(workspace.latestRun, 'created-at');
      if (completedAt) {
        return new Date(completedAt);
      } else if (createdAt) {
        return new Date(createdAt);
      }
    }
    if (workspace.updated_at) {
      return new Date(workspace.updated_at);
    }
    return new Date(workspace.created_at);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  };

  // Filter workspaces
  const filteredWorkspaces = workspaces.filter(workspace => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workspace.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workspace.vcs_repository?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (!workspace.latestRun) {
        // Workspaces with no runs should not match any status filter
        matchesStatus = false;
      } else {
        const status = getRunStatus(workspace.latestRun);
        const operation = getRunOperation(workspace.latestRun);
        const isPlanOnly = operation === 'plan' || getAttribute<boolean>(workspace.latestRun, 'plan-only', false);
        
        switch (statusFilter) {
          case 'needs_attention':
            // Needs attention = runs waiting for user action (planned runs that can be applied, pending runs)
            // NOT errored/canceled runs (they can't be applied)
            if (status === 'planned' && !isPlanOnly) {
              // Plan-and-apply run that's planned and waiting for apply
              matchesStatus = true;
            } else if (status === 'pending') {
              // Pending runs need attention
              matchesStatus = true;
            } else {
              matchesStatus = false;
            }
            break;
          case 'errored':
            matchesStatus = status === 'failed' || status === 'errored';
            break;
          case 'running':
            matchesStatus = ['running', 'planning', 'applying'].includes(status);
            break;
          case 'on_hold':
            // Plan-only runs in "planned" status are finished, not on hold
            matchesStatus = status === 'pending' || (status === 'planned' && !isPlanOnly);
            break;
          case 'success':
            // Plan-only runs in "planned" status are also considered success
            matchesStatus = status === 'completed' || status === 'applied' || (status === 'planned' && isPlanOnly) || false;
            break;
        }
      }
    }

    return matchesSearch && matchesStatus;
  });

  // Helper function to determine workspace status category based on latest run
  // This matches the filter logic used in filteredWorkspaces
  const getWorkspaceStatusCategory = (workspace: WorkspaceWithStats): StatusFilter | null => {
    if (!workspace.latestRun) {
      // Workspaces with no runs should not be categorized
      return null;
    }
    
    const status = getRunStatus(workspace.latestRun);
    const operation = getRunOperation(workspace.latestRun);
    const isPlanOnly = operation === 'plan' || getAttribute<boolean>(workspace.latestRun, 'plan-only', false);
    
    // Map run status to workspace status category (matching filter logic)
    if (status === 'failed' || status === 'errored') {
      return 'errored';
    }
    if (['running', 'planning', 'applying'].includes(status)) {
      return 'running';
    }
    // Needs attention: planned runs waiting for apply, or pending runs
    // (Note: this overlaps with on_hold, but we prioritize needs_attention)
    if (status === 'planned' && !isPlanOnly) {
      return 'needs_attention';
    }
    if (status === 'pending') {
      // Pending runs can be both needs_attention and on_hold, prioritize needs_attention
      return 'needs_attention';
    }
    if (status === 'completed' || status === 'applied' || (status === 'planned' && isPlanOnly)) {
      return 'success';
    }
    
    return null;
  };

  // Calculate aggregate stats by counting workspaces by their latest run status
  // This counts workspaces, not all runs within workspaces
  const aggregateStats = workspaces.reduce((stats, workspace) => {
    const category = getWorkspaceStatusCategory(workspace);
    if (category === 'needs_attention') {
      stats.needsAttention++;
    } else if (category === 'errored') {
      stats.errored++;
    } else if (category === 'running') {
      stats.running++;
    } else if (category === 'on_hold') {
      stats.onHold++;
    } else if (category === 'success') {
      stats.success++;
    }
    return stats;
  }, {
    needsAttention: 0,
    errored: 0,
    running: 0,
    onHold: 0,
    success: 0,
  });

  // Calculate total workspaces with running latest runs (for icon animation)
  const totalRunningRuns = workspaces.filter(w => {
    const category = getWorkspaceStatusCategory(w);
    return category === 'running';
  }).length;

  // Pagination
  const paginatedWorkspaces = filteredWorkspaces.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {selectedOrg && (
          <>
            <Link to={`/organizations/${selectedOrg}`} className="hover:text-foreground">
              {selectedOrg}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground font-medium">Workspaces</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Workspaces
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your infrastructure workspaces
          </p>
        </div>
        {selectedOrg && (
          <div className="flex items-center gap-3">
            {organizations.length > 1 && (
              <Select value={selectedOrg} onValueChange={handleOrgChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.name}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button 
              onClick={() => setCreateDialogOpen(true)} 
              className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg border border-border/40">
        <button
          onClick={() => setStatusFilter('all')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            statusFilter === 'all'
              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
              : "text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
          )}
        >
          All {workspaces.length}
        </button>
        <button
          onClick={() => setStatusFilter('needs_attention')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            statusFilter === 'needs_attention'
              ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
          )}
        >
          <AlertTriangle className="h-4 w-4" />
          Needs Attention {aggregateStats.needsAttention}
        </button>
        <button
          onClick={() => setStatusFilter('errored')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            statusFilter === 'errored'
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "text-red-600 dark:text-red-400 hover:bg-red-500/20"
          )}
        >
          <XCircle className="h-4 w-4" />
          Errored {aggregateStats.errored}
        </button>
        <button
          onClick={() => setStatusFilter('running')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            statusFilter === 'running'
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
          )}
        >
          <Loader2 className={cn("h-4 w-4", totalRunningRuns > 0 && "animate-spin")} />
          Running {aggregateStats.running}
        </button>
        <button
          onClick={() => setStatusFilter('on_hold')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            statusFilter === 'on_hold'
              ? "bg-gray-500/10 text-gray-600 dark:text-gray-400"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-500/20"
          )}
        >
          <Pause className="h-4 w-4" />
          On Hold {aggregateStats.onHold}
        </button>
        <button
          onClick={() => setStatusFilter('success')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            statusFilter === 'success'
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "text-green-600 dark:text-green-400 hover:bg-green-500/20"
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          Success {aggregateStats.success}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {/* TODO: Add tags when implemented */}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="needs_attention">Needs Attention</SelectItem>
            <SelectItem value="errored">Errored</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="success">Success</SelectItem>
          </SelectContent>
        </Select>
        {(searchQuery || statusFilter !== 'all' || tagFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setTagFilter('');
            }}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear all
          </Button>
        )}
      </div>

      {/* Workspaces Table */}
      {paginatedWorkspaces.length > 0 ? (
        <div className="border rounded-lg border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border/40">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">Workspace Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">Run Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">Repo</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">Latest Change</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedWorkspaces.map((workspace) => (
                  <tr
                    key={workspace.id}
                    className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/app/${selectedOrg}/workspaces/${workspace.name}`}
                        className="flex items-center gap-2 group"
                      >
                        {workspace.locked ? (
                          <Lock className="h-4 w-4 text-orange-500 dark:text-orange-400 group-hover:text-orange-600 dark:group-hover:text-orange-300 transition-colors" />
                        ) : (
                          <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                        <div>
                          <div className="font-medium group-hover:text-primary transition-colors">
                            {workspace.name}
                          </div>
                          {workspace.project && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {workspace.project.name}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {getRunStatusBadge(workspace.latestRun)}
                    </td>
                    <td className="px-4 py-3">
                      {workspace.vcs_repository ? (() => {
                        const repoUrl = getVcsRepoUrl(workspace.vcs_provider ?? '', workspace.vcs_repository ?? '', workspace.vcs_account_name);
                        return repoUrl ? (
                          <a
                            href={repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-foreground hover:underline group"
                          >
                            {getVcsProviderIcon(workspace.vcs_provider ?? '', 'h-3.5 w-3.5')}
                            <span className="truncate max-w-[200px]">{workspace.vcs_repository}</span>
                            <ExternalLink className="h-3 w-3 text-blue-500 dark:text-blue-400 shrink-0" />
                          </a>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-foreground">
                            {getVcsProviderIcon(workspace.vcs_provider ?? '', 'h-3.5 w-3.5')}
                            <span className="truncate max-w-[200px]">{workspace.vcs_repository}</span>
                          </span>
                        );
                      })() : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimeAgo(getLatestChangeTime(workspace))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/organizations/${selectedOrg}/workspaces/${workspace.name}`}>
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setWorkspaceToEdit(workspace);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setWorkspaceToDelete(workspace);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5 backdrop-blur-md border border-white/20 dark:border-white/10">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="text-xl font-semibold mb-2">No workspaces found</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters to see more results'
                  : 'Create your first workspace to start managing infrastructure'}
              </p>
              {!searchQuery && statusFilter === 'all' && selectedOrg && (
                <Button 
                  onClick={() => setCreateDialogOpen(true)} 
                  className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                >
                  <Plus className="h-4 w-4" />
                  Create Workspace
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredWorkspaces.length)} of {filteredWorkspaces.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Workspace Dialog */}
      {orgName && (
        <CreateWorkspaceDialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) {
              // Refresh workspaces when dialog closes (with full enrichment)
              void fetchWorkspaces(false);
            }
          }}
          orgName={orgName}
        />
      )}

      {/* Edit Workspace Dialog */}
      {orgName && workspaceToEdit && (
        <EditWorkspaceDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setWorkspaceToEdit(null);
              // Refresh workspaces when dialog closes (with full enrichment)
              void fetchWorkspaces(false);
            }
          }}
          orgName={orgName}
          workspace={workspaceToEdit}
          onUpdated={() => {
            // Refresh workspaces after update (with full enrichment)
            void fetchWorkspaces(false);
          }}
        />
      )}

      {/* Delete Workspace Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setForceDeleteMode(false);
          setDeleteConfirmName('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{forceDeleteMode ? 'Force Delete Workspace' : 'Delete Workspace'}</DialogTitle>
            <DialogDescription>
              {forceDeleteMode ? (
                <>
                  This workspace has active infrastructure. Force deleting will remove the workspace and all its data <strong>without</strong> destroying the managed resources. 
                  This may leave orphaned infrastructure in your cloud provider.
                  <br /><br />
                  Type <strong>{workspaceToDelete?.name}</strong> to confirm.
                </>
              ) : (
                <>
                  Are you sure you want to delete the workspace &quot;{workspaceToDelete?.name}&quot;? 
                  This action cannot be undone and will delete all associated runs, state versions, and variables.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {forceDeleteMode && (
            <div className="py-2">
              <Input
                placeholder={workspaceToDelete?.name}
                value={deleteConfirmName}
                onChange={(e) => { setDeleteConfirmName(e.target.value); }}
                autoFocus
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setForceDeleteMode(false); setDeleteConfirmName(''); }} disabled={deleting}>
              Cancel
            </Button>
            {forceDeleteMode ? (
              <Button
                variant="destructive"
                onClick={() => { void handleDeleteWorkspace(true); }}
                disabled={deleting || deleteConfirmName !== workspaceToDelete?.name}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Force Delete
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => { void handleDeleteWorkspace(); }} disabled={deleting}>
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
