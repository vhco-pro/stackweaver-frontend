// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  workspacesApi,
  runsApi,
  stateVersionsApi,
  variablesApi,
  variableSetsApi,
  vcsConnectionsApi,
  type Workspace,
  type Run,
  type StateVersion,
  type Variable,
  type VariableSet
} from '@/api/client';
import { getRunFromJsonApi, type JsonApiResource } from '@/utils/jsonapi';
import { calculateRunDuration, isRunActive } from './WorkspaceDetail.helpers';
import { useNow } from '@/hooks/useNow';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { OutputViewer } from '@/components/runs/OutputViewer';
import { RunSourceDisplay } from '@/components/runs/RunSourceDisplay';
import { ErrorDisplay } from '@/components/runs/ErrorDisplay';
import { EditWorkspaceDialog } from '@/components/workspace/EditWorkspaceDialog';
import { WorkspaceTags } from '@/components/workspace/WorkspaceTags';
import { WorkspaceNotifications } from '@/components/workspace/WorkspaceNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/runs/StatusBadge';
import { computeDisplayStatus } from '@/utils/runStatus';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  BookOpen,
  Lock,
  Unlock,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Trash2,
  FolderOpen,
  Tag,
  Copy,
  Edit,
  Search,
  PlayCircle,
  Pause,
  ChevronRight,
  Users,
  Package,
  ArrowRight,
  Minus,
  RotateCw,
  ExternalLink,
  AlertTriangle,
  Info,
  ChevronDown,
  Check,
  X,
  Server
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon, getVcsRepoUrl, getVcsCommitUrl } from '@/lib/vcs';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Checkbox
} from '@/components/ui/checkbox';

type TabType = 'overview' | 'runs' | 'states' | 'variables';

interface RunCardProps {
  run: Run;
  formatTimeAgo: (date: Date) => string;
  getRunStatusBadge: (run: Run) => React.ReactNode;
  orgName: string;
  workspaceName: string;
  workspace?: Workspace | null;
}

