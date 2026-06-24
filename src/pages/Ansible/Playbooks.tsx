// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Link, useParams } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ansiblePlaybooksApi, type AnsiblePlaybook } from '@/api/ansible';
import { getAnsiblePlaybookFromJsonApi } from '@/utils/ansible-jsonapi';
import { fetchAllPages } from '@/lib/pagination';
import { Pager } from '@/components/ui/pager';
import { vcsConnectionsApi } from '@/api/client';
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
  FolderGit2,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon, getVcsProviderLabel, getVcsRepoUrl, getVcsBranchUrl, getVcsFileUrl, getVcsManageUrl } from '@/lib/vcs';
import { VCSProviderSelector } from '@/components/vcs/VCSProviderSelector';
import { VCSProjectSelect } from '@/components/vcs/VCSProjectSelect';
import { PlaybookImportWizard } from '@/components/ansible/PlaybookImportWizard';
import { ListSortControl, ListFilterSelect, type ListControlOption } from '@/components/ansible/ListControls';
import { SyncStatusIndicator } from '@/components/ansible/SyncStatusIndicator';
import { normalizeSyncState, syncStateRank, type SyncState } from './syncStatus';

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

type PbSortKey = 'name' | 'created_at' | 'last_synced_at' | 'vcs_provider' | 'last_sync_status';
type StatusFilter = 'all' | 'failed' | 'syncing' | 'synced';

const PB_SORT_OPTIONS: ListControlOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'created_at', label: 'Created' },
  { value: 'last_synced_at', label: 'Last synced' },
  { value: 'vcs_provider', label: 'VCS provider' },
  { value: 'last_sync_status', label: 'Sync status' },
];

const STATUS_FILTER_OPTIONS: ListControlOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'failed', label: 'Failed' },
  { value: 'syncing', label: 'Syncing' },
  { value: 'synced', label: 'Synced' },
];

const STATUS_FILTER_MATCH: Record<Exclude<StatusFilter, 'all'>, SyncState> = {
  failed: 'failed',
  syncing: 'syncing',
  synced: 'success',
};

