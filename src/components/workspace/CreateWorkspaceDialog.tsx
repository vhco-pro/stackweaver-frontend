// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, GitBranch, Plus, CheckCircle2 } from 'lucide-react';
import { getVcsProviderIcon, getVcsProviderLabel, getVcsManageUrl } from '@/lib/vcs';
import { workspacesApi, vcsConnectionsApi, projectsApi, agentPoolsApi, terraformVersionsApi, type VCSConnection, type Repository, type Branch, type Project, type AgentPool, type TerraformVersionResource } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  projectId?: string;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  orgName,
  projectId,
}: CreateWorkspaceDialogProps) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [loadingVCS, setLoadingVCS] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [vcsConnectionId, setVcsConnectionId] = useState<string>('');
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [terraformVersion, setTerraformVersion] = useState('');
  const [autoQueueRuns, setAutoQueueRuns] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [executionMode, setExecutionMode] = useState('remote');
  const [agentPoolId, setAgentPoolId] = useState('');

  // Data state
  const [availableTfVersions, setAvailableTfVersions] = useState<TerraformVersionResource[]>([]);
  const [agentPools, setAgentPools] = useState<AgentPool[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vcsConnections, setVcsConnections] = useState<VCSConnection[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [repositorySearch, setRepositorySearch] = useState<string>('');
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);

  // Load projects and VCS connections when dialog opens
  useEffect(() => {
    if (!open || !orgName || orgName.trim() === '') {
      if (open && (!orgName || orgName.trim() === '')) {
        console.error('CreateWorkspaceDialog: orgName is missing or empty', { orgName });
        toast.error('Organization name is required. Please ensure you are on an organization page.');
        onOpenChange(false);
      }
      return;
    }

    setLoadingVCS(true);
    void terraformVersionsApi.listEnabled().then((res) => { setAvailableTfVersions(Array.isArray(res?.data) ? res.data : []); }).catch(() => { /* ignore */ });
    void Promise.all([
      projectsApi.list(orgName),
      vcsConnectionsApi.list(orgName),
      agentPoolsApi.list(orgName),
    ])
      .then(([projectsRes, vcsRes, poolsRes]) => {
        const projectsList = projectsRes?.data || [];
        setProjects(projectsList);
        const connections = Array.isArray(vcsRes) ? vcsRes : [];
        // Deduplicate by provider + account_name + account_type to prevent duplicates
        // (same account might have multiple connection records with different IDs)
        const uniqueConnections = Array.from(
          new Map(
            connections.map(conn => [
              `${conn.provider}-${conn.account_name}-${conn.account_type}`,
              conn
            ])
          ).values()
        );
        setVcsConnections(uniqueConnections);
        setAgentPools(Array.isArray(poolsRes?.data) ? poolsRes.data : []);

        // Set default project: use provided projectId, or find "default" project, or use first project
        if (projectId && !selectedProjectId) {
          setSelectedProjectId(projectId);
        } else if (projectsList.length > 0 && !selectedProjectId) {
          // Look for a project named "default" first
          const defaultProject = projectsList.find(p => p.name.toLowerCase() === 'default');
          if (defaultProject) {
            setSelectedProjectId(defaultProject.id);
          } else {
            // Fall back to first project
            setSelectedProjectId(projectsList[0].id);
          }
        }
        
        setLoadingVCS(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        toast.error('Failed to load projects or VCS connections');
        setLoadingVCS(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgName, projectId]); // onOpenChange and selectedProjectId intentionally excluded - onOpenChange is stable prop, selectedProjectId is set in effect

  // Load repositories when VCS connection is selected
  useEffect(() => {
    if (!vcsConnectionId || !open) {
      setRepositories([]);
      setBranches([]);
      setSelectedRepository('');
      setSelectedBranch('');
      return;
    }

    setLoadingRepos(true);
    // Request a larger page size to reduce extra paging for UI selection
    void vcsConnectionsApi.listRepositories(vcsConnectionId, 1, 100)
      .then((repos) => {
        setRepositories(repos || []);
        setLoadingRepos(false);
      })
      .catch((err) => {
        console.error('Failed to load repositories:', err);
        toast.error('Failed to load repositories');
        setLoadingRepos(false);
      });
  }, [vcsConnectionId, open]);

  // Load branches when repository is selected
  useEffect(() => {
    if (!selectedRepository || !vcsConnectionId || !open) {
      setBranches([]);
      setSelectedBranch('');
      setRepositorySearch('');
      return;
    }

    const connection = vcsConnections.find(c => c.id === vcsConnectionId);
    if (!connection) return;

    // Parse repository full name (e.g., "owner/repo")
    const [owner, repo] = selectedRepository.split('/');
    if (!owner || !repo) return;

    setLoadingBranches(true);
    void vcsConnectionsApi.listBranches(vcsConnectionId, owner, repo)
      .then((brs) => {
        setBranches(brs || []);
        // Set default branch if available
        const repo = repositories.find(r => r.full_name === selectedRepository);
        const defaultBranch = repo?.default_branch;
        if (defaultBranch && (brs || []).some(b => b.name === defaultBranch)) {
          setSelectedBranch(defaultBranch);
        } else if (brs && brs.length > 0) {
          setSelectedBranch(brs[0].name);
        }
        setLoadingBranches(false);
      })
      .catch((err) => {
        console.error('Failed to load branches:', err);
        toast.error('Failed to load branches');
        setLoadingBranches(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepository, vcsConnectionId, open]); // repositories and vcsConnections intentionally excluded - they're set in other effects

  // Auto-fill workspace name from repository when repository is selected
  useEffect(() => {
    if (!selectedRepository || !open) return;
    
    // Only auto-fill if name is empty (don't overwrite user input)
    if (name.trim()) return;
    
    // Extract repo name from full name (e.g., "owner/repo-name" -> "repo-name")
    const [, repoName] = selectedRepository.split('/');
    if (repoName) {
      setName(repoName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepository, open]); // name intentionally excluded to prevent overwriting user input

  // Auto-focus search input when repository select opens
  useEffect(() => {
    if (repositorySelectOpen && repositorySearchInputRef.current) {
      // Small delay to ensure the dropdown is fully rendered
      setTimeout(() => {
        repositorySearchInputRef.current?.focus();
      }, 100);
    }
  }, [repositorySelectOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Workspace name is required');
      return;
    }

    if (!selectedProjectId) {
      toast.error('Project is required');
      return;
    }

    // If VCS connection is selected, repository and branch are required
    if (vcsConnectionId && (!selectedRepository || !selectedBranch)) {
      toast.error('Repository and branch are required when VCS connection is selected');
      return;
    }

    setCreating(true);

    try {
      const workspace = await workspacesApi.create(orgName, {
        name: name.trim(),
        description: description.trim() || undefined,
        project_id: selectedProjectId,
        vcs_connection_id: vcsConnectionId || undefined,
        vcs_repository: selectedRepository || undefined,
        vcs_branch: selectedBranch || undefined,
        working_directory: workingDirectory.trim() || undefined,
        terraform_version: terraformVersion || undefined,
        auto_queue_runs: vcsConnectionId ? autoQueueRuns : undefined,
        auto_apply: autoApply,
        execution_mode: executionMode,
        agent_pool_id: executionMode === 'agent' && agentPoolId ? agentPoolId : undefined,
      });

      toast.success('Workspace created successfully');
      onOpenChange(false);
      
      // Reset form
      setName('');
      setDescription('');
      setVcsConnectionId('');
      setSelectedRepository('');
      setSelectedBranch('');
      setWorkingDirectory('');
      setTerraformVersion('');
      setAutoQueueRuns(false);
      setAutoApply(false);
      setExecutionMode('remote');

      // Navigate to workspace detail page
      void navigate(`/organizations/${orgName}/workspaces/${workspace.name}`);
    } catch (error: unknown) {
      console.error('Failed to create workspace:', error);
      let errorMessage = 'Failed to create workspace';
      if (error && typeof error === 'object') {
        const err = error as { response?: { data?: { errors?: Array<{ detail?: string }> } }; message?: string };
        errorMessage = err.response?.data?.errors?.[0]?.detail || err.message || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      // Build redirect back to workspaces page (so we can reopen the dialog)
      const redirectUrl = `${window.location.origin}/app/${orgName}/workspaces`;
      // Use the API client to make authenticated request including redirect
      const response = await vcsConnectionsApi.initiateInstallationWithRedirect(orgName, redirectUrl);
      const installUrl = response?.install_url;
      
      if (installUrl) {
        // Store state to reopen dialog after GitHub redirect
        localStorage.setItem('pendingWorkspaceDialog', JSON.stringify({
          orgName,
          timestamp: Date.now(),
        }));
        
        // Redirect to GitHub App installation page in the same tab
        window.location.href = installUrl;
      } else {
        toast.error('Failed to get GitHub App installation URL');
      }
    } catch (error: unknown) {
      console.error('Failed to initiate GitHub App installation:', error);
      let errorMessage = 'Failed to initiate GitHub App installation';
      if (error && typeof error === 'object') {
        const err = error as { response?: { data?: { errors?: Array<{ detail?: string }> } }; message?: string };
        errorMessage = err.response?.data?.errors?.[0]?.detail || err.message || errorMessage;
      }
      toast.error(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pb-6">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Create a new Terraform workspace. Connect a VCS repository to enable automatic runs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 pb-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-workspace"
              required
            />
            <p className="text-xs text-muted-foreground">
              Alphanumeric characters, hyphens, and underscores only
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Workspace description"
            />
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              required
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* VCS Connection */}
          <div className="space-y-2">
            <Label htmlFor="vcs-connection">VCS Connection (Optional)</Label>
            {loadingVCS ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading VCS connections...
              </div>
            ) : (
              <div className="space-y-3">
                {/* Provider Selection Cards */}
                {vcsConnections.length === 0 ? (
                  <div className="space-y-3">
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-900">
                          {getVcsProviderIcon('github', 'h-5 w-5 text-white')}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">GitHub</h4>
                          <p className="text-xs text-muted-foreground">GitHub App</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { void handleConnectGitHub(); }}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Connect GitHub
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vcsConnections.map((conn) => (
                      <div
                        key={conn.id}
                        className={cn(
                          'p-3 border-2 rounded-lg cursor-pointer transition-all',
                          vcsConnectionId === conn.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                            : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                        )}
                        onClick={() => {
                          const newValue = vcsConnectionId === conn.id ? '' : conn.id;
                          setVcsConnectionId(newValue);
                          setSelectedRepository('');
                          setSelectedBranch('');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getVcsProviderIcon(conn.provider)}
                            <span className="text-sm font-medium">
                              {getVcsProviderLabel(conn.provider)} - {conn.account_name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {conn.account_type}
                            </Badge>
                          </div>
                          {vcsConnectionId === conn.id && (
                            <CheckCircle2 className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { void handleConnectGitHub(); }}
                      className="w-full text-xs"
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Connect to a different VCS
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Repository (conditional on VCS connection) */}
          {vcsConnectionId && (
            <div className="space-y-2">
              <Label htmlFor="repository">Repository *</Label>
              {loadingRepos ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading repositories...
                </div>
              ) : repositories.length === 0 ? (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>No repositories found for this installation.</p>
                  {(() => {
                    const conn = vcsConnections.find(c => c.id === vcsConnectionId);
                    const manageUrl = conn
                      ? getVcsManageUrl(conn.provider, conn.installation_id ?? '', conn.account_name ?? '', conn.account_type ?? '')
                      : null;
                    return manageUrl ? (
                      <a
                        href={manageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Configure installation repository access on {conn?.provider === 'github' ? 'GitHub' : 'VCS provider'}
                      </a>
                    ) : null;
                  })()}
                </div>
              ) : (
                <Select
                  value={selectedRepository}
                  onValueChange={(value) => {
                    setSelectedRepository(value);
                    setSelectedBranch('');
                  }}
                  open={repositorySelectOpen}
                  onOpenChange={setRepositorySelectOpen}
                  required
                >
                  <SelectTrigger id="repository">
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
                              <GitBranch className="h-4 w-4" />
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

          {/* Branch (conditional on repository) */}
          {selectedRepository && (
            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              {loadingBranches ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading branches...
                </div>
              ) : (
                <Select
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                  required
                >
                  <SelectTrigger id="branch">
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

          {/* Working Directory */}
          {vcsConnectionId && (
            <div className="space-y-2">
              <Label htmlFor="working-directory">Working Directory</Label>
              <Input
                id="working-directory"
                value={workingDirectory}
                onChange={(e) => setWorkingDirectory(e.target.value)}
                placeholder="/terraform or /infra/prod"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for repository root, or specify path like /terraform
              </p>
            </div>
          )}

          {/* Terraform Version */}
          <div className="space-y-2">
            <Label htmlFor="terraform-version">Terraform Version</Label>
            <Select
              value={terraformVersion || '__default__'}
              onValueChange={(value) => { setTerraformVersion(value === '__default__' ? '' : value); }}
            >
              <SelectTrigger id="terraform-version">
                <SelectValue placeholder="Use organization default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Use organization default</SelectItem>
                {availableTfVersions.map((v) => (
                  <SelectItem key={v.id} value={v.attributes.version}>
                    {v.attributes.version}{v.attributes.beta ? ' (Beta)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto Queue Runs */}
          {vcsConnectionId && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-queue-runs"
                checked={autoQueueRuns}
                onChange={(e) => setAutoQueueRuns(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="auto-queue-runs" className="cursor-pointer">
                Automatically queue runs on VCS push
              </Label>
            </div>
          )}

          {/* Auto Apply */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-apply"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="auto-apply" className="cursor-pointer">
              Automatically apply successful plans
            </Label>
          </div>

          {/* Execution Mode */}
          <div className="space-y-2">
            <Label htmlFor="execution-mode">Execution Mode</Label>
            <Select value={executionMode} onValueChange={(val) => { setExecutionMode(val); if (val !== 'agent') { setAgentPoolId(''); } }}>
              <SelectTrigger id="execution-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remote">Remote (Platform Managed)</SelectItem>
                <SelectItem value="local">Local (Self-Managed)</SelectItem>
                <SelectItem value="agent">Agent (Custom Runner Pool)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agent Pool (shown when execution mode is 'agent') */}
          {executionMode === 'agent' && (
            <div className="space-y-2">
              <Label htmlFor="agent-pool">Agent Pool</Label>
              <Select value={agentPoolId} onValueChange={setAgentPoolId}>
                <SelectTrigger id="agent-pool">
                  <SelectValue placeholder="Select an agent pool..." />
                </SelectTrigger>
                <SelectContent>
                  {agentPools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agentPools.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No agent pools found. Create one in Settings &gt; Agent Pools first.
                </p>
              )}
            </div>
          )}

          <DialogFooter className={cn("pt-6 pb-2", repositorySelectOpen && "pb-6")}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

