// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMountEffect } from '@/hooks/useMountEffect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  ansiblePlaybooksApi, 
  ansibleJobTemplatesApi,
  ansibleJobsApi,
  type AnsibleJob,
} from '@/api/ansible';
import { vcsConnectionsApi } from '@/api/client';
import {
  getAnsiblePlaybookFromJsonApi,
  getAnsibleJobTemplateFromJsonApi,
  getAnsibleJobFromJsonApi,
} from '@/utils/ansible-jsonapi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { YamlViewer } from '@/components/code/YamlViewer';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon, getVcsProviderLabel, getVcsRepoUrl, getVcsBranchUrl, getVcsFileUrl, getVcsCommitUrl, getVcsManageUrl } from '@/lib/vcs';
import { VCSProviderSelector } from '@/components/vcs/VCSProviderSelector';
import { VCSProjectSelect } from '@/components/vcs/VCSProjectSelect';
import {
  ArrowLeft,
  FileText,
  Loader2,
  GitBranch,
  RefreshCw,
  FolderGit2,
  Clock,
  Edit,
  Trash2,
  Layers,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Code,
  Ban,
  Plus,
  CheckCircle2,
  WifiOff,
  CircleDot,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

// Helper functions for job display
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

function formatDuration(startedAt?: string, finishedAt?: string) {
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
}

function getStatusIcon(status: string) {
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
}

function getStatusColor(status: string) {
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
}

function hasWarnings(job: AnsibleJob): boolean {
  return job.has_warnings || false;
}

export default function PlaybookDetail() {
  const { orgName, playbookId } = useParams<{ orgName: string; playbookId: string }>();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  
  // File content state
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentLoading, setFileContentLoading] = useState(false);
  const [fileContentError, setFileContentError] = useState<string | null>(null);
  
  // Edit playbook state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playbookPathSelectOpen, setPlaybookPathSelectOpen] = useState(false);
  const [playbookPathSearch, setPlaybookPathSearch] = useState('');
  const playbookPathSearchInputRef = useRef<HTMLInputElement>(null);

  // VCS Integration state (mirrors create view)
  const [selectedVcsProject, setSelectedVcsProject] = useState<string>('');
  const [repositorySearch, setRepositorySearch] = useState('');
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);
  
  const [editForm, setEditForm] = useState({ 
    name: '', 
    description: '',
    vcs_connection_id: '',
    vcs_repository: '',
    vcs_branch: '',
    playbook_path: '',
  });
  
  // Delete playbook state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Sync state
  const [syncing, setSyncing] = useState(false);
  const syncPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch playbook details
  const { isLoading: loading, data: playbookData, refetch: refetchPlaybook } = useQuery({
    queryKey: ['playbookDetail', playbookId, orgName],
    queryFn: async () => {
      const pbRes = await ansiblePlaybooksApi.get(playbookId!);
      const pb = getAnsiblePlaybookFromJsonApi(pbRes.data);
      setEditForm({ 
        name: pb.name, 
        description: pb.description || '',
        vcs_connection_id: pb.vcs_connection_id || '',
        vcs_repository: pb.vcs_repository || '',
        vcs_branch: pb.vcs_branch || 'main',
        playbook_path: pb.playbook_path || 'site.yml',
      });

      const [templatesRes, jobsRes] = await Promise.all([
        ansibleJobTemplatesApi.listByOrganization(orgName!),
        ansibleJobsApi.listByOrganization(orgName!),
      ]);
      const relatedTemplates = (templatesRes.data || []).map(getAnsibleJobTemplateFromJsonApi).filter(t => t.playbook_id === playbookId);
      const relatedJobs = (jobsRes.data || []).map(getAnsibleJobFromJsonApi)
        .filter(j => j.playbook_id === playbookId)
        .slice(0, 10);
      return { playbook: pb, templates: relatedTemplates, recentJobs: relatedJobs };
    },
    enabled: !!playbookId && !!orgName,
  });

  const playbook = playbookData?.playbook ?? null;
  const templates = playbookData?.templates ?? [];
  const recentJobs = playbookData?.recentJobs ?? [];

  // Cleanup polling interval on unmount
  useMountEffect(() => {
    return () => {
      if (syncPollIntervalRef.current) {
        clearInterval(syncPollIntervalRef.current);
        syncPollIntervalRef.current = null;
      }
    };
  });

  // VCS cascade for the edit dialog (connection -> repositories -> branches ->
  // YAML files), loaded via React Query. Each query is scoped to the dialog being
  // open and the relevant selection, so stale data clears automatically when a
  // selection is reset — no synchronous reset-in-effect needed.
  const [pbOwner, pbRepo] = (editForm.vcs_repository || '').split('/');

  const { data: vcsConnections = [], isLoading: loadingVCS } = useQuery({
    queryKey: ['pb-edit-vcs', selectedOrg],
    queryFn: async () => {
      try {
        const vcsRes = await vcsConnectionsApi.list(selectedOrg);
        const connections = Array.isArray(vcsRes) ? vcsRes : [];
        return Array.from(
          new Map(
            connections.map((conn) => [`${conn.provider}-${conn.account_name}-${conn.account_type}`, conn]),
          ).values(),
        );
      } catch (err) {
        console.error('Failed to load VCS connections:', err);
        toast.error('Failed to load VCS connections');
        return [];
      }
    },
    enabled: editDialogOpen && !!selectedOrg,
  });

  const { data: repositories = [], isLoading: loadingRepos } = useQuery({
    queryKey: ['pb-edit-repos', editForm.vcs_connection_id, selectedVcsProject],
    queryFn: async () => {
      try {
        return (await vcsConnectionsApi.listAllRepositories(editForm.vcs_connection_id, selectedVcsProject || undefined)) || [];
      } catch (err) {
        console.error('Failed to load repositories:', err);
        toast.error('Failed to load repositories');
        return [];
      }
    },
    enabled: editDialogOpen && !!editForm.vcs_connection_id,
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['pb-edit-branches', editForm.vcs_connection_id, editForm.vcs_repository],
    queryFn: async () => {
      try {
        return (await vcsConnectionsApi.listBranches(editForm.vcs_connection_id, pbOwner, pbRepo)) || [];
      } catch (err) {
        console.error('Failed to load branches:', err);
        toast.error('Failed to load branches');
        return [];
      }
    },
    enabled: editDialogOpen && !!editForm.vcs_connection_id && !!pbOwner && !!pbRepo,
  });

  const { data: yamlFiles = [], isLoading: loadingYamlFiles } = useQuery({
    queryKey: ['pb-edit-yaml', editForm.vcs_connection_id, editForm.vcs_repository, editForm.vcs_branch],
    queryFn: async () => {
      try {
        return (await vcsConnectionsApi.listYamlFiles(editForm.vcs_connection_id, pbOwner, pbRepo, editForm.vcs_branch)) || [];
      } catch (err) {
        // Silent — fall back to manual input
        console.error('Failed to load YAML files:', err);
        return [];
      }
    },
    enabled: editDialogOpen && !!editForm.vcs_connection_id && !!editForm.vcs_repository && !!editForm.vcs_branch && !!pbOwner && !!pbRepo,
  });

  // Auto-focus search input when repository select opens
  useEffect(() => {
    if (repositorySelectOpen && repositorySearchInputRef.current) {
      setTimeout(() => {
        repositorySearchInputRef.current?.focus();
      }, 100);
    }
  }, [repositorySelectOpen]);

  // Auto-focus search input when playbook path select opens
  useEffect(() => {
    if (playbookPathSelectOpen && playbookPathSearchInputRef.current) {
      setTimeout(() => {
        playbookPathSearchInputRef.current?.focus();
      }, 100);
    }
  }, [playbookPathSelectOpen]);

  const handleUpdate = async () => {
    if (!playbook || !editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      await ansiblePlaybooksApi.update(playbook.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        vcs_connection_id: editForm.vcs_connection_id || undefined,
        vcs_repository: editForm.vcs_repository || undefined,
        vcs_branch: editForm.vcs_branch || undefined,
        playbook_path: editForm.playbook_path || undefined,
      });
      setEditDialogOpen(false);
      toast.success('Playbook updated successfully');
      void refetchPlaybook();
    } catch (err: unknown) {
      console.error('Failed to update playbook:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update playbook');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!playbook) return;

    setDeleting(true);
    try {
      await ansiblePlaybooksApi.delete(playbook.id);
      toast.success('Playbook deleted successfully');
      void Promise.resolve(navigate(`/app/${orgName}/ansible/playbooks`));
    } catch (err: unknown) {
      console.error('Failed to delete playbook:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete playbook');
    } finally {
      setDeleting(false);
    }
  };

  const handleSync = async () => {
    if (!playbook) return;

    // Clear any existing polling interval
    if (syncPollIntervalRef.current) {
      clearInterval(syncPollIntervalRef.current);
      syncPollIntervalRef.current = null;
    }

    setSyncing(true);
    try {
      // Start the sync
      await ansiblePlaybooksApi.sync(playbook.id);
      void refetchPlaybook();

      // Poll the playbook until sync status changes from "syncing"
      syncPollIntervalRef.current = setInterval(() => {
        void (async () => {
          try {
            const pollRes = await ansiblePlaybooksApi.get(playbook.id);
            const polledPlaybook = getAnsiblePlaybookFromJsonApi(pollRes.data);
            void refetchPlaybook();

          // Stop polling if sync is complete (not "syncing")
          if (polledPlaybook.last_sync_status !== 'syncing') {
            if (syncPollIntervalRef.current) {
              clearInterval(syncPollIntervalRef.current);
              syncPollIntervalRef.current = null;
            }
            setSyncing(false);
            
            if (polledPlaybook.last_sync_status === 'successful') {
              toast.success('Playbook synced from VCS');
            } else if (polledPlaybook.last_sync_status === 'failed') {
              toast.error('Playbook sync failed');
            }
          }
          } catch (err) {
            console.error('Failed to poll playbook status:', err);
              if (syncPollIntervalRef.current) {
                clearInterval(syncPollIntervalRef.current);
                syncPollIntervalRef.current = null;
              }
              setSyncing(false);
            }
          })();
        }, 1000); // Poll every 1 second

      // Cleanup: stop polling after 60 seconds max (timeout)
      setTimeout(() => {
        if (syncPollIntervalRef.current) {
          clearInterval(syncPollIntervalRef.current);
          syncPollIntervalRef.current = null;
        }
        setSyncing(false);
      }, 60000);
    } catch (err: unknown) {
      console.error('Failed to sync playbook:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to sync playbook');
      setSyncing(false);
    }
  };

  // Load file content when switching to content tab
  const loadFileContent = async () => {
    if (!playbook || !playbook.vcs_connection_id || !playbook.vcs_repository) return;
    
    setFileContentLoading(true);
    setFileContentError(null);
    try {
      // Parse owner/repo from vcs_repository
      const [owner, repo] = playbook.vcs_repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format');
      }
      
      const res = await vcsConnectionsApi.getFileContent(
        playbook.vcs_connection_id,
        owner,
        repo,
        playbook.playbook_path,
        playbook.vcs_branch
      );
      setFileContent(res.content);
    } catch (err: unknown) {
      console.error('Failed to load file content:', err);
      setFileContentError(err instanceof Error ? err.message : 'Failed to load file content');
    } finally {
      setFileContentLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'content' && !fileContent && !fileContentLoading) {
      void loadFileContent();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!playbook) {
    return (
      <div className="container py-6">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Playbook Not Found</h3>
          <p className="text-muted-foreground mb-4">
            The playbook you're looking for doesn't exist or was deleted.
          </p>
          <Button asChild>
            <Link to={`/app/${orgName}/ansible/playbooks`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Playbooks
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/app/${orgName}/ansible/playbooks`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <h1 className="text-2xl font-bold">{playbook.name}</h1>
              {playbook.vcs_connection_id && (
                <Badge variant="outline">VCS</Badge>
              )}
            </div>
            {playbook.description && (
              <p className="text-muted-foreground mt-1">{playbook.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void handleSync(); }}
            disabled={syncing || !playbook.vcs_connection_id}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync from VCS
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">
            <Code className="h-4 w-4 mr-1" />
            Content
          </TabsTrigger>
          <TabsTrigger value="templates">
            Job Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="jobs">
            Recent Jobs ({recentJobs.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VCS Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {getVcsProviderIcon(playbook.vcs_provider ?? '', 'h-5 w-5')}
                  {playbook.vcs_provider ? `${getVcsProviderLabel(playbook.vcs_provider)} Configuration` : 'VCS Configuration'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const provider = playbook.vcs_provider ?? '';
                  const accountName = playbook.vcs_account_name;
                  const repo = playbook.vcs_repository ?? '';
                  const branch = playbook.vcs_branch || 'main';
                  const repoUrl = getVcsRepoUrl(provider, repo, accountName);
                  const branchUrl = getVcsBranchUrl(provider, repo, branch, accountName);
                  const fileUrl = playbook.playbook_path ? getVcsFileUrl(provider, repo, branch, playbook.playbook_path, accountName) : null;
                  return (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Repository</p>
                        {repo ? (
                          repoUrl ? (
                            <a href={repoUrl} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-sm text-foreground hover:underline flex items-center gap-1">
                              {repo}<ExternalLink className="h-3 w-3 text-blue-500" />
                            </a>
                          ) : (
                            <p className="font-mono text-sm text-foreground">{repo}</p>
                          )
                        ) : (
                          <p className="font-mono text-sm text-muted-foreground">Not configured</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Branch</p>
                        {repo ? (
                          branchUrl ? (
                            <a href={branchUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-foreground hover:underline">
                              <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              <span>{branch}</span>
                              <ExternalLink className="h-3 w-3 text-blue-500" />
                            </a>
                          ) : (
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              <span>{branch}</span>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>{branch}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Playbook Path</p>
                        {repo && fileUrl ? (
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-sm text-foreground hover:underline flex items-center gap-1">
                            {playbook.playbook_path}<ExternalLink className="h-3 w-3 text-blue-500" />
                          </a>
                        ) : (
                          <p className="font-mono text-sm">{playbook.playbook_path}</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Sync Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Sync Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    {playbook.last_sync_status === 'successful' && (
                      <Badge variant="outline" className="flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                        <CheckCircle className="h-3 w-3" />
                        Synced
                      </Badge>
                    )}
                    {playbook.last_sync_status === 'syncing' && (
                      <Badge variant="outline" className="flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Syncing...
                      </Badge>
                    )}
                    {playbook.last_sync_status === 'failed' && (
                      <Badge variant="outline" className="flex items-center gap-1 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                        <XCircle className="h-3 w-3" />
                        Failed
                      </Badge>
                    )}
                    {!playbook.last_sync_status && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Never synced
                      </Badge>
                    )}
                  </div>
                </div>
                {playbook.last_sync_error && (
                  <div>
                    <p className="text-sm text-muted-foreground">Error</p>
                    <p className="text-sm text-red-500">{playbook.last_sync_error}</p>
                  </div>
                )}
                {playbook.last_sync_commit && (
                  <div>
                    <p className="text-sm text-muted-foreground">Last Commit</p>
                    {playbook.vcs_repository ? (() => {
                      const commitUrl = getVcsCommitUrl(playbook.vcs_provider ?? '', playbook.vcs_repository ?? '', playbook.last_sync_commit ?? '', playbook.vcs_account_name);
                      return commitUrl ? (
                        <a
                          href={commitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-foreground hover:underline flex items-center gap-1"
                        >
                          {playbook.last_sync_commit.substring(0, 8)}
                          <ExternalLink className="h-3 w-3 text-blue-500" />
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-foreground">{playbook.last_sync_commit.substring(0, 8)}</span>
                      );
                    })() : (
                      <p className="font-mono text-xs">{playbook.last_sync_commit.substring(0, 8)}</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Last Synced</p>
                  <p>{playbook.last_synced_at ? formatRelativeTime(playbook.last_synced_at) : 'Never'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{formatRelativeTime(playbook.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Updated</p>
                  <p>{formatRelativeTime(playbook.updated_at)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold">{templates.length}</p>
                  <p className="text-sm text-muted-foreground">Job Templates</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{recentJobs.length}</p>
                  <p className="text-sm text-muted-foreground">Recent Jobs</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {recentJobs.filter(j => j.status === 'successful').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Successful</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  {playbook.playbook_path}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { void loadFileContent(); }}
                  disabled={fileContentLoading || !playbook.vcs_connection_id}
                >
                  {fileContentLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!playbook.vcs_connection_id ? (
                <div className="text-center py-12">
                  <FolderGit2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">No VCS Connection</h3>
                  <p className="text-muted-foreground">
                    This playbook is not connected to a VCS repository.
                  </p>
                </div>
              ) : fileContentLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : fileContentError ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                  <h3 className="text-lg font-semibold">Failed to Load Content</h3>
                  <p className="text-muted-foreground">{fileContentError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { void loadFileContent(); }}
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : fileContent ? (
                <YamlViewer 
                  content={fileContent}
                  maxHeight="600px"
                  showLineNumbers={true}
                  showCopyButton={true}
                  showWrapToggle={true}
                />
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Click the Content tab to load the playbook file.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Job Templates Tab */}
        <TabsContent value="templates">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No Job Templates</h3>
                <p className="text-muted-foreground mb-4">
                  No job templates are using this playbook yet.
                </p>
                <Button asChild>
                  <Link to={`/app/${orgName}/ansible/job-templates`}>
                    View Job Templates
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Link
                          to={`/app/${orgName}/ansible/job-templates/${template.id}`}
                          className="font-medium hover:underline"
                        >
                          {template.name}
                        </Link>
                        {template.description && (
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{template.verbosity}</Badge>
                        <Badge variant="outline">{template.forks} forks</Badge>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/app/${orgName}/ansible/job-templates/${template.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recent Jobs Tab */}
        <TabsContent value="jobs">
          {recentJobs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Play className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                <h3 className="text-lg font-semibold">No Jobs Yet</h3>
                <p className="text-muted-foreground">
                  No jobs have been run using this playbook.
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Link
                          to={`/app/${orgName}/ansible/jobs/${job.id}`}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Playbook</DialogTitle>
            <DialogDescription>
              Update the playbook configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Playbook name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            {/* VCS Connection */}
            <div className="space-y-2">
              <Label>VCS Connection *</Label>
              {loadingVCS ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading VCS connections...
                </div>
              ) : vcsConnections.length === 0 ? (
                <VCSProviderSelector
                  orgName={selectedOrg}
                  selectedConnectionId={undefined}
                  onConnectionSelect={(id) => {
                    setSelectedVcsProject('');
                    setEditForm({
                      ...editForm,
                      vcs_connection_id: id || '',
                      vcs_repository: '',
                      vcs_branch: '',
                      playbook_path: '',
                    });
                  }}
                  showConfigureOption={false}
                />
              ) : (
                <div className="space-y-2">
                  {vcsConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className={cn(
                        'p-3 border-2 rounded-lg cursor-pointer transition-all',
                        editForm.vcs_connection_id === conn.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                      )}
                      onClick={() => {
                        const newValue = editForm.vcs_connection_id === conn.id ? '' : conn.id;
                        setSelectedVcsProject('');
                        setEditForm({
                          ...editForm,
                          vcs_connection_id: newValue,
                          vcs_repository: '',
                          vcs_branch: '',
                          playbook_path: '',
                        });
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getVcsProviderIcon(conn.provider, 'h-4 w-4')}
                          <span className="text-sm font-medium">
                            {getVcsProviderLabel(conn.provider)} - {conn.account_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {conn.account_type}
                          </Badge>
                        </div>
                        {editForm.vcs_connection_id === conn.id && (
                          <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { window.open(`/app/${selectedOrg}/settings/vcs-connections`, '_blank'); }}
                    className="w-full text-xs"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Connect to a different VCS
                  </Button>
                </div>
              )}
            </div>

            {/* Project Selector (Azure DevOps only) */}
            {editForm.vcs_connection_id && (
              <VCSProjectSelect
                connectionId={editForm.vcs_connection_id}
                provider={vcsConnections.find(c => c.id === editForm.vcs_connection_id)?.provider}
                value={selectedVcsProject}
                onChange={(project) => {
                  setSelectedVcsProject(project);
                  setEditForm(prev => ({ ...prev, vcs_repository: '', vcs_branch: '', playbook_path: '' }));
                }}
              />
            )}

            {/* Repository Selector */}
            {editForm.vcs_connection_id && (
              <div className="space-y-2">
                <Label>Repository *</Label>
                {loadingRepos ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading repositories...
                  </div>
                ) : repositories.length === 0 ? (
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>No repositories found for this installation.</p>
                    {(() => {
                      const conn = vcsConnections.find(c => c.id === editForm.vcs_connection_id);
                      const manageUrl = getVcsManageUrl(conn?.provider ?? '', conn?.installation_id ?? '', conn?.account_name ?? '', conn?.account_type ?? '');
                      return manageUrl ? (
                        <a
                          href={manageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          Configure installation repository access on GitHub
                        </a>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <Select
                    value={editForm.vcs_repository}
                    onValueChange={(value) => {
                      setEditForm({ ...editForm, vcs_repository: value, vcs_branch: '', playbook_path: '' });
                    }}
                    open={repositorySelectOpen}
                    onOpenChange={setRepositorySelectOpen}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a repository" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="p-2 border-b sticky top-0 bg-background z-10">
                        <Input
                          ref={repositorySearchInputRef}
                          placeholder="Search repositories..."
                          value={repositorySearch}
                          onChange={(e) => {
                            setRepositorySearch(e.target.value);
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-8"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-[250px] overflow-y-auto">
                        {repositories
                          .filter((repo) =>
                            repo.full_name.toLowerCase().includes(repositorySearch.toLowerCase())
                          )
                          .map((repo) => (
                            <SelectItem key={repo.id} value={repo.full_name}>
                              <div className="flex items-center gap-2">
                                {getVcsProviderIcon(vcsConnections.find(c => c.id === editForm.vcs_connection_id)?.provider ?? '', 'h-4 w-4')}
                                <span>{repo.full_name}</span>
                                {repo.private && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    Private
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        {repositories.filter((repo) =>
                          repo.full_name.toLowerCase().includes(repositorySearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No repositories found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Branch Selector */}
            {editForm.vcs_repository && (
              <div className="space-y-2">
                <Label>Branch *</Label>
                {loadingBranches ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading branches...
                  </div>
                ) : (
                  <Select
                    value={editForm.vcs_branch}
                    onValueChange={(value) => setEditForm({ ...editForm, vcs_branch: value, playbook_path: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.name} {branch.protected ? '(Protected)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Playbook Path */}
            {editForm.vcs_connection_id && editForm.vcs_repository && editForm.vcs_branch && (
              <div className="space-y-2">
                <Label htmlFor="playbook_path">Playbook Path</Label>
                {loadingYamlFiles ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading playbook files...
                  </div>
                ) : yamlFiles.length > 0 ? (
                  <Select
                    value={editForm.playbook_path}
                    onValueChange={(value) => setEditForm({ ...editForm, playbook_path: value })}
                    open={playbookPathSelectOpen}
                    onOpenChange={setPlaybookPathSelectOpen}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a playbook file" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="p-2 border-b sticky top-0 bg-background z-10">
                        <Input
                          ref={playbookPathSearchInputRef}
                          placeholder="Search playbook files..."
                          value={playbookPathSearch}
                          onChange={(e) => {
                            setPlaybookPathSearch(e.target.value);
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-8"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-[250px] overflow-y-auto">
                        {yamlFiles
                          .filter((file) =>
                            file.toLowerCase().includes(playbookPathSearch.toLowerCase())
                          )
                          .map((file) => (
                            <SelectItem key={file} value={file}>
                              {file}
                            </SelectItem>
                          ))}
                        {yamlFiles.filter((file) =>
                          file.toLowerCase().includes(playbookPathSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No playbook files found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="playbook_path"
                    value={editForm.playbook_path}
                    onChange={(e) => setEditForm({ ...editForm, playbook_path: e.target.value })}
                    placeholder="site.yml"
                  />
                )}
                {yamlFiles.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Select a playbook file from the repository ({yamlFiles.length} found)
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleUpdate(); }} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Playbook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{playbook.name}"? This action cannot be undone.
              Any job templates using this playbook will be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Playbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
