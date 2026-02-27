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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, GitBranch, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getVcsProviderIcon, getVcsProviderLabel, getVcsManageUrl } from '@/lib/vcs';
import { workspacesApi, vcsConnectionsApi, agentPoolsApi, terraformVersionsApi, type VCSConnection, type Repository, type Branch, type Workspace, type AgentPool, type TerraformVersionResource } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EditWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  workspace: Workspace | null;
  onUpdated?: () => void;
}

export function EditWorkspaceDialog({
  open,
  onOpenChange,
  orgName,
  workspace,
  onUpdated,
}: EditWorkspaceDialogProps) {
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [loadingVCS, setLoadingVCS] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vcsConnectionId, setVcsConnectionId] = useState<string>('');
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [terraformVersion, setTerraformVersion] = useState('');
  const [autoQueueRuns, setAutoQueueRuns] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [executionMode, setExecutionMode] = useState('remote');
  const [agentPoolId, setAgentPoolId] = useState('');
  const [forceDelete, setForceDelete] = useState(false);

  // Data state
  const [availableTfVersions, setAvailableTfVersions] = useState<TerraformVersionResource[]>([]);
  const [agentPools, setAgentPools] = useState<AgentPool[]>([]);
  const [vcsConnections, setVcsConnections] = useState<VCSConnection[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [repositorySearch, setRepositorySearch] = useState<string>('');
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);
  
  // Store workspace VCS connection ID in a ref so it persists even if workspace becomes null
  const workspaceVcsIdRef = useRef<string>('');

  // Track original values to detect state-invalidating changes
  const [originalVcsConnectionId, setOriginalVcsConnectionId] = useState<string>('');
  const [originalRepository, setOriginalRepository] = useState<string>('');
  const [originalBranch, setOriginalBranch] = useState<string>('');

  // Initialize form when workspace changes
  useEffect(() => {
    if (workspace && open) {
      setName(workspace.name || '');
      setDescription(workspace.description || '');
      // VCS connection ID - ensure it's a string to match VCSConnection.id type
      const workspaceVcsId = workspace.vcs_connection_id ? String(workspace.vcs_connection_id) : '';
      // Store in ref so it persists even if workspace becomes null
      workspaceVcsIdRef.current = workspaceVcsId;
      setVcsConnectionId(workspaceVcsId);
      setSelectedRepository(workspace.vcs_repository || '');
      setSelectedBranch(workspace.vcs_branch || 'main');
      setWorkingDirectory(workspace.working_directory || '');
      setTerraformVersion(workspace.terraform_version || '');
      setAutoQueueRuns(workspace.auto_queue_runs || false);
      setAutoApply(workspace.auto_apply || false);
      setExecutionMode(workspace.execution_mode || 'remote');
      setAgentPoolId(workspace.agent_pool_id || '');
      setForceDelete(workspace.force_delete || false);

      // Store original values
      setOriginalVcsConnectionId(workspaceVcsId);
      setOriginalRepository(workspace.vcs_repository || '');
      setOriginalBranch(workspace.vcs_branch || 'main');
    } else if (!workspace && open) {
      // Reset form when dialog opens without workspace
      setName('');
      setDescription('');
      setVcsConnectionId('');
      setSelectedRepository('');
      setSelectedBranch('main');
      setWorkingDirectory('');
      setTerraformVersion('');
      setAutoQueueRuns(false);
      setAutoApply(false);
      setExecutionMode('remote');
    }
  }, [workspace, open]);

  // Load VCS connections when dialog opens
  useEffect(() => {
    if (!open || !orgName || orgName.trim() === '') {
      return;
    }

    setLoadingVCS(true);
    void terraformVersionsApi.listEnabled().then((res) => { setAvailableTfVersions(Array.isArray(res?.data) ? res.data : []); }).catch(() => { /* ignore */ });
    void agentPoolsApi.list(orgName).then((res) => { setAgentPools(Array.isArray(res?.data) ? res.data : []); }).catch(() => { /* ignore */ });
    void vcsConnectionsApi.list(orgName)
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
      })
      .catch((error) => {
        console.error('Failed to load VCS connections:', error);
        toast.error('Failed to load VCS connections');
      })
      .finally(() => {
        setLoadingVCS(false);
      });
  }, [open, orgName]);

  // Set VCS connection ID from workspace when connections are loaded
  // This MUST run after vcsConnections is set to ensure the card shows as selected
  // Use ref to get workspace VCS ID even if workspace prop becomes null
  useEffect(() => {
    if (!open || loadingVCS || vcsConnections.length === 0) {
      return;
    }

    // Use ref value if workspace is null, otherwise use workspace value
    const workspaceVcsId = workspace?.vcs_connection_id 
      ? String(workspace.vcs_connection_id) 
      : workspaceVcsIdRef.current;
    
    if (workspaceVcsId) {
      // Find the matching connection - compare as strings to ensure match
      const matchingConn = vcsConnections.find(conn => String(conn.id) === workspaceVcsId);
      
      if (matchingConn) {
        const matchingId = String(matchingConn.id);
        // Always set to ensure state is synchronized and component re-renders
        // This is necessary to make the card show as selected
        setVcsConnectionId(matchingId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vcsConnections.length, loadingVCS]); // Run when connections load - ref is checked inside effect

  // Load repositories when VCS connection changes
  useEffect(() => {
    if (!vcsConnectionId || !orgName) {
      setRepositories([]);
      setBranches([]);
      if (!vcsConnectionId) {
        setSelectedRepository('');
        setSelectedBranch('');
      }
      return;
    }

    // Wait for VCS connections to load before checking
    if (loadingVCS || vcsConnections.length === 0) {
      return;
    }

    // Check if VCS connection exists in available connections
    const connectionExists = vcsConnections.some(conn => conn.id === vcsConnectionId);
    if (!connectionExists) {
      // VCS connection no longer exists or is invalid
      setRepositories([]);
      setBranches([]);
      return;
    }

    setLoadingRepos(true);
    void vcsConnectionsApi.listRepositories(vcsConnectionId, 1, 100)
      .then((repos) => {
        setRepositories(Array.isArray(repos) ? repos : []);
        // If we have a repository from workspace, ensure it's set
        // This will trigger the branch loading effect
        if (workspace?.vcs_repository && repos && repos.some(r => r.full_name === workspace.vcs_repository)) {
          if (selectedRepository !== workspace.vcs_repository) {
            setSelectedRepository(workspace.vcs_repository);
          }
        } else if (!selectedRepository) {
          setSelectedBranch('');
          setBranches([]);
        }
      })
      .catch((error) => {
        console.error('Failed to load repositories:', error);
        const errorMessage = error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : null;
        if (errorMessage !== 404) {
          toast.error('Failed to load repositories');
        }
        setRepositories([]);
      })
      .finally(() => {
        setLoadingRepos(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vcsConnectionId, orgName, vcsConnections, loadingVCS, selectedRepository]); // workspace?.vcs_repository intentionally excluded - only set on initial load

  // Load branches when repository changes
  useEffect(() => {
    if (!selectedRepository || !vcsConnectionId || !orgName) {
      setBranches([]);
      if (!selectedRepository) {
        setSelectedBranch('');
      }
      return;
    }

    // Wait for VCS connections to load before checking
    if (loadingVCS || vcsConnections.length === 0) {
      return;
    }

    // Check if VCS connection exists in available connections
    const connectionExists = vcsConnections.some(conn => conn.id === vcsConnectionId);
    if (!connectionExists) {
      setBranches([]);
      return;
    }

    // Parse owner/repo from selectedRepository (format: "owner/repo")
    const [owner, repo] = selectedRepository.split('/');
    if (!owner || !repo) {
      setBranches([]);
      setSelectedBranch('');
      return;
    }

    setLoadingBranches(true);
    void vcsConnectionsApi.listBranches(vcsConnectionId, owner, repo)
      .then((branchList) => {
        setBranches(Array.isArray(branchList) ? branchList : []);
        // If we have a branch from workspace, ensure it's set (might have been cleared)
        if (workspace?.vcs_branch && branchList && branchList.some(b => b.name === workspace.vcs_branch)) {
          if (selectedBranch !== workspace.vcs_branch) {
            setSelectedBranch(workspace.vcs_branch);
          }
        } else if (branchList && branchList.length > 0 && !selectedBranch) {
          // Set default branch if available and not already set
          const mainBranch = branchList.find(b => b.name === 'main' || b.name === 'master');
          setSelectedBranch(mainBranch ? mainBranch.name : branchList[0].name);
        }
      })
      .catch((error) => {
        console.error('Failed to load branches:', error);
        const errorMessage = error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : null;
        if (errorMessage !== 404) {
          toast.error('Failed to load branches');
        }
        setBranches([]);
      })
      .finally(() => {
        setLoadingBranches(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepository, vcsConnectionId, orgName, vcsConnections, loadingVCS, selectedBranch]); // workspace?.vcs_branch intentionally excluded - only set on initial load

  // Auto-focus search input when repository select opens
  useEffect(() => {
    if (repositorySelectOpen && repositorySearchInputRef.current) {
      setTimeout(() => {
        repositorySearchInputRef.current?.focus();
      }, 100);
    }
  }, [repositorySelectOpen]);

  const handleConnectGitHub = () => {
    try {
      const url = `/app/${orgName}/settings/vcs-connections`;
      void navigate(url);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to navigate to VCS connections:', error);
      toast.error('Failed to open VCS connections page');
    }
  };

  // Check if state-invalidating changes are being made
  const hasStateInvalidatingChanges = 
    (vcsConnectionId !== originalVcsConnectionId) ||
    (selectedRepository !== originalRepository) ||
    (selectedBranch !== originalBranch);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Workspace name is required');
      return;
    }

    if (!workspace) {
      toast.error('Workspace not found');
      return;
    }

    // If VCS connection is selected, repository and branch are required
    if (vcsConnectionId && (!selectedRepository || !selectedBranch)) {
      toast.error('Repository and branch are required when VCS connection is selected');
      return;
    }

    setUpdating(true);

    try {
      await workspacesApi.update(orgName, workspace.name, {
        name: name.trim(),
        description: description.trim() || undefined,
        vcs_connection_id: vcsConnectionId || null,
        vcs_repository: selectedRepository || undefined,
        vcs_branch: selectedBranch || undefined,
        working_directory: workingDirectory.trim() || undefined,
        terraform_version: terraformVersion || undefined,
        auto_queue_runs: autoQueueRuns,
        auto_apply: autoApply,
        execution_mode: executionMode,
        agent_pool_id: executionMode === 'agent' && agentPoolId ? agentPoolId : null,
        force_delete: forceDelete,
      });

      toast.success('Workspace updated successfully');
      onOpenChange(false);
      if (onUpdated) {
        onUpdated();
      }
    } catch (error: unknown) {
      console.error('Failed to update workspace:', error);
      let errorMessage = 'Failed to update workspace';
      if (error && typeof error === 'object') {
        const err = error as { response?: { data?: { errors?: Array<{ detail?: string }> } }; message?: string };
        errorMessage = err.response?.data?.errors?.[0]?.detail || err.message || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(repositorySearch.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(repositorySearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pb-6">
        <DialogHeader>
          <DialogTitle>Edit Workspace</DialogTitle>
          <DialogDescription>
            Update workspace settings. Some changes may affect existing state and runs.
          </DialogDescription>
        </DialogHeader>

        {hasStateInvalidatingChanges && (
          <div className="mb-4 p-4 border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <strong className="text-yellow-800 dark:text-yellow-400">Warning:</strong>
                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                  Changing the VCS connection, repository, or branch may invalidate existing state and affect future runs. 
                  The workspace will pull from a different source, which could cause issues if the new source has different Terraform code.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 pb-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
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
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Workspace description"
            />
          </div>

          {/* VCS Connection */}
          <div className="space-y-2">
            <Label htmlFor="edit-vcs-connection">VCS Connection (Optional)</Label>
            {loadingVCS ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading VCS connections...
              </div>
            ) : (
              <div className="space-y-3">
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
                    {vcsConnections.map((conn) => {
                      // Ensure consistent string comparison for selection state
                      // Check both state and workspace value (from ref) to handle timing issues
                      const connIdStr = String(conn.id);
                      const stateVcsId = String(vcsConnectionId || '');
                      const workspaceVcsId = workspace?.vcs_connection_id 
                        ? String(workspace.vcs_connection_id) 
                        : workspaceVcsIdRef.current;
                      // Selected if either state matches OR workspace value matches (for initial render)
                      const isSelected = (stateVcsId === connIdStr && stateVcsId !== '') || 
                                        (workspaceVcsId === connIdStr && workspaceVcsId !== '');
                      
                      return (
                        <div
                          key={conn.id}
                          className={cn(
                            'p-3 border-2 rounded-lg cursor-pointer transition-all',
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                              : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                          )}
                          onClick={() => {
                            const newValue = isSelected ? '' : connIdStr;
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
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
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
              <Label htmlFor="edit-repository">Repository *</Label>
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
                  <SelectTrigger id="edit-repository">
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
                      {filteredRepositories.map((repo) => (
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
                      {filteredRepositories.length === 0 && (
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
              <Label htmlFor="edit-branch">Branch *</Label>
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
                  <SelectTrigger id="edit-branch">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Always include the currently selected branch even if not in branches list */}
                    {selectedBranch && !branches.some(b => b.name === selectedBranch) && (
                      <SelectItem key={selectedBranch} value={selectedBranch}>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span>{selectedBranch}</span>
                          {(selectedBranch === 'main' || selectedBranch === 'master') && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    )}
                    {branches.map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span>{branch.name}</span>
                          {(branch.name === 'main' || branch.name === 'master') && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Working Directory */}
          <div className="space-y-2">
            <Label htmlFor="edit-working-directory">Working Directory</Label>
            <Input
              id="edit-working-directory"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="/terraform or /infra/prod (leave empty for root)"
            />
            <p className="text-xs text-muted-foreground">
              Path within the repository where Terraform files are located
            </p>
          </div>

          {/* Terraform Version */}
          <div className="space-y-2">
            <Label htmlFor="edit-terraform-version">Terraform Version</Label>
            <Select 
              value={terraformVersion || '__default__'} 
              onValueChange={(value) => setTerraformVersion(value === '__default__' ? '' : value)}
            >
              <SelectTrigger id="edit-terraform-version">
                <SelectValue placeholder="Use default version" />
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

          {/* Execution Mode */}
          <div className="space-y-2">
            <Label htmlFor="edit-execution-mode">Execution Mode</Label>
            <Select value={executionMode} onValueChange={(val) => { setExecutionMode(val); if (val !== 'agent') { setAgentPoolId(''); } }}>
              <SelectTrigger id="edit-execution-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agent Pool (shown when execution mode is 'agent') */}
          {executionMode === 'agent' && (
            <div className="space-y-2">
              <Label htmlFor="edit-agent-pool">Agent Pool</Label>
              <Select value={agentPoolId} onValueChange={setAgentPoolId}>
                <SelectTrigger id="edit-agent-pool">
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

          {/* Auto Queue Runs */}
          {vcsConnectionId && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-auto-queue-runs"
                checked={autoQueueRuns}
                onCheckedChange={(checked) => setAutoQueueRuns(checked === true)}
              />
              <Label htmlFor="edit-auto-queue-runs" className="cursor-pointer">
                Automatically queue runs on VCS push
              </Label>
            </div>
          )}

          {/* Auto Apply */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-auto-apply"
              checked={autoApply}
              onCheckedChange={(checked) => setAutoApply(checked === true)}
            />
            <Label htmlFor="edit-auto-apply" className="cursor-pointer">
              Auto-apply runs
            </Label>
          </div>

          {/* Destruction and Deletion */}
          <div className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
            <Label className="text-sm font-medium text-destructive">Destruction and Deletion</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-force-delete"
                checked={forceDelete}
                onCheckedChange={(checked) => setForceDelete(checked === true)}
              />
              <Label htmlFor="edit-force-delete" className="cursor-pointer text-sm">
                Allow force delete — permits deletion even when the workspace has active infrastructure
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
