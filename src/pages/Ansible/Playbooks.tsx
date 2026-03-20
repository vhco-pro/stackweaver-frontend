// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ansiblePlaybooksApi, type AnsiblePlaybook } from '@/api/ansible';
import { getAnsiblePlaybookFromJsonApi } from '@/utils/ansible-jsonapi';
import { vcsConnectionsApi, type VCSConnection, type Repository, type Branch } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Search,
  Plus,
  MoreVertical,
  Trash2,
  Loader2,
  GitBranch,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon, getVcsProviderLabel, getVcsRepoUrl, getVcsBranchUrl, getVcsFileUrl, getVcsManageUrl } from '@/lib/vcs';

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

export default function Playbooks() {
  const { orgName } = useParams<{ orgName: string }>();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playbookToDelete, setPlaybookToDelete] = useState<AnsiblePlaybook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loadingYamlFiles, setLoadingYamlFiles] = useState(false);
  const [yamlFiles, setYamlFiles] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [nameTouched, setNameTouched] = useState(false); // Track if user has touched the name field

  // VCS Integration state (mirrors CreateWorkspaceDialog pattern)
  const [loadingVCS, setLoadingVCS] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [vcsConnections, setVcsConnections] = useState<VCSConnection[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [repositorySearch, setRepositorySearch] = useState('');
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);
  const [playbookPathSelectOpen, setPlaybookPathSelectOpen] = useState(false);
  const [playbookPathSearch, setPlaybookPathSearch] = useState('');
  const playbookPathSearchInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    vcs_connection_id: '',
    vcs_repository: '',
    vcs_branch: '',
    playbook_path: 'site.yml',
  });

  // Fetch playbooks
  const playbooksQueryKey = ['playbooks', selectedOrg];
  const { data: playbooks = [], isLoading: loading } = useQuery({
    queryKey: playbooksQueryKey,
    queryFn: async () => {
      const res = await ansiblePlaybooksApi.listByOrganization(selectedOrg);
      return (res.data || []).map(getAnsiblePlaybookFromJsonApi);
    },
    enabled: !!selectedOrg,
  });

  // Check for pending dialog after GitHub auth redirect
  useEffect(() => {
    const pendingDialog = localStorage.getItem('pendingPlaybookDialog');
    if (pendingDialog) {
      try {
        const parsed = JSON.parse(pendingDialog) as { orgName: string; timestamp: number };
        const { orgName: pendingOrg, timestamp } = parsed;
        // Only reopen if it's recent (within last 5 minutes) and matches current org
        if (Date.now() - timestamp < 5 * 60 * 1000 && pendingOrg === selectedOrg) {
          setCreateDialogOpen(true);
          localStorage.removeItem('pendingPlaybookDialog');
        } else {
          localStorage.removeItem('pendingPlaybookDialog');
        }
      } catch (err) {
        console.error('Failed to parse pending dialog state:', err);
        localStorage.removeItem('pendingPlaybookDialog');
      }
    }
  }, [selectedOrg]);

  // Load VCS connections when dialog opens
  useEffect(() => {
    if (!createDialogOpen || !selectedOrg) return;

    setLoadingVCS(true);
    void vcsConnectionsApi.list(selectedOrg)
      .then((vcsRes) => {
        const connections = Array.isArray(vcsRes) ? vcsRes : [];
        // Deduplicate by provider + account_name + account_type
        const uniqueConnections = Array.from(
          new Map(
            connections.map(conn => [
              `${conn.provider}-${conn.account_name}-${conn.account_type}`,
              conn
            ])
          ).values()
        );
        setVcsConnections(uniqueConnections);

        // Auto-select if there's exactly one VCS connection
        if (uniqueConnections.length === 1 && !createForm.vcs_connection_id) {
          setCreateForm(prev => ({
            ...prev,
            vcs_connection_id: uniqueConnections[0].id,
          }));
        }
      })
      .catch((err) => {
        console.error('Failed to load VCS connections:', err);
        toast.error('Failed to load VCS connections');
      })
      .finally(() => {
        setLoadingVCS(false);
      });
    // createForm.vcs_connection_id is intentionally omitted - createForm object changes would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDialogOpen, selectedOrg]);

  // Load repositories when VCS connection is selected
  useEffect(() => {
    if (!createForm.vcs_connection_id || !createDialogOpen) {
      setRepositories([]);
      setBranches([]);
      return;
    }

    setLoadingRepos(true);
    vcsConnectionsApi.listRepositories(createForm.vcs_connection_id, 1, 100)
      .then((repos) => {
        setRepositories(repos || []);
      })
      .catch((err) => {
        console.error('Failed to load repositories:', err);
        toast.error('Failed to load repositories');
      })
      .finally(() => {
        setLoadingRepos(false);
      });
  }, [createForm.vcs_connection_id, createDialogOpen]);

  // Load branches when repository is selected
  useEffect(() => {
    if (!createForm.vcs_repository || !createForm.vcs_connection_id || !createDialogOpen) {
      setBranches([]);
      return;
    }

    const [owner, repo] = createForm.vcs_repository.split('/');
    if (!owner || !repo) return;

    setLoadingBranches(true);
    vcsConnectionsApi.listBranches(createForm.vcs_connection_id, owner, repo)
      .then((brs) => {
        setBranches(brs || []);
        // Set default branch if available
        const repoObj = repositories.find(r => r.full_name === createForm.vcs_repository);
        const defaultBranch = repoObj?.default_branch;
        if (defaultBranch && (brs || []).some(b => b.name === defaultBranch)) {
          setCreateForm(prev => ({ ...prev, vcs_branch: defaultBranch }));
        } else if (brs && brs.length > 0) {
          setCreateForm(prev => ({ ...prev, vcs_branch: brs[0].name }));
        }
      })
      .catch((err) => {
        console.error('Failed to load branches:', err);
        toast.error('Failed to load branches');
      })
      .finally(() => {
        setLoadingBranches(false);
      });
  }, [createForm.vcs_repository, createForm.vcs_connection_id, createDialogOpen, repositories]);

  // Load YAML files when repository and branch are selected
  useEffect(() => {
    if (!createForm.vcs_connection_id || !createForm.vcs_repository || !createForm.vcs_branch || !createDialogOpen) {
      setYamlFiles([]);
      return;
    }

    const [owner, repo] = createForm.vcs_repository.split('/');
    if (!owner || !repo) return;

    setLoadingYamlFiles(true);
    vcsConnectionsApi.listYamlFiles(createForm.vcs_connection_id, owner, repo, createForm.vcs_branch)
      .then((files) => {
        setYamlFiles(files || []);
      })
      .catch((err) => {
        console.error('Failed to load YAML files:', err);
        // Don't show error toast - just continue with manual input
        setYamlFiles([]);
      })
      .finally(() => {
        setLoadingYamlFiles(false);
      });
  }, [createForm.vcs_connection_id, createForm.vcs_repository, createForm.vcs_branch, createDialogOpen]);

  // Auto-focus search input when repository select opens
  useEffect(() => {
    if (repositorySelectOpen && repositorySearchInputRef.current) {
      setTimeout(() => {
        repositorySearchInputRef.current?.focus();
      }, 100);
    }
  }, [repositorySelectOpen]);

  // Auto-generate name from repo-branch-path if user hasn't touched the name field
  useEffect(() => {
    if (nameTouched || !createForm.vcs_repository) return;

    const repoName = createForm.vcs_repository.split('/').pop() || '';
    const branch = createForm.vcs_branch || '';
    const path = createForm.playbook_path?.replace(/\.ya?ml$/i, '').replace(/\//g, '-') || '';

    // Generate name: repo-branch-path (e.g., "my-repo-main-site" or "my-repo-main-playbooks-deploy")
    const parts = [repoName];
    if (branch) parts.push(branch);
    if (path && path !== 'site') parts.push(path);

    const autoName = parts.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    setCreateForm(prev => ({ ...prev, name: autoName }));
  }, [createForm.vcs_repository, createForm.vcs_branch, createForm.playbook_path, nameTouched]);

  // Filter playbooks
  const filteredPlaybooks = playbooks.filter((pb) =>
    pb.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pb.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pb.playbook_path?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (!playbookToDelete) return;

    setDeleting(true);
    try {
      await ansiblePlaybooksApi.delete(playbookToDelete.id);
      queryClient.setQueryData<AnsiblePlaybook[]>(playbooksQueryKey, (old) =>
        (old || []).filter((pb) => pb.id !== playbookToDelete.id)
      );
      setDeleteDialogOpen(false);
      setPlaybookToDelete(null);
      toast.success('Playbook deleted successfully');
    } catch (err: unknown) {
      console.error('Failed to delete playbook:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete playbook';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!createForm.vcs_connection_id || !createForm.vcs_repository || !createForm.vcs_branch) {
      toast.error('VCS connection, repository, and branch are required');
      return;
    }

    setCreating(true);
    try {
      const response = await ansiblePlaybooksApi.create(selectedOrg, {
        name: createForm.name,
        description: createForm.description || undefined,
        vcs_connection_id: createForm.vcs_connection_id,
        vcs_repository: createForm.vcs_repository,
        vcs_branch: createForm.vcs_branch,
        playbook_path: createForm.playbook_path || 'site.yml',
      });
      const newPlaybook = getAnsiblePlaybookFromJsonApi(response.data);
      queryClient.setQueryData<AnsiblePlaybook[]>(playbooksQueryKey, (old) =>
        [...(old || []), newPlaybook]
      );
      setCreateDialogOpen(false);
      resetCreateForm();
      toast.success('Playbook created successfully');
    } catch (err: unknown) {
      console.error('Failed to create playbook:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create playbook');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      description: '',
      vcs_connection_id: '',
      vcs_repository: '',
      vcs_branch: '',
      playbook_path: 'site.yml',
    });
    setNameTouched(false);
    setRepositorySearch('');
    setPlaybookPathSearch('');
    setYamlFiles([]);
  };

  const handleSync = async (playbook: AnsiblePlaybook) => {
    setSyncing(playbook.id);
    try {
      await ansiblePlaybooksApi.sync(playbook.id);
      toast.success('Playbook sync started');

      // Poll for updated playbook status (sync is async)
      let pollCount = 0;
      const maxPolls = 30; // 30 polls * 2 seconds = 60 seconds max
      const pollInterval = setInterval(() => {
        void (async () => {
          pollCount++;
          try {
          const refreshed = await ansiblePlaybooksApi.get(playbook.id);
          const updated = getAnsiblePlaybookFromJsonApi(refreshed.data);
          queryClient.setQueryData<AnsiblePlaybook[]>(playbooksQueryKey, (old) =>
            (old || []).map((pb) => (pb.id === playbook.id ? updated : pb))
          );

          // If sync is complete (not syncing anymore), stop polling
          if (updated.last_sync_status !== 'syncing') {
            clearInterval(pollInterval);
            setSyncing((prevSyncing) => (prevSyncing === playbook.id ? null : prevSyncing));
            if (updated.last_sync_status === 'successful') {
              toast.success('Playbook synced successfully');
            } else if (updated.last_sync_status === 'failed') {
              toast.error('Playbook sync failed');
            }
          } else if (pollCount >= maxPolls) {
            // Timeout - stop polling
            clearInterval(pollInterval);
            setSyncing((prevSyncing) => (prevSyncing === playbook.id ? null : prevSyncing));
          }
        } catch (err) {
          console.warn('Failed to refresh playbook after sync:', err);
          clearInterval(pollInterval);
          setSyncing((prevSyncing) => (prevSyncing === playbook.id ? null : prevSyncing));
        }
        })();
      }, 2000); // Poll every 2 seconds
    } catch (err: unknown) {
      console.error('Failed to sync playbook:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync playbook';
      toast.error(errorMessage);
      setSyncing(null);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      const redirectUrl = `${window.location.origin}/app/${selectedOrg}/ansible/playbooks`;
      const response = await vcsConnectionsApi.initiateInstallationWithRedirect(selectedOrg, redirectUrl);
      const installUrl = response?.install_url;

      if (installUrl) {
        localStorage.setItem('pendingPlaybookDialog', JSON.stringify({
          orgName: selectedOrg,
          timestamp: Date.now(),
        }));
        window.location.href = installUrl;
      } else {
        toast.error('Failed to get GitHub App installation URL');
      }
    } catch (error: unknown) {
      console.error('Failed to initiate GitHub App installation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to initiate GitHub App installation');
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Playbooks</h1>
          <p className="text-muted-foreground">
            Manage Ansible playbooks for {selectedOrg}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Playbook
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search playbooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Playbooks List */}
      {filteredPlaybooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No playbooks found</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {searchQuery
                ? 'No playbooks match your search criteria.'
                : 'No playbooks have been created yet. Click the button above to create your first playbook.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Playbook
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPlaybooks.map((playbook) => (
            <Card key={playbook.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                      <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/app/${selectedOrg}/ansible/playbooks/${playbook.id}`}
                        className="hover:underline"
                      >
                        <CardTitle className="text-lg truncate">
                          {playbook.name}
                        </CardTitle>
                      </Link>
                      {playbook.description && (
                        <CardDescription className="line-clamp-2 mt-1">
                          {playbook.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/app/${selectedOrg}/ansible/playbooks/${playbook.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      {playbook.vcs_connection_id && (
                        <DropdownMenuItem
                          onClick={() => { void handleSync(playbook); }}
                          disabled={syncing === playbook.id}
                        >
                          {syncing === playbook.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Sync from VCS
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setPlaybookToDelete(playbook);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {/* VCS Badge */}
                  {playbook.vcs_connection_id && playbook.vcs_provider && (
                    <Badge variant="outline" className="gap-1">
                      {getVcsProviderIcon(playbook.vcs_provider, 'h-3 w-3')}
                      {getVcsProviderLabel(playbook.vcs_provider)}
                    </Badge>
                  )}

                  {/* Playbook Path */}
                  {playbook.vcs_repository ? (() => {
                    const fileUrl = getVcsFileUrl(playbook.vcs_provider ?? '', playbook.vcs_repository ?? '', playbook.vcs_branch || 'main', playbook.playbook_path || 'site.yml', playbook.vcs_account_name);
                    return fileUrl ? (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground flex items-center gap-1 hover:text-foreground hover:underline"
                        onClick={(e) => e.stopPropagation()}>
                        <FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        {playbook.playbook_path || 'site.yml'}
                      </a>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        {playbook.playbook_path || 'site.yml'}
                      </span>
                    );
                  })() : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      {playbook.playbook_path || 'site.yml'}
                    </span>
                  )}

                  {/* Branch */}
                  {playbook.vcs_branch && playbook.vcs_repository ? (() => {
                    const branchUrl = getVcsBranchUrl(playbook.vcs_provider ?? '', playbook.vcs_repository ?? '', playbook.vcs_branch, playbook.vcs_account_name);
                    return branchUrl ? (
                      <a href={branchUrl} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground flex items-center gap-1 hover:text-foreground hover:underline"
                        onClick={(e) => e.stopPropagation()}>
                        <GitBranch className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        {playbook.vcs_branch}
                      </a>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <GitBranch className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        {playbook.vcs_branch}
                      </span>
                    );
                  })() : playbook.vcs_branch ? (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <GitBranch className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      {playbook.vcs_branch}
                    </span>
                  ) : null}

                  {/* Last Synced */}
                  {playbook.last_synced_at && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Synced {formatRelativeTime(playbook.last_synced_at)}
                    </span>
                  )}

                  {/* Created */}
                  <span className="text-muted-foreground">
                    Created {formatRelativeTime(playbook.created_at)}
                  </span>
                </div>

                {/* Repository info */}
                {playbook.vcs_repository && (() => {
                  const repoUrl = getVcsRepoUrl(playbook.vcs_provider ?? '', playbook.vcs_repository ?? '', playbook.vcs_account_name);
                  return (
                    <div className="mt-3 text-sm text-muted-foreground truncate">
                      <span className="font-medium">Repository:</span>{' '}
                      {repoUrl ? (
                        <a href={repoUrl} target="_blank" rel="noopener noreferrer"
                          className="hover:text-foreground hover:underline"
                          onClick={(e) => e.stopPropagation()}>
                          {playbook.vcs_repository}
                        </a>
                      ) : (
                        <span>{playbook.vcs_repository}</span>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Playbook Dialog - Uses VCS Integration like Terraform Workspaces */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Playbook</DialogTitle>
            <DialogDescription>
              Create a new Ansible playbook. Connect to a GitHub repository to sync your playbook files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => {
                  setNameTouched(true);
                  setCreateForm({ ...createForm, name: e.target.value });
                }}
                placeholder="my-ansible-playbook"
              />
              {!nameTouched && createForm.vcs_repository && (
                <p className="text-xs text-muted-foreground">
                  Auto-generated from repository, branch, and playbook path
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            {/* VCS Connection - Reuses same pattern as Terraform Workspaces */}
            <div className="space-y-2">
              <Label>VCS Connection *</Label>
              {loadingVCS ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading VCS connections...
                </div>
              ) : vcsConnections.length === 0 ? (
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <p className="text-sm text-muted-foreground mb-3">
                      No VCS connections configured. Connect a VCS provider in Settings to link repositories.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { void handleConnectGitHub(); }}
                        className="flex-1"
                      >
                        {getVcsProviderIcon('github', 'h-4 w-4 mr-2')}
                        Connect GitHub
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { void navigate(`/app/${selectedOrg}/settings/vcs`); }}
                        className="flex-1"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        VCS Settings
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {vcsConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className={cn(
                        'p-3 border-2 rounded-lg cursor-pointer transition-all',
                        createForm.vcs_connection_id === conn.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                      )}
                      onClick={() => {
                        const newValue = createForm.vcs_connection_id === conn.id ? '' : conn.id;
                        setCreateForm({
                          ...createForm,
                          vcs_connection_id: newValue,
                          vcs_repository: '',
                          vcs_branch: '',
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
                        {createForm.vcs_connection_id === conn.id && (
                          <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { void navigate(`/app/${selectedOrg}/settings/vcs`); }}
                    className="w-full text-xs"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Connect a different VCS provider
                  </Button>
                </div>
              )}
            </div>

            {/* Repository Selector */}
            {createForm.vcs_connection_id && (
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
                      const conn = vcsConnections.find(c => c.id === createForm.vcs_connection_id);
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
                    value={createForm.vcs_repository}
                    onValueChange={(value) => {
                      setCreateForm({ ...createForm, vcs_repository: value, vcs_branch: '' });
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
                                {getVcsProviderIcon(vcsConnections.find(c => c.id === createForm.vcs_connection_id)?.provider ?? '', 'h-4 w-4')}
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
            {createForm.vcs_repository && (
              <div className="space-y-2">
                <Label>Branch *</Label>
                {loadingBranches ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading branches...
                  </div>
                ) : (
                  <Select
                    value={createForm.vcs_branch}
                    onValueChange={(value) => setCreateForm({ ...createForm, vcs_branch: value })}
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
            {createForm.vcs_connection_id && createForm.vcs_repository && createForm.vcs_branch && (
              <div className="space-y-2">
                <Label htmlFor="playbook_path">Playbook Path</Label>
                {loadingYamlFiles ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading playbook files...
                  </div>
                ) : yamlFiles.length > 0 ? (
                  <Select
                    value={createForm.playbook_path}
                    onValueChange={(value) => setCreateForm({ ...createForm, playbook_path: value })}
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
                    value={createForm.playbook_path}
                    onChange={(e) => setCreateForm({ ...createForm, playbook_path: e.target.value })}
                    placeholder="site.yml or playbooks/main.yml"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {yamlFiles.length > 0
                    ? `Select a playbook file from the repository (${yamlFiles.length} found)`
                    : 'Path to the main playbook file within the repository (e.g., site.yml, playbooks/deploy.yml)'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => { void handleCreate(); }}
              disabled={creating || !createForm.name || !createForm.vcs_connection_id || !createForm.vcs_repository || !createForm.vcs_branch}
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Playbook
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
              Are you sure you want to delete "{playbookToDelete?.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setPlaybookToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