export default function Playbooks() {
  const { orgName } = useParams<{ orgName: string }>();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';
  const queryClient = useQueryClient();
  const { canManagePlaybooks } = usePermissions(selectedOrg);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<PbSortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [pbPage, setPbPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playbookToDelete, setPlaybookToDelete] = useState<AnsiblePlaybook | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Set to the server's 409 dependency message when a plain delete is blocked;
  // switches the delete dialog into the force-delete escalation.
  const [forceDeleteDetail, setForceDeleteDetail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nameTouched, setNameTouched] = useState(false); // Track if user has touched the name field

  // VCS Integration state (mirrors CreateWorkspaceDialog pattern)
  const [selectedVcsProject, setSelectedVcsProject] = useState<string>('');
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
    source_mode: 'cached',
  });

  // Fetch playbooks
  const playbooksQueryKey = ['playbooks', selectedOrg];
  const { data: playbooks = [], isLoading: loading } = useQuery({
    queryKey: playbooksQueryKey,
    queryFn: async () => {
      const { items } = await fetchAllPages((page, pageSize) =>
        ansiblePlaybooksApi.listByOrganization(selectedOrg, { page, pageSize }));
      return items.map(getAnsiblePlaybookFromJsonApi);
    },
    enabled: !!selectedOrg,
  });

  // Reopen the create dialog after a GitHub OAuth redirect (a full page load, so
  // this is genuinely mount-once). localStorage-only signal.
  useMountEffect(() => {
    const pendingDialog = localStorage.getItem('pendingPlaybookDialog');
    if (!pendingDialog) return;
    try {
      const parsed = JSON.parse(pendingDialog) as { orgName: string; timestamp: number };
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000 && parsed.orgName === selectedOrg) {
        setCreateDialogOpen(true);
      }
    } catch (err) {
      console.error('Failed to parse pending dialog state:', err);
    }
    localStorage.removeItem('pendingPlaybookDialog');
  });

  // VCS cascade for the create dialog, loaded via React Query. Each query is scoped
  // to the dialog being open and the relevant selection, so stale data clears
  // automatically — no reset-in-effect needed.
  const [pbOwner, pbRepo] = (createForm.vcs_repository || '').split('/');

  const { data: vcsConnections = [], isLoading: loadingVCS } = useQuery({
    queryKey: ['pb-create-vcs', selectedOrg],
    queryFn: async () => {
      try {
        const vcsRes = await vcsConnectionsApi.list(selectedOrg);
        const connections = Array.isArray(vcsRes) ? vcsRes : [];
        return Array.from(
          new Map(connections.map((conn) => [`${conn.provider}-${conn.account_name}-${conn.account_type}`, conn])).values(),
        );
      } catch (err) {
        console.error('Failed to load VCS connections:', err);
        toast.error('Failed to load VCS connections');
        return [];
      }
    },
    enabled: createDialogOpen && !!selectedOrg,
  });

  const { data: repositories = [], isLoading: loadingRepos } = useQuery({
    queryKey: ['pb-create-repos', createForm.vcs_connection_id, selectedVcsProject],
    queryFn: async () => {
      try {
        return (await vcsConnectionsApi.listAllRepositories(createForm.vcs_connection_id, selectedVcsProject || undefined)) || [];
      } catch (err) {
        console.error('Failed to load repositories:', err);
        toast.error('Failed to load repositories');
        return [];
      }
    },
    enabled: createDialogOpen && !!createForm.vcs_connection_id,
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['pb-create-branches', createForm.vcs_connection_id, createForm.vcs_repository],
    queryFn: async () => {
      try {
        return (await vcsConnectionsApi.listBranches(createForm.vcs_connection_id, pbOwner, pbRepo)) || [];
      } catch (err) {
        console.error('Failed to load branches:', err);
        toast.error('Failed to load branches');
        return [];
      }
    },
    enabled: createDialogOpen && !!createForm.vcs_connection_id && !!pbOwner && !!pbRepo,
  });

  const { data: yamlFiles = [], isLoading: loadingYamlFiles } = useQuery({
    queryKey: ['pb-create-yaml', createForm.vcs_connection_id, createForm.vcs_repository, createForm.vcs_branch],
    queryFn: async () => {
      try {
        return (await vcsConnectionsApi.listYamlFiles(createForm.vcs_connection_id, pbOwner, pbRepo, createForm.vcs_branch)) || [];
      } catch (err) {
        console.error('Failed to load YAML files:', err);
        return [];
      }
    },
    enabled: createDialogOpen && !!createForm.vcs_connection_id && !!createForm.vcs_repository && !!createForm.vcs_branch && !!pbOwner && !!pbRepo,
  });

  // Auto-select the sole VCS connection once it loads (during render, once per load).
  const connAutoKey = createDialogOpen && vcsConnections.length === 1 ? vcsConnections[0].id : null;
  const [prevConnAutoKey, setPrevConnAutoKey] = useState<string | null>(null);
  if (connAutoKey && connAutoKey !== prevConnAutoKey) {
    setPrevConnAutoKey(connAutoKey);
    if (!createForm.vcs_connection_id) {
      setCreateForm((prev) => ({ ...prev, vcs_connection_id: connAutoKey }));
    }
  }

  // Default the branch once a repo's branches load (during render, once per repo).
  const branchDefaultKey = createForm.vcs_repository && branches.length > 0
    ? `${createForm.vcs_connection_id}|${createForm.vcs_repository}`
    : null;
  const [prevBranchDefaultKey, setPrevBranchDefaultKey] = useState<string | null>(null);
  if (branchDefaultKey && branchDefaultKey !== prevBranchDefaultKey) {
    setPrevBranchDefaultKey(branchDefaultKey);
    const repoObj = repositories.find((r) => r.full_name === createForm.vcs_repository);
    const defaultBranch = repoObj?.default_branch;
    let nextBranch = '';
    if (defaultBranch && branches.some((b) => b.name === defaultBranch)) nextBranch = defaultBranch;
    else if (branches.length > 0) nextBranch = branches[0].name;
    if (nextBranch) setCreateForm((prev) => ({ ...prev, vcs_branch: nextBranch }));
  }

  // Auto-focus search input when repository select opens
  useEffect(() => {
    if (repositorySelectOpen && repositorySearchInputRef.current) {
      setTimeout(() => {
        repositorySearchInputRef.current?.focus();
      }, 100);
    }
  }, [repositorySelectOpen]);

  // Auto-generate the name from repo-branch-path while the user hasn't touched it
  // (during render, keyed on the source fields).
  const autoNameKey = !nameTouched && createForm.vcs_repository
    ? `${createForm.vcs_repository}|${createForm.vcs_branch}|${createForm.playbook_path}`
    : null;
  const [prevAutoNameKey, setPrevAutoNameKey] = useState<string | null>(null);
  if (autoNameKey !== null && autoNameKey !== prevAutoNameKey) {
    setPrevAutoNameKey(autoNameKey);
    const repoName = createForm.vcs_repository.split('/').pop() || '';
    const branch = createForm.vcs_branch || '';
    const path = createForm.playbook_path?.replace(/\.ya?ml$/i, '').replace(/\//g, '-') || '';
    const parts = [repoName];
    if (branch) parts.push(branch);
    if (path && path !== 'site') parts.push(path);
    const autoName = parts.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    setCreateForm((prev) => ({ ...prev, name: autoName }));
  }

  // VCS provider filter options, derived from the loaded set so the dropdown only
  // lists providers actually in use (plus the "all" default).
  const providerOptions: ListControlOption[] = [
    { value: 'all', label: 'All providers' },
    ...Array.from(new Set(playbooks.map((pb) => pb.vcs_provider).filter((p): p is string => !!p)))
      .sort()
      .map((p) => ({ value: p, label: getVcsProviderLabel(p) })),
  ];

  const filtersActive = searchQuery !== '' || statusFilter !== 'all' || providerFilter !== 'all';

  // Transform order MUST be search → status/provider filter → sort → slice(window),
  // so sorting orders the FULL set, not just the visible page (see plan's critical constraint).
  const sortedPlaybooks = playbooks
    .filter((pb) =>
      pb.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pb.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pb.playbook_path?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((pb) => statusFilter === 'all' || normalizeSyncState(pb.last_sync_status) === STATUS_FILTER_MATCH[statusFilter])
    .filter((pb) => providerFilter === 'all' || pb.vcs_provider === providerFilter)
    .slice()
    .sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'created_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'last_synced_at':
          return dir * ((a.last_synced_at ? new Date(a.last_synced_at).getTime() : 0) - (b.last_synced_at ? new Date(b.last_synced_at).getTime() : 0));
        case 'vcs_provider':
          return dir * (a.vcs_provider || '').localeCompare(b.vcs_provider || '');
        case 'last_sync_status':
          return dir * (syncStateRank(a.last_sync_status) - syncStateRank(b.last_sync_status));
        case 'name':
        default:
          return dir * (a.name || '').localeCompare(b.name || '');
      }
    });

  const PB_PAGE_SIZE = 12;
  const pbTotalPages = Math.max(1, Math.ceil(sortedPlaybooks.length / PB_PAGE_SIZE));
  const currentPbPage = Math.min(pbPage, pbTotalPages);
  const paginatedPlaybooks = sortedPlaybooks.slice(
    (currentPbPage - 1) * PB_PAGE_SIZE,
    currentPbPage * PB_PAGE_SIZE,
  );

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setProviderFilter('all');
    setPbPage(1);
  };

  const handleDelete = async (force = false) => {
    if (!playbookToDelete) return;

    setDeleting(true);
    try {
      await ansiblePlaybooksApi.delete(playbookToDelete.id, { force });
      queryClient.setQueryData<AnsiblePlaybook[]>(playbooksQueryKey, (old) =>
        (old || []).filter((pb) => pb.id !== playbookToDelete.id)
      );
      setDeleteDialogOpen(false);
      setPlaybookToDelete(null);
      setForceDeleteDetail(null);
      toast.success(force ? 'Playbook and all dependent resources deleted' : 'Playbook deleted successfully');
    } catch (err: unknown) {
      console.error('Failed to delete playbook:', err);
      // A 409 means dependent resources block the delete — escalate the dialog
      // to offer force delete instead of just surfacing a toast.
      if (!force && (err as Error & { status?: number }).status === 409) {
        setForceDeleteDetail(err instanceof Error ? err.message : 'The playbook is referenced by other resources.');
        return;
      }
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
        source_mode: createForm.source_mode || 'cached',
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
      source_mode: 'cached',
    });
    setSelectedVcsProject('');
    setNameTouched(false);
    setRepositorySearch('');
    setPlaybookPathSearch('');
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
        {canManagePlaybooks && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <FolderGit2 className="h-4 w-4 mr-2" />
              Import from repository
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Playbook
            </Button>
          </div>
        )}
      </div>

      {/* Search + sort + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search playbooks..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPbPage(1); }}
            className="pl-10"
          />
        </div>
        <ListFilterSelect
          ariaLabel="Filter by sync status"
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPbPage(1); }}
        />
        {providerOptions.length > 1 && (
          <ListFilterSelect
            ariaLabel="Filter by VCS provider"
            value={providerFilter}
            options={providerOptions}
            onValueChange={(v) => { setProviderFilter(v); setPbPage(1); }}
          />
        )}
        <ListSortControl
          value={sortBy}
          order={sortOrder}
          options={PB_SORT_OPTIONS}
          onValueChange={(v) => { setSortBy(v as PbSortKey); setPbPage(1); }}
          onOrderChange={(o) => { setSortOrder(o); setPbPage(1); }}
        />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Playbooks List */}
      {sortedPlaybooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {statusFilter === 'failed' ? 'No failed playbooks 🎉' : 'No playbooks found'}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {filtersActive
                ? 'No playbooks match the current filters.'
                : 'No playbooks have been created yet. Click the button above to create your first playbook.'}
            </p>
            {filtersActive ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canManagePlaybooks && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Playbook
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4">
          {paginatedPlaybooks.map((playbook) => (
            <Card key={playbook.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
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
                      <Button variant="ghost" size="icon" className="shrink-0">
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
                      {canManagePlaybooks && (
                        <>
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
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {/* VCS Badge — provider tag stays short/categorical; the repo path is
                      the navigation target rendered inline right after it (merged from #118). */}
                  {playbook.vcs_connection_id && playbook.vcs_provider && (
                    <Badge variant="outline" className="gap-1">
                      {getVcsProviderIcon(playbook.vcs_provider, 'h-3 w-3')}
                      {getVcsProviderLabel(playbook.vcs_provider)}
                    </Badge>
                  )}

                  {/* Repository (inline after the badge — replaces the old separate line) */}
                  {playbook.vcs_repository && (() => {
                    const repoUrl = getVcsRepoUrl(playbook.vcs_provider ?? '', playbook.vcs_repository ?? '', playbook.vcs_account_name);
                    return repoUrl ? (
                      <a href={repoUrl} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground hover:underline truncate max-w-[16rem]"
                        onClick={(e) => e.stopPropagation()}>
                        {playbook.vcs_repository}
                      </a>
                    ) : (
                      <span className="text-muted-foreground truncate max-w-[16rem]">{playbook.vcs_repository}</span>
                    );
                  })()}

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

                  {/* Sync status — small icon, red on failure, hover reveals last_sync_error */}
                  <SyncStatusIndicator
                    status={playbook.last_sync_status}
                    error={playbook.last_sync_error}
                    syncedAt={playbook.last_synced_at}
                    detailHref={`/app/${selectedOrg}/ansible/playbooks/${playbook.id}`}
                    onRetry={playbook.vcs_connection_id ? () => { void handleSync(playbook); } : undefined}
                    retrying={syncing === playbook.id}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pager page={currentPbPage} totalPages={pbTotalPages} onPageChange={setPbPage} />
        </>
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
                    setCreateForm({
                      ...createForm,
                      vcs_connection_id: id || '',
                      vcs_repository: '',
                      vcs_branch: '',
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
                        createForm.vcs_connection_id === conn.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                      )}
                      onClick={() => {
                        const newValue = createForm.vcs_connection_id === conn.id ? '' : conn.id;
                        setSelectedVcsProject('');
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
            {createForm.vcs_connection_id && (
              <VCSProjectSelect
                connectionId={createForm.vcs_connection_id}
                provider={vcsConnections.find(c => c.id === createForm.vcs_connection_id)?.provider}
                value={selectedVcsProject}
                onChange={(project) => {
                  setSelectedVcsProject(project);
                  setCreateForm(prev => ({ ...prev, vcs_repository: '', vcs_branch: '' }));
                }}
              />
            )}

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
              <>
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
              <div className="space-y-2">
                <Label htmlFor="source_mode">Source</Label>
                <Select
                  value={createForm.source_mode}
                  onValueChange={(value) => setCreateForm({ ...createForm, source_mode: value })}
                >
                  <SelectTrigger id="source_mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cached">Cached snapshot (recommended)</SelectItem>
                    <SelectItem value="fresh">Fresh from remote</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {createForm.source_mode === 'fresh'
                    ? 'Each run clones the playbook fresh from the VCS at runtime (always latest HEAD).'
                    : 'Runs the last synced snapshot from storage; the first run syncs it automatically. Keeps critical playbooks runnable even when the VCS is unreachable.'}
                </p>
              </div>
              </>
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

      {/* Delete Confirmation Dialog — escalates to force delete on a 409 */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) { setPlaybookToDelete(null); setForceDeleteDetail(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{forceDeleteDetail ? 'Playbook Is Still in Use' : 'Delete Playbook'}</DialogTitle>
            <DialogDescription>
              {forceDeleteDetail ? (
                <>{forceDeleteDetail}</>
              ) : (
                <>
                  Are you sure you want to delete "{playbookToDelete?.name}"? This action
                  cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {forceDeleteDetail && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-muted-foreground">
              Force delete removes the playbook <span className="font-medium text-foreground">and everything built on it</span>:
              its job templates (with their jobs, schedules, and notification attachments),
              jobs run against it, schedules that target it directly, and any workflow steps
              that run those templates. This cannot be undone.
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setPlaybookToDelete(null);
                setForceDeleteDetail(null);
              }}
            >
              Cancel
            </Button>
            {forceDeleteDetail ? (
              <Button variant="destructive" onClick={() => { void handleDelete(true); }} disabled={deleting}>
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Force Delete Everything
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={deleting}>
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk import wizard */}
      <PlaybookImportWizard
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        organizationName={selectedOrg}
        onImported={() => { void queryClient.invalidateQueries({ queryKey: playbooksQueryKey }); }}
      />
    </div>
  );
}
