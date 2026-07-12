// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Package, Plus, Trash2, Settings, Users, ChevronDown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  variableSetsApi,
  projectsApi,
  workspacesApi,
  type VariableSet,
} from '@/api/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export default function VariableSets() {
  const { orgName } = useParams<{ orgName: string }>();

  const { data: variableSets = [], isLoading: loading, refetch: refetchVariableSets } = useQuery({
    queryKey: ['variable-sets', orgName],
    queryFn: async () => {
      const sets = await variableSetsApi.list(orgName!);
      return Array.isArray(sets) ? sets : [];
    },
    enabled: !!orgName,
  });

  const { data: scopeData } = useQuery({
    queryKey: ['variable-sets-scope', orgName],
    queryFn: async () => {
      const [projectsRes, workspacesRes] = await Promise.all([
        projectsApi.list(orgName!),
        workspacesApi.list(orgName!),
      ]);
      return {
        projects: projectsRes?.data || [],
        workspaces: workspacesRes?.data || [],
      };
    },
    enabled: !!orgName,
  });

  const projects = scopeData?.projects ?? [];
  const workspaces = scopeData?.workspaces ?? [];

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedVariableSet, setSelectedVariableSet] = useState<VariableSet | null>(null);
  const [saving, setSaving] = useState(false);
  const [manageDialogTab, setManageDialogTab] = useState<'general' | 'variables' | 'assignment'>('general');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteVariableDialogOpen, setDeleteVariableDialogOpen] = useState(false);
  const [variableToDelete, setVariableToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [creating, setCreating] = useState(false);
  const [assignedProjects, setAssignedProjects] = useState<string[]>([]);
  const [assignedWorkspaces, setAssignedWorkspaces] = useState<string[]>([]);

  const [variableSetForm, setVariableSetForm] = useState({
    name: '',
    description: '',
    global: true, // TFE: true = apply to all, false = apply to specific projects/workspaces
    priority: false, // TFE priority field
    selectedProjects: [] as string[], // Selected project IDs when global=false
    selectedWorkspaces: [] as string[], // Selected workspace IDs when global=false
    // Parent is always 'organizations' when creating from org settings (inferred from context)
    // Project-owned sets will be created from project settings (future feature)
  });
  const [showSelectedProjects, setShowSelectedProjects] = useState(false);
  const [showSelectedWorkspaces, setShowSelectedWorkspaces] = useState(false);

  const [variableForm, setVariableForm] = useState({
    key: '',
    value: '',
    sensitive: false,
    encrypted: false,
    category: 'terraform',
    description: '',
  });

  const [initialVariables, setInitialVariables] = useState<Array<{
    key: string;
    value: string;
    sensitive: boolean;
    encrypted: boolean;
    category: string;
    description: string;
  }>>([]);

  const handleCreateVariableSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName) return;

    if (!variableSetForm.name.trim()) {
      toast.error('Variable set name is required');
      return;
    }

    setCreating(true);
    try {
      const newSet = await variableSetsApi.create(orgName, {
        name: variableSetForm.name.trim(),
        description: variableSetForm.description.trim() || undefined,
        scope: variableSetForm.global ? 'organization' : 'workspace', // AUD-150: maps to global flag; 'workspace' = non-global (scoped to specific projects/workspaces), still org-owned via parent
        priority: variableSetForm.priority,
        // Parent is always organization when creating from org settings
        parentType: 'organizations',
        parentId: orgName,
      });
      
      // Add initial variables if any
      if (initialVariables.length > 0) {
        const variablePromises = initialVariables.map(variable =>
          variableSetsApi.createVariable(orgName, newSet.id, {
            key: variable.key.trim(),
            value: variable.value.trim(),
            sensitive: variable.sensitive,
            encrypted: variable.encrypted,
            category: variable.category,
            description: variable.description.trim() || undefined,
          })
        );
        await Promise.all(variablePromises);
      }

      // Assign to projects and workspaces if specified
      if (!variableSetForm.global) {
        const assignmentPromises: Promise<unknown>[] = [];
        
        // Assign to selected projects
        if (variableSetForm.selectedProjects.length > 0) {
          assignmentPromises.push(...variableSetForm.selectedProjects.map(projectId =>
            variableSetsApi.assignProject(orgName, newSet.id, projectId)
          ));
        }
        
        // Assign to selected workspaces
        if (variableSetForm.selectedWorkspaces.length > 0) {
          assignmentPromises.push(...variableSetForm.selectedWorkspaces.map(workspaceId =>
            variableSetsApi.assignWorkspace(orgName, newSet.id, workspaceId)
          ));
        }
        
        if (assignmentPromises.length > 0) {
          await Promise.all(assignmentPromises);
        }
      }
      
      toast.success('Variable set created successfully');
      
      // Always reload to get the full set with variables
      void refetchVariableSets();
      
      setCreateDialogOpen(false);
      setVariableSetForm({ name: '', description: '', global: true, priority: false, selectedProjects: [], selectedWorkspaces: [] }); // Default to global (apply to all)
      setInitialVariables([]);
      setShowSelectedProjects(false);
      setShowSelectedWorkspaces(false);
      setVariableForm({ key: '', value: '', sensitive: false, encrypted: false, category: 'terraform', description: '' });
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err).message)
        : 'Failed to create variable set';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleAddInitialVariable = () => {
    if (!variableForm.key.trim() || !variableForm.value.trim()) {
      toast.error('Key and value are required');
      return;
    }

    // Check for duplicate keys in initial variables
    if (initialVariables.some(v => v.key.trim().toLowerCase() === variableForm.key.trim().toLowerCase())) {
      toast.error(`A variable with the key '${variableForm.key.trim()}' has already been added. Variable keys must be unique within a variable set.`);
      return;
    }

    setInitialVariables([...initialVariables, { ...variableForm }]);
    setVariableForm({ key: '', value: '', sensitive: false, encrypted: false, category: 'terraform', description: '' });
  };

  const handleRemoveInitialVariable = (index: number) => {
    setInitialVariables(initialVariables.filter((_, i) => i !== index));
  };

  const handleSaveVariableSet = async () => {
    if (!orgName || !selectedVariableSet) return;

    if (!variableSetForm.name.trim()) {
      toast.error('Variable set name is required');
      return;
    }

    setSaving(true);
    try {
      // Update basic info
      // Note: Parent cannot be changed in TFE - it's inferred from creation context
      await variableSetsApi.update(orgName, selectedVariableSet.id, {
        name: variableSetForm.name.trim(),
        description: variableSetForm.description.trim() || undefined,
        scope: variableSetForm.global ? 'organization' : 'workspace', // AUD-150: maps to global flag; 'workspace' = non-global (scoped to specific projects/workspaces), still org-owned via parent
        priority: variableSetForm.priority,
        // Don't send parent - it cannot be changed after creation
      });

      // Update assignments based on global flag
      const currentProjects = selectedVariableSet.projects?.map(p => p.id) || [];
      const currentWorkspaces = selectedVariableSet.workspaces?.map(w => w.id) || [];
      
      const promises: Promise<unknown>[] = [];
      
      if (variableSetForm.global) {
        // Remove all project and workspace assignments when global
        const removeProjectPromises = currentProjects.map(projectId =>
          variableSetsApi.unassignProject(orgName, selectedVariableSet.id, projectId)
        );
        const removeWorkspacePromises = currentWorkspaces.map(workspaceId =>
          variableSetsApi.unassignWorkspace(orgName, selectedVariableSet.id, workspaceId)
        );
        promises.push(...removeProjectPromises, ...removeWorkspacePromises);
      } else {
        // Handle project assignments
        const toAddProjects = assignedProjects.filter(id => !currentProjects.includes(id));
        const toRemoveProjects = currentProjects.filter(id => !assignedProjects.includes(id));
        
        // Handle workspace assignments
        const toAddWorkspaces = assignedWorkspaces.filter(id => !currentWorkspaces.includes(id));
        const toRemoveWorkspaces = currentWorkspaces.filter(id => !assignedWorkspaces.includes(id));
        
        // Add/remove projects
        promises.push(...toAddProjects.map(projectId =>
          variableSetsApi.assignProject(orgName, selectedVariableSet.id, projectId)
        ));
        promises.push(...toRemoveProjects.map(projectId =>
          variableSetsApi.unassignProject(orgName, selectedVariableSet.id, projectId)
        ));
        
        // Add/remove workspaces
        promises.push(...toAddWorkspaces.map(workspaceId =>
          variableSetsApi.assignWorkspace(orgName, selectedVariableSet.id, workspaceId)
        ));
        promises.push(...toRemoveWorkspaces.map(workspaceId =>
          variableSetsApi.unassignWorkspace(orgName, selectedVariableSet.id, workspaceId)
        ));
      }
      
      await Promise.all(promises);
      toast.success('Variable set updated successfully');
      void refetchVariableSets();
      // Reload the variable set to get updated data
      const fullSet = await variableSetsApi.get(orgName, selectedVariableSet.id);
      setSelectedVariableSet(fullSet);
      // Close the detail view after successful save
      setManageDialogOpen(false);
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err).message)
        : 'Failed to update variable set';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariableSet = async () => {
    if (!orgName || !selectedVariableSet) return;

    setDeleting(true);
    try {
      await variableSetsApi.delete(orgName, selectedVariableSet.id);
      toast.success('Variable set deleted successfully');
      setSelectedVariableSet(null);
      void refetchVariableSets();
      setDeleteDialogOpen(false);
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err).message)
        : 'Failed to delete variable set';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenManage = async (variableSet: VariableSet) => {
    if (!orgName) return;
    try {
      const fullSet = await variableSetsApi.get(orgName, variableSet.id);
      setSelectedVariableSet(fullSet);
      // Determine if it's global based on scope and assignments
      const isGlobal = fullSet.scope === 'organization' && (!fullSet.projects || fullSet.projects.length === 0) && (!fullSet.workspaces || fullSet.workspaces.length === 0);
      setVariableSetForm({
        name: fullSet.name,
        description: fullSet.description || '',
        global: isGlobal,
        priority: fullSet.priority || false,
        selectedProjects: fullSet.projects?.map(p => p.id) || [],
        selectedWorkspaces: fullSet.workspaces?.map(w => w.id) || [],
      });

      // Load currently assigned projects and workspaces
      if (fullSet.projects && fullSet.projects.length > 0) {
        setAssignedProjects(fullSet.projects.map(p => p.id));
        setAssignedWorkspaces(fullSet.workspaces?.map(w => w.id) || []);
      } else if (fullSet.workspaces && fullSet.workspaces.length > 0) {
        setAssignedWorkspaces(fullSet.workspaces.map(w => w.id));
        setAssignedProjects([]);
      } else {
        setAssignedProjects([]);
        setAssignedWorkspaces([]);
      }
      
      setVariableForm({ key: '', value: '', sensitive: false, encrypted: false, category: 'terraform', description: '' });
      setManageDialogTab('general');
      setManageDialogOpen(true);
    } catch (err) {
      console.error('Failed to load variable set details:', err);
      toast.error('Failed to load variable set details');
    }
  };

  const handleAddVariable = async () => {
    if (!orgName || !selectedVariableSet) return;

    if (!variableForm.key.trim() || !variableForm.value.trim()) {
      toast.error('Key and value are required');
      return;
    }

    // Check for duplicate keys in existing variables
    if (selectedVariableSet.variables?.some(v => v.key.trim().toLowerCase() === variableForm.key.trim().toLowerCase())) {
      toast.error(`A variable with the key '${variableForm.key.trim()}' already exists in this variable set. Variable keys must be unique within a variable set.`);
      return;
    }

    try {
      await variableSetsApi.createVariable(orgName, selectedVariableSet.id, {
        key: variableForm.key.trim(),
        value: variableForm.value.trim(),
        sensitive: variableForm.sensitive,
        encrypted: variableForm.encrypted,
        category: variableForm.category,
        description: variableForm.description.trim() || undefined,
      });
      toast.success('Variable added successfully');
      setVariableForm({ key: '', value: '', sensitive: false, encrypted: false, category: 'terraform', description: '' });
      // Reload variable set to get updated variables
      const fullSet = await variableSetsApi.get(orgName, selectedVariableSet.id);
      setSelectedVariableSet(fullSet);
    } catch (err: unknown) {
      // The API client already extracts the error detail from the backend response
      // Backend returns: { errors: [{ detail: "A variable with the key 'X' already exists..." }] }
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err).message)
        : 'Failed to add variable';
      toast.error(errorMessage);
    }
  };

  const handleDeleteVariable = async (variableId: string) => {
    if (!orgName || !selectedVariableSet) return;

    setDeleting(true);
    try {
      await variableSetsApi.deleteVariable(orgName, selectedVariableSet.id, variableId);
      toast.success('Variable deleted successfully');
      // Reload variable set
      const fullSet = await variableSetsApi.get(orgName, selectedVariableSet.id);
      setSelectedVariableSet(fullSet);
      setDeleteVariableDialogOpen(false);
      setVariableToDelete(null);
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err).message)
        : 'Failed to delete variable';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };



  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Link to={orgName ? `/app/${orgName}/settings` : '/settings'}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent mb-2">
                Variable Sets
              </h1>
              <p className="text-muted-foreground">
                Manage variable sets that can be applied to multiple workspaces
              </p>
            </div>
            <div className="relative inline-flex rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 p-[2px]">
              <Button
                variant="ghost"
                onClick={() => {
                  setVariableSetForm({ name: '', description: '', global: true, priority: false, selectedProjects: [], selectedWorkspaces: [] });
                  setShowSelectedProjects(false);
                  setShowSelectedWorkspaces(false);
                  setCreateDialogOpen(true);
                }}
                className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Variable Set
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Variable Sets List */}
      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : variableSets.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5 backdrop-blur-md border border-white/20 dark:border-white/10">
            <Package className="h-16 w-16 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="text-xl font-semibold mb-2">No variable sets found</h3>
              <p className="text-muted-foreground mb-6">
                Create your first variable set to share variables across workspaces
              </p>
              {orgName && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Variable Set
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Applied To</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variableSets.map((variableSet) => (
                <TableRow key={variableSet.id}>
                  <TableCell className="font-medium">{variableSet.name}</TableCell>
                  <TableCell>
                    {variableSet.scope === 'organization' ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                        Global
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20">
                        Scoped
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {variableSet.variables ? variableSet.variables.length : 0} var{variableSet.variables?.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(() => {
                      // AUD-150: scope==='organization' is the client-derived global flag. A global set
                      // applies to All; a scoped set lists its attached projects and/or workspaces.
                      const projectCount = variableSet.projects?.length ?? 0;
                      const workspaceCount = variableSet.workspaces?.length ?? 0;
                      if (variableSet.scope === 'organization' && projectCount === 0 && workspaceCount === 0) {
                        return 'All';
                      }
                      const parts: string[] = [];
                      if (projectCount > 0) parts.push(`${projectCount} project${projectCount !== 1 ? 's' : ''}`);
                      if (workspaceCount > 0) parts.push(`${workspaceCount} workspace${workspaceCount !== 1 ? 's' : ''}`);
                      return parts.length > 0 ? parts.join(', ') : 'None';
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {variableSet.description || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { void handleOpenManage(variableSet); }}
                        title="Manage variable set"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedVariableSet(variableSet);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Variable Set Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          setVariableSetForm({ name: '', description: '', global: true, priority: false, selectedProjects: [], selectedWorkspaces: [] });
          setInitialVariables([]);
          setVariableForm({ key: '', value: '', sensitive: false, encrypted: false, category: 'terraform', description: '' });
          setShowSelectedProjects(false);
          setShowSelectedWorkspaces(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={(e) => { void handleCreateVariableSet(e); }}>
            <DialogHeader>
              <DialogTitle>Create Variable Set</DialogTitle>
              <DialogDescription>
                Create a new variable set to share variables across workspaces.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="vs-name">Name *</Label>
                  <Input
                    id="vs-name"
                    value={variableSetForm.name}
                    onChange={(e) => setVariableSetForm({ ...variableSetForm, name: e.target.value })}
                    placeholder="Production Variables"
                    required
                    disabled={creating}
                  />
                </div>
                <div>
                  <Label htmlFor="vs-description">Description</Label>
                  <Textarea
                    id="vs-description"
                    value={variableSetForm.description}
                    onChange={(e) => setVariableSetForm({ ...variableSetForm, description: e.target.value })}
                    placeholder="Optional description"
                    disabled={creating}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Variable set scope</Label>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-start space-x-3">
                      <input
                        type="radio"
                        id="scope-all"
                        name="scope"
                        value="all"
                        checked={variableSetForm.global}
                        onChange={() => setVariableSetForm({ ...variableSetForm, global: true })}
                        disabled={creating}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label htmlFor="scope-all" className="font-medium cursor-pointer">
                          Apply to all projects and workspaces
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          All current and future workspaces in this organization will access this variable set.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <input
                        type="radio"
                        id="scope-specific"
                        name="scope"
                        value="specific"
                        checked={!variableSetForm.global}
                        onChange={() => setVariableSetForm({ ...variableSetForm, global: false })}
                        disabled={creating}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label htmlFor="scope-specific" className="font-medium cursor-pointer">
                          Apply to specific projects and workspaces
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          You can assign this variable set to specific projects or workspaces after creation.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "p-3 rounded-lg border mt-3",
                    variableSetForm.global
                      ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                      : "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800"
                  )}>
                    <div className={cn(
                      "flex items-center gap-2 text-sm",
                      variableSetForm.global
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-purple-600 dark:text-purple-400"
                    )}>
                      <Users className="h-4 w-4" />
                      <span className={cn(
                        "font-medium",
                        variableSetForm.global
                          ? "text-blue-900 dark:text-blue-100"
                          : "text-purple-900 dark:text-purple-100"
                      )}>
                        {variableSetForm.global 
                          ? 'Organization-wide Variable Set' 
                          : 'Scoped Variable Set'}
                      </span>
                    </div>
                    <p className={cn(
                      "text-xs mt-1",
                      variableSetForm.global
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-purple-700 dark:text-purple-300"
                    )}>
                      {variableSetForm.global 
                        ? 'This variable set applies to all workspaces in the organization. You can optionally assign it to specific projects after creation.'
                        : 'This variable set will be assigned to specific projects or workspaces. Configure assignments below.'}
                    </p>
                  </div>
                </div>
                {!variableSetForm.global && (
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Apply to projects</Label>
                      <p className="text-sm text-muted-foreground mt-1 mb-2">
                        All current and future workspaces in the selected projects will access this variable set.
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="flex h-10 w-full cursor-pointer items-center rounded-md border border-dashed border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                            <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
                            {variableSetForm.selectedProjects.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 flex-1">
                                {variableSetForm.selectedProjects.map((projectId) => {
                                  const project = projects.find(p => p.id === projectId);
                                  return project ? (
                                    <Badge key={projectId} variant="secondary" className="text-xs">
                                      {project.name}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            ) : (
                              <span className="flex-1">Select projects</span>
                            )}
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
                          {projects.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No projects available</div>
                          ) : (
                            <>
                              {(showSelectedProjects 
                                ? projects.filter(p => variableSetForm.selectedProjects.includes(p.id))
                                : projects
                              ).map((project) => (
                                <DropdownMenuCheckboxItem
                                  key={project.id}
                                  checked={variableSetForm.selectedProjects.includes(project.id)}
                                  onSelect={(e) => {
                                    e.preventDefault();
                                  }}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setVariableSetForm({
                                        ...variableSetForm,
                                        selectedProjects: [...variableSetForm.selectedProjects, project.id],
                                      });
                                    } else {
                                      setVariableSetForm({
                                        ...variableSetForm,
                                        selectedProjects: variableSetForm.selectedProjects.filter(id => id !== project.id),
                                      });
                                    }
                                  }}
                                >
                                  {project.name}
                                </DropdownMenuCheckboxItem>
                              ))}
                              {variableSetForm.selectedProjects.length > 0 && (
                                <>
                                  <div className="border-t my-1" />
                                  <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {variableSetForm.selectedProjects.length} selected
                                    </span>
                                    <div className="flex gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => {
                                          setShowSelectedProjects(!showSelectedProjects);
                                        }}
                                      >
                                        {showSelectedProjects ? 'Show all' : 'Show selected'}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => {
                                          setVariableSetForm({
                                            ...variableSetForm,
                                            selectedProjects: [],
                                          });
                                        }}
                                      >
                                        Clear selected
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {projects.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{projects.length} total</p>
                    )}
                    <div>
                      <Label>Apply to workspaces</Label>
                      <p className="text-sm text-muted-foreground mt-1 mb-2">
                        Only the selected workspaces will access this variable set.
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="flex h-10 w-full cursor-pointer items-center rounded-md border border-dashed border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                            <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
                            {variableSetForm.selectedWorkspaces.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 flex-1">
                                {variableSetForm.selectedWorkspaces.map((workspaceId) => {
                                  const workspace = workspaces.find(w => w.id === workspaceId);
                                  return workspace ? (
                                    <Badge key={workspaceId} variant="secondary" className="text-xs">
                                      {workspace.name}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            ) : (
                              <span className="flex-1">Select workspaces</span>
                            )}
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
                          {workspaces.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No workspaces available</div>
                          ) : (
                            <>
                              {(showSelectedWorkspaces 
                                ? workspaces.filter(w => variableSetForm.selectedWorkspaces.includes(w.id))
                                : workspaces
                              ).map((workspace) => (
                                <DropdownMenuCheckboxItem
                                  key={workspace.id}
                                  checked={variableSetForm.selectedWorkspaces.includes(workspace.id)}
                                  onSelect={(e) => {
                                    e.preventDefault();
                                  }}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setVariableSetForm({
                                        ...variableSetForm,
                                        selectedWorkspaces: [...variableSetForm.selectedWorkspaces, workspace.id],
                                      });
                                    } else {
                                      setVariableSetForm({
                                        ...variableSetForm,
                                        selectedWorkspaces: variableSetForm.selectedWorkspaces.filter(id => id !== workspace.id),
                                      });
                                    }
                                  }}
                                >
                                  {workspace.name}
                                </DropdownMenuCheckboxItem>
                              ))}
                              {variableSetForm.selectedWorkspaces.length > 0 && (
                                <>
                                  <div className="border-t my-1" />
                                  <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {variableSetForm.selectedWorkspaces.length} selected
                                    </span>
                                    <div className="flex gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => {
                                          setShowSelectedWorkspaces(!showSelectedWorkspaces);
                                        }}
                                      >
                                        {showSelectedWorkspaces ? 'Show all' : 'Show selected'}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => {
                                          setVariableSetForm({
                                            ...variableSetForm,
                                            selectedWorkspaces: [],
                                          });
                                        }}
                                      >
                                        Clear selected
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {workspaces.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{workspaces.length} total</p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="vs-priority">Prioritize the variables in this set</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Override any other variable values, even if the other variable set has a more specific scope.
                      </p>
                    </div>
                    <Switch
                      id="vs-priority"
                      checked={variableSetForm.priority}
                      onCheckedChange={(checked) => setVariableSetForm({ ...variableSetForm, priority: checked })}
                      disabled={creating}
                    />
                  </div>
                </div>
              </div>

              {/* Variables Section */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Variables</h4>
                    <p className="text-sm text-muted-foreground">
                      {initialVariables.length} variable{initialVariables.length !== 1 ? 's' : ''} added
                    </p>
                  </div>
                </div>

                {initialVariables.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Key</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {initialVariables.map((variable, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {variable.key}
                              {variable.sensitive && (
                                <Badge variant="outline" className="ml-2 text-xs">Sensitive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {variable.sensitive ? '••••••••' : variable.value}
                            </TableCell>
                            <TableCell>{variable.category}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => handleRemoveInitialVariable(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Add Variable Form */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-semibold">Add Variable</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="create-var-key">Key *</Label>
                      <Input
                        id="create-var-key"
                        value={variableForm.key}
                        onChange={(e) => setVariableForm({ ...variableForm, key: e.target.value })}
                        placeholder="variable_name"
                        disabled={creating}
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-var-category">Category</Label>
                      <Select
                        value={variableForm.category}
                        onValueChange={(value) => setVariableForm({ ...variableForm, category: value })}
                        disabled={creating}
                      >
                        <SelectTrigger id="create-var-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="terraform">Terraform</SelectItem>
                          <SelectItem value="env">Environment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="create-var-value">Value *</Label>
                    <Input
                      id="create-var-value"
                      type={variableForm.sensitive ? 'password' : 'text'}
                      value={variableForm.value}
                      onChange={(e) => setVariableForm({ ...variableForm, value: e.target.value })}
                      placeholder="variable_value"
                      disabled={creating}
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-var-description">Description</Label>
                    <Textarea
                      id="create-var-description"
                      value={variableForm.description}
                      onChange={(e) => setVariableForm({ ...variableForm, description: e.target.value })}
                      placeholder="Optional description"
                      rows={2}
                      disabled={creating}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="create-var-sensitive"
                      checked={variableForm.sensitive}
                      onCheckedChange={(checked) => setVariableForm({ ...variableForm, sensitive: checked === true })}
                      disabled={creating}
                    />
                    <Label htmlFor="create-var-sensitive" className="text-sm font-normal cursor-pointer">
                      Sensitive - Variable value will be hidden in the UI
                    </Label>
                  </div>
                  <Button 
                    type="button" 
                    onClick={() => { void handleAddInitialVariable(); }} 
                    className="w-full"
                    disabled={!variableForm.key.trim() || !variableForm.value.trim() || creating}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Variable
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Variable Set
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unified Manage Variable Set Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={(open) => {
        setManageDialogOpen(open);
        if (!open) {
          setSelectedVariableSet(null);
          setVariableSetForm({ name: '', description: '', global: true, priority: false, selectedProjects: [], selectedWorkspaces: [] });
          setVariableForm({ key: '', value: '', sensitive: false, encrypted: false, category: 'terraform', description: '' });
          setShowSelectedProjects(false);
          setShowSelectedWorkspaces(false);
          setAssignedProjects([]);
          setAssignedWorkspaces([]);
          setManageDialogTab('general');
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Variable Set: {selectedVariableSet?.name}</DialogTitle>
            <DialogDescription>
              Edit details, manage variables, and configure assignments.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={manageDialogTab} onValueChange={(v) => setManageDialogTab(v as 'general' | 'variables' | 'assignment')} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="variables">Variables</TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 py-4">
              <div>
                <Label htmlFor="manage-vs-name">Name *</Label>
                <Input
                  id="manage-vs-name"
                  value={variableSetForm.name}
                  onChange={(e) => setVariableSetForm({ ...variableSetForm, name: e.target.value })}
                  placeholder="Production Variables"
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <Label htmlFor="manage-vs-description">Description</Label>
                <Textarea
                  id="manage-vs-description"
                  value={variableSetForm.description}
                  onChange={(e) => setVariableSetForm({ ...variableSetForm, description: e.target.value })}
                  placeholder="Optional description"
                  disabled={saving}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="manage-vs-priority">Prioritize the variables in this set</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Override any other variable values, even if the other variable set has a more specific scope.
                    </p>
                  </div>
                  <Switch
                    id="manage-vs-priority"
                    checked={variableSetForm.priority}
                    onCheckedChange={(checked) => setVariableSetForm({ ...variableSetForm, priority: checked })}
                    disabled={saving}
                  />
                </div>
              </div>
              {/* Note: Parent is inferred from creation context and cannot be changed */}
              {selectedVariableSet && (
                <div className="text-sm text-muted-foreground p-2 bg-muted rounded-sm">
                  <p>
                    <strong>Ownership:</strong> This variable set is{' '}
                    {selectedVariableSet.projects && selectedVariableSet.projects.length > 0 
                      ? 'project-owned' 
                      : 'organization-owned'}.
                    Ownership cannot be changed after creation.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="variables" className="space-y-4 py-4">
              <div>
                <h3 className="font-semibold">Variables</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedVariableSet?.variables?.length || 0} variable{(selectedVariableSet?.variables?.length || 0) !== 1 ? 's' : ''} in this set
                </p>
              </div>

              {selectedVariableSet?.variables && selectedVariableSet.variables.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedVariableSet.variables.map((variable) => (
                        <TableRow key={variable.id}>
                          <TableCell className="font-medium">
                            {variable.key}
                            {variable.sensitive && (
                              <Badge variant="outline" className="ml-2 text-xs">Sensitive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {variable.sensitive ? '••••••••' : variable.value}
                          </TableCell>
                          <TableCell>{variable.category}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVariableToDelete(variable.id);
                                setDeleteVariableDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <p>No variables in this set.</p>
                  <p className="text-sm mt-2">Add variables to share them across workspaces.</p>
                </div>
              )}

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-semibold">Add New Variable</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="manage-var-key">Key *</Label>
                    <Input
                      id="manage-var-key"
                      value={variableForm.key}
                      onChange={(e) => setVariableForm({ ...variableForm, key: e.target.value })}
                      placeholder="variable_name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="manage-var-category">Category</Label>
                    <Select
                      value={variableForm.category}
                      onValueChange={(value) => setVariableForm({ ...variableForm, category: value })}
                    >
                      <SelectTrigger id="manage-var-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="terraform">Terraform</SelectItem>
                        <SelectItem value="env">Environment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="manage-var-value">Value *</Label>
                  <Input
                    id="manage-var-value"
                    type={variableForm.sensitive ? 'password' : 'text'}
                    value={variableForm.value}
                    onChange={(e) => setVariableForm({ ...variableForm, value: e.target.value })}
                    placeholder="variable_value"
                  />
                </div>
                <div>
                  <Label htmlFor="manage-var-description">Description</Label>
                  <Textarea
                    id="manage-var-description"
                    value={variableForm.description}
                    onChange={(e) => setVariableForm({ ...variableForm, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="manage-var-sensitive"
                    checked={variableForm.sensitive}
                    onCheckedChange={(checked) => setVariableForm({ ...variableForm, sensitive: checked as boolean })}
                  />
                  <Label htmlFor="manage-var-sensitive" className="text-sm font-normal cursor-pointer">
                    Sensitive - Variable value will be hidden in the UI
                  </Label>
                </div>
                <Button 
                  type="button" 
                  onClick={() => { void handleAddVariable(); }} 
                  className="w-full"
                  disabled={!variableForm.key.trim() || !variableForm.value.trim()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variable
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="assignment" className="space-y-4 py-4">
              <div>
                <Label>Variable set scope</Label>
                <div className="space-y-3 mt-2">
                  <div className="flex items-start space-x-3">
                    <input
                      type="radio"
                      id="manage-scope-all"
                      name="manage-scope"
                      value="all"
                      checked={variableSetForm.global}
                      onChange={() => {
                        setVariableSetForm({ ...variableSetForm, global: true });
                        setAssignedProjects([]);
                        setAssignedWorkspaces([]);
                      }}
                      disabled={saving}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="manage-scope-all" className="font-medium cursor-pointer">
                        Apply to all projects and workspaces
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        All current and future workspaces in this organization will access this variable set.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <input
                      type="radio"
                      id="manage-scope-specific"
                      name="manage-scope"
                      value="specific"
                      checked={!variableSetForm.global}
                      onChange={() => {
                        setVariableSetForm({ ...variableSetForm, global: false });
                      }}
                      disabled={saving}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="manage-scope-specific" className="font-medium cursor-pointer">
                        Apply to specific projects and workspaces
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        This variable set will be assigned to specific projects or workspaces. Configure assignments below.
                      </p>
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "p-3 rounded-lg border mt-3",
                  variableSetForm.global
                    ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                    : "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800"
                )}>
                  <div className={cn(
                    "flex items-center gap-2 text-sm",
                    variableSetForm.global
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-purple-600 dark:text-purple-400"
                  )}>
                    <Users className="h-4 w-4" />
                    <span className={cn(
                      "font-medium",
                      variableSetForm.global
                        ? "text-blue-900 dark:text-blue-100"
                        : "text-purple-900 dark:text-purple-100"
                    )}>
                      {variableSetForm.global 
                        ? 'Organization-wide Variable Set' 
                        : 'Scoped Variable Set'}
                    </span>
                  </div>
                  <p className={cn(
                    "text-xs mt-1",
                    variableSetForm.global
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-purple-700 dark:text-purple-300"
                  )}>
                    {variableSetForm.global 
                      ? 'This variable set applies to all workspaces in the organization. You can optionally assign it to specific projects after creation.'
                      : 'This variable set will be assigned to specific projects or workspaces. Configure assignments below.'}
                  </p>
                </div>
              </div>
              {!variableSetForm.global && (
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Apply to projects</Label>
                    <p className="text-sm text-muted-foreground mt-1 mb-2">
                      All current and future workspaces in the selected projects will access this variable set.
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="flex h-10 w-full cursor-pointer items-center rounded-md border border-dashed border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                          <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
                          {assignedProjects.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 flex-1">
                              {assignedProjects.map((projectId) => {
                                const project = projects.find(p => p.id === projectId);
                                return project ? (
                                  <Badge key={projectId} variant="secondary" className="text-xs">
                                    {project.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          ) : (
                            <span className="flex-1">Select projects</span>
                          )}
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
                        {projects.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No projects available</div>
                        ) : (
                          <>
                            {(showSelectedProjects 
                              ? projects.filter(p => assignedProjects.includes(p.id))
                              : projects
                            ).map((project) => (
                              <DropdownMenuCheckboxItem
                                key={project.id}
                                checked={assignedProjects.includes(project.id)}
                                onSelect={(e) => {
                                  e.preventDefault();
                                }}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setAssignedProjects([...assignedProjects, project.id]);
                                  } else {
                                    setAssignedProjects(assignedProjects.filter(id => id !== project.id));
                                  }
                                }}
                              >
                                {project.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                            {assignedProjects.length > 0 && (
                              <>
                                <div className="border-t my-1" />
                                <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {assignedProjects.length} selected
                                  </span>
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => {
                                        setShowSelectedProjects(!showSelectedProjects);
                                      }}
                                    >
                                      {showSelectedProjects ? 'Show all' : 'Show selected'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => {
                                        setAssignedProjects([]);
                                      }}
                                    >
                                      Clear selected
                                    </Button>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {projects.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{projects.length} total</p>
                  )}
                  <div>
                    <Label>Apply to workspaces</Label>
                    <p className="text-sm text-muted-foreground mt-1 mb-2">
                      Only the selected workspaces will access this variable set.
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="flex h-10 w-full cursor-pointer items-center rounded-md border border-dashed border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                          <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
                          {assignedWorkspaces.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 flex-1">
                              {assignedWorkspaces.map((workspaceId) => {
                                const workspace = workspaces.find(w => w.id === workspaceId);
                                return workspace ? (
                                  <Badge key={workspaceId} variant="secondary" className="text-xs">
                                    {workspace.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          ) : (
                            <span className="flex-1">Select workspaces</span>
                          )}
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
                        {workspaces.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No workspaces available</div>
                        ) : (
                          <>
                            {(showSelectedWorkspaces 
                              ? workspaces.filter(w => assignedWorkspaces.includes(w.id))
                              : workspaces
                            ).map((workspace) => (
                              <DropdownMenuCheckboxItem
                                key={workspace.id}
                                checked={assignedWorkspaces.includes(workspace.id)}
                                onSelect={(e) => {
                                  e.preventDefault();
                                }}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setAssignedWorkspaces([...assignedWorkspaces, workspace.id]);
                                  } else {
                                    setAssignedWorkspaces(assignedWorkspaces.filter(id => id !== workspace.id));
                                  }
                                }}
                              >
                                {workspace.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                            {assignedWorkspaces.length > 0 && (
                              <>
                                <div className="border-t my-1" />
                                <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {assignedWorkspaces.length} selected
                                  </span>
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => {
                                        setShowSelectedWorkspaces(!showSelectedWorkspaces);
                                      }}
                                    >
                                      {showSelectedWorkspaces ? 'Show all' : 'Show selected'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => {
                                        setAssignedWorkspaces([]);
                                      }}
                                    >
                                      Clear selected
                                    </Button>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {workspaces.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{workspaces.length} total</p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => { void handleSaveVariableSet(); }} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Variable Set Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Variable Set</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete variable set <strong>"{selectedVariableSet?.name}"</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { void handleDeleteVariableSet(); }} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Variable Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Variable Confirmation Dialog */}
      <Dialog open={deleteVariableDialogOpen} onOpenChange={setDeleteVariableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Variable</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this variable? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteVariableDialogOpen(false);
              setVariableToDelete(null);
            }} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => {
              if (variableToDelete) {
                void handleDeleteVariable(variableToDelete);
              }
            }} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

