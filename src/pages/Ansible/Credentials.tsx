// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ansibleCredentialsApi,
  type AnsibleCredential, 
  type CredentialType,
  type CreateCredentialInput 
} from '@/api/ansible';
import { getAnsibleCredentialFromJsonApi } from '@/utils/ansible-jsonapi';
import { fetchAllPages } from '@/lib/pagination';
import { Pager } from '@/components/ui/pager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Key,
  Search,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Loader2,
  Shield,
  Cloud,
  Server,
  Lock,
  GitBranch,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

const CREDENTIAL_TYPES: { value: CredentialType; label: string; description: string }[] = [
  { value: 'ssh', label: 'SSH', description: 'SSH private key authentication' },
  { value: 'machine-ssh', label: 'Machine SSH', description: 'Username/password for SSH' },
  { value: 'vcs', label: 'VCS', description: 'Source control credentials' },
  { value: 'vault', label: 'Ansible Vault', description: 'Vault password for encrypted files' },
  { value: 'aws', label: 'AWS', description: 'Amazon Web Services credentials' },
  { value: 'azure', label: 'Azure', description: 'Microsoft Azure credentials' },
  { value: 'gcp', label: 'GCP', description: 'Google Cloud Platform credentials' },
  { value: 'vmware', label: 'VMware', description: 'VMware vSphere credentials' },
];

// normalizePrivateKey repairs a pasted SSH private key so it loads cleanly.
// CRLF and lone-CR line endings (common from browser/Windows pastes) and stray
// surrounding whitespace otherwise make the key fail with "error in libcrypto"
// on the runner. The backend normalizes too; this is a friendlier client-side
// guard applied on submit (not while typing). Empty input is returned as-is.
function normalizePrivateKey(key: string): string {
  if (!key) return key;
  return key.replace(/\r\n/g, '\n').replace(/\r/g, '').trim() + '\n';
}

