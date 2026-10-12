// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ansibleJobTemplatesApi, 
  ansiblePlaybooksApi,
  ansibleInventoriesApi,
  ansibleCredentialsApi,
  ansibleJobsApi,
  type AnsibleJobTemplate,
  type AnsiblePlaybook,
  type AnsibleInventory,
  type AnsibleCredential,
  type AnsibleJob,
} from '@/api/ansible';
import { agentPoolsApi, type AgentPool } from '@/api/client';
import { PlaybookSourcePicker } from '@/components/ansible/PlaybookSourcePicker';
import { resolvePlaybookSelection, type PlaybookSelection } from '@/components/ansible/playbook-selection';
import {
  getAnsibleJobTemplateFromJsonApi,
  getAnsiblePlaybookFromJsonApi,
  getAnsibleInventoryFromJsonApi,
  getAnsibleCredentialFromJsonApi,
  getAnsibleJobFromJsonApi,
} from '@/utils/ansible-jsonapi';
import { fetchAllPages } from '@/lib/pagination';
import { Pager } from '@/components/ui/pager';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
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
  Ban,
  Layers,
  Search,
  Plus,
  MoreVertical,
  Trash2,
  Play,
  PlayCircle,
  Eye,
  Edit,
  Loader2,
  FileText,
  Server,
  Key,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

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

// Status styling for last run
function getStatusStyles(status: string) {
  switch (status) {
    case 'successful':
      return { icon: <CheckCircle className="h-3 w-3" />, className: 'text-green-600 dark:text-green-400' };
    case 'running':
      return { icon: <Loader2 className="h-3 w-3 animate-spin" />, className: 'text-blue-600 dark:text-blue-400' };
    case 'pending':
      return { icon: <Clock className="h-3 w-3" />, className: 'text-yellow-600 dark:text-yellow-400' };
    case 'failed':
    case 'error':
      return { icon: <XCircle className="h-3 w-3" />, className: 'text-red-600 dark:text-red-400' };
    case 'canceled':
      return { icon: <XCircle className="h-3 w-3" />, className: 'text-gray-600 dark:text-gray-400' };
    default:
      return { icon: null, className: 'text-muted-foreground' };
  }
}

/** What the list query holds: the organization's templates, and its jobs for the "last run". */
interface JobTemplatesListData {
  templates: AnsibleJobTemplate[];
  jobs: AnsibleJob[];
}

/** What the create dialog's pickers offer. */
interface JobTemplateFormData {
  playbooks: AnsiblePlaybook[];
  inventories: AnsibleInventory[];
  credentials: AnsibleCredential[];
  agentPools: AgentPool[];
}

// Stable fallbacks for the time before a query has data, so that memoised values derived from
// them do not change identity on every render.
const NO_TEMPLATES: AnsibleJobTemplate[] = [];
const NO_JOBS: AnsibleJob[] = [];

