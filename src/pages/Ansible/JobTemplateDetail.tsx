// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  ansibleJobTemplatesApi,
  ansibleJobsApi,
  ansiblePlaybooksApi,
  ansibleInventoriesApi,
  ansibleCredentialsApi,
  type AnsibleJobTemplate,
  type AnsibleJob,
  type AnsiblePlaybook,
  type AnsibleInventory,
  type AnsibleCredential,
} from '@/api/ansible';
import {
  variableSetsApi,
  agentPoolsApi,
  type VariableSet,
  type AgentPool,
} from '@/api/client';
import {
  getAnsibleJobTemplateFromJsonApi,
  getAnsibleJobFromJsonApi,
  getAnsiblePlaybookFromJsonApi,
  getAnsibleInventoryFromJsonApi,
  getAnsibleCredentialFromJsonApi,
} from '@/utils/ansible-jsonapi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Layers,
  Loader2,
  Clock,
  Edit,
  Trash2,
  Play,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  FileText,
  Database,
  Settings,
  Zap,
  RefreshCw,
  Ban,
  WifiOff,
  CircleDot,
  EyeOff,
  Info,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Helper functions for job display
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

function formatDuration(startedAt?: string, finishedAt?: string) {
  if (!startedAt) return '-';
  const start = new Date(startedAt);
  const end = finishedAt ? new Date(finishedAt) : new Date();
  const durationMs = end.getTime() - start.getTime();
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />;
    case 'successful':
      return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case 'failed':
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case 'canceled':
      return <Ban className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'running':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'successful':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'failed':
    case 'error':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'canceled':
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
}

function hasWarnings(job: AnsibleJob): boolean {
  return job.has_warnings || false;
}

