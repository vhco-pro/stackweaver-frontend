// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { FileText, ArrowLeft, Save, Trash2, Loader2, Building2, FolderKanban, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  projectsApi,
} from '@/api/client';
import { ansibleConfigApi, type AnsibleConfig } from '@/api/ansible';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DEFAULT_ANSIBLE_CFG = `[defaults]
# Ansible configuration
# See: https://docs.ansible.com/ansible/latest/reference_appendices/config.html

# Host key checking (disabled for automation)
host_key_checking = False

# Timeout for connection attempts
timeout = 30

# Gathering facts
gathering = smart

# Retry on unreachable
retries = 3

[ssh_connection]
# SSH pipelining for performance
pipelining = True

# Control persist for connection reuse
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
`;

export default function AnsibleConfiguration() {
  const { orgName } = useParams<{ orgName: string }>();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState<'org' | 'project' | null>(null);

  // Organization config
  const [orgConfig, setOrgConfig] = useState<AnsibleConfig | null>(null);
  const [orgContent, setOrgContent] = useState('');
  const [orgDirty, setOrgDirty] = useState(false);

  // Project configs
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectConfig, setProjectConfig] = useState<AnsibleConfig | null>(null);
  const [projectContent, setProjectContent] = useState('');
  const [projectDirty, setProjectDirty] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);

  const { isLoading: loading, refetch: refetchOrgConfig } = useQuery({
    queryKey: ['ansibleOrgConfig', orgName],
    queryFn: async () => {
      try {
        const response = await ansibleConfigApi.getByOrganization(orgName!);
        if (response.data) {
          setOrgConfig({
            id: response.data.id,
            organization_id: response.data.attributes['organization-id'],
            content: response.data.attributes.content,
            created_at: response.data.attributes['created-at'],
            updated_at: response.data.attributes['updated-at'],
          });
          setOrgContent(response.data.attributes.content);
        }
      } catch (err) {
        if ((err as { status?: number }).status !== 404) {
          console.error('Failed to load org ansible config:', err);
        }
        setOrgConfig(null);
        setOrgContent('');
      }
      return null;
    },
    enabled: !!orgName,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['ansibleConfigProjects', orgName],
    queryFn: async () => {
      const response = await projectsApi.list(orgName!);
      return response.data || [];
    },
    enabled: !!orgName,
  });

  useQuery({
    queryKey: ['ansibleProjectConfig', selectedProjectId],
    queryFn: async () => {
      setProjectDirty(false);
      setProjectLoading(true);
      try {
        const response = await ansibleConfigApi.getByProject(selectedProjectId);
        if (response.data) {
          setProjectConfig({
            id: response.data.id,
            project_id: response.data.attributes['project-id'],
            content: response.data.attributes.content,
            created_at: response.data.attributes['created-at'],
            updated_at: response.data.attributes['updated-at'],
          });
          setProjectContent(response.data.attributes.content);
        }
      } catch (err) {
        if ((err as { status?: number }).status !== 404) {
          console.error('Failed to load project ansible config:', err);
        }
        setProjectConfig(null);
        setProjectContent('');
      } finally {
        setProjectLoading(false);
      }
      return null;
    },
    enabled: !!selectedProjectId,
  });

  const handleSaveOrg = async () => {
    if (!orgName) return;
    setSaving(true);
    try {
      await ansibleConfigApi.upsertByOrganization(orgName, orgContent);
      await refetchOrgConfig();
      setOrgDirty(false);
      toast.success('Organization Ansible configuration saved');
    } catch (err) {
      console.error('Failed to save org ansible config:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProject = async () => {
    if (!selectedProjectId) return;
    setSaving(true);
    try {
      await ansibleConfigApi.upsertByProject(selectedProjectId, projectContent);
      // Config will refresh from query cache
      setProjectDirty(false);
      toast.success('Project Ansible configuration saved');
    } catch (err) {
      console.error('Failed to save project ansible config:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteScope) return;
    setDeleting(true);
    try {
      if (deleteScope === 'org' && orgName) {
        await ansibleConfigApi.deleteByOrganization(orgName);
        setOrgConfig(null);
        setOrgContent('');
        setOrgDirty(false);
        toast.success('Organization Ansible configuration deleted');
      } else if (deleteScope === 'project' && selectedProjectId) {
        await ansibleConfigApi.deleteByProject(selectedProjectId);
        setProjectConfig(null);
        setProjectContent('');
        setProjectDirty(false);
        toast.success('Project Ansible configuration deleted');
      }
    } catch (err) {
      console.error('Failed to delete ansible config:', err);
      toast.error('Failed to delete configuration');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteScope(null);
    }
  };

  const openDeleteDialog = (scope: 'org' | 'project') => {
    setDeleteScope(scope);
    setDeleteDialogOpen(true);
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
      <div className="flex items-center gap-4">
        <Link to={`/app/${orgName}/settings`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 border border-orange-500/20">
            <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ansible Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Manage ansible.cfg settings for your organization and projects
            </p>
          </div>
        </div>
      </div>

      {/* Priority Info */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Configuration Priority:</strong> Project-level configuration takes precedence over organization-level.
          When a job runs, StackWeaver uses the most specific configuration available (project → organization).
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="organization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="project" className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Project
          </TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Configuration
              </CardTitle>
              <CardDescription>
                Default ansible.cfg for all Ansible jobs in this organization.
                Can be overridden at the project level.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>ansible.cfg content</Label>
                  {!orgConfig && !orgContent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOrgContent(DEFAULT_ANSIBLE_CFG);
                        setOrgDirty(true);
                      }}
                    >
                      Use Default Template
                    </Button>
                  )}
                </div>
                <Textarea
                  value={orgContent}
                  onChange={(e) => {
                    setOrgContent(e.target.value);
                    setOrgDirty(true);
                  }}
                  placeholder="# Enter ansible.cfg content here..."
                  className="font-mono text-sm min-h-[400px]"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {orgConfig ? (
                    <>Last updated: {new Date(orgConfig.updated_at).toLocaleString()}</>
                  ) : (
                    'No configuration saved yet'
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {orgConfig && (
                    <Button
                      variant="outline"
                      onClick={() => openDeleteDialog('org')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                  <Button
                    onClick={() => { void handleSaveOrg(); }}
                    disabled={saving || !orgDirty || !orgContent.trim()}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Tab */}
        <TabsContent value="project">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Project Configuration
              </CardTitle>
              <CardDescription>
                Project-specific ansible.cfg that overrides the organization default.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Project</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProjectId ? (
                projectLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>ansible.cfg content</Label>
                        {!projectConfig && !projectContent && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setProjectContent(orgContent || DEFAULT_ANSIBLE_CFG);
                              setProjectDirty(true);
                            }}
                          >
                            {orgContent ? 'Copy from Organization' : 'Use Default Template'}
                          </Button>
                        )}
                      </div>
                      <Textarea
                        value={projectContent}
                        onChange={(e) => {
                          setProjectContent(e.target.value);
                          setProjectDirty(true);
                        }}
                        placeholder="# Enter ansible.cfg content here..."
                        className="font-mono text-sm min-h-[400px]"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {projectConfig ? (
                          <>Last updated: {new Date(projectConfig.updated_at).toLocaleString()}</>
                        ) : (
                          'No project configuration saved (will use organization default)'
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {projectConfig && (
                          <Button
                            variant="outline"
                            onClick={() => openDeleteDialog('project')}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        )}
                        <Button
                          onClick={() => { void handleSaveProject(); }}
                          disabled={saving || !projectDirty || !projectContent.trim()}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  </>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Select a project to manage its Ansible configuration</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ansible Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {deleteScope === 'org' ? 'organization' : 'project'}-level
              Ansible configuration? {deleteScope === 'project' && 'Jobs will fall back to the organization default.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDelete(); }}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
