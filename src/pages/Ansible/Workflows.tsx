// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ansibleWorkflowsApi,
  type AnsibleWorkflow,
  type CreateWorkflowInput,
} from '@/api/ansible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Workflow,
  Search,
  Plus,
  MoreVertical,
  Trash2,
  Eye,
  Edit,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';
import type { JsonApiResource } from '@/utils/jsonapi';

// Parse workflow from JSON:API response
function getWorkflowFromJsonApi(resource: JsonApiResource): AnsibleWorkflow {
  const attrs = (resource.attributes || {}) as Record<string, unknown>;
  const rels = resource.relationships || {};
  
  const getRelationshipId = (rel: { data?: { id: string } | Array<{ id: string }> } | undefined): string | undefined => {
    if (!rel?.data) return undefined;
    return Array.isArray(rel.data) ? rel.data[0]?.id : rel.data.id;
  };
  
  return {
    id: resource.id,
    organization_id: getRelationshipId(rels.organization) || '',
    project_id: getRelationshipId(rels.project),
    inventory_id: getRelationshipId(rels.inventory),
    name: (typeof attrs.name === 'string' ? attrs.name : '') || '',
    description: (typeof attrs.description === 'string' ? attrs.description : '') || '',
    allow_simultaneous: (typeof attrs['allow-simultaneous'] === 'boolean' ? attrs['allow-simultaneous'] : false) || false,
    ask_variables_on_launch: (typeof attrs['ask-variables-on-launch'] === 'boolean' ? attrs['ask-variables-on-launch'] : false) || false,
    ask_inventory_on_launch: (typeof attrs['ask-inventory-on-launch'] === 'boolean' ? attrs['ask-inventory-on-launch'] : false) || false,
    ask_limit_on_launch: (typeof attrs['ask-limit-on-launch'] === 'boolean' ? attrs['ask-limit-on-launch'] : false) || false,
    extra_vars: attrs['extra-vars'] ? (typeof attrs['extra-vars'] === 'string' && attrs['extra-vars'] ? (JSON.parse(attrs['extra-vars']) as Record<string, unknown>) : (typeof attrs['extra-vars'] === 'object' ? attrs['extra-vars'] as Record<string, unknown> : undefined)) : undefined,
    limit: (typeof attrs.limit === 'string' ? attrs.limit : '') || '',
    survey_enabled: (typeof attrs['survey-enabled'] === 'boolean' ? attrs['survey-enabled'] : false) || false,
    survey_spec: (typeof attrs['survey-spec'] === 'object' ? attrs['survey-spec'] as Record<string, unknown> : undefined),
    created_at: (typeof attrs['created-at'] === 'string' ? attrs['created-at'] : '') || '',
    updated_at: (typeof attrs['updated-at'] === 'string' ? attrs['updated-at'] : '') || '',
  };
}

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

