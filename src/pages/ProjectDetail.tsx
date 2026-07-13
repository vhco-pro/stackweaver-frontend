// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { projectsApi, workspacesApi, vcsConnectionsApi } from '@/api/client';
import { 
  ansibleInventoriesApi, 
  ansiblePlaybooksApi, 
  ansibleJobTemplatesApi, 
  ansibleWorkflowsApi, 
  ansibleCredentialsApi,
} from '@/api/ansible';
import {
  getAnsibleInventoryFromJsonApi,
  getAnsiblePlaybookFromJsonApi,
  getAnsibleJobTemplateFromJsonApi,
  getAnsibleCredentialFromJsonApi,
  getAnsibleWorkflowFromJsonApi,
} from '@/utils/ansible-jsonapi';
import { Button } from '@/components/ui/button';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { ProjectTags } from '@/components/project/ProjectTags';
import { Plus, FolderKanban, Building2, Loader2, Server, FileCode, Layers, Workflow, Key, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProjectDetail() {
  const params = useParams<{ orgName: string; projectName: string }>();
  const orgName = params.orgName;
  const projectName = params.projectName;
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    workspaces: true,
    inventories: false,
    playbooks: false,
    jobTemplates: false,
    workflows: false,
    credentials: false,
  });

  const { isLoading: loading, data: projectData, refetch: refetchData } = useQuery({
    queryKey: ['projectDetail', orgName, projectName],
    queryFn: async () => {
      const [projectRes, workspacesRes, inventoriesRes, playbooksRes, jobTemplatesRes, workflowsRes, credentialsRes] = await Promise.all([
        projectsApi.get(orgName!, projectName!),
        workspacesApi.list(orgName!),
        ansibleInventoriesApi.list(orgName!),
        ansiblePlaybooksApi.listByOrganization(orgName!),
        ansibleJobTemplatesApi.listByOrganization(orgName!),
        ansibleWorkflowsApi.list(orgName!),
        ansibleCredentialsApi.list(orgName!),
      ]);
      const projectWorkspaces = (workspacesRes?.data || []).filter(w => w.project_id === projectRes.id);
      return {
        project: projectRes,
        workspaces: projectWorkspaces,
        inventories: (inventoriesRes.data || []).map(getAnsibleInventoryFromJsonApi).filter(i => i.project_id === projectRes.id),
        playbooks: (playbooksRes.data || []).map(getAnsiblePlaybookFromJsonApi).filter(p => p.project_id === projectRes.id),
        jobTemplates: (jobTemplatesRes.data || []).map(getAnsibleJobTemplateFromJsonApi).filter(jt => jt.project_id === projectRes.id),
        workflows: (workflowsRes.data || []).map(getAnsibleWorkflowFromJsonApi).filter(w => w.project_id === projectRes.id),
        credentials: (credentialsRes.data || []).map(getAnsibleCredentialFromJsonApi).filter(c => c.project_id === projectRes.id),
      };
    },
    enabled: !!orgName && !!projectName,
  });

  const project = projectData?.project ?? null;
  const workspaces = projectData?.workspaces ?? [];
  const inventories = projectData?.inventories ?? [];
  const playbooks = projectData?.playbooks ?? [];
  const jobTemplates = projectData?.jobTemplates ?? [];
  const workflows = projectData?.workflows ?? [];
  const credentials = projectData?.credentials ?? [];

  const installationHandledRef = useRef(false);

  // Handle GitHub App redirect with installation_id
  useEffect(() => {
    const installationId = searchParams.get('installation_id');
    if (!installationId || !orgName || installationHandledRef.current) return;

    installationHandledRef.current = true;
    // Create connection from installation and refresh
    void vcsConnectionsApi.createConnectionFromInstallation(orgName, installationId)
      .then(() => {
        // Clean query params
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('installation_id');
        setSearchParams(newSearchParams, { replace: true });
        // Refresh list
        void refetchData();
      })
      .catch((err) => {
        console.error('Failed to create VCS connection from installation:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, orgName]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4 p-12 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10 dark:via-black/5 backdrop-blur-md border border-white/20 dark:border-white/10">
          <h3 className="text-2xl font-semibold mb-2">Project not found</h3>
          <p className="text-muted-foreground mb-6">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <Link to="/projects">
            <Button variant="outline">Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {orgName && (
          <>
            <Link 
              to={`/app/${orgName}/projects`} 
              className="hover:text-foreground transition-colors"
            >
              {orgName}
            </Link>
            <span>/</span>
          </>
        )}
        <Link 
          to={orgName ? `/app/${orgName}/projects` : '/projects'}
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30">
              <FolderKanban className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-muted-foreground text-lg">
                  {project.description}
                </p>
              )}
              {orgName && (
                <div className="flex items-center gap-2 mt-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Link 
                    to={`/app/${orgName}/workspaces`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {orgName}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Workspace
        </Button>
      </div>

      {orgName && (
        <CreateWorkspaceDialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            // Refresh workspaces when dialog closes (in case a workspace was created)
            if (!open) {
              void refetchData();
            }
          }}
          orgName={orgName}
          projectId={project?.id}
        />
      )}

      {/* Tags */}
      {project.id && <ProjectTags projectId={project.id} />}

      {/* Resource Sections */}
      <div className="space-y-6">
        {/* Workspaces Section */}
        {workspaces.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, workspaces: !prev.workspaces }))}
              className="w-full flex items-center justify-between mb-4 text-left hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-semibold">Workspaces</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{workspaces.length}</span>
                {expandedSections.workspaces ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSections.workspaces && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    to={orgName ? `/app/${orgName}/workspaces/${workspace.name}` : `/organizations/${orgName}/workspaces/${workspace.name}`}
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
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 group-hover:from-blue-500/30 group-hover:to-indigo-500/30 transition-all duration-300 shrink-0">
                        <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors truncate">
                          {workspace.name}
                        </h3>
                        {workspace.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {workspace.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Inventories Section */}
        {inventories.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, inventories: !prev.inventories }))}
              className="w-full flex items-center justify-between mb-4 text-left hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-semibold">Inventories</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{inventories.length}</span>
                {expandedSections.inventories ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSections.inventories && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventories.map((inventory) => (
                  <Link
                    key={inventory.id}
                    to={orgName ? `/app/${orgName}/ansible/inventories/${inventory.id}` : `/organizations/${orgName}/ansible/inventories/${inventory.id}`}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl',
                      'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                      'dark:from-black/10 dark:via-black/5',
                      'backdrop-blur-md border border-white/20 dark:border-white/10',
                      'p-6 shadow-lg shadow-green-500/10',
                      'transition-all duration-300',
                      'hover:shadow-xl hover:shadow-green-500/20 hover:scale-[1.02]',
                      'hover:border-green-500/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 group-hover:from-green-500/30 group-hover:to-emerald-500/30 transition-all duration-300 shrink-0">
                        <Server className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors truncate">
                          {inventory.name}
                        </h3>
                        {inventory.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {inventory.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Playbooks Section */}
        {playbooks.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, playbooks: !prev.playbooks }))}
              className="w-full flex items-center justify-between mb-4 text-left hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-semibold">Playbooks</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{playbooks.length}</span>
                {expandedSections.playbooks ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSections.playbooks && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {playbooks.map((playbook) => (
                  <Link
                    key={playbook.id}
                    to={orgName ? `/app/${orgName}/ansible/playbooks/${playbook.id}` : `/organizations/${orgName}/ansible/playbooks/${playbook.id}`}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl',
                      'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                      'dark:from-black/10 dark:via-black/5',
                      'backdrop-blur-md border border-white/20 dark:border-white/10',
                      'p-6 shadow-lg shadow-purple-500/10',
                      'transition-all duration-300',
                      'hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02]',
                      'hover:border-purple-500/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all duration-300 shrink-0">
                        <FileCode className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors truncate">
                          {playbook.name}
                        </h3>
                        {playbook.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {playbook.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Job Templates Section */}
        {jobTemplates.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, jobTemplates: !prev.jobTemplates }))}
              className="w-full flex items-center justify-between mb-4 text-left hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-semibold">Job Templates</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{jobTemplates.length}</span>
                {expandedSections.jobTemplates ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSections.jobTemplates && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobTemplates.map((template) => (
                  <Link
                    key={template.id}
                    to={orgName ? `/app/${orgName}/ansible/job-templates/${template.id}` : `/organizations/${orgName}/ansible/job-templates/${template.id}`}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl',
                      'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                      'dark:from-black/10 dark:via-black/5',
                      'backdrop-blur-md border border-white/20 dark:border-white/10',
                      'p-6 shadow-lg shadow-orange-500/10',
                      'transition-all duration-300',
                      'hover:shadow-xl hover:shadow-orange-500/20 hover:scale-[1.02]',
                      'hover:border-orange-500/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 group-hover:from-orange-500/30 group-hover:to-amber-500/30 transition-all duration-300 shrink-0">
                        <Layers className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors truncate">
                          {template.name}
                        </h3>
                        {template.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Workflows Section */}
        {workflows.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, workflows: !prev.workflows }))}
              className="w-full flex items-center justify-between mb-4 text-left hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-semibold">Workflows</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{workflows.length}</span>
                {expandedSections.workflows ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSections.workflows && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workflows.map((workflow) => (
                  <Link
                    key={workflow.id}
                    to={orgName ? `/app/${orgName}/ansible/workflows/${workflow.id}` : `/organizations/${orgName}/ansible/workflows/${workflow.id}`}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl',
                      'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                      'dark:from-black/10 dark:via-black/5',
                      'backdrop-blur-md border border-white/20 dark:border-white/10',
                      'p-6 shadow-lg shadow-indigo-500/10',
                      'transition-all duration-300',
                      'hover:shadow-xl hover:shadow-indigo-500/20 hover:scale-[1.02]',
                      'hover:border-indigo-500/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 group-hover:from-indigo-500/30 group-hover:to-violet-500/30 transition-all duration-300 shrink-0">
                        <Workflow className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors truncate">
                          {workflow.name}
                        </h3>
                        {workflow.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {workflow.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Credentials Section */}
        {credentials.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, credentials: !prev.credentials }))}
              className="w-full flex items-center justify-between mb-4 text-left hover:opacity-80 transition-opacity"
            >
              <h2 className="text-2xl font-semibold">Credentials</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{credentials.length}</span>
                {expandedSections.credentials ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSections.credentials && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {credentials.map((credential) => (
                  <Link
                    key={credential.id}
                    to={orgName ? `/app/${orgName}/ansible/credentials/${credential.id}` : `/organizations/${orgName}/ansible/credentials/${credential.id}`}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl',
                      'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                      'dark:from-black/10 dark:via-black/5',
                      'backdrop-blur-md border border-white/20 dark:border-white/10',
                      'p-6 shadow-lg shadow-yellow-500/10',
                      'transition-all duration-300',
                      'hover:shadow-xl hover:shadow-yellow-500/20 hover:scale-[1.02]',
                      'hover:border-yellow-500/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 group-hover:from-yellow-500/30 group-hover:to-amber-500/30 transition-all duration-300 shrink-0">
                        <Key className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors truncate">
                          {credential.name}
                        </h3>
                        {credential.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {credential.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

