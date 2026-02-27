// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Key, ArrowLeft, Plus, Copy, Trash2, Calendar, Loader2, CheckCircle2, X, Building2, FolderKanban, User, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { settingsApi, organizationsApi, projectsApi, type ApiKey, type CreateApiKeyResponse, type Organization, type Project } from '@/api/client';
import { toast } from 'sonner';

type ScopeType = 'all' | 'org' | 'project' | 'user' | 'runner';

export default function ApiKeysSettings() {
  const { orgName } = useParams<{ orgName: string }>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreateApiKeyResponse | null>(null);
  
  // Scope selection state
  const [scopeType, setScopeType] = useState<ScopeType>('all');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [permissions, setPermissions] = useState<{ read: boolean; write: boolean; admin: boolean }>({
    read: false,
    write: false,
    admin: false,
  });

  useEffect(() => {
    void loadApiKeys();
    void loadOrganizations();
  }, []);

  useEffect(() => {
    if (scopeType === 'project' && selectedOrgId && organizations.length > 0) {
      void loadProjects(selectedOrgId);
    } else {
      setProjects([]);
      setSelectedProjectId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeType, selectedOrgId, organizations]); // loadProjects intentionally excluded - it's defined in component and would cause re-renders

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsApi.listApiKeys();
      setApiKeys(response.api_keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await organizationsApi.list();
      setOrganizations(response.data || []);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const loadProjects = async (orgId: string) => {
    try {
      const org = organizations.find(o => o.id === orgId);
      if (!org) return;
      
      const response = await projectsApi.list(org.name);
      setProjects(response.data || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjects([]);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('API key copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const buildScopes = (): string[] => {
    if (scopeType === 'all') {
      return []; // Empty array means full access
    }

    const scopes: string[] = [];
    const selectedPermissions: string[] = [];
    
    if (permissions.read) selectedPermissions.push('read');
    if (permissions.write) selectedPermissions.push('write');
    if (permissions.admin) selectedPermissions.push('admin');

    if (selectedPermissions.length === 0) {
      // If no permissions selected, default to read
      selectedPermissions.push('read');
    }

    if (scopeType === 'org' && selectedOrgId) {
      selectedPermissions.forEach(perm => {
        scopes.push(`org:${selectedOrgId}:${perm}`);
      });
    } else if (scopeType === 'project' && selectedProjectId) {
      selectedPermissions.forEach(perm => {
        scopes.push(`project:${selectedProjectId}:${perm}`);
      });
    } else if (scopeType === 'user') {
      selectedPermissions.forEach(perm => {
        scopes.push(`user:${perm}`);
      });
    } else if (scopeType === 'runner' && selectedOrgId) {
      // Runner scope - allows registering runners for an organization
      scopes.push(`org:${selectedOrgId}:runner:register`);
    }

    return scopes;
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newKeyName.trim()) {
      toast.error('Key name is required');
      return;
    }

    if (scopeType === 'org' && !selectedOrgId) {
      toast.error('Please select an organization');
      return;
    }

    if (scopeType === 'project' && (!selectedOrgId || !selectedProjectId)) {
      toast.error('Please select an organization and project');
      return;
    }

    if (scopeType === 'runner' && !selectedOrgId) {
      toast.error('Please select an organization for runner registration');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);
      
      const scopes = buildScopes();
      const data: { name: string; scopes?: string[]; expires_at?: string } = {
        name: newKeyName.trim(),
        ...(scopes.length > 0 && { scopes }),
      };
      
      if (newKeyExpiry) {
        // Convert date to ISO 8601 format
        const selectedDate = new Date(newKeyExpiry);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateOnly = new Date(selectedDate);
        selectedDateOnly.setHours(0, 0, 0, 0);
        
        // If selected date is today, set expiration to end of day (23:59:59)
        if (selectedDateOnly.getTime() === today.getTime()) {
          selectedDate.setHours(23, 59, 59, 999);
        } else {
          // For future dates, set to end of that day
          selectedDate.setHours(23, 59, 59, 999);
        }
        
        data.expires_at = selectedDate.toISOString();
      }

      const response = await settingsApi.createApiKey(data);
      setNewlyCreatedKey(response);
      // Success message is shown in the detailed banner below, no need for duplicate
      
      // Reload keys
      await loadApiKeys();
      
      // Reset form
      setNewKeyName('');
      setNewKeyExpiry('');
      setScopeType('all');
      setSelectedOrgId('');
      setSelectedProjectId('');
      setPermissions({ read: false, write: false, admin: false });
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
      toast.error(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(keyId);
      setError(null);
      await settingsApi.deleteApiKey(keyId);
      toast.success('API key deleted successfully');
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
      toast.error(err instanceof Error ? err.message : 'Failed to delete API key');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return formatDate(dateString);
  };

  const getMaskedKey = (keyPrefix: string) => {
    // Show prefix + masked suffix
    // Prefix is typically "sk_live_XXXX" (12 chars), so we add dots for the rest
    return keyPrefix + '••••••••••••••••••••';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={orgName ? `/app/${orgName}/settings` : '/settings'}>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                API Keys
              </h1>
              <p className="text-muted-foreground">
                Create and manage API keys for programmatic access
              </p>
            </div>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 flex items-center gap-2">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Show newly created key (only shown once) */}
      {newlyCreatedKey && (
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent',
          'dark:from-green-500/10 dark:via-green-500/5',
          'backdrop-blur-md border border-green-500/30 dark:border-green-500/20',
          'p-6 shadow-lg shadow-green-500/20'
        )}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold text-green-400">API Key Created Successfully!</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Make sure to copy your API key now. You won't be able to see it again after closing this message.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 dark:bg-black/10 border border-white/10 dark:border-white/5 text-sm font-mono break-all">
              {newlyCreatedKey.key}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void copyToClipboard(newlyCreatedKey.key);
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewlyCreatedKey(null);
              setSuccess(null);
            }}
            className="w-full"
          >
            I've copied the key
          </Button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4">Create New API Key</h3>
          <form onSubmit={(e) => { void handleCreateKey(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production API Key"
                required
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-expiry">Expiry Date (Optional)</Label>
              <Input
                id="key-expiry"
                type="date"
                value={newKeyExpiry}
                onChange={(e) => setNewKeyExpiry(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                disabled={creating}
              />
            </div>

            {/* Scope Selection */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Scope Type</Label>
                <Select value={scopeType} onValueChange={(value) => {
                  setScopeType(value as ScopeType);
                  setSelectedOrgId('');
                  setSelectedProjectId('');
                  setPermissions({ read: false, write: false, admin: false });
                }} disabled={creating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        <span>All Access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="org">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>Organization</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="project">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4" />
                        <span>Project</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>User</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="runner">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        <span>Runner Registration</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scopeType === 'org' && (
                <div className="space-y-2">
                  <Label htmlFor="org-select">Organization</Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={creating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scopeType === 'project' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="org-select">Organization</Label>
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={creating}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedOrgId && (
                    <div className="space-y-2">
                      <Label htmlFor="project-select">Project</Label>
                      <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={creating}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
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
                  )}
                </>
              )}

              {scopeType === 'runner' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-select">Organization</Label>
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={creating}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This key allows self-hosted runners to register with the selected organization.
                    Use this key when starting runner agents with <code className="px-1 py-0.5 rounded bg-muted">STACKWEAVER_TOKEN</code>.
                  </p>
                </div>
              )}

              {scopeType !== 'all' && scopeType !== 'runner' && (
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="perm-read"
                        checked={permissions.read}
                        onCheckedChange={(checked) =>
                          setPermissions({ ...permissions, read: checked === true })
                        }
                        disabled={creating}
                      />
                      <Label htmlFor="perm-read" className="font-normal cursor-pointer">
                        Read
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="perm-write"
                        checked={permissions.write}
                        onCheckedChange={(checked) =>
                          setPermissions({ ...permissions, write: checked === true })
                        }
                        disabled={creating}
                      />
                      <Label htmlFor="perm-write" className="font-normal cursor-pointer">
                        Write
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="perm-admin"
                        checked={permissions.admin}
                        onCheckedChange={(checked) =>
                          setPermissions({ ...permissions, admin: checked === true })
                        }
                        disabled={creating}
                      />
                      <Label htmlFor="perm-admin" className="font-normal cursor-pointer">
                        Admin
                      </Label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName('');
                  setNewKeyExpiry('');
                  setScopeType('all');
                  setSelectedOrgId('');
                  setSelectedProjectId('');
                  setPermissions({ read: false, write: false, admin: false });
                }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={creating}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Key'
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* API Keys List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => {
            const maskedKey = getMaskedKey(apiKey.key_prefix);
            const isExpired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date();
            
            return (
              <div
                key={apiKey.id}
                className={cn(
                  'rounded-2xl',
                  'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                  'dark:from-black/10 dark:via-black/5',
                  'backdrop-blur-md border border-white/20 dark:border-white/10',
                  'p-6 shadow-lg shadow-purple-500/10',
                  isExpired && 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500">
                        <Key className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{apiKey.name}</h3>
                          {isExpired && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created {formatDate(apiKey.created_at)}
                          </span>
                          {apiKey.expires_at && (
                            <span className={isExpired ? "text-red-500" : "text-orange-500"}>
                              Expires {formatDate(apiKey.expires_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-4">
                      <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 dark:bg-black/10 border border-white/10 dark:border-white/5 text-sm font-mono">
                        {maskedKey}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { void handleDeleteKey(apiKey.id); }}
                        disabled={deleting === apiKey.id}
                        className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        {deleting === apiKey.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {apiKey.scopes && apiKey.scopes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {apiKey.scopes.map((scope, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    )}
                    {(apiKey.organization_id || apiKey.project_id) && (
                      <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-2">
                        {apiKey.organization_id && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            Org: {organizations.find(o => o.id === apiKey.organization_id)?.name || apiKey.organization_id.substring(0, 8) + '...'}
                          </span>
                        )}
                        {apiKey.project_id && (
                          <span className="flex items-center gap-1">
                            <FolderKanban className="h-3 w-3" />
                            Project: {apiKey.project_id.substring(0, 8) + '...'}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-3 text-xs text-muted-foreground">
                      Last used: {formatTimeAgo(apiKey.last_used_at)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && apiKeys.length === 0 && !showCreateForm && (
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-12 text-center'
        )}>
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Key className="h-8 w-8 text-cyan-500" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
          <p className="text-muted-foreground mb-4">
            Create your first API key to get started with programmatic access
          </p>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create API Key
          </Button>
        </div>
      )}
    </div>
  );
}

