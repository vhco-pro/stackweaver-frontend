// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { organizationsApi, projectsApi, type Organization, type Project } from '@/api/client';
import { Button } from '@/components/ui/button';
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
import { Loader2, Building2, FolderKanban, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrganizationDetail() {
  const { name } = useParams<{ name: string }>();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const navigate = useNavigate();

  const fetchData = () => {
    if (!name) return;

    void Promise.all([
      organizationsApi.get(name),
      projectsApi.list(name),
    ])
      .then(([orgRes, projectsRes]) => {
        // organizationsApi.get() returns Organization directly
        // projectsApi.list() returns { data: Project[], meta: { pagination: ... } }
        setOrganization(orgRes);
        // Safely handle projects response - ensure it's always an array
        setProjects(projectsRes?.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        // Set empty array on error to prevent undefined.length errors
        setProjects([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    // fetchData is intentionally omitted - it uses name which is in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) return;
    
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setCreating(true);
    try {
      const newProject = await projectsApi.create(name, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      toast.success('Project created successfully');
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '' });
      fetchData();
      // Navigate to the new project (using names)
      void Promise.resolve(navigate(`/organizations/${name}/projects/${newProject.name}`));
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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4 p-12 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5 backdrop-blur-md border border-white/20 dark:border-white/10">
          <h3 className="text-2xl font-semibold mb-2">Organization not found</h3>
          <p className="text-muted-foreground mb-6">
            The organization you're looking for doesn't exist or you don't have access to it.
          </p>
          <Link to="/organizations">
            <Button variant="outline">Back to Organizations</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link 
          to="/organizations" 
          className="hover:text-foreground transition-colors"
        >
          Organizations
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{organization.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30">
              <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {organization.name}
              </h1>
              {organization.description && (
                <p className="text-muted-foreground text-lg">
                  {organization.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(e) => { void handleCreateProject(e); }}>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>
                  Create a new project in {organization.name} to organize your infrastructure.
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

      {/* Projects Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Projects</h2>
          <span className="text-sm text-muted-foreground">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center space-y-6 p-12 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl shadow-blue-500/10 max-w-2xl">
              <div className="flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30">
                  <FolderKanban className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">No Projects Found</h3>
                <p className="text-muted-foreground text-lg mb-6">
                  Get started by creating your first project for this organization.
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
              to={`/organizations/${name}/projects/${project.name}`}
              className={cn(
                'group relative overflow-hidden rounded-2xl',
                'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                'dark:from-black/10 dark:via-black/5',
                'backdrop-blur-md border border-white/20 dark:border-white/10',
                'p-6 shadow-lg shadow-blue-500/10',
                'transition-all duration-300',
                'hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02]',
                'hover:border-blue-500/30'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 group-hover:from-blue-500/30 group-hover:to-indigo-500/30 transition-all duration-300">
                    <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-200">
                      {project.name}
                    </h3>
                  </div>
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
    </div>
  );
}

