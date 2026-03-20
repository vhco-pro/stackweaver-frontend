// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, GitBranch, Plus, CheckCircle2 } from 'lucide-react';
import { getVcsProviderIcon, getVcsProviderLabel } from '@/lib/vcs';
import { registryApi, vcsConnectionsApi } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CreateModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
}

export function CreateModuleDialog({
  open,
  onOpenChange,
  orgName,
}: CreateModuleDialogProps) {
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [description, setDescription] = useState('');
  const [vcsConnectionId, setVcsConnectionId] = useState<string>('');
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [repositorySearch, setRepositorySearch] = useState<string>('');
  const [autoPublishTags, setAutoPublishTags] = useState(true);
  const [publishMethod, setPublishMethod] = useState<'vcs' | 'manual'>('vcs');

  // Data state
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);

  // Load VCS connections when dialog opens
  const { data: vcsConnections = [], isLoading: loadingVCS } = useQuery({
    queryKey: ['vcs-connections-deduped', orgName],
    queryFn: async () => {
      const vcsRes = await vcsConnectionsApi.list(orgName);
      const connections = Array.isArray(vcsRes) ? vcsRes : [];
      // Deduplicate by provider + account_name + account_type to prevent duplicates
      return Array.from(
        new Map(
          connections.map(conn => [
            `${conn.provider}-${conn.account_name}-${conn.account_type}`,
            conn
          ])
        ).values()
      );
    },
    enabled: open,
  });

  // Load repositories when VCS connection is selected
  const { data: repositories = [], isLoading: loadingRepos } = useQuery({
    queryKey: ['vcs-repositories', vcsConnectionId],
    queryFn: async () => {
      const repos = await vcsConnectionsApi.listRepositories(vcsConnectionId, 1, 100);
      return repos || [];
    },
    enabled: !!vcsConnectionId && open && publishMethod === 'vcs',
  });

  // Parse Terraform module name from repository name
  // Format: terraform-<PROVIDER>-<MODULE-NAME>
  // Example: terraform-azurerm-federated-credentials -> provider: azurerm, name: federated-credentials
  // The provider is the segment immediately after "terraform-" (stops at first dash)
  // The module name is everything after the provider
  const parseModuleName = (repoName: string): { provider: string; name: string } | null => {
    // Remove owner prefix if present (e.g., "owner/terraform-azurerm-federated-credentials" -> "terraform-azurerm-federated-credentials")
    const nameOnly = repoName.split('/').pop() || repoName;
    
    // Match pattern: terraform-<provider>-<module-name>
    // Provider is a single word (no dashes), module name can contain dashes
    const match = nameOnly.match(/^terraform-([a-z0-9]+)-(.+)$/i);
    if (match) {
      return {
        provider: match[1], // Provider (e.g., azurerm)
        name: match[2], // Module name (e.g., federated-credentials)
      };
    }
    return null;
  };

  // Auto-detect module name and provider when repository is selected
  useEffect(() => {
    if (!selectedRepository || publishMethod !== 'vcs') return;

    const parsed = parseModuleName(selectedRepository);
    if (parsed) {
      // Only auto-fill if fields are empty (allow manual override)
      if (!name.trim()) {
        setName(parsed.name);
      }
      if (!provider.trim()) {
        setProvider(parsed.provider);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepository, publishMethod]); // name and provider intentionally excluded to prevent overwriting user input

  // Auto-focus search input when repository select opens
  useEffect(() => {
    if (repositorySelectOpen && repositorySearchInputRef.current) {
      // Small delay to ensure the dropdown is fully rendered
      setTimeout(() => {
        repositorySearchInputRef.current?.focus();
      }, 100);
    }
  }, [repositorySelectOpen]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setProvider('');
      setDescription('');
      setVcsConnectionId('');
      setSelectedRepository('');
      setRepositorySearch('');
      setAutoPublishTags(true);
      setPublishMethod('vcs');
    }
  }, [open]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !provider.trim()) {
      toast.error('Module name and provider are required');
      return;
    }

    if (publishMethod === 'vcs' && !vcsConnectionId) {
      toast.error('Please select a VCS connection');
      return;
    }

    if (publishMethod === 'vcs' && !selectedRepository) {
      toast.error('Please select a repository');
      return;
    }

    setCreating(true);
    try {
      await registryApi.modules.create(orgName, {
        name: name.trim(),
        provider: provider.trim(),
        description: description.trim() || undefined,
        vcs_connection_id: publishMethod === 'vcs' && vcsConnectionId ? vcsConnectionId : undefined,
        vcs_repository: publishMethod === 'vcs' && selectedRepository ? selectedRepository : undefined,
        auto_publish_tags: publishMethod === 'vcs' ? autoPublishTags : false,
      });

      toast.success('Module created successfully');
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Failed to create module:', err);
      const message = err instanceof Error ? err.message : 'Failed to create module';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Module</DialogTitle>
          <DialogDescription>
            Create a new module in the registry. You can connect it to a VCS repository for automatic publishing or upload versions manually.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Module Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., vpc, ec2-cluster"
                required
              />
            </div>

            <div>
              <Label htmlFor="provider">Provider *</Label>
              <Input
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g., aws, azurerm, gcp"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this module does"
              />
            </div>
          </div>

          {/* Publishing Method */}
          <div className="space-y-4">
            <Label>Publishing Method</Label>
            <Select value={publishMethod} onValueChange={(value: 'vcs' | 'manual') => setPublishMethod(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vcs">VCS Repository (Auto-publish from Git tags)</SelectItem>
                <SelectItem value="manual">Manual Upload</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* VCS Configuration */}
          {publishMethod === 'vcs' && (
            <div className="space-y-4 border-t pt-4">
              <Label>VCS Connection</Label>
              {loadingVCS ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading VCS connections...
                </div>
              ) : vcsConnections.length === 0 ? (
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-900">
                        {getVcsProviderIcon('github', 'h-5 w-5 text-white')}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">GitHub</h4>
                        <p className="text-xs text-muted-foreground">GitHub App</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void (async () => {
                          try {
                            const redirectUrl = window.location.href;
                            const response = await vcsConnectionsApi.initiateInstallationWithRedirect(orgName, redirectUrl);
                            const installUrl = response?.install_url;
                            if (installUrl) {
                              window.location.href = installUrl;
                            }
                          } catch (err: unknown) {
                            const message = err instanceof Error ? err.message : 'Failed to initiate GitHub App installation';
                            toast.error(message);
                          }
                        })();
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Connect GitHub
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {vcsConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className={cn(
                        'p-3 border-2 rounded-lg cursor-pointer transition-all',
                        vcsConnectionId === conn.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                      )}
                      onClick={() => setVcsConnectionId(vcsConnectionId === conn.id ? '' : conn.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getVcsProviderIcon(conn.provider)}
                          <span className="text-sm font-medium">
                            {getVcsProviderLabel(conn.provider)} - {conn.account_name}
                          </span>
                        </div>
                        {vcsConnectionId === conn.id && (
                          <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        try {
                          const redirectUrl = window.location.href;
                          const response = await vcsConnectionsApi.initiateInstallationWithRedirect(orgName, redirectUrl);
                          const installUrl = response?.install_url;
                          if (installUrl) {
                            window.location.href = installUrl;
                          }
                        } catch (err: unknown) {
                          const message = err instanceof Error ? err.message : 'Failed to initiate GitHub App installation';
                          toast.error(message);
                        }
                      })();
                    }}
                    className="w-full text-xs"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Connect to a different VCS
                  </Button>
                </div>
              )}

              {vcsConnectionId && (
                <div>
                  <Label>Repository</Label>
                  {loadingRepos ? (
                    <div className="flex items-center gap-2 text-muted-foreground mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading repositories...
                    </div>
                  ) : repositories.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 border rounded-lg mt-2">
                      No repositories found. Please ensure the VCS connection has access to repositories.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select 
                        value={selectedRepository} 
                        onValueChange={setSelectedRepository}
                        open={repositorySelectOpen}
                        onOpenChange={setRepositorySelectOpen}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select repository" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <div className="p-2 border-b sticky top-0 bg-background z-10">
                            <Input
                              ref={repositorySearchInputRef}
                              placeholder="Search repositories..."
                              value={repositorySearch}
                              onChange={(e) => {
                                setRepositorySearch(e.target.value);
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="h-8"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-[250px] overflow-y-auto">
                            {repositories
                              .filter((repo) =>
                                repo.full_name.toLowerCase().includes(repositorySearch.toLowerCase())
                              )
                              .map((repo) => (
                                <SelectItem key={repo.id} value={repo.full_name}>
                                  <div className="flex items-center gap-2">
                                    <GitBranch className="h-4 w-4" />
                                    <span>{repo.full_name}</span>
                                    {repo.private && (
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        Private
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            {repositories.filter((repo) =>
                              repo.full_name.toLowerCase().includes(repositorySearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                No repositories found
                              </div>
                            )}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {vcsConnectionId && selectedRepository && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autoPublish"
                    checked={autoPublishTags}
                    onCheckedChange={(checked) => setAutoPublishTags(checked === true)}
                  />
                  <Label htmlFor="autoPublish" className="text-sm font-normal cursor-pointer">
                    Automatically publish versions when Git tags are pushed
                  </Label>
                </div>
              )}
            </div>
          )}

          {/* Manual Upload Note */}
          {publishMethod === 'manual' && (
            <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              You can upload module versions manually after creating the module. Go to the module detail page to upload tarballs.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || (publishMethod === 'vcs' && (!vcsConnectionId || !selectedRepository))}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Module
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