export default function JobTemplateDetail() {
  const { orgName, templateId } = useParams<{ orgName: string; templateId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<AnsibleJobTemplate | null>(null);
  const [playbook, setPlaybook] = useState<AnsiblePlaybook | null>(null);
  const [inventory, setInventory] = useState<AnsibleInventory | null>(null);
  const [recentJobs, setRecentJobs] = useState<AnsibleJob[]>([]);
  const [credentials, setCredentials] = useState<AnsibleCredential[]>([]);
  const [inventories, setInventories] = useState<AnsibleInventory[]>([]);
  const [variableSets, setVariableSets] = useState<VariableSet[]>([]);
  const [templateVariables, setTemplateVariables] = useState<Array<{
    id: string;
    job_template_id: string;
    key: string;
    value: string;
    description?: string;
    category?: string;
    hcl?: boolean;
    encrypted: boolean;
    sensitive: boolean;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [platformVariablesSectionOpen, setPlatformVariablesSectionOpen] = useState(false);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ 
    name: '', 
    description: '',
    limit: '',
    tags: '',
    skip_tags: '',
    verbosity: 0,
    forks: 5,
    credential_id: '',
    inventory_id: '',
    agent_pool_id: '',
  });
  const [agentPools, setAgentPools] = useState<AgentPool[]>([]);
  
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Launch state
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchOverrides, setLaunchOverrides] = useState({
    extra_vars: '',
    limit: '',
    tags: '',
    skip_tags: '',
  });

  // Template Variable state
  const [createVariableDialogOpen, setCreateVariableDialogOpen] = useState(false);
  const [editingTemplateVariable, setEditingTemplateVariable] = useState<typeof templateVariables[0] | null>(null);
  const [deleteVariableDialogOpen, setDeleteVariableDialogOpen] = useState(false);
  const [variableToDelete, setVariableToDelete] = useState<typeof templateVariables[0] | null>(null);
  const [deletingVariable, setDeletingVariable] = useState(false);
  const [variableForm, setVariableForm] = useState({
    key: '',
    value: '',
    description: '',
    category: 'env' as 'terraform' | 'env',
    hcl: false,
    sensitive: false,
    encrypted: false,
  });

  // Fetch template details
  const { isLoading: loading } = useQuery({
    queryKey: ['jobTemplateDetail', templateId, orgName],
    queryFn: async () => {
      const tmplRes = await ansibleJobTemplatesApi.get(templateId!);
      const tmpl = getAnsibleJobTemplateFromJsonApi(tmplRes.data);
      setTemplate(tmpl);
      setEditForm({ 
        name: tmpl.name, 
        description: tmpl.description || '',
        limit: tmpl.limit || '',
        tags: tmpl.tags || '',
        skip_tags: tmpl.skip_tags || '',
        verbosity: tmpl.verbosity,
        forks: tmpl.forks,
        credential_id: tmpl.credential_id || '',
        inventory_id: tmpl.inventory_id || '',
        agent_pool_id: tmpl.agent_pool_id || '',
      });
      setLaunchOverrides({
        extra_vars: tmpl.extra_vars ? JSON.stringify(tmpl.extra_vars, null, 2) : '',
        limit: tmpl.limit || '',
        tags: tmpl.tags || '',
        skip_tags: tmpl.skip_tags || '',
      });

      if (tmpl.playbook_id) {
        try {
          const pbRes = await ansiblePlaybooksApi.get(tmpl.playbook_id);
          setPlaybook(getAnsiblePlaybookFromJsonApi(pbRes.data));
        } catch (err) {
          console.warn('Could not load playbook:', err);
        }
      }
      if (tmpl.inventory_id) {
        try {
          const invRes = await ansibleInventoriesApi.get(tmpl.inventory_id);
          setInventory(getAnsibleInventoryFromJsonApi(invRes.data));
        } catch (err) {
          console.warn('Could not load inventory:', err);
        }
      }

      const jobsRes = await ansibleJobsApi.listByOrganization(orgName!);
      const relatedJobs = (jobsRes.data || []).map(getAnsibleJobFromJsonApi)
        .filter(j => j.job_template_id === templateId)
        .slice(0, 10);
      setRecentJobs(relatedJobs);

      try {
        const [credRes, invListRes] = await Promise.all([
          ansibleCredentialsApi.list(orgName!),
          ansibleInventoriesApi.list(orgName!),
        ]);
        setCredentials((credRes.data || []).map(getAnsibleCredentialFromJsonApi));
        setInventories((invListRes.data || []).map(getAnsibleInventoryFromJsonApi));
      } catch (err) {
        console.warn('Failed to load credentials/inventories:', err);
      }

      try {
        const assignedSets = await variableSetsApi.listByJobTemplate(templateId!);
        const setsWithDetails = await Promise.all(
          assignedSets.map(async (vs) => {
            try {
              const fullSet = await variableSetsApi.get(orgName!, vs.id);
              return fullSet;
            } catch (err) {
              console.error(`Failed to load details for variable set ${vs.id}:`, err);
              return null;
            }
          })
        );
        setVariableSets(setsWithDetails.filter((vs): vs is VariableSet => vs !== null));
      } catch (err) {
        console.warn('Failed to load variable sets for job template:', err);
        setVariableSets([]);
      }

      try {
        const vars = await ansibleJobTemplatesApi.listVariables(templateId!);
        setTemplateVariables(Array.isArray(vars) ? vars : []);
      } catch (err) {
        console.warn('Failed to load template variables:', err);
        setTemplateVariables([]);
      }
      return null;
    },
    enabled: !!templateId && !!orgName,
  });

  // Auto-open edit dialog if ?edit=true in URL
  useEffect(() => {
    if (!loading && searchParams.get('edit') === 'true') {
      setEditDialogOpen(true);
      // Remove the edit param from URL
      setSearchParams({});
    }
  }, [loading, searchParams, setSearchParams]);

  // Initialize edit form when dialog opens or template changes
  useEffect(() => {
    if (editDialogOpen && template) {
      setEditForm({
        name: template.name || '',
        description: template.description || '',
        limit: template.limit || '',
        tags: template.tags || '',
        skip_tags: template.skip_tags || '',
        verbosity: template.verbosity || 0,
        forks: template.forks || 5,
        credential_id: template.credential_id || '',
        inventory_id: template.inventory_id || '',
        agent_pool_id: template.agent_pool_id || '',
      });
      // Load agent pools for the edit dialog
      if (orgName) {
        void agentPoolsApi.list(orgName)
          .then((res) => setAgentPools(res.data || []))
          .catch((err) => console.error('Failed to load agent pools:', err));
      }
    }
  }, [editDialogOpen, template, orgName]);

  const handleUpdate = async () => {
    if (!template || !editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!editForm.inventory_id) {
      toast.error('Inventory is required');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        name: editForm.name,
        description: editForm.description || undefined,
        limit: editForm.limit || undefined,
        tags: editForm.tags || undefined,
        skip_tags: editForm.skip_tags || undefined,
        verbosity: editForm.verbosity,
        forks: editForm.forks,
        inventory_id: editForm.inventory_id,
        // Use empty string (not undefined) to clear the relationship, undefined to skip updating it
        credential_id: editForm.credential_id === '' ? '' : (editForm.credential_id || undefined),
        agent_pool_id: editForm.agent_pool_id === '' ? '' : (editForm.agent_pool_id || undefined),
      };
      
      // Debug logging (only in development)
      if (import.meta.env.DEV) {
        console.log('[DEBUG] JobTemplateDetail.handleUpdate: Sending update request:', {
          template_id: template.id,
          inventory_id: updateData.inventory_id,
          credential_id: updateData.credential_id,
          credential_id_original: editForm.credential_id,
        });
      }
      
      const res = await ansibleJobTemplatesApi.update(template.id, updateData);
      setTemplate(getAnsibleJobTemplateFromJsonApi(res.data));
      setEditDialogOpen(false);
      toast.success('Job template updated successfully');
    } catch (err: unknown) {
      console.error('Failed to update job template:', err);
      const message = err instanceof Error ? err instanceof Error ? err.message : 'Unknown error' : 'Failed to update job template';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;

    setDeleting(true);
    try {
      await ansibleJobTemplatesApi.delete(template.id);
      toast.success('Job template deleted successfully');
      void Promise.resolve(navigate(`/app/${orgName}/ansible/job-templates`));
    } catch (err: unknown) {
      console.error('Failed to delete job template:', err);
      const message = err instanceof Error ? err instanceof Error ? err.message : 'Unknown error' : 'Failed to delete job template';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleLaunch = async () => {
    if (!template) return;

    setLaunching(true);
    try {
      let parsedExtraVars: unknown = undefined;
      if (launchOverrides.extra_vars.trim()) {
        try {
          parsedExtraVars = JSON.parse(launchOverrides.extra_vars) as unknown;
        } catch {
          toast.error('Invalid JSON in extra variables');
          setLaunching(false);
          return;
        }
      }

      const res = await ansibleJobTemplatesApi.launch(template.id, {
        extra_vars: parsedExtraVars as Record<string, unknown> | undefined,
        limit: launchOverrides.limit || undefined,
        tags: launchOverrides.tags || undefined,
        skip_tags: launchOverrides.skip_tags || undefined,
      });
      const job = getAnsibleJobFromJsonApi(res.data);
      toast.success('Job launched successfully');
      setLaunchDialogOpen(false);
      // Navigate to the job detail page
      void Promise.resolve(navigate(`/app/${orgName}/ansible/jobs/${job.id}`));
    } catch (err: unknown) {
      console.error('Failed to launch job:', err);
      const message = err instanceof Error ? err instanceof Error ? err.message : 'Unknown error' : 'Failed to launch job';
      toast.error(message);
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container py-6">
        <div className="text-center py-12">
          <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Job Template Not Found</h3>
          <p className="text-muted-foreground mb-4">
            The job template you're looking for doesn't exist or was deleted.
          </p>
          <Button asChild>
            <Link to={`/app/${orgName}/ansible/job-templates`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Job Templates
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/app/${orgName}/ansible/job-templates`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold">{template.name}</h1>
            </div>
            {template.description && (
              <p className="text-muted-foreground mt-1">{template.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setLaunchDialogOpen(true)}
          >
            <Play className="h-4 w-4 mr-2" />
            Launch
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs">
            Recent Jobs ({recentJobs.length})
          </TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Linked Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  Linked Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Playbook</p>
                  {playbook ? (
                    <Link
                      to={`/app/${orgName}/ansible/playbooks/${playbook.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      {playbook.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Not found</span>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Inventory</p>
                  {inventory ? (
                    <Link
                      to={`/app/${orgName}/ansible/inventories/${inventory.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Database className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      {inventory.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Not found</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Execution Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Execution Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Verbosity</p>
                    <p className="font-medium">{template.verbosity} ({['Normal', '-v', '-vv', '-vvv', '-vvvv'][template.verbosity] || 'Normal'})</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Forks</p>
                    <p className="font-medium">{template.forks}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Privilege Escalation</p>
                  <Badge variant={template.become ? 'default' : 'outline'}>
                    {template.become ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {template.limit && (
                  <div>
                    <p className="text-sm text-muted-foreground">Limit</p>
                    <p className="font-mono text-sm">{template.limit}</p>
                  </div>
                )}
                {template.tags && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tags</p>
                    <p className="font-mono text-sm">{template.tags}</p>
                  </div>
                )}
                {template.skip_tags && (
                  <div>
                    <p className="text-sm text-muted-foreground">Skip Tags</p>
                    <p className="font-mono text-sm">{template.skip_tags}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Extra Variables */}
          {template.extra_vars && Object.keys(template.extra_vars).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Extra Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
                  {JSON.stringify(template.extra_vars, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold">{recentJobs.length}</p>
                  <p className="text-sm text-muted-foreground">Recent Jobs</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {recentJobs.filter(j => j.status === 'successful').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Successful</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {recentJobs.filter(j => j.status === 'failed').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{formatRelativeTime(template.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Updated</p>
                  <p>{formatRelativeTime(template.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Jobs Tab */}
        <TabsContent value="jobs">
          {recentJobs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No Jobs Yet</h3>
                <p className="text-muted-foreground mb-4">
                  No jobs have been launched from this template.
                </p>
                <Button onClick={() => setLaunchDialogOpen(true)}>
                  <Play className="h-4 w-4 mr-2" />
                  Launch First Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Stats</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Link
                          to={`/app/${orgName}/ansible/jobs/${job.id}`}
                          className="font-medium hover:underline"
                        >
                          {job.name || `Job ${job.id.slice(0, 8)}`}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {job.id.slice(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("capitalize", getStatusColor(job.status))}
                        >
                          {getStatusIcon(job.status)}
                          <span className="ml-1">{job.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.started_at
                          ? formatRelativeTime(job.started_at)
                          : job.created_at
                          ? formatRelativeTime(job.created_at)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(job.started_at, job.finished_at)}
                      </TableCell>
                      <TableCell>
                        {(job.status === 'successful' || job.status === 'failed') && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1" title="OK">
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-xs font-medium text-green-600">{job.hosts_ok}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Changed">
                              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                              <span className="text-xs font-medium text-blue-600">{job.hosts_changed}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Failed">
                              <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                              <span className="text-xs font-medium text-red-600">{job.hosts_failed}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Unreachable">
                              <WifiOff className="h-3.5 w-3.5 text-orange-600" />
                              <span className="text-xs font-medium text-orange-600">{job.hosts_unreachable}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Rescued">
                              <CircleDot className="h-3.5 w-3.5 text-purple-600" />
                              <span className="text-xs font-medium text-purple-600">{job.hosts_rescued || 0}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Skipped">
                              <Ban className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs font-medium text-gray-400">{job.hosts_skipped}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Ignored">
                              <EyeOff className="h-3.5 w-3.5 text-gray-600" />
                              <span className="text-xs font-medium text-gray-600">{job.hosts_ignored || 0}</span>
                            </div>
                            {hasWarnings(job) && (
                              <div className="flex items-center gap-1 ml-4 pl-3 border-l border-border" title={`${job.warnings_count || 0} Warning${(job.warnings_count || 0) !== 1 ? 's' : ''}`}>
                                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                                <span className="text-xs font-medium text-yellow-600">{job.warnings_count || 0}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Variables Tab */}
        <TabsContent value="variables" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Variables</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ansible uses all Environment variables for all jobs launched from this template. Template variables override variables from variable sets (except priority sets).
              </p>
            </div>
            <Button onClick={() => {
              setEditingTemplateVariable(null);
              setVariableForm({ key: '', value: '', description: '', category: 'env', hcl: false, sensitive: false, encrypted: false });
              setCreateVariableDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add variable
            </Button>
          </div>

          {/* Template Variables Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Template variables ({templateVariables.length})</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Template variables override variables from variable sets (except priority sets). These variables apply to all jobs launched from this template.
            </p>
            {templateVariables.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <p>There are no template variables added.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Key</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Value</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Category</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateVariables.map((variable) => (
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
                          {variable.category || 'env'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTemplateVariable(variable);
                                setVariableForm({
                                  key: variable.key,
                                  value: variable.sensitive ? '' : variable.value,
                                  description: variable.description || '',
                                  category: (variable.category || 'env') as 'terraform' | 'env',
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

          {/* Variable Sets Section */}
          {(() => {
            // Filter variable sets to only show those with env variables
            const variableSetsWithEnvVars = variableSets.filter(vs => 
              vs.variables && vs.variables.some(v => v.category === 'env')
            );
            
            return variableSetsWithEnvVars.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Variable Sets ({variableSetsWithEnvVars.length})</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Variable sets are automatically inherited from this template's project. Variable sets assigned to the project automatically apply to all job templates in that project. To manage variable set assignments, go to the project settings.
                  </p>
                </div>
                {variableSetsWithEnvVars.map((variableSet) => {
                  // Filter to only show env variables for Ansible
                  const envVariables = variableSet.variables?.filter(v => v.category === 'env') || [];
                  
                  return (
                    <div key={variableSet.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-base">{variableSet.name}</div>
                          {variableSet.description && (
                            <div className="text-sm text-muted-foreground mt-1">{variableSet.description}</div>
                          )}
                          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                            {variableSet.priority && (
                              <Badge variant="default" className="text-xs">Priority</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">{variableSet.scope}</Badge>
                          </div>
                        </div>
                      </div>
                      {envVariables.length > 0 && (
                        <div className="mt-4 border-t pt-3">
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-muted/50 border-b">
                                <tr>
                                  <th className="text-left px-4 py-3 text-sm font-semibold">Key</th>
                                  <th className="text-left px-4 py-3 text-sm font-semibold">Value</th>
                                  <th className="text-left px-4 py-3 text-sm font-semibold">Category</th>
                                </tr>
                              </thead>
                              <tbody>
                                {envVariables.map((varSetVar) => (
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
                                        {varSetVar.category || 'env'}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Platform Variables Section (Collapsed by default) */}
          <div className="mt-8 border-t pt-6">
            <button
              onClick={() => { setPlatformVariablesSectionOpen(!platformVariablesSectionOpen); }}
              className="w-full flex items-center justify-between text-left hover:text-foreground transition-colors"
            >
              <h3 className="text-sm font-medium text-muted-foreground">Platform Variables (4)</h3>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                platformVariablesSectionOpen && "rotate-180"
              )} />
            </button>
            {platformVariablesSectionOpen && (
              <div className="mt-4 space-y-3">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      These are system-provided variables automatically injected when jobs are launched. They cannot be modified but can be overridden by variable sets or template extra_vars.
                    </p>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden bg-muted/20">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold">Key</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm">stackweaver_job_template_id</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          The ID of this job template
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm">stackweaver_inventory_id</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          The ID of the inventory used by this template
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm">stackweaver_playbook_id</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          The ID of the playbook used by this template
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm">stackweaver_project_id</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          The ID of the project this template belongs to
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Template Variable Dialog */}
      <Dialog open={createVariableDialogOpen} onOpenChange={(open) => {
        setCreateVariableDialogOpen(open);
        if (!open) {
          setEditingTemplateVariable(null);
          setVariableForm({ key: '', value: '', description: '', category: 'env', hcl: false, sensitive: false, encrypted: false });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplateVariable ? 'Edit Template Variable' : 'Add Template Variable'}</DialogTitle>
            <DialogDescription>
              {editingTemplateVariable
                ? 'Update the template variable. For sensitive variables, the value will be hidden in the UI.'
                : 'Add a new variable to this job template.'}
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
                placeholder={editingTemplateVariable?.sensitive ? 'Enter new value (current value is hidden)' : 'variable_value'}
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
                  <SelectItem value="env">Environment</SelectItem>
                  <SelectItem value="terraform">Terraform</SelectItem>
                </SelectContent>
              </Select>
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
            <Button onClick={() => { void (async () => {
              if (!template || !variableForm.key.trim() || !variableForm.value.trim()) {
                toast.error('Key and value are required');
                return;
              }

              try {
                if (editingTemplateVariable) {
                  await ansibleJobTemplatesApi.updateVariable(template.id, editingTemplateVariable.id, variableForm);
                  toast.success('Template variable updated');
                } else {
                  await ansibleJobTemplatesApi.createVariable(template.id, variableForm);
                  toast.success('Template variable created');
                }
                setCreateVariableDialogOpen(false);
                setEditingTemplateVariable(null);
                setVariableForm({ key: '', value: '', description: '', category: 'env', hcl: false, sensitive: false, encrypted: false });
                // Reload template variables
                const vars = await ansibleJobTemplatesApi.listVariables(template.id);
                setTemplateVariables(Array.isArray(vars) ? vars : []);
              } catch (err) {
                console.error('Failed to save template variable:', err);
                toast.error('Failed to save template variable');
              }
            })(); }}>
              {editingTemplateVariable ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Variable Dialog */}
      <Dialog open={deleteVariableDialogOpen} onOpenChange={(open) => {
        setDeleteVariableDialogOpen(open);
        if (!open) {
          setVariableToDelete(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template Variable</DialogTitle>
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
              onClick={() => {
                void (async () => {
                  if (!template || !variableToDelete) return;

                  setDeletingVariable(true);
                  try {
                    await ansibleJobTemplatesApi.deleteVariable(template.id, variableToDelete.id);
                    toast.success('Template variable deleted');
                    setDeleteVariableDialogOpen(false);
                    setVariableToDelete(null);
                    // Reload template variables
                    const vars = await ansibleJobTemplatesApi.listVariables(template.id);
                    setTemplateVariables(Array.isArray(vars) ? vars : []);
                  } catch (err) {
                    console.error('Failed to delete template variable:', err);
                    toast.error('Failed to delete template variable');
                  } finally {
                    setDeletingVariable(false);
                  }
                })();
              }}
              disabled={deletingVariable}
            >
              {deletingVariable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Job Template</DialogTitle>
            <DialogDescription>
              Update the job template configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Template name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit">Limit</Label>
                <Input
                  id="limit"
                  value={editForm.limit}
                  onChange={(e) => setEditForm({ ...editForm, limit: e.target.value })}
                  placeholder="Host pattern (e.g., webservers)"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="verbosity">Verbosity</Label>
                <Input
                  id="verbosity"
                  type="number"
                  min="0"
                  max="4"
                  value={editForm.verbosity}
                  onChange={(e) => setEditForm({ ...editForm, verbosity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forks">Forks</Label>
                <Input
                  id="forks"
                  type="number"
                  min="1"
                  value={editForm.forks}
                  onChange={(e) => setEditForm({ ...editForm, forks: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="Comma-separated tags"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skip_tags">Skip Tags</Label>
                <Input
                  id="skip_tags"
                  value={editForm.skip_tags}
                  onChange={(e) => setEditForm({ ...editForm, skip_tags: e.target.value })}
                  placeholder="Comma-separated tags to skip"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inventory_id">Inventory *</Label>
                <Select
                  value={editForm.inventory_id}
                  onValueChange={(value) => setEditForm({ ...editForm, inventory_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an inventory" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventories.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>{inv.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="credential_id">Credential (Optional)</Label>
                <Select
                  value={editForm.credential_id || '__none__'}
                  onValueChange={(value) => setEditForm({ ...editForm, credential_id: value === '__none__' ? '' : value })}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent_pool_id">Agent Pool (Optional)</Label>
              <Select
                value={editForm.agent_pool_id || '__none__'}
                onValueChange={(value) => setEditForm({ ...editForm, agent_pool_id: value === '__none__' ? '' : value })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleUpdate(); }} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Launch Dialog */}
      <Dialog open={launchDialogOpen} onOpenChange={setLaunchDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Launch Job</DialogTitle>
            <DialogDescription>
              Launch a job from this template. You can override the default settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="launch_limit">Limit (optional)</Label>
              <Input
                id="launch_limit"
                value={launchOverrides.limit}
                onChange={(e) => setLaunchOverrides({ ...launchOverrides, limit: e.target.value })}
                placeholder="Host pattern (e.g., webservers)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="launch_tags">Tags (optional)</Label>
              <Input
                id="launch_tags"
                value={launchOverrides.tags}
                onChange={(e) => setLaunchOverrides({ ...launchOverrides, tags: e.target.value })}
                placeholder="Comma-separated tags"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="launch_skip_tags">Skip Tags (optional)</Label>
              <Input
                id="launch_skip_tags"
                value={launchOverrides.skip_tags}
                onChange={(e) => setLaunchOverrides({ ...launchOverrides, skip_tags: e.target.value })}
                placeholder="Comma-separated tags to skip"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="launch_extra_vars">Extra Variables (JSON, optional)</Label>
              <Textarea
                id="launch_extra_vars"
                value={launchOverrides.extra_vars}
                onChange={(e) => setLaunchOverrides({ ...launchOverrides, extra_vars: e.target.value })}
                placeholder='{"key": "value"}'
                rows={4}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleLaunch(); }} disabled={launching}>
              {launching && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Launch Job
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
              Are you sure you want to delete "{template.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