function RunCard({ run, formatTimeAgo, getRunStatusBadge, orgName, workspaceName, workspace }: RunCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden hover:bg-muted/30 transition-colors">
      <Link
        to={`/app/${orgName}/workspaces/${workspaceName}/runs/${run.id}`}
        className="block p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <PlayCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="font-semibold">
                {run.operation === 'plan-and-apply' ? 'Plan and Apply' :
                 run.operation === 'plan-only' ? 'Plan Only' :
                 run.operation === 'destroy' ? 'Destroy' :
                 run.operation}
              </div>
              <div className="text-sm text-muted-foreground space-y-1 mt-1">
                <RunSourceDisplay run={run} workspace={workspace || undefined} />
                <div className="font-mono text-xs">#{run.id}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getRunStatusBadge(run)}
            <span className="text-xs text-muted-foreground">{formatTimeAgo(new Date(run.created_at))}</span>
          </div>
        </div>
      </Link>
      {run.plan_output && (
        <div className="border-t">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-between"
          >
            <span>Plan Output</span>
            {expanded ? (
              <ChevronRight className="h-4 w-4 rotate-90" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {expanded && (
            <div className="px-4 pb-4">
              <OutputViewer 
                data={run.plan_output} 
                showJsonViewer={false}
                title="Terraform Plan"
              />
            </div>
          )}
        </div>
      )}
      {run.error_message && (
        <div className="border-t">
          <ErrorDisplay logs={run.error_message} title="Error" className="border-0 rounded-none bg-transparent" />
        </div>
      )}
    </div>
  );
}

// cleanStateProvider shortens a Terraform provider reference for display, e.g.
// `provider["registry.terraform.io/hashicorp/null"]` → `hashicorp/null`.
function cleanStateProvider(provider: string | undefined): string {
  if (!provider) return 'unknown';
  const match = provider.match(/provider\["([^"]+)"\]/);
  if (match) provider = match[1];
  if (provider.includes('/')) {
    return provider.split('/').slice(-2).join('/');
  }
  return provider;
}

export default function WorkspaceDetail() {
  const { orgName, workspaceName } = useParams<{
    orgName: string;
    workspaceName: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // workspace, runs, stateVersions, variables, variableSets, platformVariableKeys
  // are derived from the main useQuery below (workspaceData)
  // Seed the active tab from the URL `?tab=` once (lazy init). Nothing in-app
  // mutates `?tab` after mount, so a sync effect isn't needed — tab clicks below
  // drive `setActiveTab` directly. Avoids set-state-in-effect.
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tabParam = searchParams.get('tab');
    return tabParam && ['overview', 'runs', 'states', 'variables'].includes(tabParam)
      ? (tabParam as TabType)
      : 'overview';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createRunDialogOpen, setCreateRunDialogOpen] = useState(false);
  const [isCreatingRun, setIsCreatingRun] = useState(false);
  const [createVariableDialogOpen, setCreateVariableDialogOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [forceDeleteMode, setForceDeleteMode] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [timeoutDialogOpen, setTimeoutDialogOpen] = useState(false);
  const [timeoutValue, setTimeoutValue] = useState<number>(7200); // Default: 2 hours in seconds
  const [savingTimeout, setSavingTimeout] = useState(false);
  const [deleteVariableDialogOpen, setDeleteVariableDialogOpen] = useState(false);
  const [variableToDelete, setVariableToDelete] = useState<Variable | null>(null);
  const [deletingVariable, setDeletingVariable] = useState(false);
  const [editWorkspaceDialogOpen, setEditWorkspaceDialogOpen] = useState(false);
  const [resourceFilter, setResourceFilter] = useState('');
  const [deleteResourceDialogOpen, setDeleteResourceDialogOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);
  const [deletingResource, setDeletingResource] = useState(false);
  const [variableForm, setVariableForm] = useState({
    key: '',
    value: '',
    description: '',
    category: 'terraform' as 'terraform' | 'env',
    hcl: false,
    sensitive: false,
    encrypted: false, // Legacy field, kept for compatibility
  });
  const [platformVariableOverrideWarningOpen, setPlatformVariableOverrideWarningOpen] = useState(false);
  const [pendingVariableCreate, setPendingVariableCreate] = useState<(() => void) | null>(null);
  const [platformVariablesSectionOpen, setPlatformVariablesSectionOpen] = useState(false);
  
  // Inline description editing state
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [inlineDescription, setInlineDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  // Helper function to format duration
  // Helper function to construct commit URL for state versions
  const getCommitUrl = (hash: string): string | null =>
    getVcsCommitUrl(
      workspace?.vcs_provider ?? '',
      workspace?.vcs_repository ?? '',
      hash,
      workspace?.vcs_account_name,
    );

  // Helper function to count resources changed - removed unused function

  // Helper function to calculate resource impact summary
  interface ResourceImpactSummary {
    add: number;
    update: number;
    replace: number;
    delete: number;
  }

  const calculateResourceImpact = (planOutput: Record<string, unknown> | null | undefined): ResourceImpactSummary | null => {
    if (!planOutput) return null;
    
    const resourceChanges = planOutput.resource_changes;
    if (!Array.isArray(resourceChanges)) return null;
    
    const summary: ResourceImpactSummary = {
      add: 0,
      update: 0,
      replace: 0,
      delete: 0,
    };
    
    resourceChanges.forEach((resource: Record<string, unknown>) => {
      const change = resource?.change as { actions?: string[] } | undefined;
      if (change && Array.isArray(change.actions)) {
        const actions = change.actions;
        
        // Check if this is a replace (both delete and create)
        const hasReplace = actions.includes('delete') && actions.includes('create');
        
        if (hasReplace) {
          // Count as replace, not as separate add and delete
          summary.replace++;
        } else {
          // Count individual actions
          actions.forEach((action: string) => {
            if (action === 'create') {
              summary.add++;
            } else if (action === 'update') {
              summary.update++;
            } else if (action === 'delete') {
              summary.delete++;
            }
            // Note: 'replace' as a single action is handled above
          });
        }
      }
    });
    
    // Return null if no changes
    if (summary.add === 0 && summary.update === 0 && summary.replace === 0 && summary.delete === 0) {
      return null;
    }
    
    return summary;
  };

  // Main data fetch: workspace + runs + state versions + variables + variable sets + platform keys
  const { isLoading: loading, data: workspaceData, refetch: refetchData } = useQuery({
    queryKey: ['workspace-detail', orgName, workspaceName],
    queryFn: async () => {
      console.log('WorkspaceDetail: Fetching workspace', { orgName, workspaceName });
      const workspaceRes = await workspacesApi.get(orgName!, workspaceName!);
      console.log('WorkspaceDetail: Workspace fetched', workspaceRes);
      
      if (!workspaceRes || !workspaceRes.id) {
        console.error('WorkspaceDetail: Invalid workspace response', workspaceRes);
        toast.error('Failed to load workspace: Invalid response');
        return null;
      }

      // Fetch all data in parallel
      const [runsRes, statesRes, varsRes, varSetsRes, platformKeysRes] = await Promise.all([
        runsApi.list(workspaceRes.id).catch(() => ({ data: [], meta: {} })),
        stateVersionsApi.list(workspaceRes.id).catch((err) => {
          console.error('Failed to load state versions:', err);
          return [];
        }),
        variablesApi.list(workspaceRes.id).catch(() => []),
        orgName ? variableSetsApi.list(orgName).catch(() => []) : Promise.resolve([]),
        variablesApi.getPlatformVariableKeys(workspaceRes.id).catch(() => []),
      ]);
      
      // Convert JSON:API format to Run objects
      const runsData = Array.isArray(runsRes?.data) ? runsRes.data : [];
      const fetchedRuns = runsData.map((resource: JsonApiResource) => getRunFromJsonApi(resource));
      
      // Filter out legacy apply runs that are part of a plan-and-apply flow
      // For plan-and-apply runs, we only show the single plan-and-apply run, not separate apply runs
      const filteredRuns = fetchedRuns.filter((run: Run) => {
        // Keep all plan-and-apply, plan-only, and destroy runs
        if (run.operation === 'plan-and-apply' || run.operation === 'plan-only' || run.operation === 'destroy') {
          return true;
        }
        // For legacy apply runs, check if there's a corresponding plan-and-apply run with the same config version
        if (run.operation === 'apply' && run.configuration_version_id) {
          // Check if there's a plan-and-apply run with the same config version created before this apply run
          const hasPlanAndApplyRun = fetchedRuns.some((r: Run) => 
            r.operation === 'plan-and-apply' &&
            r.configuration_version_id === run.configuration_version_id &&
            new Date(r.created_at) <= new Date(run.created_at)
          );
          // Filter out this apply run if there's a corresponding plan-and-apply run
          return !hasPlanAndApplyRun;
        }
        // Keep legacy plan runs (for backward compatibility)
        return true;
      });
      
      // Deduplicate runs by ID to prevent duplicates from StrictMode double-rendering
      const uniqueRuns = Array.from(
        new Map(filteredRuns.map((run: Run) => [run.id, run])).values()
      );
      
      // Handle state versions response - backend returns { data: StateVersion[], meta: {...} }
      // stateVersionsApi.list() extracts .data, so statesRes should be StateVersion[]
      // Backend returns models.StateVersion with JSON tags (snake_case), so field names should match
      let stateVersionsData: StateVersion[] = [];
      if (Array.isArray(statesRes)) {
        stateVersionsData = statesRes as StateVersion[];
      } else if (statesRes && typeof statesRes === 'object' && 'data' in statesRes) {
        // Handle case where response wrapper wasn't unwrapped
        const data = (statesRes as { data?: unknown }).data;
        if (Array.isArray(data)) {
          stateVersionsData = data as StateVersion[];
        }
      }
      console.log('State versions loaded:', stateVersionsData.length, stateVersionsData);
      
      // Filter variable sets to only show those applicable to this workspace
      // Organization-scoped sets apply to all workspaces (unless filtered by project)
      // Workspace-scoped sets only apply if assigned to this workspace
      let applicableSets = Array.isArray(varSetsRes) ? varSetsRes : [];
      
      // Filter to the sets that apply to this workspace. AUD-150: the client-side `scope` is derived
      // from the API `global` flag (scope==='organization' ⇔ global). A global set applies to every
      // workspace; a non-global org-owned set applies only where its project or the workspace itself is
      // attached. (Attachments may be absent from the list response — the per-set detail fetch below
      // re-checks precisely, so keep unloaded candidates here rather than dropping them.)
      applicableSets = applicableSets.filter(vs => {
        if (vs.scope === 'organization') {
          return true; // global — applies to all workspaces
        }
        const projectMatch = vs.projects?.some((p: { id?: string }) => p.id === workspaceRes.project_id);
        const workspaceMatch = vs.workspaces?.some((w: { id?: string }) => w.id === workspaceRes.id);
        const attachmentsNotLoaded =
          (!vs.projects || vs.projects.length === 0) && (!vs.workspaces || vs.workspaces.length === 0);
        return Boolean(projectMatch || workspaceMatch || attachmentsNotLoaded);
      });
      
      // Load full details for each variable set to ensure we have variables and correct filtering
      const setsWithDetails = await Promise.all(
        applicableSets.map(async (vs) => {
          try {
            const fullSet = await variableSetsApi.get(orgName!, vs.id);
            // Precise re-check with the fully-loaded attachments. A non-global set (scope!=='organization')
            // applies only if this workspace's project is attached or the workspace itself is attached.
            if (fullSet.scope !== 'organization') {
              const projectMatch = fullSet.projects?.some((p: { id?: string }) => p.id === workspaceRes.project_id);
              const workspaceMatch = fullSet.workspaces?.some((w: { id?: string }) => w.id === workspaceRes.id);
              if (!projectMatch && !workspaceMatch) {
                return null; // does not apply to this workspace
              }
            }
            return fullSet;
          } catch (err) {
            console.error(`Failed to load details for variable set ${vs.id}:`, err);
            return vs; // Return original if fetch fails
          }
        })
      );
      
      // Filter out null values (sets that were filtered out)
      const filteredSets = setsWithDetails.filter((vs): vs is VariableSet => vs !== null);
      
      return {
        workspace: workspaceRes,
        runs: uniqueRuns,
        stateVersions: stateVersionsData,
        variables: Array.isArray(varsRes) ? varsRes as Variable[] : [],
        variableSets: filteredSets,
        platformVariableKeys: Array.isArray(platformKeysRes) ? platformKeysRes as string[] : [],
      };
    },
    enabled: !!orgName && !!workspaceName,
    // Poll every 5s while there are active runs, stop when idle
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.runs) return false;
      const activeStatuses = ['running', 'pending', 'planning', 'applying', 'plan_queued', 'apply_queued'];
      return data.runs.some((r: Run) => activeStatuses.includes(r.status)) ? 5000 : false;
    },
  });

  // Derive fetched data from the query result
  const workspace = workspaceData?.workspace ?? null;
  const runs = workspaceData?.runs ?? [];
  const stateVersions = workspaceData?.stateVersions ?? [];
  const variables = workspaceData?.variables ?? [];
  const variableSets = workspaceData?.variableSets ?? [];
  const platformVariableKeys = workspaceData?.platformVariableKeys ?? [];

  // `inlineDescription` is seeded when editing starts (the "Add description"
  // button) and reset on cancel; the read-only view renders workspace.description
  // directly. So no sync effect is needed — and removing it avoids clobbering an
  // in-progress edit when a poll refetch returns a new workspace object.

  // Fetch README from VCS repository
  const { data: readmeContent, isLoading: readmeLoading } = useQuery({
    queryKey: ['workspace-readme', workspace?.vcs_connection_id, workspace?.vcs_repository, workspace?.vcs_branch, workspace?.working_directory],
    queryFn: async () => {
      const parts = workspace!.vcs_repository!.split('/');
      if (parts.length !== 2) return null;
      const [owner, repo] = parts;
      const dir = workspace!.working_directory ? `${workspace!.working_directory}/` : '';
      const candidates = [`${dir}README.md`, `${dir}readme.md`, `${dir}Readme.md`];
      for (const filepath of candidates) {
        try {
          const result = await vcsConnectionsApi.getFileContent(
            workspace!.vcs_connection_id!,
            owner,
            repo,
            filepath,
            workspace!.vcs_branch || undefined,
          );
          return result.content;
        } catch {
          // Try next candidate
        }
      }
      return null;
    },
    enabled: !!workspace?.vcs_connection_id && !!workspace?.vcs_repository,
  });

  // Fetch plan output for latest run
  const latestRun = runs.length > 0 ? runs[0] : null;
  // Ticking clock for the live run-duration display — only ticks while the
  // latest run is in progress. Passed into the pure calculateRunDuration so it
  // never calls Date.now() during render (react-hooks/purity).
  const now = useNow(!!latestRun && isRunActive(latestRun));
  const shouldFetchPlan = latestRun && (
    (latestRun.operation === 'plan-and-apply' && 
     (latestRun.status === 'planned' || latestRun.status === 'applying' || latestRun.status === 'applied')) ||
    ((latestRun.operation === 'plan-only' || latestRun.operation === 'plan') && 
     (latestRun.status === 'planned' || latestRun.status === 'completed')) ||
    (latestRun.operation === 'destroy' && 
     (latestRun.status === 'planned' || latestRun.status === 'applying' || latestRun.status === 'applied' || latestRun.status === 'completed'))
  );
  const { data: latestRunPlanOutput } = useQuery({
    queryKey: ['plan-output', latestRun?.id, latestRun?.status],
    queryFn: async () => {
      const planOutput = await runsApi.getPlan(latestRun!.id);
      if (planOutput && typeof planOutput === 'object' && Object.keys(planOutput).length > 0) {
        return planOutput as Record<string, unknown>;
      }
      return null;
    },
    enabled: !!shouldFetchPlan,
  });

  // TFE-compatible: Support "Plan only", "Plan and Apply", and "Destroy"
  // "Plan and Apply" is a single run that goes through both phases (planning → planned → applying → applied)
  const handleCreateRun = (operation: 'plan-only' | 'plan-and-apply' | 'destroy') => {
    if (!workspace || isCreatingRun) return; // Prevent duplicate calls

    setIsCreatingRun(true);
    
    const isDestroy = operation === 'destroy';
    const isPlanAndApply = operation === 'plan-and-apply';
    
    // TFE-compatible: Send explicit operation type
    // auto_apply_after_plan controls whether the run auto-applies after plan
    // (derived from workspace auto_apply setting, not from operation type)
    void runsApi.create({ 
      workspace_id: workspace.id,
      operation: isDestroy ? 'destroy' as const : (isPlanAndApply ? 'plan-and-apply' as const : 'plan-only' as const),
      auto_apply_after_plan: isPlanAndApply && (workspace.auto_apply === true),
    })
      .then((runRes) => {
        // Convert JSON:API format to Run object
        const run = getRunFromJsonApi(runRes.data);
        const message = isDestroy ? 'Destroy run created' : 'Plan run created';
        toast.success(message);
        setCreateRunDialogOpen(false);
        // Navigate to the run detail page
        if (run?.id) {
          void navigate(`/app/${orgName}/workspaces/${workspaceName}/runs/${run.id}`);
        } else {
          // Fallback: reload workspace data
          void refetchData();
        }
      })
      .catch((err) => {
        console.error('Failed to create run:', err);
        toast.error('Failed to create run');
      })
      .finally(() => {
        setIsCreatingRun(false);
      });
  };

  const handleCreateVariable = () => {
    if (!workspace || !variableForm.key.trim() || !variableForm.value.trim()) {
      toast.error('Key and value are required');
      return;
    }

    // Check if this would override a platform variable (only for new variables, not edits)
    if (!editingVariable && platformVariableKeys.includes(variableForm.key.trim())) {
      // Show warning dialog
      setPendingVariableCreate(() => () => {
        // This function will be called if user confirms
        const apiCall = variablesApi.create(workspace.id, variableForm);
        void apiCall
          .then(() => {
            toast.success('Variable created');
            setCreateVariableDialogOpen(false);
            setEditingVariable(null);
            setVariableForm({ key: '', value: '', description: '', category: 'terraform', hcl: false, sensitive: false, encrypted: false });
            void refetchData();
          })
          .catch((err) => {
            console.error('Failed to save variable:', err);
            toast.error('Failed to save variable');
          });
      });
      setPlatformVariableOverrideWarningOpen(true);
      return;
    }

    // Normal create/update flow
    const apiCall = editingVariable
      ? variablesApi.update(workspace.id, editingVariable.id, variableForm)
      : variablesApi.create(workspace.id, variableForm);

    void apiCall
      .then(() => {
        toast.success(editingVariable ? 'Variable updated' : 'Variable created');
        setCreateVariableDialogOpen(false);
        setEditingVariable(null);
        setVariableForm({ key: '', value: '', description: '', category: 'terraform', hcl: false, sensitive: false, encrypted: false });
        void refetchData();
      })
      .catch((err) => {
        console.error('Failed to save variable:', err);
        toast.error('Failed to save variable');
      });
  };

  const handleDeleteResource = async () => {
    if (!workspace || !resourceToDelete) return;

    try {
      setDeletingResource(true);
      await stateVersionsApi.removeResource(workspace.id, resourceToDelete);
      toast.success(`Resource ${resourceToDelete} removed from state`);
      setDeleteResourceDialogOpen(false);
      setResourceToDelete(null);
      // Reload data to refresh the resources view
      void refetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove resource from state';
      toast.error(errorMessage);
    } finally {
      setDeletingResource(false);
    }
  };

  const handleSaveInlineDescription = async () => {
    if (!workspace || !orgName || !workspaceName) return;

    setSavingDescription(true);
    try {
      await workspacesApi.update(orgName, workspaceName, {
        name: workspace.name,
        description: inlineDescription.trim() || undefined,
      });
      void refetchData();
      setIsEditingDescription(false);
      toast.success('Description updated successfully');
    } catch (err: unknown) {
      console.error('Failed to update description:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update description';
      toast.error(errorMessage);
    } finally {
      setSavingDescription(false);
    }
  };

  const handleCancelInlineDescription = () => {
    setInlineDescription(workspace?.description || '');
    setIsEditingDescription(false);
  };

  const handleDeleteVariable = () => {
    if (!workspace || !variableToDelete) return;

    setDeletingVariable(true);
    void variablesApi.delete(workspace.id, variableToDelete.id)
      .then(() => {
        toast.success('Variable deleted');
        setDeleteVariableDialogOpen(false);
        setVariableToDelete(null);
        void refetchData();
      })
      .catch((err) => {
        console.error('Failed to delete variable:', err);
        toast.error('Failed to delete variable');
      })
      .finally(() => {
        setDeletingVariable(false);
      });
  };

  const handleDeleteWorkspace = async (force = false) => {
    if (!workspace || !orgName) return;

    // Force delete requires typing the workspace name
    if (force && deleteConfirmName !== workspace.name) {
      toast.error('Please type the workspace name to confirm force deletion');
      return;
    }

    setDeleting(true);
    try {
      await workspacesApi.delete(orgName, workspace.name, force);
      toast.success('Workspace deleted successfully');
      setDeleteDialogOpen(false);
      void navigate(`/app/${orgName}/workspaces`);
    } catch (error: unknown) {
      console.error('Failed to delete workspace:', error);
      // Check if this is a 409 Conflict (active infrastructure)
      const isConflict = error instanceof Error && 'response' in error &&
        typeof error.response === 'object' && error.response !== null &&
        'status' in error.response && error.response.status === 409;

      if (isConflict && !force) {
        // Switch to force delete mode
        setForceDeleteMode(true);
        setDeleting(false);
        return;
      }

      const errorMessage = (error instanceof Error && 'response' in error && typeof error.response === 'object' && error.response !== null && 'data' in error.response && typeof error.response.data === 'object' && error.response.data !== null && 'errors' in error.response.data && Array.isArray(error.response.data.errors) && error.response.data.errors.length > 0 && typeof error.response.data.errors[0] === 'object' && error.response.data.errors[0] !== null && 'detail' in error.response.data.errors[0] && typeof error.response.data.errors[0].detail === 'string')
        ? error.response.data.errors[0].detail
        : (error instanceof Error ? error.message : 'Failed to delete workspace');
      toast.error(errorMessage);
      setDeleting(false);
    }
  };

  // Compute run status badge using unified utility
  const getRunStatusBadge = (run: Run) => {
    // Use has-changes from API response (backend includes it in attributes)
    const hasChanges = run['has-changes'];
    
    const displayStatus = computeDisplayStatus({
      status: run.status,
      operation: run.operation,
      planOnly: run.plan_only,
      hasChanges,
      canApply: run.permissions?.['can-apply'],
    });
    return <StatusBadge status={displayStatus} variant="outline" />;
  };
  

  const formatTimeout = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = seconds / 3600;
      if (hours % 1 === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);
        if (minutes === 0) {
          return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''}`;
        }
        return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
    }
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

  const filteredRuns = runs.filter(run => {
    const matchesSearch = searchQuery === '' ||
      run.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.operation.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter with TFE-style status mapping
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      const isPlanOnly = run.plan_only || run.operation === 'plan-only' || run.operation === 'plan';
      switch (statusFilter) {
        case 'errored':
          matchesStatus = run.status === 'failed'; // 'errored' is not a valid status, use 'failed'
          break;
        case 'running':
          matchesStatus = ['running', 'planning', 'applying'].includes(run.status);
          break;
        case 'on_hold':
          // Plan-only runs in "planned" status are finished, not on hold
          matchesStatus = run.status === 'pending' || (run.status === 'planned' && !isPlanOnly);
          break;
        case 'success':
          // Plan-only runs in "planned" status are also considered success
          matchesStatus = run.status === 'applied' || run.status === 'completed' || (run.status === 'planned' && isPlanOnly);
          break;
        default:
          matchesStatus = run.status === statusFilter;
      }
    }
    
    return matchesSearch && matchesStatus;
  });

  const latestStateVersionSummary = stateVersions.length > 0 ? stateVersions[0] : null;

  // Fetch latest state version metadata (created_at, version) — used for the CREATED column
  // and as an existence guard. Resources/outputs come from the materialized endpoints below,
  // not from the (deprecated) inline state_data blob.
  const { data: latestStateVersion } = useQuery({
    queryKey: ['latest-state-version-full', latestStateVersionSummary?.id],
    queryFn: () => stateVersionsApi.get(latestStateVersionSummary!.id),
    enabled: !!latestStateVersionSummary?.id,
  });

  // Materialized current-state resources/outputs (State Storage Rework) — served from the
  // dedicated tables, so the tabs/counts no longer parse the raw state blob.
  const { data: currentResourcesData } = useQuery({
    queryKey: ['current-state-resources', workspace?.id],
    queryFn: () => stateVersionsApi.currentResources(workspace!.id),
    enabled: !!workspace?.id,
  });
  const { data: currentOutputsData } = useQuery({
    queryKey: ['current-state-outputs', workspace?.id],
    queryFn: () => stateVersionsApi.currentOutputs(workspace!.id),
    enabled: !!workspace?.id,
  });
  const managedResources = (currentResourcesData ?? []).filter(r => r.mode === 'managed');
  const dataSources = (currentResourcesData ?? []).filter(r => r.mode === 'data');
  const stateOutputs = currentOutputsData ?? [];
  const stateCreatedAt = latestStateVersion?.created_at;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Workspace not found</p>
          <Button onClick={() => { void navigate(`/app/${orgName}/workspaces`); }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workspaces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`/app/${orgName}/workspaces`} className="hover:text-foreground">
          {orgName}
        </Link>
        <span>/</span>
        <Link to={`/app/${orgName}/workspaces`} className="hover:text-foreground">
          Workspaces
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{workspace.name}</span>
      </div>

      {/* Lock Banner */}
      {workspace.locked && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex items-center gap-3">
          <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <div className="flex-1">
            <div className="font-medium text-orange-600 dark:text-orange-400">
              Workspace manually locked
            </div>
            <div className="text-sm text-muted-foreground">
              This workspace has been manually locked{workspace.locked_at ? ` at ${new Date(workspace.locked_at).toLocaleString()}` : ''}.
              {workspace.locked_by ? ` Locked by: ${workspace.locked_by}` : ''}
              {workspace.locked_reason ? ` Reason: ${workspace.locked_reason}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {workspace.name}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span>ID: {workspace.id}</span>
            <Copy 
              className="h-3.5 w-3.5 cursor-pointer hover:text-foreground" 
              onClick={() => { void navigator.clipboard.writeText(workspace.id).then(() => {
                toast.success('Workspace ID copied');
              }); }}
            />
          </div>
          {isEditingDescription ? (
            <div className="flex items-center gap-2">
              <Input
                value={inlineDescription}
                onChange={(e) => setInlineDescription(e.target.value)}
                placeholder="Add workspace description"
                className="max-w-md"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleSaveInlineDescription();
                  } else if (e.key === 'Escape') {
                    handleCancelInlineDescription();
                  }
                }}
                autoFocus
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { void handleSaveInlineDescription(); }}
                disabled={savingDescription}
              >
                {savingDescription ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelInlineDescription}
                disabled={savingDescription}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                setInlineDescription(workspace.description || '');
                setIsEditingDescription(true);
              }}
            >
              {workspace.description || 'Add workspace description.'}
            </button>
          )}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
              {workspace.locked ? (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Locked{workspace.locked_by ? ` by ${workspace.locked_by}` : ''}</span>
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" />
                  <span>Unlocked</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <span>Resources {managedResources.length}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="h-4 w-4" />
              <span>Outputs {stateOutputs.length}</span>
            </div>
            {workspace.terraform_version && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span>Terraform {workspace.terraform_version}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Updated {formatTimeAgo(new Date(workspace.updated_at))}</span>
            </div>
            {workspace.execution_mode === 'agent' && workspace.agent_pool_name && (
              <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                <Server className="h-4 w-4" />
                <span>{workspace.agent_pool_name}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => { setEditWorkspaceDialogOpen(true); }}
            disabled={!workspace}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              void (async () => {
                if (!workspace) return;
                try {
                  if (workspace.locked) {
                    // Try normal unlock first
                    try {
                      await workspacesApi.unlock(workspace.id);
                      void refetchData();
                      toast.success('Workspace unlocked');
                    } catch (unlockErr: unknown) {
                      // If locked by different user, try force-unlock
                      const unlockErrResponse = (unlockErr instanceof Error && 'response' in unlockErr && typeof unlockErr.response === 'object' && unlockErr.response !== null) 
                        ? unlockErr.response as { status?: number; data?: { errors?: Array<{ detail?: string }> } } 
                        : null;
                      if (unlockErrResponse?.status === 409 &&
                          unlockErrResponse?.data?.errors?.[0]?.detail?.includes('different user')) {
                        const forceUnlock = confirm('This workspace is locked by a different user. Would you like to force unlock it?');
                        if (forceUnlock) {
                          await workspacesApi.forceUnlock(workspace.id);
                          void refetchData();
                          toast.success('Workspace force unlocked');
                        }
                      } else {
                        throw unlockErr;
                      }
                    }
                  } else {
                    // Open dialog for lock reason
                    setLockReason('');
                    setLockDialogOpen(true);
                  }
                } catch (err: unknown) {
                  const errorMessage = (err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response !== null && 'data' in err.response && typeof err.response.data === 'object' && err.response.data !== null && 'errors' in err.response.data && Array.isArray(err.response.data.errors) && err.response.data.errors.length > 0 && typeof err.response.data.errors[0] === 'object' && err.response.data.errors[0] !== null && 'detail' in err.response.data.errors[0] && typeof err.response.data.errors[0].detail === 'string')
                    ? err.response.data.errors[0].detail
                    : (err instanceof Error ? err.message : 'Failed to toggle lock');
                  toast.error(errorMessage);
                }
              })();
            }}
            disabled={!workspace}
          >
            {workspace?.locked ? (
              <>
                <Unlock className="mr-2 h-4 w-4" />
                Unlock
              </>
            ) : (
              <>
            <Lock className="mr-2 h-4 w-4" />
            Lock
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => { setDeleteDialogOpen(true); }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button size="sm" onClick={() => { setCreateRunDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            New run
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {latestRun && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Latest Run</h2>
              <Link
                to={`/app/${orgName}/workspaces/${workspaceName}/runs/${latestRun.id}`}
                className="block border rounded-lg p-6 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <PlayCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">
                        {latestRun.operation === 'plan-and-apply' ? 'Plan-and-apply Run' :
                         latestRun.operation === 'plan-only' ? 'Plan Only Run' :
                         latestRun.operation === 'destroy' ? 'Destroy Run' :
                         latestRun.operation.charAt(0).toUpperCase() + latestRun.operation.slice(1) + ' Run'} {latestRun.id}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <RunSourceDisplay run={latestRun} workspace={workspace || undefined} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getRunStatusBadge(latestRun)}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="text-muted-foreground mb-2 text-center">Policy checks</div>
                    <div className="font-medium text-center">—</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-muted-foreground mb-2 text-center">Estimated cost change</div>
                    <div className="font-medium text-center">—</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-muted-foreground mb-2 text-center">Plan & apply duration</div>
                    <div className="font-medium text-center">{calculateRunDuration(latestRun, now) ?? '—'}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-muted-foreground mb-2 text-center">
                      {latestRun.operation === 'destroy' ? 'Resources destroyed' : 'Resource impact'}
                    </div>
                    {(() => {
                      // Use plan output from state if available, otherwise use run's plan_output
                      const planOutput = latestRunPlanOutput ?? latestRun.plan_output;
                      const impact = calculateResourceImpact(planOutput);
                      
                      if (!impact) {
                        return <div className="font-medium text-center">—</div>;
                      }
                      
                      // For destroy runs, only show delete count
                      if (latestRun.operation === 'destroy') {
                        return (
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            {impact.delete > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-red-500/20">
                                <Minus className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                <span className="text-xs font-semibold text-red-600 dark:text-red-400">{impact.delete}</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      
                      // For other runs, show all action types
                      return (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {impact.add > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-green-500/20">
                              <Plus className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              <span className="text-xs font-semibold text-green-600 dark:text-green-400">{impact.add}</span>
                            </div>
                          )}
                          {impact.update > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-blue-500/20">
                              <ArrowRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{impact.update}</span>
                            </div>
                          )}
                          {impact.replace > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-orange-500/20">
                              <RotateCw className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{impact.replace}</span>
                            </div>
                          )}
                          {impact.delete > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-red-500/20">
                              <Minus className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                              <span className="text-xs font-semibold text-red-600 dark:text-red-400">{impact.delete}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void navigate(`/app/${orgName}/workspaces/${workspaceName}/runs/${latestRun.id}`);
                    }}
                  >
                    See details
                  </Button>
                </div>
              </Link>
            </div>
          )}

          {/* Resources and Outputs Section */}
          <div className="space-y-6">
            <Tabs defaultValue="resources" className="w-full">
              <TabsList>
                <TabsTrigger value="resources">
                  Resources ({managedResources.length})
                </TabsTrigger>
                <TabsTrigger value="data-sources">
                  Data Sources ({dataSources.length})
                </TabsTrigger>
                <TabsTrigger value="outputs">
                  Outputs ({stateOutputs.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="resources" className="mt-4">
                <div className="border rounded-lg overflow-hidden">
                  {managedResources.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <p>This workspace does not have any resources.</p>
                      <p className="text-sm mt-2">Resources will appear here after you apply your first Terraform configuration.</p>
                    </div>
                  ) : (() => {
                    const created = stateCreatedAt
                      ? new Date(stateCreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';
                    const filtered = managedResources.filter((resource) => {
                      if (!resourceFilter.trim()) return true;
                      const f = resourceFilter.toLowerCase();
                      return resource.address.toLowerCase().includes(f) ||
                             resource.type.toLowerCase().includes(f) ||
                             cleanStateProvider(resource.provider).toLowerCase().includes(f);
                    });
                    return (
                      <>
                        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Filter resources by address..."
                              aria-label="Filter resources by address"
                              className="max-w-sm"
                              value={resourceFilter}
                              onChange={(e) => setResourceFilter(e.target.value)}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Current as of the most recent state version.
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                              <tr>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">NAME</th>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">PROVIDER</th>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">TYPE</th>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">MODULE</th>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">CREATED</th>
                                <th scope="col" className="text-right px-4 py-3 text-sm font-semibold">ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((resource, idx) => (
                                <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="font-mono text-sm">{resource.address}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-muted-foreground">{cleanStateProvider(resource.provider)}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm">{resource.type}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-muted-foreground">{resource.module || 'root'}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-muted-foreground">{created}</div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setResourceToDelete(resource.address);
                                        setDeleteResourceDialogOpen(true);
                                      }}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </TabsContent>
              
              <TabsContent value="data-sources" className="mt-4">
                <div className="border rounded-lg overflow-hidden">
                  {dataSources.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <p>This workspace does not have any data sources.</p>
                      <p className="text-sm mt-2">Data sources will appear here after you apply your first Terraform configuration.</p>
                    </div>
                  ) : (() => {
                    const created = stateCreatedAt
                      ? new Date(stateCreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';
                    const filtered = dataSources.filter((resource) => {
                      if (!resourceFilter.trim()) return true;
                      const f = resourceFilter.toLowerCase();
                      return resource.address.toLowerCase().includes(f) ||
                             resource.type.toLowerCase().includes(f) ||
                             cleanStateProvider(resource.provider).toLowerCase().includes(f);
                    });
                    return (
                      <>
                        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Filter data sources by address..."
                              aria-label="Filter data sources by address"
                              className="max-w-sm"
                              value={resourceFilter}
                              onChange={(e) => setResourceFilter(e.target.value)}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Current as of the most recent state version.
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                              <tr>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">NAME</th>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">PROVIDER</th>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">TYPE</th>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">MODULE</th>
                                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">CREATED</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((resource, idx) => (
                                <tr key={`${resource.address}-${idx}`} className="border-b hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="font-mono text-sm">{resource.name}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm">{cleanStateProvider(resource.provider)}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm">{resource.type}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-muted-foreground">{resource.module || 'root'}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-muted-foreground">{created}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </TabsContent>
              
              <TabsContent value="outputs" className="mt-4">
                <div className="border rounded-lg overflow-hidden">
                  {stateOutputs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <p>No outputs available.</p>
                      <p className="text-sm mt-2">Outputs will appear here when defined in your Terraform configuration.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 border-b bg-muted/30">
                        <p className="text-sm text-muted-foreground">
                          Current as of the most recent state version.
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">NAME</th>
                              <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">VALUE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stateOutputs.map((output) => (
                              <tr key={output.name} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-mono text-sm font-medium">{output.name}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm">
                                    {output.sensitive ? (
                                      <span className="text-muted-foreground italic">(sensitive)</span>
                                    ) : (
                                      <pre className="text-sm font-mono bg-muted/50 p-2 rounded-sm overflow-x-auto max-w-2xl">
                                        {JSON.stringify(output.value, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* README Section */}
          {workspace.vcs_connection_id && workspace.vcs_repository && (
            readmeLoading ? (
              <div className="border rounded-lg p-6 bg-muted/30">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">README</h3>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading README...</span>
                </div>
              </div>
            ) : readmeContent ? (
              <div className="border rounded-lg p-6 bg-muted/30">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">README</h3>
                </div>
                <div className="max-w-4xl">
                  <MarkdownRenderer
                    content={readmeContent}
                    enableCallouts={true}
                    enableCodeGroups={true}
                    enableMermaid={true}
                  />
                </div>
              </div>
            ) : null
          )}

          {/* Right Sidebar Info */}
          <div className="border rounded-lg p-6 bg-muted/30">
            <h3 className="text-lg font-semibold mb-4">Workspace Settings</h3>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Execution Mode</div>
                <div className="font-medium">{workspace.execution_mode || 'Remote'}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Auto-apply settings</div>
                <div className="space-y-1">
                  <div>Auto-apply API, UI, & VCS runs: {workspace.auto_apply ? 'On' : 'Off'}</div>
                  <div>Auto-apply run triggers: Off</div>
                  <div>Auto-destroy: Off</div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-muted-foreground">Run Timeout</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTimeoutValue(workspace.run_timeout || 7200);
                      setTimeoutDialogOpen(true);
                    }}
                    className="h-6 px-2 text-xs"
                    id="edit-timeout"
                    name="edit-timeout"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
                <div className="font-medium">
                  {workspace.run_timeout ? formatTimeout(workspace.run_timeout) : '2 hours (default)'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Applies will be automatically cancelled after this duration
                </div>
              </div>
              {workspace.vcs_repository && (() => {
                const repoUrl = getVcsRepoUrl(
                  workspace.vcs_provider ?? '',
                  workspace.vcs_repository,
                  workspace.vcs_account_name,
                );
                return (
                  <div>
                    <div className="text-muted-foreground mb-1">Source</div>
                    {repoUrl ? (
                      <a
                        href={repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {getVcsProviderIcon(workspace.vcs_provider ?? '', 'h-3.5 w-3.5')}
                        <span>{workspace.vcs_repository}</span>
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5 text-foreground">
                        {getVcsProviderIcon(workspace.vcs_provider ?? '', 'h-3.5 w-3.5')}
                        <span>{workspace.vcs_repository}</span>
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          
          {/* Timeout Configuration Dialog */}
          <Dialog open={timeoutDialogOpen} onOpenChange={setTimeoutDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Run Timeout</DialogTitle>
                <DialogDescription>
                  Set the maximum duration for apply operations. Runs exceeding this timeout will be automatically cancelled.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout-hours">Timeout (hours)</Label>
                  <Input
                    id="timeout-hours"
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={timeoutValue / 3600}
                    onChange={(e) => {
                      const hours = parseFloat(e.target.value);
                      if (!isNaN(hours) && hours > 0) {
                        setTimeoutValue(Math.round(hours * 3600));
                      }
                    }}
                    placeholder="2"
                  />
                  <div className="text-sm text-muted-foreground">
                    Current: {formatTimeout(timeoutValue)} ({timeoutValue} seconds)
                  </div>
                </div>
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <strong>Note:</strong> This is a StackWeaver-specific feature. TFE-compatible clients will ignore this setting.
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setTimeoutDialogOpen(false)}
                  disabled={savingTimeout}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void (async () => {
                      if (!orgName || !workspaceName) return;
                      setSavingTimeout(true);
                      try {
                        await workspacesApi.update(orgName, workspaceName, {
                          'run-timeout': timeoutValue,
                        });
                        void refetchData();
                        setTimeoutDialogOpen(false);
                        toast.success('Run timeout updated successfully');
                      } catch (error) {
                        console.error('Failed to update timeout:', error);
                        toast.error(error instanceof Error ? error.message : 'Failed to update timeout');
                      } finally {
                        setSavingTimeout(false);
                      }
                    })();
                  }}
                  disabled={savingTimeout}
                >
                  {savingTimeout ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Runs Tab */}
        <TabsContent value="runs" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  statusFilter === 'all'
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                All {runs.length}
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
                Errored {runs.filter(r => r.status === 'failed').length}
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
                <Loader2 className={cn("h-4 w-4", runs.filter(r => ['running', 'planning', 'applying'].includes(r.status)).length > 0 && "animate-spin")} />
                Running {runs.filter(r => ['running', 'planning', 'applying'].includes(r.status)).length}
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
                On Hold {runs.filter(r => r.status === 'pending' || (r.status === 'planned' && !r.plan_only && r.operation !== 'plan-only' && r.operation !== 'plan')).length}
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
                Success {runs.filter(r => r.status === 'applied' || r.status === 'completed' || (r.status === 'planned' && (r.plan_only || r.operation === 'plan-only' || r.operation === 'plan'))).length}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search runs..."
                  aria-label="Search runs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="canceled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredRuns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <p>No runs found.</p>
              <p className="text-sm mt-2">Create a run to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRuns.map((run) => (
                <RunCard 
                  key={run.id} 
                  run={run} 
                  formatTimeAgo={formatTimeAgo} 
                  getRunStatusBadge={getRunStatusBadge}
                  orgName={orgName || ''}
                  workspaceName={workspaceName || ''}
                  workspace={workspace || undefined}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* States Tab */}
        <TabsContent value="states" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">State Versions</h2>
          </div>

          {stateVersions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <p>No state versions found.</p>
              <p className="text-sm mt-2">State versions are created when runs are applied.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stateVersions.map((stateVersion) => (
                <Link
                  key={stateVersion.id}
                  to={`/app/${orgName}/${workspaceName}/states/${stateVersion.id}`}
                  className="block border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <FolderOpen className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">
                          State version #{stateVersion.version}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {stateVersion.run_id && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    void navigate(`/app/${orgName}/workspaces/${workspaceName}/runs/${stateVersion.run_id}`);
                                  }}
                                  className="font-mono text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
                                >
                                  {stateVersion.run_id}
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                                <span>•</span>
                              </>
                            )}
                            {stateVersion.commit_hash && (() => {
                              const commitUrl = getCommitUrl(stateVersion.commit_hash);
                              const shortHash = stateVersion.commit_hash.slice(0, 7);
                              
                              if (commitUrl) {
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        window.open(commitUrl, '_blank', 'noopener,noreferrer');
                                      }}
                                      className="font-mono text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
                                    >
                                      {shortHash}
                                      <ExternalLink className="h-3 w-3" />
                                    </button>
                                    <span>•</span>
                                  </>
                                );
                              }
                              
                              return (
                                <>
                                  <span className="font-mono text-xs">{shortHash}</span>
                                  <span>•</span>
                                </>
                              );
                            })()}
                            {stateVersion.committer && (
                              <>
                                <span>{stateVersion.committer}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{formatTimeAgo(new Date(stateVersion.created_at))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-mono">{stateVersion.id}</span>
                      <Button variant="ghost" size="sm" asChild>
                        <span>
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Variables Tab */}
        <TabsContent value="variables" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Variables</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Terraform uses all Terraform and Environment variables for all plans and applies in this workspace. Workspace variables always override variables from variable sets that have the same type and the same key.
              </p>
            </div>
            <Button onClick={() => {
              setEditingVariable(null);
              setVariableForm({ key: '', value: '', description: '', category: 'terraform', hcl: false, sensitive: false, encrypted: false });
              setCreateVariableDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add variable
            </Button>
          </div>

          {/* Variable Sets Section */}
          {variableSets.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Variable Sets ({variableSets.length})</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Variable sets allow you to reuse variables across multiple workspaces within your organization. We recommend creating a variable set for variables used in more than one workspace.
                </p>
              </div>
              {variableSets.map((variableSet) => (
                <div key={variableSet.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-base">{variableSet.name}</div>
                      {variableSet.description && (
                        <div className="text-sm text-muted-foreground mt-1">{variableSet.description}</div>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          <span>Owned by organization</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FolderOpen className="h-4 w-4" />
                          <span>
                            {variableSet.projects && variableSet.projects.length > 0
                              ? `${variableSet.projects.length} project${variableSet.projects.length !== 1 ? 's' : ''}`
                              : variableSet.workspaces && variableSet.workspaces.length > 0
                              ? `${variableSet.workspaces.length} workspace${variableSet.workspaces.length !== 1 ? 's' : ''}`
                              : 'All projects and workspaces'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Package className="h-4 w-4" />
                          <span>{variableSet.variables?.length || 0} variable{(variableSet.variables?.length || 0) !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {variableSet.variables && variableSet.variables.length > 0 ? (
                    <div className="mt-4 border-t pt-3">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Key</th>
                              <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Value</th>
                              <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Category</th>
                            </tr>
                          </thead>
                          <tbody>
                            {variableSet.variables.map((varSetVar) => (
                              <tr key={varSetVar.id} className="border-b hover:bg-muted/30">
                                <td className="px-4 py-3">
                                  <div className="font-medium">{varSetVar.key}</div>
                                  {varSetVar.sensitive && (
                                    <Badge variant="outline" className="text-xs mt-1">Sensitive</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {varSetVar.sensitive ? (
                                    <span className="text-muted-foreground italic">••••••••</span>
                                  ) : (
                                    <span className="font-mono text-xs">{varSetVar.value}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className="text-xs">
                                    {varSetVar.category || 'terraform'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-2">No variables in this set.</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Workspace Variables Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Workspace variables ({variables.length})</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Variables defined within a workspace always overwrite variables from variable sets that have the same type and the same key.
            </p>
            {variables.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <p>There are no variables added.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Key</th>
                      <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Value</th>
                      <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Category</th>
                      <th scope="col" className="text-right px-4 py-3 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((variable) => (
                      <tr key={variable.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{variable.key}</div>
                          {variable.sensitive && (
                            <Badge variant="outline" className="text-xs mt-1">Sensitive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {variable.sensitive ? (
                            <span className="text-muted-foreground italic">••••••••</span>
                          ) : (
                            <span className="font-mono text-sm">{variable.value}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {variable.category || 'terraform'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingVariable(variable);
                                setVariableForm({
                                  key: variable.key,
                                  value: variable.sensitive ? '' : variable.value,
                                  description: variable.description || '',
                                  category: (variable.category || 'terraform') as 'terraform' | 'env',
                                  hcl: variable.hcl || false,
                                  sensitive: variable.sensitive,
                                  encrypted: variable.encrypted,
                                });
                                setCreateVariableDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVariableToDelete(variable);
                                setDeleteVariableDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Platform Variables Section (Collapsed by default) */}
          {platformVariableKeys.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <button
                onClick={() => { setPlatformVariablesSectionOpen(!platformVariablesSectionOpen); }}
                className="w-full flex items-center justify-between text-left hover:text-foreground transition-colors"
              >
                <h3 className="text-sm font-medium text-muted-foreground">Platform Variables ({platformVariableKeys.length})</h3>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  platformVariablesSectionOpen && "rotate-180"
                )} />
              </button>
                {platformVariablesSectionOpen && (
                  <div className="mt-4 space-y-3">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          These are system-provided variables. They cannot be modified, but can be overridden by creating a workspace variable with the same key.
                        </p>
                      </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden bg-muted/20">
                      <table className="w-full">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Key</th>
                            <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {platformVariableKeys.map((key) => (
                            <tr key={key} className="border-b hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <div className="font-mono text-sm">{key}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {key === 'TF_WORKSPACE_NAME' && 'The name of this workspace'}
                                {key === 'TF_WORKSPACE_ID' && 'The ID of this workspace'}
                                {key === 'TF_PROJECT_NAME' && 'The name of the project this workspace belongs to'}
                                {key === 'TF_PROJECT_ID' && 'The ID of the project this workspace belongs to'}
                                {key === 'TF_ORGANIZATION_NAME' && 'The name of the organization'}
                                {key === 'TF_ORGANIZATION_ID' && 'The ID of the organization'}
                                {!['TF_WORKSPACE_NAME', 'TF_WORKSPACE_ID', 'TF_PROJECT_NAME', 'TF_PROJECT_ID', 'TF_ORGANIZATION_NAME', 'TF_ORGANIZATION_ID'].includes(key) && 'System-provided variable'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          )}
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-6 mt-6">
          {workspace.id && <WorkspaceTags workspaceId={workspace.id} />}
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6 mt-6">
          {workspace.id && <WorkspaceNotifications scope="workspaces" id={workspace.id} />}
        </TabsContent>
      </Tabs>

      {/* Create Run Dialog */}
      <Dialog open={createRunDialogOpen} onOpenChange={setCreateRunDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start a new run</DialogTitle>
            <DialogDescription>
              Select the run type for this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              className="w-full h-auto py-3 px-4 justify-start text-left"
              variant="default"
              onClick={() => { void handleCreateRun('plan-and-apply'); }}
              disabled={isCreatingRun}
            >
              <PlayCircle className="mr-3 h-5 w-5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Plan & Apply</span>
                <span className="text-xs opacity-80 font-normal">Plan changes, then confirm to apply</span>
              </div>
            </Button>
            <Button
              className="w-full h-auto py-3 px-4 justify-start text-left"
              variant="outline"
              onClick={() => { void handleCreateRun('plan-only'); }}
              disabled={isCreatingRun}
            >
              <FileText className="mr-3 h-5 w-5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Plan Only</span>
                <span className="text-xs text-muted-foreground font-normal">Preview changes without applying</span>
              </div>
            </Button>
            <Button
              className="w-full h-auto py-3 px-4 justify-start text-left"
              variant="destructive"
              onClick={() => { void handleCreateRun('destroy'); }}
              disabled={isCreatingRun}
            >
              <Trash2 className="mr-3 h-5 w-5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Destroy</span>
                <span className="text-xs opacity-80 font-normal">Remove all managed resources</span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Variable Dialog */}
      <Dialog open={createVariableDialogOpen} onOpenChange={(open) => {
        setCreateVariableDialogOpen(open);
        if (!open) {
          setEditingVariable(null);
          setVariableForm({ key: '', value: '', description: '', category: 'terraform', hcl: false, sensitive: false, encrypted: false });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVariable ? 'Edit Variable' : 'Add Variable'}</DialogTitle>
            <DialogDescription>
              {editingVariable
                ? 'Update the variable. For sensitive variables, the value will be hidden in the UI.'
                : 'Add a new variable to this workspace.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="var-key">Key</Label>
              <Input
                id="var-key"
                value={variableForm.key}
                onChange={(e) => setVariableForm({ ...variableForm, key: e.target.value })}
                placeholder="variable_name"
              />
            </div>
            <div>
              <Label htmlFor="var-value">Value</Label>
              <Input
                id="var-value"
                type={variableForm.sensitive ? 'password' : 'text'}
                value={variableForm.value}
                onChange={(e) => setVariableForm({ ...variableForm, value: e.target.value })}
                placeholder={editingVariable?.sensitive ? 'Enter new value (current value is hidden)' : 'variable_value'}
              />
            </div>
            <div>
              <Label htmlFor="var-description">Description (optional)</Label>
              <Input
                id="var-description"
                value={variableForm.description}
                onChange={(e) => setVariableForm({ ...variableForm, description: e.target.value })}
                placeholder="Variable description"
              />
            </div>
            <div>
              <Label htmlFor="var-category">Category</Label>
              <Select
                value={variableForm.category}
                onValueChange={(value) => setVariableForm({ ...variableForm, category: value as 'terraform' | 'env' })}
              >
                <SelectTrigger id="var-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="terraform">Terraform</SelectItem>
                  <SelectItem value="env">Environment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="var-hcl"
                checked={variableForm.hcl}
                onCheckedChange={(checked) => setVariableForm({ ...variableForm, hcl: checked as boolean })}
                disabled={variableForm.category === 'env'} // HCL only applies to terraform variables
              />
              <Label htmlFor="var-hcl" className="text-sm font-normal cursor-pointer">
                HCL - Evaluate value as HCL code (Terraform variables only)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="var-sensitive"
                checked={variableForm.sensitive}
                onCheckedChange={(checked) => setVariableForm({ ...variableForm, sensitive: checked as boolean })}
              />
              <Label htmlFor="var-sensitive" className="text-sm font-normal cursor-pointer">
                Sensitive - Variable value will be hidden in the UI
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateVariableDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleCreateVariable(); }}>
              {editingVariable ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Platform Variable Override Warning Dialog */}
      <Dialog open={platformVariableOverrideWarningOpen} onOpenChange={(open) => {
        setPlatformVariableOverrideWarningOpen(open);
        if (!open) {
          setPendingVariableCreate(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              Override Platform Variable
            </DialogTitle>
            <DialogDescription>
              This variable will override the platform-provided variable <code className="px-1.5 py-0.5 bg-muted rounded-sm text-sm font-mono">{variableForm.key}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-900 dark:text-yellow-200">
                Platform variables are system-generated and cannot be modified directly. Creating this workspace variable will override the platform value for this workspace.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Platform variables provide context about your workspace, project, and organization. They are automatically available in all Terraform runs.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPlatformVariableOverrideWarningOpen(false);
                setPendingVariableCreate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingVariableCreate) {
                  pendingVariableCreate();
                  setPlatformVariableOverrideWarningOpen(false);
                  setPendingVariableCreate(null);
                }
              }}
            >
              Create Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Variable Dialog */}
      <Dialog open={deleteVariableDialogOpen} onOpenChange={(open) => {
        setDeleteVariableDialogOpen(open);
        if (!open) {
          setVariableToDelete(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Variable</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the variable "{variableToDelete?.key}"? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteVariableDialogOpen(false);
                setVariableToDelete(null);
              }}
              disabled={deletingVariable}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDeleteVariable(); }}
              disabled={deletingVariable}
            >
              {deletingVariable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Resource Dialog */}
      <Dialog open={deleteResourceDialogOpen} onOpenChange={(open) => {
        setDeleteResourceDialogOpen(open);
        if (!open) {
          setResourceToDelete(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Resource from State</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-mono font-semibold">{resourceToDelete}</span> from Terraform state?
              <br />
              <br />
              <strong>Warning:</strong> This action is equivalent to <code className="text-xs bg-muted px-1 py-0.5 rounded-sm">terraform state rm {resourceToDelete}</code>.
              The resource will be removed from state but will NOT be destroyed in the actual infrastructure.
              <br />
              <br />
              This cannot be undone without manually re-importing the resource.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteResourceDialogOpen(false);
                setResourceToDelete(null);
              }}
              disabled={deletingResource}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDeleteResource(); }}
              disabled={deletingResource}
            >
              {deletingResource ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove from State'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  Type <strong>{workspace?.name}</strong> to confirm.
                </>
              ) : (
                <>
                  Are you sure you want to delete the workspace &quot;{workspace?.name}&quot;? 
                  This action cannot be undone and will delete all associated runs, state versions, and variables.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {forceDeleteMode && (
            <div className="py-2">
              <Input
                placeholder={workspace?.name}
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
                disabled={deleting || deleteConfirmName !== workspace?.name}
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

      {/* Lock Workspace Dialog */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Workspace</DialogTitle>
            <DialogDescription>
              Locking this workspace will prevent any runs from being queued until it is unlocked.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="lock-reason">Reason (optional)</Label>
              <Input
                id="lock-reason"
                placeholder="Enter a reason for locking..."
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                void (async () => {
                  if (!workspace) return;
                  try {
                    await workspacesApi.lock(workspace.id, lockReason || undefined);
                    void refetchData();
                    setLockDialogOpen(false);
                    setLockReason('');
                    toast.success('Workspace locked');
                  } catch (err: unknown) {
                    const errorMessage = (err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response !== null && 'data' in err.response && typeof err.response.data === 'object' && err.response.data !== null && 'errors' in err.response.data && Array.isArray(err.response.data.errors) && err.response.data.errors.length > 0 && typeof err.response.data.errors[0] === 'object' && err.response.data.errors[0] !== null && 'detail' in err.response.data.errors[0] && typeof err.response.data.errors[0].detail === 'string')
                      ? err.response.data.errors[0].detail
                      : (err instanceof Error ? err.message : 'Failed to lock workspace');
                    toast.error(errorMessage);
                  }
                })();
              }}
            >
              <Lock className="mr-2 h-4 w-4" />
              Lock Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Dialog */}
      {orgName && workspaceName && (
        <EditWorkspaceDialog
          open={editWorkspaceDialogOpen}
          onOpenChange={setEditWorkspaceDialogOpen}
          orgName={orgName}
          workspace={workspace}
          onUpdated={() => {
            void refetchData();
          }}
        />
      )}
    </div>
  );
}
