// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsApi, type Project } from '@/api/client';
import { Button } from '@/components/ui/button';
import { FolderKanban, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Projects() {
  const params = useParams<{ orgName: string }>();
  const orgName = params.orgName;
  const navigate = useNavigate();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data: projects = [], isLoading: loading, error: queryError, refetch: refetchProjects } = useQuery({
    queryKey: ['projects', orgName],
    queryFn: async () => {
      const response = await projectsApi.list(orgName!);
      return response?.data || [];
    },
    enabled: !!orgName,
  });

  const error = queryError ? 'Failed to load projects. Please try again.' : null;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgName) return;
    
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setCreating(true);
    try {
      const newProject = await projectsApi.create(orgName, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      toast.success('Project created successfully');
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '' });
      void refetchProjects();
      // Navigate to the new project
      if (orgName) {
        void Promise.resolve(navigate(`/app/${orgName}/projects/${newProject.name}`));
      }
    } catch (err: unknown) {
      let errorMessage = 'Failed to create project';
      if (err && typeof err === 'object') {
        const error = err as { message?: string; error?: string };
        errorMessage = error.message || error.error || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!projectToDelete || !orgName) return;

    setDeleting(true);
    try {
      await projectsApi.delete(orgName, projectToDelete.name);
      toast.success('Project deleted successfully');
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      void refetchProjects();
    } catch (err: unknown) {
      let errorMessage = 'Failed to delete project';
      if (err && typeof err === 'object') {
        const error = err as { message?: string; error?: string };
        errorMessage = error.message || error.error || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  if (!orgName) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Please select an organization to view projects.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => { void refetchProjects(); }}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {orgName && (
          <>
            <Link to={`/app/${orgName}/workspaces`} className="hover:text-foreground">
              {orgName}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground font-medium">Projects</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Projects
          </h1>
          <p className="text-muted-foreground">
            Group workspaces together logically for better organization
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(e) => { void handleCreateProject(e); }}>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>
                  Create a new project to group workspaces together logically.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Project"
                    required
                    maxLength={200}
                    disabled={creating}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    maxLength={500}
                    disabled={creating}
                  />
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
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete Project Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project "{projectToDelete?.name}"? 
              This action cannot be undone and will delete all associated workspaces, runs, and resources.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setProjectToDelete(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDelete(); }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center space-y-6 p-12 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10 dark:from-black/5 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl shadow-blue-500/10 max-w-2xl">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30">
                <FolderKanban className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-semibold mb-2">No Projects Found</h3>
              <p className="text-muted-foreground text-lg mb-6">
                Get started by creating your first project to group workspaces together.
              </p>
              <Button 
                onClick={() => setCreateDialogOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/app/${orgName}/projects/${project.name}`}
              className={cn(
                'group relative overflow-hidden rounded-2xl',
                'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                'dark:from-black/10 dark:from-black/5',
                'backdrop-blur-md border border-white/20 dark:border-white/10',
                'p-6 shadow-lg shadow-purple-500/10',
                'transition-all duration-300',
                'hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02]',
                'hover:border-purple-500/30'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all duration-300 flex-shrink-0">
                    <FolderKanban className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-200 truncate">
                      {project.name}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
                      "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                      "hover:border-destructive/20"
                    )}
                    onClick={(e) => handleDeleteClick(e, project)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {project.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>View Details</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}