export default function Workflows() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';
  const { canManageJobTemplates } = usePermissions(selectedOrg);

  const { data: workflows = [], isLoading: loading, refetch: refetchWorkflows } = useQuery({
    queryKey: ['workflows', selectedOrg],
    queryFn: async () => {
      const res = await ansibleWorkflowsApi.list(selectedOrg);
      return (res.data || []).map(getWorkflowFromJsonApi);
    },
    enabled: !!selectedOrg,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<AnsibleWorkflow | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateWorkflowInput>({
    name: '',
    description: '',
    allow_simultaneous: false,
    ask_variables_on_launch: false,
    ask_inventory_on_launch: false,
    ask_limit_on_launch: false,
    survey_enabled: false,
  });

  // Filter workflows
  const filteredWorkflows = workflows.filter((wf) =>
    wf.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wf.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setCreating(true);
    try {
      const res = await ansibleWorkflowsApi.create(selectedOrg, createForm);
      const newWorkflow = getWorkflowFromJsonApi(res.data);
      void refetchWorkflows();
      setCreateDialogOpen(false);
      setCreateForm({
        name: '',
        description: '',
        allow_simultaneous: false,
        ask_variables_on_launch: false,
        ask_inventory_on_launch: false,
        ask_limit_on_launch: false,
        survey_enabled: false,
      });
      toast.success('Workflow template created successfully');
      // Navigate to detail page to add nodes
      void Promise.resolve(navigate(`/${selectedOrg}/ansible/workflows/${newWorkflow.id}`));
    } catch (err) {
      console.error('Failed to create workflow:', err);
      toast.error('Failed to create workflow template');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!workflowToDelete) return;

    setDeleting(true);
    try {
      await ansibleWorkflowsApi.delete(workflowToDelete.id);
      void refetchWorkflows();
      toast.success('Workflow template deleted');
    } catch (err: unknown) {
      console.error('Failed to delete workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete workflow template';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
    }
  };

  if (!selectedOrg) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Please select an organization to view workflow templates.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            Workflow Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Create multi-job pipelines with conditional branching
          </p>
        </div>
        {canManageJobTemplates && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Workflow
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workflow templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Workflows List */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Templates</CardTitle>
          <CardDescription>
            {loading 
              ? 'Loading...' 
              : `${filteredWorkflows.length} workflow template${filteredWorkflows.length !== 1 ? 's' : ''}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No workflow templates found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery 
                  ? 'Try adjusting your search query'
                  : 'Create your first workflow template to orchestrate multiple jobs'
                }
              </p>
              {!searchQuery && canManageJobTemplates && (
                <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell>
                      <Link 
                        to={`/${selectedOrg}/ansible/workflows/${workflow.id}`}
                        className="flex flex-col hover:text-primary"
                      >
                        <span className="font-medium">{workflow.name}</span>
                        {workflow.description && (
                          <span className="text-sm text-muted-foreground line-clamp-1">
                            {workflow.description}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {workflow.allow_simultaneous && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Concurrent
                          </span>
                        )}
                        {workflow.survey_enabled && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            Survey
                          </span>
                        )}
                        {workflow.ask_variables_on_launch && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            Prompt Vars
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(workflow.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { void Promise.resolve(navigate(`/${selectedOrg}/ansible/workflows/${workflow.id}`)); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {canManageJobTemplates && (
                            <DropdownMenuItem onClick={() => { void Promise.resolve(navigate(`/${selectedOrg}/ansible/workflows/${workflow.id}/edit`)); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Workflow
                            </DropdownMenuItem>
                          )}
                          {canManageJobTemplates && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setWorkflowToDelete(workflow);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create Workflow Template</DialogTitle>
            <DialogDescription>
              Create a new workflow template to orchestrate multiple jobs with conditional logic.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="My Workflow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
              />
            </div>
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-sm">Options</h4>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allow_simultaneous"
                  checked={createForm.allow_simultaneous}
                  onCheckedChange={(checked) => setCreateForm({ ...createForm, allow_simultaneous: checked === true })}
                />
                <div>
                  <Label htmlFor="allow_simultaneous" className="text-sm">Allow Simultaneous Runs</Label>
                  <p className="text-xs text-muted-foreground">Allow multiple runs at the same time</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ask_variables"
                  checked={createForm.ask_variables_on_launch}
                  onCheckedChange={(checked) => setCreateForm({ ...createForm, ask_variables_on_launch: checked === true })}
                />
                <div>
                  <Label htmlFor="ask_variables" className="text-sm">Prompt for Variables</Label>
                  <p className="text-xs text-muted-foreground">Ask for extra variables on launch</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ask_inventory"
                  checked={createForm.ask_inventory_on_launch}
                  onCheckedChange={(checked) => setCreateForm({ ...createForm, ask_inventory_on_launch: checked === true })}
                />
                <div>
                  <Label htmlFor="ask_inventory" className="text-sm">Prompt for Inventory</Label>
                  <p className="text-xs text-muted-foreground">Ask to select inventory on launch</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="survey_enabled"
                  checked={createForm.survey_enabled}
                  onCheckedChange={(checked) => setCreateForm({ ...createForm, survey_enabled: checked === true })}
                />
                <div>
                  <Label htmlFor="survey_enabled" className="text-sm">Enable Survey</Label>
                  <p className="text-xs text-muted-foreground">Show a survey form on launch</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleCreate(); }} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workflow Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{workflowToDelete?.name}"? This will also delete all nodes and edges in the workflow. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
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
