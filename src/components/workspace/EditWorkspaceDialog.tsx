// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- the repository-search auto-focus is a legitimate DOM effect
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { workspacesApi, vcsConnectionsApi, agentPoolsApi, terraformVersionsApi, type Workspace } from '@/api/client';
import { VCSProviderSelector } from '@/components/vcs/VCSProviderSelector';
import { VCSProjectSelect } from '@/components/vcs/VCSProjectSelect';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  dedupeVcsConnections,
  vcsConnectionExists,
  resolveEffectiveBranch,
  hasStateInvalidatingChanges,
} from './EditWorkspaceDialog.helpers';

interface EditWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  workspace: Workspace | null;
  onUpdated?: () => void;
}

/** Extract an HTTP status code from an unknown API error, if present. */
function errorStatus(error: unknown): number | null {
  return error && typeof error === 'object' && 'response' in error
    ? (error as { response?: { status?: number } }).response?.status ?? null
    : null;
}

export function EditWorkspaceDialog({
  open,
  onOpenChange,
  orgName,
  workspace,
  onUpdated,
}: EditWorkspaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pb-6">
        <DialogHeader>
          <DialogTitle>Edit Workspace</DialogTitle>
          <DialogDescription>
            Update workspace settings. Some changes may affect existing state and runs.
          </DialogDescription>
        </DialogHeader>

        {/* The body mounts fresh each time the dialog opens (Radix unmounts closed
            content), so all form fields initialize straight from the workspace via
            useState initializers - no form-sync effect needed. Keyed by workspace id
            so switching the target workspace re-initializes cleanly. */}
        {workspace && (
          <EditWorkspaceFormBody
            key={workspace.id}
            orgName={orgName}
            workspace={workspace}
            onOpenChange={onOpenChange}
            onUpdated={onUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditWorkspaceFormBodyProps {
  orgName: string;
  workspace: Workspace;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

function EditWorkspaceFormBody({
  orgName,
  workspace,
  onOpenChange,
  onUpdated,
}: EditWorkspaceFormBodyProps) {
  const [updating, setUpdating] = useState(false);

  // Form state - initialized directly from the workspace (mount == dialog open).
  const initialVcsId = workspace.vcs_connection_id ? String(workspace.vcs_connection_id) : '';
  const [name, setName] = useState(workspace.name || '');
  const [description, setDescription] = useState(workspace.description || '');
  const [vcsConnectionId, setVcsConnectionId] = useState<string>(initialVcsId);
  const [selectedVcsProject, setSelectedVcsProject] = useState<string>('');
  const [selectedRepository, setSelectedRepository] = useState<string>(workspace.vcs_repository || '');
  // '' means "auto" - resolveEffectiveBranch derives the default from the loaded list.
  const [selectedBranch, setSelectedBranch] = useState<string>(workspace.vcs_branch || 'main');
  const [workingDirectory, setWorkingDirectory] = useState(workspace.working_directory || '');
  const [terraformVersion, setTerraformVersion] = useState(workspace.terraform_version || '');
  const [autoQueueRuns, setAutoQueueRuns] = useState(workspace.auto_queue_runs || false);
  const [autoApply, setAutoApply] = useState(workspace.auto_apply || false);
  const [executionMode, setExecutionMode] = useState(workspace.execution_mode || 'remote');
  const [agentPoolId, setAgentPoolId] = useState(workspace.agent_pool_id || '');
  const [forceDelete, setForceDelete] = useState(workspace.force_delete || false);
  const [repositorySearch, setRepositorySearch] = useState<string>('');
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);

  // Original (persisted) VCS values - constants for this mount, used to flag
  // state-invalidating changes.
  const originalVcsConnectionId = initialVcsId;
  const originalRepository = workspace.vcs_repository || '';
  const originalBranch = workspace.vcs_branch || 'main';

  // Org-level reference data: terraform versions, agent pools, VCS connections.
  const { data: orgData, isLoading: loadingVCS } = useQuery({
    queryKey: ['edit-workspace-data', orgName],
    queryFn: async () => {
      const [tfRes, poolsRes, vcsRes] = await Promise.all([
        terraformVersionsApi.listEnabled().catch(() => ({ data: [] })),
        agentPoolsApi.list(orgName).catch(() => ({ data: [] })),
        vcsConnectionsApi.list(orgName),
      ]);
      return {
        tfVersions: Array.isArray(tfRes?.data) ? tfRes.data : [],
        agentPools: Array.isArray(poolsRes?.data) ? poolsRes.data : [],
        vcsConnections: dedupeVcsConnections(Array.isArray(vcsRes) ? vcsRes : []),
      };
    },
    enabled: !!orgName,
  });
  const availableTfVersions = orgData?.tfVersions ?? [];
  const agentPools = orgData?.agentPools ?? [];
  const vcsConnections = orgData?.vcsConnections ?? [];

  const connectionReady = !loadingVCS && vcsConnections.length > 0;
  const repoConnectionValid = connectionReady && vcsConnectionExists(vcsConnections, vcsConnectionId);

  // Repositories for the selected connection (+ optional Azure DevOps project).
  const { data: repositories = [], isLoading: loadingRepos } = useQuery({
    queryKey: ['edit-workspace-repos', vcsConnectionId, selectedVcsProject, orgName],
    queryFn: async () => {
      try {
        const repos = await vcsConnectionsApi.listAllRepositories(
          vcsConnectionId,
          selectedVcsProject || undefined,
        );
        return Array.isArray(repos) ? repos : [];
      } catch (error) {
        console.error('Failed to load repositories:', error);
        if (errorStatus(error) !== 404) toast.error('Failed to load repositories');
        return [];
      }
    },
    enabled: repoConnectionValid,
  });

  // Branches for the selected repository.
  const [repoOwner, repoName] = selectedRepository.split('/');
  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['edit-workspace-branches', vcsConnectionId, selectedRepository, orgName],
    queryFn: async () => {
      try {
        const list = await vcsConnectionsApi.listBranches(vcsConnectionId, repoOwner, repoName);
        return Array.isArray(list) ? list : [];
      } catch (error) {
        console.error('Failed to load branches:', error);
        if (errorStatus(error) !== 404) toast.error('Failed to load branches');
        return [];
      }
    },
    enabled: repoConnectionValid && !!selectedRepository && !!repoOwner && !!repoName,
  });

  // The branch actually in effect: an explicit pick wins, else the list default.
  const effectiveBranch = resolveEffectiveBranch(selectedBranch, branches);

  // Auto-focus the repository search input when the select opens.
  useEffect(() => {
    if (repositorySelectOpen && repositorySearchInputRef.current) {
      const id = setTimeout(() => {
        repositorySearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(id);
    }
  }, [repositorySelectOpen]);

  const handleVcsConnectionChange = (newId: string) => {
    setVcsConnectionId(newId);
    setSelectedVcsProject('');
    setSelectedRepository('');
    setSelectedBranch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Workspace name is required');
      return;
    }

    // If VCS connection is selected, repository and branch are required
    if (vcsConnectionId && (!selectedRepository || !effectiveBranch)) {
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
        vcs_branch: effectiveBranch || undefined,
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

  const showStateWarning = hasStateInvalidatingChanges(
    { vcsConnectionId, selectedRepository, effectiveBranch },
    { vcsConnectionId: originalVcsConnectionId, selectedRepository: originalRepository, branch: originalBranch },
  );

  return (
    <>
      {showStateWarning && (
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
          ) : vcsConnections.length === 0 ? (
            <VCSProviderSelector
              orgName={orgName}
              selectedConnectionId={undefined}
              onConnectionSelect={(id) => { handleVcsConnectionChange(id || ''); }}
              showConfigureOption={false}
            />
          ) : (
            <div className="space-y-2">
              {vcsConnections.map((conn) => {
                const connIdStr = String(conn.id);
                const stateVcsId = String(vcsConnectionId || '');
                // vcsConnectionId is initialized from the workspace at mount, so the
                // state value is the single source of truth for selection.
                const isSelected = stateVcsId === connIdStr && stateVcsId !== '';
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
                      handleVcsConnectionChange(isSelected ? '' : connIdStr);
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
                value={effectiveBranch}
                onValueChange={setSelectedBranch}
                required
              >
                <SelectTrigger id="edit-branch">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {/* Always include the currently selected branch even if not in branches list */}
                  {effectiveBranch && !branches.some(b => b.name === effectiveBranch) && (
                    <SelectItem key={effectiveBranch} value={effectiveBranch}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        <span>{effectiveBranch}</span>
                        {(effectiveBranch === 'main' || effectiveBranch === 'master') && (
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

        {/* OpenTofu Version */}
        <div className="space-y-2">
          <Label htmlFor="edit-terraform-version">OpenTofu Version</Label>
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
              Allow force delete - permits deletion even when the workspace has active infrastructure
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
    </>
  );
}