export default function JobTemplates() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';
  const { canManageJobTemplates, canExecuteJobs } = usePermissions(selectedOrg);

  const [searchQuery, setSearchQuery] = useState('');
  const [tplPage, setTplPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<AnsibleJobTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    inventory_id: '',
    credential_id: '',
    agent_pool_id: '',
    verbosity: 0,
    forks: 5,
    become: false,
  });
  const [playbookSelection, setPlaybookSelection] = useState<PlaybookSelection>(null);

  // Templates and jobs. The query returns what it fetched and the page renders from the query's
  // data: a query function that stored the lists in component state and returned nothing left
  // the cache empty, so a second mount inside the stale window (a launch, then Back) fetched
  // nothing and listed nothing (#896). The handlers below change the list through the cache for
  // the same reason.
  const listQueryKey = ['jobTemplates', selectedOrg];
  const { data: listData, isLoading: loading, isError: loadFailed } = useQuery({
    queryKey: listQueryKey,
    queryFn: async (): Promise<JobTemplatesListData> => {
      const [templatesRes, jobsRes] = await Promise.all([
        fetchAllPages((page, pageSize) => ansibleJobTemplatesApi.listByOrganization(selectedOrg, { page, pageSize })),
        fetchAllPages((page, pageSize) => ansibleJobsApi.listByOrganization(selectedOrg, { page, pageSize })),
      ]);
      return {
        templates: templatesRes.items.map(getAnsibleJobTemplateFromJsonApi),
        jobs: jobsRes.items.map(getAnsibleJobFromJsonApi),
      };
    },
    enabled: !!selectedOrg,
  });
  const templates = listData?.templates ?? NO_TEMPLATES;
  const jobs = listData?.jobs ?? NO_JOBS;

  // Map template IDs to their last job
  const lastJobByTemplate = useMemo(() => {
    const map = new Map<string, AnsibleJob>();
    // Jobs are typically returned sorted by created_at desc, so first match is latest
    for (const job of jobs) {
      if (job.job_template_id && !map.has(job.job_template_id)) {
        map.set(job.job_template_id, job);
      }
    }
    return map;
  }, [jobs]);

  // Playbooks, inventories, credentials and agent pools for the create dialog, fetched when it
  // first opens. Whether the dialog is open decides when the query runs and is not part of its
  // key, so reopening the dialog reads the same entry.
  const formDataQueryKey = ['jobTemplateFormData', selectedOrg];
  const { data: formData } = useQuery({
    queryKey: formDataQueryKey,
    queryFn: async (): Promise<JobTemplateFormData> => {
      const [playbooksRes, inventoriesRes, credentialsRes, agentPoolsRes] = await Promise.all([
        fetchAllPages((page, pageSize) => ansiblePlaybooksApi.listByOrganization(selectedOrg, { page, pageSize })),
        fetchAllPages((page, pageSize) => ansibleInventoriesApi.list(selectedOrg, { page, pageSize })),
        fetchAllPages((page, pageSize) => ansibleCredentialsApi.list(selectedOrg, undefined, { page, pageSize })),
        agentPoolsApi.list(selectedOrg),
      ]);
      return {
        playbooks: playbooksRes.items.map(getAnsiblePlaybookFromJsonApi),
        inventories: inventoriesRes.items.map(getAnsibleInventoryFromJsonApi),
        credentials: credentialsRes.items.map(getAnsibleCredentialFromJsonApi),
        agentPools: agentPoolsRes.data || [],
      };
    },
    enabled: createDialogOpen && !!selectedOrg,
  });
  const playbooks = formData?.playbooks ?? [];
  const inventories = formData?.inventories ?? [];
  const credentials = formData?.credentials ?? [];
  const agentPools = formData?.agentPools ?? [];

  // A launch adds a job, which the list shows as the template's last run and the template's own
  // page (JobTemplateDetail, keyed ['jobTemplateDetail', templateId, orgName]) lists under
  // "Recent Jobs". Both are marked out of date; the list refetches at once while it is mounted,
  // and the returned promise settles when it has.
  const invalidateAfterLaunch = (templateId: string) => {
    void queryClient.invalidateQueries({ queryKey: ['jobTemplateDetail', templateId] });
    return queryClient.invalidateQueries({ queryKey: listQueryKey });
  };

  // Filter templates
  const filteredTemplates = templates.filter((tpl) =>
    tpl.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tpl.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const TPL_PAGE_SIZE = 12;
  const tplTotalPages = Math.max(1, Math.ceil(filteredTemplates.length / TPL_PAGE_SIZE));
  const currentTplPage = Math.min(tplPage, tplTotalPages);
  const paginatedTemplates = filteredTemplates.slice(
    (currentTplPage - 1) * TPL_PAGE_SIZE,
    currentTplPage * TPL_PAGE_SIZE,
  );

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!playbookSelection) {
      toast.error('Playbook is required');
      return;
    }
    if (!createForm.inventory_id) {
      toast.error('Inventory is required');
      return;
    }

    setCreating(true);
    try {
      // A repository-file selection registers the playbook now (find-or-create).
      const playbookId = await resolvePlaybookSelection(selectedOrg, playbookSelection);
      const res = await ansibleJobTemplatesApi.create(selectedOrg, {
        name: createForm.name,
        description: createForm.description || undefined,
        playbook_id: playbookId,
        inventory_id: createForm.inventory_id,
        credential_ids: createForm.credential_id ? [createForm.credential_id] : undefined,
        agent_pool_id: createForm.agent_pool_id || undefined,
        verbosity: createForm.verbosity,
        forks: createForm.forks,
        become: createForm.become,
      });
      const newTemplate = getAnsibleJobTemplateFromJsonApi(res.data);
      queryClient.setQueryData<JobTemplatesListData>(listQueryKey, (old) =>
        old ? { ...old, templates: [...old.templates, newTemplate] } : old);
      // Saving a repository file registers it as a playbook, so the pickers' options may have
      // grown and are fetched again.
      void queryClient.invalidateQueries({ queryKey: formDataQueryKey });
      setCreateDialogOpen(false);
      setCreateForm({
        name: '',
        description: '',
        inventory_id: '',
        credential_id: '',
        agent_pool_id: '',
        verbosity: 0,
        forks: 5,
        become: false,
      });
      setPlaybookSelection(null);
      toast.success('Job template created successfully');
    } catch (err: unknown) {
      console.error('Failed to create job template:', err);
      const message = err instanceof Error ? err instanceof Error ? err.message : 'Unknown error' : 'Failed to create job template';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    setDeleting(true);
    try {
      await ansibleJobTemplatesApi.delete(templateToDelete.id);
      const deletedId = templateToDelete.id;
      queryClient.setQueryData<JobTemplatesListData>(listQueryKey, (old) =>
        old ? { ...old, templates: old.templates.filter((tpl) => tpl.id !== deletedId) } : old);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      toast.success('Job template deleted successfully');
    } catch (err: unknown) {
      console.error('Failed to delete job template:', err);
      const errorMessage = err instanceof Error ? err instanceof Error ? err.message : 'Unknown error' : 'Failed to delete job template';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleEnabled = async (template: AnsibleJobTemplate) => {
    try {
      const res = await ansibleJobTemplatesApi.update(template.id, { enabled: !template.enabled });
      const updated = getAnsibleJobTemplateFromJsonApi(res.data);
      queryClient.setQueryData<JobTemplatesListData>(listQueryKey, (old) =>
        old ? { ...old, templates: old.templates.map((tpl) => (tpl.id === template.id ? updated : tpl)) } : old);
      // The template's own page shows the same switch.
      void queryClient.invalidateQueries({ queryKey: ['jobTemplateDetail', template.id] });
      toast.success(`Template ${updated.enabled ? 'enabled' : 'disabled'}`);
    } catch (err: unknown) {
      console.error('Failed to toggle template:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update template');
    }
  };

  // Launch and navigate to job
  const handleLaunch = async (template: AnsibleJobTemplate) => {
    setLaunching(template.id);
    try {
      const response = await ansibleJobTemplatesApi.launch(template.id);
      const job = getAnsibleJobFromJsonApi(response.data);
      toast.success('Job launched successfully');
      // Not awaited: the move to the job page does not wait for the list. The refetch carries
      // on after this page is gone, so the Back button returns to a list that has the new job.
      void invalidateAfterLaunch(template.id);
      void Promise.resolve(navigate(`/app/${selectedOrg}/ansible/jobs/${job.id}`));
    } catch (err: unknown) {
      console.error('Failed to launch job:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to launch job';
      toast.error(errorMessage);
    } finally {
      setLaunching(null);
    }
  };

  // Launch in background (no navigation)
  const handleBackgroundLaunch = async (template: AnsibleJobTemplate) => {
    setLaunching(template.id);
    try {
      await ansibleJobTemplatesApi.launch(template.id);
      toast.success('Job launched in background');
      // Refresh the list to show the new job as the template's last run
      await invalidateAfterLaunch(template.id);
    } catch (err: unknown) {
      console.error('Failed to launch job:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to launch job';
      toast.error(errorMessage);
    } finally {
      setLaunching(null);
    }
  };

  // Defined once and handed to both the header and the empty-state card: the header does not
  // render it while there is nothing to list, so the action never appears twice.
  const createAction = canManageJobTemplates ? (
    <GradientButton
      ramp="app"
      onClick={() => setCreateDialogOpen(true)}
      className="w-auto px-4 py-2"
    >
      <Plus className="h-4 w-4 mr-2" />
      New Job Template
    </GradientButton>
  ) : undefined;
  const listState = loading
    ? 'loading'
    : loadFailed
      ? 'error'
      : templates.length === 0 && searchQuery === ''
        ? 'empty'
        : 'ready';
  const header = (
    <PageHeader
      icon={Layers}
      title="Job Templates"
      subtitle={`Manage reusable Ansible job configurations for ${selectedOrg}`}
      action={createAction}
      listState={listState}
    />
  );

  if (loading) {
    return (
      <Page>
        {header}
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      {header}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search job templates..."
            aria-label="Search job templates"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setTplPage(1); }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Templates List */}
      {filteredTemplates.length === 0 ? (
        <PageEmptyState
          icon={Layers}
          title="No job templates found"
          description={searchQuery
            ? 'No job templates match your search criteria.'
            : 'No job templates have been created yet. Create your first job template to get started.'}
          action={loadFailed ? undefined : createAction}
          filtered={searchQuery !== ''}
          onClearFilters={() => { setSearchQuery(''); setTplPage(1); }}
        />
      ) : (
        <>
        <div className="grid gap-4">
          {paginatedTemplates.map((template) => (
            <Card
              key={template.id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => window.location.href = `/app/${selectedOrg}/ansible/job-templates/${template.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                      <Layers className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate flex items-center gap-2">
                        {template.name}
                        {!template.enabled && (
                          <Badge variant="outline" className="text-muted-foreground border-dashed shrink-0">Disabled</Badge>
                        )}
                      </CardTitle>
                      {template.description && (
                        <CardDescription className="line-clamp-2 mt-1">
                          {template.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {canExecuteJobs && (
                      <GradientButton
                        ramp="app"
                        emphasis="secondary"
                        size="sm"
                        onClick={() => { void handleLaunch(template); }}
                        disabled={launching === template.id || !template.enabled}
                        title={!template.enabled ? 'This template is disabled' : undefined}
                        className="w-auto px-3 py-1"
                      >
                        {launching === template.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Launch
                      </GradientButton>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Job template actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/app/${selectedOrg}/ansible/job-templates/${template.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {canManageJobTemplates && (
                          <DropdownMenuItem asChild>
                            <Link to={`/app/${selectedOrg}/ansible/job-templates/${template.id}?edit=true`} onClick={(e) => e.stopPropagation()}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {canExecuteJobs && (
                          <DropdownMenuItem
                            onClick={() => { void handleBackgroundLaunch(template); }}
                            disabled={launching === template.id || !template.enabled}
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Background Launch
                          </DropdownMenuItem>
                        )}
                        {canManageJobTemplates && (
                          <DropdownMenuItem onClick={() => { void handleToggleEnabled(template); }}>
                            {template.enabled ? (
                              <><Ban className="h-4 w-4 mr-2" />Disable</>
                            ) : (
                              <><CheckCircle className="h-4 w-4 mr-2" />Enable</>
                            )}
                          </DropdownMenuItem>
                        )}
                        {canManageJobTemplates && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setTemplateToDelete(template);
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
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {/* Playbook */}
                  {template.playbook_id && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Playbook: {template.playbook_id.slice(0, 8)}...
                    </span>
                  )}

                  {/* Inventory */}
                  {template.inventory_id && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Server className="h-3.5 w-3.5" />
                      Inventory
                    </span>
                  )}

                  {/* Credentials */}
                  {template.credential_ids && template.credential_ids.length > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Key className="h-3.5 w-3.5" />
                      {template.credential_ids.length === 1
                        ? 'Credential'
                        : `${template.credential_ids.length} credentials`}
                    </span>
                  )}

                  {/* Verbosity */}
                  <Badge variant="outline" className="gap-1">
                    Verbosity: {template.verbosity || 0}
                  </Badge>

                  {/* Forks */}
                  <Badge variant="secondary" className="gap-1">
                    Forks: {template.forks || 5}
                  </Badge>

                  {/* Become */}
                  {template.become && (
                    <Badge variant="destructive" className="gap-1">
                      Privilege Escalation
                    </Badge>
                  )}

                  {/* Limit */}
                  {template.limit && (
                    <Badge variant="outline" className="gap-1">
                      Limit: {template.limit}
                    </Badge>
                  )}

                  {/* Tags */}
                  {template.tags && (
                    <Badge variant="outline" className="gap-1">
                      Tags: {template.tags}
                    </Badge>
                  )}

                  {/* Last Run - right aligned */}
                  <div className="ml-auto flex items-center gap-3">
                    {lastJobByTemplate.get(template.id) ? (
                      <Link 
                        to={`/app/${selectedOrg}/ansible/jobs/${lastJobByTemplate.get(template.id)!.id}`}
                        className="flex items-center gap-1.5 text-sm hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const job = lastJobByTemplate.get(template.id)!;
                          const { icon, className } = getStatusStyles(job.status);
                          return (
                            <>
                              <span className={className}>{icon}</span>
                              <span className={`capitalize ${className}`}>{job.status}</span>
                              <span className="text-muted-foreground">
                                {formatRelativeTime(job.created_at)}
                              </span>
                            </>
                          );
                        })()}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never run</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pager page={currentTplPage} totalPages={tplTotalPages} onPageChange={setTplPage} />
        </>
      )}

      {/* Create Job Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Job Template</DialogTitle>
            <DialogDescription>
              Create a reusable job template. Select a playbook, inventory, and optional credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template_name">Name *</Label>
              <Input
                id="template_name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="My Job Template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template_description">Description</Label>
              <Textarea
                id="template_description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <PlaybookSourcePicker
              key={String(createDialogOpen)}
              organizationName={selectedOrg}
              playbooks={playbooks}
              value={playbookSelection}
              onChange={setPlaybookSelection}
            />
            <div className="space-y-2">
              <Label htmlFor="inventory_id">Inventory *</Label>
              <Select
                value={createForm.inventory_id}
                onValueChange={(value) => setCreateForm({ ...createForm, inventory_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an inventory" />
                </SelectTrigger>
                <SelectContent emptyMessage="No inventories available">
                  {inventories.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credential_id">Credential (Optional)</Label>
              <Select
                value={createForm.credential_id || '__none__'}
                onValueChange={(value) => setCreateForm({ ...createForm, credential_id: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a credential (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {credentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>{cred.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent_pool_id">Agent Pool (Optional)</Label>
              <Select
                value={createForm.agent_pool_id || '__none__'}
                onValueChange={(value) => setCreateForm({ ...createForm, agent_pool_id: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default (built-in runner)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default (built-in runner)</SelectItem>
                  {agentPools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>{pool.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Assign to a self-hosted runner pool for execution on your own infrastructure.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="verbosity">Verbosity</Label>
                <Select
                  value={String(createForm.verbosity)}
                  onValueChange={(value) => setCreateForm({ ...createForm, verbosity: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 (Normal)</SelectItem>
                    <SelectItem value="1">1 (-v)</SelectItem>
                    <SelectItem value="2">2 (-vv)</SelectItem>
                    <SelectItem value="3">3 (-vvv)</SelectItem>
                    <SelectItem value="4">4 (-vvvv)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forks">Forks</Label>
                <Input
                  id="forks"
                  type="number"
                  min="1"
                  value={createForm.forks}
                  onChange={(e) => setCreateForm({ ...createForm, forks: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <GradientButton ramp="app" onClick={() => { void handleCreate(); }} disabled={creating} className="w-auto px-4 py-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Template
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTemplateToDelete(null);
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
    </Page>
  );
}
