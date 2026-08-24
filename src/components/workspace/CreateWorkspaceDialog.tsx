// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { VCSProviderSelector } from '@/components/vcs/VCSProviderSelector';
import { VCSProjectSelect } from '@/components/vcs/VCSProjectSelect';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { autoFillWorkspaceName } from './CreateWorkspaceDialog.helpers';

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
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [vcsConnectionId, setVcsConnectionId] = useState<string>('');
  const [selectedVcsProject, setSelectedVcsProject] = useState<string>('');
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [terraformVersion, setTerraformVersion] = useState('');
  const [autoQueueRuns, setAutoQueueRuns] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [executionMode, setExecutionMode] = useState('remote');
  const [agentPoolId, setAgentPoolId] = useState('');

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [vcsConnections, setVcsConnections] = useState<VCSConnection[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [agentPools, setAgentPools] = useState<AgentPool[]>([]);
  const [availableTfVersions, setAvailableTfVersions] = useState<TerraformVersionResource[]>([]);
  const [repositorySearch, setRepositorySearch] = useState<string>('');
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);

  // Load projects, VCS connections, agent pools, and terraform versions when dialog opens
  const { isLoading: loadingVCS } = useQuery({
    queryKey: ['workspace-dialog-data', orgName],
    queryFn: async () => {
      if (!orgName || orgName.trim() === '') {
        console.error('CreateWorkspaceDialog: orgName is missing or empty', { orgName });
        toast.error('Organization name is required. Please ensure you are on an organization page.');
        onOpenChange(false);
        return null;
      }

      const [tfRes, projectsRes, vcsRes, poolsRes] = await Promise.all([
        terraformVersionsApi.listEnabled().catch(() => ({ data: [] })),
        projectsApi.list(orgName),
        vcsConnectionsApi.list(orgName),
        agentPoolsApi.list(orgName),
      ]);

      const tfVersions = Array.isArray(tfRes?.data) ? tfRes.data : [];
      setAvailableTfVersions(tfVersions);

      const projectsList = projectsRes?.data || [];
      setProjects(projectsList);

      const connections = Array.isArray(vcsRes) ? vcsRes : [];
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

      // Set default project
      if (projectId && !selectedProjectId) {
        setSelectedProjectId(projectId);
      } else if (projectsList.length > 0 && !selectedProjectId) {
        const defaultProject = projectsList.find(p => p.name.toLowerCase() === 'default');
        setSelectedProjectId(defaultProject ? defaultProject.id : projectsList[0].id);
      }

      return { tfVersions, projectsList, uniqueConnections };
    },
    enabled: open && !!orgName,
  });

  // Load repositories when VCS connection is selected
  const { isLoading: loadingRepos } = useQuery({
    queryKey: ['vcs-repositories', vcsConnectionId, selectedVcsProject],
    queryFn: async () => {
      const repos = await vcsConnectionsApi.listAllRepositories(vcsConnectionId, selectedVcsProject || undefined);
      setRepositories(repos || []);
      return repos;
    },
    enabled: !!vcsConnectionId && open,
  });

  // Load branches when repository is selected
  const { isLoading: loadingBranches } = useQuery({
    queryKey: ['vcs-branches', vcsConnectionId, selectedRepository],
    queryFn: async () => {
      const connection = vcsConnections.find(c => c.id === vcsConnectionId);
      if (!connection) return [];

      const [owner, repo] = selectedRepository.split('/');
      if (!owner || repo === undefined) return [];

      const brs = await vcsConnectionsApi.listBranches(vcsConnectionId, owner, repo);
      setBranches(brs || []);

      // Set default branch if available
      const repoData = repositories.find(r => r.full_name === selectedRepository);
      const defaultBranch = repoData?.default_branch;
      if (defaultBranch && (brs || []).some(b => b.name === defaultBranch)) {
        setSelectedBranch(defaultBranch);
      } else if (brs && brs.length > 0) {
        setSelectedBranch(brs[0].name);
      }

      return brs;
    },
    enabled: !!selectedRepository && !!vcsConnectionId && open,
  });

  // Auto-fill the workspace name from a repository the user picks, only when the
  // name field is still empty (don't overwrite typed input). Handled at the
  // selection event (see the repository Select's onValueChange) rather than in an
  // effect, per the React "you don't need an effect for user events" guidance.
  const handleRepositorySelect = (value: string) => {
    setSelectedRepository(value);
    setSelectedBranch('');
    const autoName = autoFillWorkspaceName(name, value);
    if (autoName) setName(autoName);
  };

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
      void navigate(`/app/${orgName}/workspaces/${workspace.name}`);
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
            ) : vcsConnections.length === 0 ? (
              <VCSProviderSelector
                orgName={orgName}
                selectedConnectionId={undefined}
                onConnectionSelect={(id) => {
                  setVcsConnectionId(id || '');
                  setSelectedVcsProject('');
                  setSelectedRepository('');
                  setSelectedBranch('');
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
                      vcsConnectionId === conn.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                    )}
                    onClick={() => {
                      const newValue = vcsConnectionId === conn.id ? '' : conn.id;
                      setVcsConnectionId(newValue);
                      setSelectedVcsProject('');
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
                  onClick={() => { window.open(`/app/${orgName}/settings/vcs-connections`, '_blank'); }}
                  className="w-full text-xs"
                >
                  <Plus className="h-3 w-3 mr-2" />
                  Connect to a different VCS
                </Button>
              </div>
            )}
          </div>

          {/* Project scoping (Azure DevOps only) */}
          {vcsConnectionId && (
            <VCSProjectSelect
              connectionId={vcsConnectionId}
              provider={vcsConnections.find(c => c.id === vcsConnectionId)?.provider}
              value={selectedVcsProject}
              onChange={(project) => {
                setSelectedVcsProject(project);
                setSelectedRepository('');
                setSelectedBranch('');
              }}
            />
          )}

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
                  onValueChange={handleRepositorySelect}
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
                        aria-label="Search repositories"
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

          {/* OpenTofu Version */}
          <div className="space-y-2">
            <Label htmlFor="terraform-version">OpenTofu Version</Label>
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
                className="h-4 w-4 rounded-sm border-gray-300"
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
              className="h-4 w-4 rounded-sm border-gray-300"
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