export default function Credentials() {
  const { orgName } = useParams<{ orgName: string }>();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';
  const { canManageCredentials } = usePermissions(selectedOrg);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CredentialType | 'all'>('all');
  const [credPage, setCredPage] = useState(1);

  const { data: credentials = [], isLoading: loading, refetch: refetchCredentials } = useQuery({
    queryKey: ['credentials', selectedOrg, typeFilter],
    queryFn: async () => {
      const { items } = await fetchAllPages((page, pageSize) =>
        ansibleCredentialsApi.list(selectedOrg, typeFilter === 'all' ? undefined : typeFilter, { page, pageSize }));
      return items.map(getAnsibleCredentialFromJsonApi);
    },
    enabled: !!selectedOrg,
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<AnsibleCredential | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [credentialToEdit, setCredentialToEdit] = useState<AnsibleCredential | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', username: '', newPassword: '', confirmPassword: '' });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showKeyPassphrase, setShowKeyPassphrase] = useState(false);
  const [showVaultPassword, setShowVaultPassword] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateCredentialInput>({
    name: '',
    description: '',
    type: 'ssh',
  });

  // Filter credentials
  const filteredCredentials = credentials.filter((cred) =>
    cred.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cred.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const CRED_PAGE_SIZE = 12;
  const credTotalPages = Math.max(1, Math.ceil(filteredCredentials.length / CRED_PAGE_SIZE));
  const currentCredPage = Math.min(credPage, credTotalPages);
  const paginatedCredentials = filteredCredentials.slice(
    (currentCredPage - 1) * CRED_PAGE_SIZE,
    currentCredPage * CRED_PAGE_SIZE,
  );

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setCreating(true);
    try {
      const payload: CreateCredentialInput = formData.ssh_private_key
        ? { ...formData, ssh_private_key: normalizePrivateKey(formData.ssh_private_key) }
        : formData;
      const res = await ansibleCredentialsApi.create(selectedOrg, payload);
      getAnsibleCredentialFromJsonApi(res.data);
      void refetchCredentials();
      setCreateDialogOpen(false);
      resetForm();
      toast.success('Credential created successfully');
    } catch (err: unknown) {
      console.error('Failed to create credential:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create credential';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!credentialToDelete) return;

    setDeleting(true);
    try {
      await ansibleCredentialsApi.delete(credentialToDelete.id);
      void refetchCredentials();
      setDeleteDialogOpen(false);
      setCredentialToDelete(null);
      toast.success('Credential deleted successfully');
    } catch (err: unknown) {
      console.error('Failed to delete credential:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete credential';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = async () => {
    if (!credentialToEdit || !editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const isMachineSsh = credentialToEdit.type === 'machine-ssh';
    if (isMachineSsh && editForm.newPassword !== '') {
      if (editForm.newPassword !== editForm.confirmPassword) {
        toast.error('New password and confirm password do not match');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Parameters<typeof ansibleCredentialsApi.update>[1] = {
        name: editForm.name,
        description: editForm.description || undefined,
      };
      const isSshOrMachineSsh = credentialToEdit.type === 'ssh' || credentialToEdit.type === 'machine-ssh';
      if (isSshOrMachineSsh && editForm.username !== undefined) {
        payload.username = editForm.username;
      }
      if (isMachineSsh && editForm.newPassword !== '') {
        payload.password = editForm.newPassword;
      }
      const res = await ansibleCredentialsApi.update(credentialToEdit.id, payload);
      getAnsibleCredentialFromJsonApi(res.data);
      void refetchCredentials();
      setEditDialogOpen(false);
      setCredentialToEdit(null);
      setEditForm({ name: '', description: '', username: '', newPassword: '', confirmPassword: '' });
      toast.success('Credential updated successfully');
    } catch (err: unknown) {
      console.error('Failed to update credential:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update credential';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (credential: AnsibleCredential) => {
    setCredentialToEdit(credential);
    setEditForm({
      name: credential.name,
      description: credential.description || '',
      username: credential.username ?? '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowEditPassword(false);
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'ssh',
    });
    // Reset password visibility
    setShowPassword(false);
    setShowKeyPassphrase(false);
    setShowVaultPassword(false);
    setShowSecretKey(false);
  };

  const getTypeIcon = (type: CredentialType) => {
    switch (type) {
      case 'ssh':
      case 'machine-ssh':
        return <Key className="h-4 w-4" />;
      case 'vcs':
        return <GitBranch className="h-4 w-4" />;
      case 'vault':
        return <Lock className="h-4 w-4" />;
      case 'aws':
      case 'azure':
      case 'gcp':
        return <Cloud className="h-4 w-4" />;
      case 'vmware':
        return <Server className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: CredentialType) => {
    switch (type) {
      case 'ssh':
      case 'machine-ssh':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'vcs':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'vault':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'aws':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'azure':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'gcp':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'vmware':
        return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  // Render credential-type-specific form fields
  const renderCredentialFields = () => {
    switch (formData.type) {
      case 'ssh':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="ansible"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssh_private_key">SSH Private Key</Label>
              <Textarea
                id="ssh_private_key"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={5}
                value={formData.ssh_private_key || ''}
                onChange={(e) => setFormData({ ...formData, ssh_private_key: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssh_key_passphrase">Key Passphrase (optional)</Label>
              <div className="relative">
                <Input
                  id="ssh_key_passphrase"
                  type={showKeyPassphrase ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.ssh_key_passphrase || ''}
                  onChange={(e) => setFormData({ ...formData, ssh_key_passphrase: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyPassphrase(!showKeyPassphrase)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKeyPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        );
      case 'machine-ssh':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="root"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        );
      case 'vcs':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="git"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password/Token</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Personal access token"
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssh_private_key">SSH Private Key (alternative)</Label>
              <Textarea
                id="ssh_private_key"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={4}
                value={formData.ssh_private_key || ''}
                onChange={(e) => setFormData({ ...formData, ssh_private_key: e.target.value })}
              />
            </div>
          </>
        );
      case 'vault':
        return (
          <div className="space-y-2">
            <Label htmlFor="vault_password">Vault Password</Label>
            <div className="relative">
              <Input
                id="vault_password"
                type={showVaultPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.vault_password || ''}
                onChange={(e) => setFormData({ ...formData, vault_password: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowVaultPassword(!showVaultPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showVaultPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        );
      case 'aws':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="aws_access_key_id">Access Key ID</Label>
              <Input
                id="aws_access_key_id"
                placeholder="AKIA..."
                value={formData.aws_access_key_id || ''}
                onChange={(e) => setFormData({ ...formData, aws_access_key_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aws_secret_access_key">Secret Access Key</Label>
              <div className="relative">
                <Input
                  id="aws_secret_access_key"
                  type={showSecretKey ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.aws_secret_access_key || ''}
                  onChange={(e) => setFormData({ ...formData, aws_secret_access_key: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        );
      case 'azure':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="azure_subscription_id">Subscription ID</Label>
              <Input
                id="azure_subscription_id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={formData.azure_subscription_id || ''}
                onChange={(e) => setFormData({ ...formData, azure_subscription_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="azure_tenant_id">Tenant ID</Label>
              <Input
                id="azure_tenant_id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={formData.azure_tenant_id || ''}
                onChange={(e) => setFormData({ ...formData, azure_tenant_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="azure_client_id">Client ID</Label>
              <Input
                id="azure_client_id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={formData.azure_client_id || ''}
                onChange={(e) => setFormData({ ...formData, azure_client_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="azure_client_secret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="azure_client_secret"
                  type={showSecretKey ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.azure_client_secret || ''}
                  onChange={(e) => setFormData({ ...formData, azure_client_secret: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        );
      case 'gcp':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="gcp_project">Project ID</Label>
              <Input
                id="gcp_project"
                placeholder="my-gcp-project"
                value={formData.gcp_project || ''}
                onChange={(e) => setFormData({ ...formData, gcp_project: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gcp_service_account">Service Account JSON</Label>
              <Textarea
                id="gcp_service_account"
                placeholder='{"type": "svc_account", "project_id": "...", ...}'
                rows={5}
                value={formData.gcp_service_account || ''}
                onChange={(e) => setFormData({ ...formData, gcp_service_account: e.target.value })}
              />
            </div>
          </>
        );
      case 'vmware':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="vmware_host">vCenter Host</Label>
              <Input
                id="vmware_host"
                placeholder="vcenter.example.com"
                value={formData.vmware_host || ''}
                onChange={(e) => setFormData({ ...formData, vmware_host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vmware_username">Username</Label>
              <Input
                id="vmware_username"
                placeholder="administrator@vsphere.local"
                value={formData.vmware_username || ''}
                onChange={(e) => setFormData({ ...formData, vmware_username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vmware_password">Password</Label>
              <div className="relative">
                <Input
                  id="vmware_password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.vmware_password || ''}
                  onChange={(e) => setFormData({ ...formData, vmware_password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        );
      default:
        return null;
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
        <div className="flex-1 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-600 dark:from-amber-400 via-orange-600 dark:via-orange-400 to-amber-600 dark:to-amber-400 bg-clip-text text-transparent mb-2">
              Credentials
            </h1>
            <p className="text-muted-foreground">
              Manage Ansible credentials for automation
            </p>
          </div>
          {canManageCredentials && (
            <div className="relative inline-flex rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 p-[2px]">
              <Button
                variant="ghost"
                onClick={() => setCreateDialogOpen(true)}
                className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Credential
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Credential Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Credential</DialogTitle>
            <DialogDescription>
              Add a new credential for Ansible automation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="my-credential"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Credential description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: CredentialType) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CREDENTIAL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(type.value)}
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {CREDENTIAL_TYPES.find((t) => t.value === formData.type)?.description}
              </p>
            </div>
            {renderCredentialFields()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleCreate(); }} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search credentials..."
            aria-label="Search credentials"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCredPage(1); }}
            className="pl-9"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) => { setTypeFilter(value as CredentialType | 'all'); setCredPage(1); }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CREDENTIAL_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Credential List */}
      {filteredCredentials.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No credentials found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery || typeFilter !== 'all'
                ? 'No credentials match your filters.'
                : 'Create your first credential to get started.'}
            </p>
            {!searchQuery && typeFilter === 'all' && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Credential
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5">
          {paginatedCredentials.map((credential) => (
            <Card
              key={credential.id}
              className="hover:shadow-md transition-shadow group"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg font-semibold">
                    {credential.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {credential.description || 'No description'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Credential actions"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManageCredentials && (
                      <DropdownMenuItem onClick={() => openEditDialog(credential)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canManageCredentials && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setCredentialToDelete(credential);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={getTypeBadgeColor(credential.type)}
                  >
                    {getTypeIcon(credential.type)}
                    <span className="ml-1">{credential.type.toUpperCase()}</span>
                  </Badge>
                  {credential.username && (
                    <span className="text-xs text-muted-foreground">
                      @{credential.username}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pager page={currentCredPage} totalPages={credTotalPages} onPageChange={setCredPage} />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Credential</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{credentialToDelete?.name}"? This action
              cannot be undone. Jobs using this credential may fail.
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

      {/* Edit Credential Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credential</DialogTitle>
            <DialogDescription>
              Update the credential name and description. For Machine SSH you can change the username and reset the password below; leave password blank to keep the current one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            {(credentialToEdit?.type === 'machine-ssh' || credentialToEdit?.type === 'ssh') && (
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  placeholder="SSH login user"
                />
              </div>
            )}
            {credentialToEdit?.type === 'machine-ssh' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-new-password">New password (leave blank to keep current)</Label>
                  <div className="relative">
                    <Input
                      id="edit-new-password"
                      type={showEditPassword ? 'text' : 'password'}
                      value={editForm.newPassword}
                      onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                    >
                      {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-confirm-password">Confirm new password</Label>
                  <Input
                    id="edit-confirm-password"
                    type={showEditPassword ? 'text' : 'password'}
                    value={editForm.confirmPassword}
                    onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}
            {credentialToEdit && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className={getTypeBadgeColor(credentialToEdit.type)}>
                  {getTypeIcon(credentialToEdit.type)}
                  <span className="ml-1">{credentialToEdit.type.toUpperCase()}</span>
                </Badge>
                <span>Type cannot be changed</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleEdit(); }} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
