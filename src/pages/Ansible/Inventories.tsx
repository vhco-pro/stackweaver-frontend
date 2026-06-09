// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ansibleInventoriesApi, ansibleHostsApi, ansibleGroupsApi, type AnsibleInventory } from '@/api/ansible';
import { getAnsibleInventoryFromJsonApi } from '@/utils/ansible-jsonapi';
import { fetchAllPages } from '@/lib/pagination';
import { Pager } from '@/components/ui/pager';
import { vcsConnectionsApi, type VCSConnection, type Repository, type Branch } from '@/api/client';
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
  DialogTrigger,
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
  Server,
  Search,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Loader2,
  Database,
  Cloud,
  GitBranch,
  Info,
  FolderTree,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon, getVcsProviderLabel } from '@/lib/vcs';
import { VCSProviderSelector } from '@/components/vcs/VCSProviderSelector';
import { VCSProjectSelect } from '@/components/vcs/VCSProjectSelect';
import { detectDynamicInventoryPlugin } from '@/utils/dynamic-inventory';

export default function Inventories() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';
  const queryClient = useQueryClient();
  const { canManageInventories } = usePermissions(selectedOrg);
  const [searchQuery, setSearchQuery] = useState('');
  const [invPage, setInvPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inventoryToDelete, setInventoryToDelete] = useState<AnsibleInventory | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // VCS Integration state
  const [loadingVCS, setLoadingVCS] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingInventoryFiles, setLoadingInventoryFiles] = useState(false);
  const [vcsConnections, setVcsConnections] = useState<VCSConnection[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedVcsProject, setSelectedVcsProject] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventoryFiles, setInventoryFiles] = useState<string[]>([]);
  const [repositorySearch, setRepositorySearch] = useState('');
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);
  const [inventoryPathSelectOpen, setInventoryPathSelectOpen] = useState(false);
  const [inventoryPathSearch, setInventoryPathSearch] = useState('');
  const inventoryPathSearchInputRef = useRef<HTMLInputElement>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);

  // Form state for creating inventory
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'static' as 'static' | 'dynamic' | 'vcs',
    vcs_connection_id: '',
    vcs_repository: '',
    vcs_branch: '',
    inventory_path: '',
  });

  // Fetch ALL inventories (walk every server page) so newly-created ones aren't stranded on a
  // later page and never shown. Counts are fetched separately, only for the visible page (below),
  // to avoid an N+1 host/group request storm across the whole org.
  const { data: inventoriesData, isLoading: loading } = useQuery({
    queryKey: ['inventories', selectedOrg],
    queryFn: async () => {
      const { items } = await fetchAllPages((page, pageSize) =>
        ansibleInventoriesApi.list(selectedOrg, { page, pageSize }));
      return { inventories: items.map(getAnsibleInventoryFromJsonApi) };
    },
    enabled: !!selectedOrg,
    // Auto-refetch while any inventory is syncing so counters update after VCS sync completes
    refetchInterval: (query) => {
      const invs = query.state.data?.inventories;
      if (invs?.some((inv) => inv.last_sync_status === 'syncing')) {
        return 5000; // Poll every 5s while syncing
      }
      return false; // Stop polling when nothing is syncing
    },
  });

  const inventories = inventoriesData?.inventories ?? [];

  // Filter inventories (client-side search across the full set)
  const filteredInventories = inventories.filter((inv) =>
    inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Window the rendered cards so a large org doesn't paint hundreds at once.
  const INV_PAGE_SIZE = 12;
  const invTotalPages = Math.max(1, Math.ceil(filteredInventories.length / INV_PAGE_SIZE));
  const currentInvPage = Math.min(invPage, invTotalPages);
  const paginatedInventories = filteredInventories.slice(
    (currentInvPage - 1) * INV_PAGE_SIZE,
    currentInvPage * INV_PAGE_SIZE,
  );

  // Host/group counts only for the visible page — keyed on those IDs so paging or searching
  // refetches just the dozen on screen, not the whole org.
  const visibleIdsKey = paginatedInventories.map((inv) => inv.id).join(',');
  const { data: inventoryCounts = {} } = useQuery({
    queryKey: ['inventoryCounts', selectedOrg, visibleIdsKey],
    queryFn: async () => {
      const entries = await Promise.all(paginatedInventories.map(async (inv) => {
        try {
          const [hostsRes, groupsRes] = await Promise.all([
            ansibleHostsApi.list(inv.id).catch(() => ({ data: [], meta: { pagination: { 'total-count': 0 } } })),
            ansibleGroupsApi.list(inv.id).catch(() => ({ data: [], meta: { pagination: { 'total-count': 0 } } })),
          ]);
          const hosts = ('meta' in hostsRes && hostsRes.meta?.pagination?.['total-count']) || (Array.isArray(hostsRes.data) ? hostsRes.data.length : 0);
          const groups = ('meta' in groupsRes && groupsRes.meta?.pagination?.['total-count']) || (Array.isArray(groupsRes.data) ? groupsRes.data.length : 0);
          return [inv.id, { hosts, groups }] as const;
        } catch {
          return [inv.id, { hosts: 0, groups: 0 }] as const;
        }
      }));
      return Object.fromEntries(entries);
    },
    enabled: paginatedInventories.length > 0,
    refetchInterval: () => paginatedInventories.some((inv) => inv.last_sync_status === 'syncing') ? 5000 : false,
  });

  // Reset form when dialog closes
  const resetCreateForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'static',
      vcs_connection_id: '',
      vcs_repository: '',
      vcs_branch: '',
      inventory_path: '',
    });
    setSelectedVcsProject('');
    setRepositories([]);
    setBranches([]);
    setInventoryFiles([]);
    setNameTouched(false);
    setDescriptionTouched(false);
    setRepositorySearch('');
    setInventoryPathSearch('');
  };

  // Load VCS connections when dialog opens
  useEffect(() => {
    if (!createDialogOpen || !selectedOrg) return;

    setLoadingVCS(true);
    vcsConnectionsApi.list(selectedOrg)
      .then((vcsRes) => {
        const connections = Array.isArray(vcsRes) ? vcsRes : [];
        // Deduplicate by provider + account_name + account_type
        const uniqueConnections = Array.from(
          new Map(
            connections.map(conn => [
              `${conn.provider}-${conn.account_name}-${conn.account_type}`,
              conn
            ])
          ).values()
        );
        setVcsConnections(uniqueConnections);
        
        // Auto-select if there's exactly one VCS connection and type is vcs
        if (uniqueConnections.length === 1 && !formData.vcs_connection_id && formData.type === 'vcs') {
          setFormData(prev => ({
            ...prev,
            vcs_connection_id: uniqueConnections[0].id,
          }));
        }
      })
      .catch((err) => {
        console.error('Failed to load VCS connections:', err);
        toast.error('Failed to load VCS connections');
      })
      .finally(() => {
        setLoadingVCS(false);
      });
    // formData.type and formData.vcs_connection_id are intentionally omitted - formData object changes would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDialogOpen, selectedOrg]);

  // Load repositories when VCS connection is selected
  useEffect(() => {
    if (!formData.vcs_connection_id || !createDialogOpen || formData.type !== 'vcs') {
      setRepositories([]);
      setBranches([]);
      setInventoryFiles([]);
      return;
    }

    setLoadingRepos(true);
    vcsConnectionsApi.listAllRepositories(formData.vcs_connection_id, selectedVcsProject || undefined)
      .then((repos) => {
        setRepositories(repos || []);
      })
      .catch((err) => {
        console.error('Failed to load repositories:', err);
        toast.error('Failed to load repositories');
      })
      .finally(() => {
        setLoadingRepos(false);
      });
  }, [formData.vcs_connection_id, createDialogOpen, formData.type, selectedVcsProject]);

  // Load branches when repository is selected
  useEffect(() => {
    if (!formData.vcs_repository || !formData.vcs_connection_id || !createDialogOpen || formData.type !== 'vcs') {
      setBranches([]);
      setInventoryFiles([]);
      return;
    }

    const [owner, repo] = formData.vcs_repository.split('/');
    if (!owner || !repo) {
      setBranches([]);
      setInventoryFiles([]);
      return;
    }

    setLoadingBranches(true);
    vcsConnectionsApi.listBranches(formData.vcs_connection_id, owner, repo)
      .then((brs) => {
        setBranches(brs || []);
      })
      .catch((err) => {
        console.error('Failed to load branches:', err);
        toast.error('Failed to load branches');
      })
      .finally(() => {
        setLoadingBranches(false);
      });
  }, [formData.vcs_repository, formData.vcs_connection_id, createDialogOpen, formData.type]);

  // Load inventory files when repository and branch are selected
  useEffect(() => {
    if (!formData.vcs_connection_id || !formData.vcs_repository || !formData.vcs_branch || !createDialogOpen || formData.type !== 'vcs') {
      setInventoryFiles([]);
      return;
    }

    const [owner, repo] = formData.vcs_repository.split('/');
    if (!owner || !repo) return;

    setLoadingInventoryFiles(true);
    vcsConnectionsApi.listInventoryFiles(formData.vcs_connection_id, owner, repo, formData.vcs_branch)
      .then((files) => {
        setInventoryFiles(files || []);
      })
      .catch((err) => {
        console.error('Failed to load inventory files:', err);
        // Don't show error toast - just continue with manual input
        setInventoryFiles([]);
      })
      .finally(() => {
        setLoadingInventoryFiles(false);
      });
  }, [formData.vcs_connection_id, formData.vcs_repository, formData.vcs_branch, createDialogOpen, formData.type]);

  // Auto-focus search input when repository select opens
  useEffect(() => {
    if (repositorySelectOpen && repositorySearchInputRef.current) {
      setTimeout(() => {
        repositorySearchInputRef.current?.focus();
      }, 100);
    }
  }, [repositorySelectOpen]);

  // Auto-focus search input when inventory path select opens
  useEffect(() => {
    if (inventoryPathSelectOpen && inventoryPathSearchInputRef.current) {
      setTimeout(() => {
        inventoryPathSearchInputRef.current?.focus();
      }, 100);
    }
  }, [inventoryPathSelectOpen]);

  // Auto-generate name from repo-branch-path if user hasn't touched the name field
  useEffect(() => {
    if (nameTouched || !formData.vcs_repository || formData.type !== 'vcs') return;
    
    const repoName = formData.vcs_repository.split('/').pop() || '';
    const branch = formData.vcs_branch || '';
    const path = formData.inventory_path?.replace(/\.(ini|ya?ml|json)$/i, '').replace(/\//g, '-') || '';
    
    // Generate name: repo-branch-path (e.g., "my-repo-main-inventory")
    const parts = [repoName];
    if (branch) parts.push(branch);
    if (path) parts.push(path);
    
    const autoName = parts.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    setFormData(prev => ({ ...prev, name: autoName }));
  }, [formData.vcs_repository, formData.vcs_branch, formData.inventory_path, nameTouched, formData.type]);

  // Auto-generate description from repo-branch-path if user hasn't touched the description field
  useEffect(() => {
    if (descriptionTouched || !formData.vcs_repository || formData.type !== 'vcs') return;
    
    const repoName = formData.vcs_repository.split('/').pop() || '';
    const branch = formData.vcs_branch || '';
    const path = formData.inventory_path || '';
    
    // Generate description: "VCS inventory from {repo} repository, on the {branch} branch, at {path}"
    const parts: string[] = [];
    if (repoName) {
      parts.push(`${repoName} repository`);
    }
    if (branch) {
      parts.push(`on the ${branch} branch`);
    }
    if (path) {
      parts.push(`at ${path}`);
    }
    
    const autoDescription = parts.length > 0 
      ? `VCS inventory from ${parts.join(', ')}`
      : '';
    setFormData(prev => ({ ...prev, description: autoDescription }));
  }, [formData.vcs_repository, formData.vcs_branch, formData.inventory_path, descriptionTouched, formData.type]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    // Validate VCS fields if type is vcs
    if (formData.type === 'vcs') {
      if (!formData.vcs_connection_id) {
        toast.error('VCS connection is required for VCS inventory');
        return;
      }
      if (!formData.vcs_repository) {
        toast.error('Repository is required for VCS inventory');
        return;
      }
      if (!formData.vcs_branch) {
        toast.error('Branch is required for VCS inventory');
        return;
      }
      if (!formData.inventory_path) {
        toast.error('Inventory file path is required for VCS inventory');
        return;
      }
    }

    setCreating(true);
    try {
      const res = await ansibleInventoriesApi.create(selectedOrg, {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        vcs_connection_id: formData.vcs_connection_id || undefined,
        vcs_repository: formData.vcs_repository || undefined,
        vcs_branch: formData.vcs_branch || undefined,
        inventory_path: formData.inventory_path || undefined,
      });
      const newInventory = getAnsibleInventoryFromJsonApi(res.data);
      await queryClient.invalidateQueries({ queryKey: ['inventories', selectedOrg] });
      setCreateDialogOpen(false);
      resetCreateForm();
      toast.success('Inventory created successfully');

      // For dynamic inventories, redirect to detail page with setup=true to prompt source configuration
      if (formData.type === 'dynamic') {
        void Promise.resolve(navigate(`/app/${selectedOrg}/ansible/inventories/${newInventory.id}?setup=true`));
      }
    } catch (err: unknown) {
      console.error('Failed to create inventory:', err);
      const errorMessage = err instanceof Error ? err instanceof Error ? err.message : 'Unknown error' : 'Failed to create inventory';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!inventoryToDelete) return;

    setDeleting(true);
    try {
      await ansibleInventoriesApi.delete(inventoryToDelete.id);
      await queryClient.invalidateQueries({ queryKey: ['inventories', selectedOrg] });
      setDeleteDialogOpen(false);
      setInventoryToDelete(null);
      toast.success('Inventory deleted successfully');
    } catch (err: unknown) {
      console.error('Failed to delete inventory:', err);
      const errorMessage = err instanceof Error ? err instanceof Error ? err.message : 'Unknown error' : 'Failed to delete inventory';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const getTypeIcon = (type: string, inventoryPath?: string) => {
    if (type === 'vcs' && inventoryPath) {
      const plugin = detectDynamicInventoryPlugin(inventoryPath);
      if (plugin) {
        return <img src={plugin.iconPath} alt="" className="h-4 w-4" />;
      }
    }
    switch (type) {
      case 'static':
        return <Database className="h-4 w-4 text-orange-500" />;
      case 'dynamic':
        return <Cloud className="h-4 w-4 text-cyan-500" />;
      case 'vcs':
        return <GitBranch className="h-4 w-4 text-purple-500" />;
      default:
        return <Server className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeBadgeVariant = () => 'outline' as const;

  const getTypeLabel = (inventory: AnsibleInventory) => {
    if (inventory.type === 'vcs' && inventory.inventory_path) {
      const plugin = detectDynamicInventoryPlugin(inventory.inventory_path);
      if (plugin) {
        return plugin.label.replace(' Dynamic Inventory', '');
      }
    }
    return inventory.type === 'vcs' ? 'VCS' : inventory.type;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventories</h1>
          <p className="text-muted-foreground">
            Manage Ansible inventories for {selectedOrg}
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) resetCreateForm();
        }}>
          {canManageInventories && (
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Inventory
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Inventory</DialogTitle>
              <DialogDescription>
                Create a new Ansible inventory to manage hosts and groups.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder={formData.type === 'vcs' ? 'leave empty for auto suggest' : 'production-servers'}
                  value={formData.name}
                  onChange={(e) => {
                    setNameTouched(true);
                    setFormData({ ...formData, name: e.target.value });
                  }}
                />
                {!nameTouched && formData.vcs_repository && formData.type === 'vcs' && (
                  <p className="text-xs text-muted-foreground">
                    Auto-generated from repository, branch, and inventory file path
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder={formData.type === 'vcs' ? 'leave empty for auto suggest' : 'Production server inventory'}
                  value={formData.description}
                  onChange={(e) => {
                    setDescriptionTouched(true);
                    setFormData({ ...formData, description: e.target.value });
                  }}
                  rows={2}
                />
                {!descriptionTouched && formData.vcs_repository && formData.type === 'vcs' && (
                  <p className="text-xs text-muted-foreground">
                    Auto-generated from repository, branch, and inventory file path
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'static' | 'dynamic' | 'vcs') => {
                    setFormData({ 
                      ...formData, 
                      type: value,
                      // Reset VCS fields if switching away from vcs
                      ...(value !== 'vcs' ? { vcs_connection_id: '', vcs_repository: '', vcs_branch: '', inventory_path: '' } : {})
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-orange-500" />
                        <span>Static</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="dynamic">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-cyan-500" />
                        <span>Dynamic</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="vcs">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-purple-500" />
                        <span>VCS</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Type description */}
                <div className="flex items-start gap-2 p-3 bg-muted rounded-lg mt-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    {formData.type === 'static' && (
                      <>
                        <span className="font-medium text-foreground">Static inventory:</span>{' '}
                        Manually define hosts and groups. Best for fixed infrastructure.
                      </>
                    )}
                    {formData.type === 'dynamic' && (
                      <>
                        <span className="font-medium text-foreground">Dynamic inventory:</span>{' '}
                        Automatically discover hosts from cloud providers (AWS, Azure, GCP, VMware). 
                        You'll configure the cloud source after creating the inventory.
                      </>
                    )}
                    {formData.type === 'vcs' && (
                      <>
                        <span className="font-medium text-foreground">VCS inventory:</span>{' '}
                        Load inventory from a Git repository. Keep your inventory versioned with your code.
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* VCS Configuration - Only show when type is vcs */}
              {formData.type === 'vcs' && (
                <>
                  <div className="space-y-2 border-t pt-4">
                    <Label>VCS Connection *</Label>
                    {loadingVCS ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading VCS connections...
                      </div>
                    ) : vcsConnections.length === 0 ? (
                      <VCSProviderSelector
                        orgName={selectedOrg}
                        selectedConnectionId={undefined}
                        onConnectionSelect={(id) => {
                          setSelectedVcsProject('');
                          setFormData({
                            ...formData,
                            vcs_connection_id: id || '',
                            vcs_repository: '',
                            vcs_branch: '',
                            inventory_path: '',
                          });
                        }}
                        showConfigureOption={false}
                      />
                    ) : (
                      <div className="space-y-2">
                        {vcsConnections.map((conn) => (
                          <div
                            key={conn.id}
                            className={cn(
                              'p-3 border-2 rounded-lg cursor-pointer transition-all',
                              formData.vcs_connection_id === conn.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                                : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                            )}
                            onClick={() => {
                              const newValue = formData.vcs_connection_id === conn.id ? '' : conn.id;
                              setSelectedVcsProject('');
                              setFormData({
                                ...formData,
                                vcs_connection_id: newValue,
                                vcs_repository: '',
                                vcs_branch: '',
                                inventory_path: '',
                              });
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getVcsProviderIcon(conn.provider, 'h-4 w-4')}
                                <span className="text-sm font-medium">
                                  {getVcsProviderLabel(conn.provider)} - {conn.account_name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {conn.account_type}
                                </Badge>
                              </div>
                              {formData.vcs_connection_id === conn.id && (
                                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => { window.open(`/app/${selectedOrg}/settings/vcs-connections`, '_blank'); }}
                          className="w-full text-xs"
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          Connect to a different VCS
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Project Selector (Azure DevOps only) */}
                  {formData.vcs_connection_id && (
                    <VCSProjectSelect
                      connectionId={formData.vcs_connection_id}
                      provider={vcsConnections.find(c => c.id === formData.vcs_connection_id)?.provider}
                      value={selectedVcsProject}
                      onChange={(project) => {
                        setSelectedVcsProject(project);
                        setFormData(prev => ({ ...prev, vcs_repository: '', vcs_branch: '', inventory_path: '' }));
                      }}
                    />
                  )}

                  {/* Repository Selector */}
                  {formData.vcs_connection_id && (
                    <div className="space-y-2">
                      <Label>Repository *</Label>
                      {loadingRepos ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading repositories...
                        </div>
                      ) : repositories.length === 0 ? (
                        <div className="text-sm text-muted-foreground space-y-2">
                          <p>No repositories found for this installation.</p>
                        </div>
                      ) : (
                        <Select
                          value={formData.vcs_repository}
                          onValueChange={(value) => {
                            setFormData({ ...formData, vcs_repository: value, vcs_branch: '', inventory_path: '' });
                          }}
                          open={repositorySelectOpen}
                          onOpenChange={setRepositorySelectOpen}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a repository" />
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
                                      {getVcsProviderIcon(vcsConnections.find(c => c.id === formData.vcs_connection_id)?.provider ?? '', 'h-4 w-4')}
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
                      )}
                    </div>
                  )}

                  {/* Branch Selector */}
                  {formData.vcs_repository && (
                    <div className="space-y-2">
                      <Label>Branch *</Label>
                      {loadingBranches ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading branches...
                        </div>
                      ) : (
                        <Select
                          value={formData.vcs_branch}
                          onValueChange={(value) => setFormData({ ...formData, vcs_branch: value, inventory_path: '' })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((branch) => (
                              <SelectItem key={branch.name} value={branch.name}>
                                {branch.name} {branch.protected ? '(Protected)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Inventory Path */}
                  {formData.vcs_connection_id && formData.vcs_repository && formData.vcs_branch && (
                    <div className="space-y-2">
                      <Label htmlFor="inventory_path">Inventory File Path *</Label>
                      {loadingInventoryFiles ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading inventory files...
                        </div>
                      ) : inventoryFiles.length > 0 ? (
                        <Select
                          value={formData.inventory_path}
                          onValueChange={(value) => setFormData({ ...formData, inventory_path: value })}
                          open={inventoryPathSelectOpen}
                          onOpenChange={setInventoryPathSelectOpen}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an inventory file" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <div className="p-2 border-b sticky top-0 bg-background z-10">
                              <Input
                                ref={inventoryPathSearchInputRef}
                                placeholder="Search inventory files..."
                                value={inventoryPathSearch}
                                onChange={(e) => {
                                  setInventoryPathSearch(e.target.value);
                                  e.stopPropagation();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="h-8"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-[250px] overflow-y-auto">
                              {inventoryFiles
                                .filter((file) =>
                                  file.toLowerCase().includes(inventoryPathSearch.toLowerCase())
                                )
                                .map((file) => (
                                  <SelectItem key={file} value={file}>
                                    {file}
                                  </SelectItem>
                                ))}
                              {inventoryFiles.filter((file) =>
                                file.toLowerCase().includes(inventoryPathSearch.toLowerCase())
                              ).length === 0 && (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                  No inventory files found
                                </div>
                              )}
                            </div>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="inventory_path"
                          value={formData.inventory_path}
                          onChange={(e) => setFormData({ ...formData, inventory_path: e.target.value })}
                          placeholder="inventory.ini or inventories/production.yml"
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        {inventoryFiles.length > 0 
                          ? `Select an inventory file from the repository (${inventoryFiles.length} found - .ini, .yaml, .yml, .json)` 
                          : 'Path to the inventory file within the repository (e.g., inventory.ini, inventories/production.yml)'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => { void handleCreate(); }} 
                disabled={creating || !formData.name || (formData.type === 'vcs' && (!formData.vcs_connection_id || !formData.vcs_repository || !formData.vcs_branch || !formData.inventory_path))}
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search inventories..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setInvPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Inventory List */}
      {filteredInventories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-orange-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">No inventories found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery
                ? 'No inventories match your search.'
                : 'Create your first inventory to get started.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Inventory
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedInventories.map((inventory) => (
            <Card
              key={inventory.id}
              className="hover:border-primary/50 transition-colors cursor-pointer group flex flex-col"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 flex-1">
                <div className="space-y-1 flex-1">
                  <Link
                    to={`/app/${selectedOrg}/ansible/inventories/${inventory.id}`}
                    className="hover:underline"
                  >
                    <CardTitle className="text-lg font-semibold">
                      {inventory.name}
                    </CardTitle>
                  </Link>
                  {inventory.description && (
                    <CardDescription className="line-clamp-2">
                      {inventory.description}
                    </CardDescription>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/app/${selectedOrg}/ansible/inventories/${inventory.id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    {canManageInventories && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setInventoryToDelete(inventory);
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
              <CardContent className="mt-auto pt-4">
                <div className="flex items-center justify-between">
                  <Badge variant={getTypeBadgeVariant()}>
                    {getTypeIcon(inventory.type, inventory.inventory_path)}
                    <span className="ml-1 capitalize">{getTypeLabel(inventory)}</span>
                  </Badge>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {inventoryCounts[inventory.id] && (
                      <>
                        <div className="flex items-center gap-1">
                          <Server className="h-3.5 w-3.5 text-blue-500" />
                          <span>{inventoryCounts[inventory.id].hosts}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FolderTree className="h-3.5 w-3.5 text-green-500" />
                          <span>{inventoryCounts[inventory.id].groups}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pager — windows the inventory grid for large orgs */}
      <Pager page={currentInvPage} totalPages={invTotalPages} onPageChange={setInvPage} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Inventory</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{inventoryToDelete?.name}"? This action
              cannot be undone and will also delete all hosts and groups in this
              inventory.
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
