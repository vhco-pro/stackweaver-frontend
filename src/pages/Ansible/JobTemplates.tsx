// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
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
import {
  getAnsibleJobTemplateFromJsonApi,
  getAnsiblePlaybookFromJsonApi,
  getAnsibleInventoryFromJsonApi,
  getAnsibleCredentialFromJsonApi,
  getAnsibleJobFromJsonApi,
} from '@/utils/ansible-jsonapi';
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

export default function JobTemplates() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';

  const [templates, setTemplates] = useState<AnsibleJobTemplate[]>([]);
  const [jobs, setJobs] = useState<AnsibleJob[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<AnsibleJobTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  
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
  
  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [playbooks, setPlaybooks] = useState<AnsiblePlaybook[]>([]);
  const [inventories, setInventories] = useState<AnsibleInventory[]>([]);
  const [credentials, setCredentials] = useState<AnsibleCredential[]>([]);
  const [agentPools, setAgentPools] = useState<AgentPool[]>([]);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    playbook_id: '',
    inventory_id: '',
    credential_id: '',
    agent_pool_id: '',
    verbosity: 0,
    forks: 5,
    become: false,
  });

  // Fetch templates and jobs
  const { isLoading: loading } = useQuery({
    queryKey: ['jobTemplates', selectedOrg],
    queryFn: async () => {
      const [templatesRes, jobsRes] = await Promise.all([
        ansibleJobTemplatesApi.listByOrganization(selectedOrg),
        ansibleJobsApi.listByOrganization(selectedOrg),
      ]);
      setTemplates((templatesRes.data || []).map(getAnsibleJobTemplateFromJsonApi));
      setJobs((jobsRes.data || []).map(getAnsibleJobFromJsonApi));
      return null;
    },
    enabled: !!selectedOrg,
  });

  // Fetch playbooks, inventories, credentials, and agent pools when create dialog opens
  useQuery({
    queryKey: ['jobTemplateFormData', selectedOrg, createDialogOpen],
    queryFn: async () => {
      const [playbooksRes, inventoriesRes, credentialsRes, agentPoolsRes] = await Promise.all([
        ansiblePlaybooksApi.listByOrganization(selectedOrg),
        ansibleInventoriesApi.list(selectedOrg),
        ansibleCredentialsApi.list(selectedOrg),
        agentPoolsApi.list(selectedOrg),
      ]);
      setPlaybooks((playbooksRes.data || []).map(getAnsiblePlaybookFromJsonApi));
      setInventories((inventoriesRes.data || []).map(getAnsibleInventoryFromJsonApi));
      setCredentials((credentialsRes.data || []).map(getAnsibleCredentialFromJsonApi));
      setAgentPools(agentPoolsRes.data || []);
      return null;
    },
    enabled: createDialogOpen && !!selectedOrg,
  });

  // Filter templates
  const filteredTemplates = templates.filter((tpl) =>
    tpl.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tpl.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!createForm.playbook_id) {
      toast.error('Playbook is required');
      return;
    }
    if (!createForm.inventory_id) {
      toast.error('Inventory is required');
      return;
    }

    setCreating(true);
    try {
      const res = await ansibleJobTemplatesApi.create(selectedOrg, {
        name: createForm.name,
        description: createForm.description || undefined,
        playbook_id: createForm.playbook_id,
        inventory_id: createForm.inventory_id,
        credential_id: createForm.credential_id || undefined,
        agent_pool_id: createForm.agent_pool_id || undefined,
        verbosity: createForm.verbosity,
        forks: createForm.forks,
        become: createForm.become,
      });
      const newTemplate = getAnsibleJobTemplateFromJsonApi(res.data);
      setTemplates([...templates, newTemplate]);
      setCreateDialogOpen(false);
      setCreateForm({
        name: '',
        description: '',
        playbook_id: '',
        inventory_id: '',
        credential_id: '',
        agent_pool_id: '',
        verbosity: 0,
        forks: 5,
        become: false,
      });
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
      setTemplates(templates.filter((tpl) => tpl.id !== templateToDelete.id));
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

  // Launch and navigate to job
  const handleLaunch = async (template: AnsibleJobTemplate) => {
    setLaunching(template.id);
    try {
      const response = await ansibleJobTemplatesApi.launch(template.id);
      const job = getAnsibleJobFromJsonApi(response.data);
      toast.success('Job launched successfully');
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
      // Refresh jobs list to show the new job
      const jobsRes = await ansibleJobsApi.listByOrganization(selectedOrg);
      setJobs((jobsRes.data || []).map(getAnsibleJobFromJsonApi));
    } catch (err: unknown) {
      console.error('Failed to launch job:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to launch job';
      toast.error(errorMessage);
    } finally {
      setLaunching(null);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 bg-clip-text text-transparent mb-2">
            Job Templates
          </h1>
          <p className="text-muted-foreground">
            Manage reusable Ansible job configurations for {selectedOrg}
          </p>
        </div>
        <div className="relative inline-flex rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 p-[2px]">
          <Button
            variant="ghost"
            onClick={() => setCreateDialogOpen(true)}
            className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Job Template
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search job templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Templates List */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No job templates found</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {searchQuery
                ? 'No job templates match your search criteria.'
                : 'No job templates have been created yet. Click the button above to create your first job template.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Job Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => window.location.href = `/app/${selectedOrg}/ansible/job-templates/${template.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                      <Layers className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">
                        {template.name}
                      </CardTitle>
                      {template.description && (
                        <CardDescription className="line-clamp-2 mt-1">
                          {template.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-flex rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 p-[2px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { void handleLaunch(template); }}
                        disabled={launching === template.id}
                        className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-3 py-1"
                      >
                        {launching === template.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Launch
                      </Button>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
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
                        <DropdownMenuItem asChild>
                          <Link to={`/app/${selectedOrg}/ansible/job-templates/${template.id}?edit=true`} onClick={(e) => e.stopPropagation()}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => { void handleBackgroundLaunch(template); }}
                          disabled={launching === template.id}
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Background Launch
                        </DropdownMenuItem>
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

                  {/* Credential */}
                  {template.credential_id && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Key className="h-3.5 w-3.5" />
                      Credential
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
      )}

      {/* Create Job Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
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
            <div className="space-y-2">
              <Label htmlFor="playbook_id">Playbook *</Label>
              <Select
                value={createForm.playbook_id}
                onValueChange={(value) => setCreateForm({ ...createForm, playbook_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a playbook" />
                </SelectTrigger>
                <SelectContent>
                  {playbooks.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No playbooks available</div>
                  ) : (
                    playbooks.map((pb) => (
                      <SelectItem key={pb.id} value={pb.id}>{pb.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory_id">Inventory *</Label>
              <Select
                value={createForm.inventory_id}
                onValueChange={(value) => setCreateForm({ ...createForm, inventory_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an inventory" />
                </SelectTrigger>
                <SelectContent>
                  {inventories.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No inventories available</div>
                  ) : (
                    inventories.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>{inv.name}</SelectItem>
                    ))
                  )}
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
            <Button onClick={() => { void handleCreate(); }} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Template
            </Button>
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
    </div>
  );
}
