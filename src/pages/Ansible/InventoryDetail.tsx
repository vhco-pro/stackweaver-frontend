// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ansibleInventoriesApi, 
  ansibleHostsApi,
  ansibleGroupsApi,
  ansibleInventorySourcesApi,
  ansibleCredentialsApi,
  type AnsibleInventory,
  type AnsibleInventoryHost,
  type AnsibleInventoryGroup,
  type AnsibleInventorySource,
  type AnsibleCredential,
  type InventorySourceType,
  type CreateInventorySourceInput,
} from '@/api/ansible';
import { 
  getAnsibleInventoryFromJsonApi,
  getAnsibleHostFromJsonApi,
  getAnsibleGroupFromJsonApi,
  getAnsibleInventorySourceFromJsonApi,
  getAnsibleCredentialFromJsonApi,
} from '@/utils/ansible-jsonapi';
import type { JsonApiResource } from '@/utils/jsonapi';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Server,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Loader2,
  Database,
  Cloud,
  GitBranch,
  FolderTree,
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  Info,
  FileText,
  ExternalLink,
  X,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { vcsConnectionsApi, azureOIDCConfigApi, type VCSConnection, type AzureOIDCConfiguration } from '@/api/client';
import { getVcsProviderIcon, getVcsRepoUrl, getVcsFileUrl } from '@/lib/vcs';
import { InventoryFileViewer } from '@/components/code/InventoryFileViewer';
import { toast } from 'sonner';
import { detectDynamicInventoryPlugin, type DynamicInventoryPlugin } from '@/utils/dynamic-inventory';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InventoryDetailData {
  inventory: AnsibleInventory;
  vcsConnections: VCSConnection[];
  hosts: AnsibleInventoryHost[];
  groups: (AnsibleInventoryGroup & { hostIds?: string[] })[];
  sources: AnsibleInventorySource[];
  credentials: AnsibleCredential[];
  hasAzureOIDC: boolean;
  azureOIDCConfig: AzureOIDCConfiguration | null;
}

export default function InventoryDetail() {
  const { orgName, inventoryId } = useParams<{ orgName: string; inventoryId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('hosts');
  const [activeTabInitialized, setActiveTabInitialized] = useState(false);
  
  // Collapsible banner state
  const [infoBannerOpen, setInfoBannerOpen] = useState(true);
  const [warningBannerOpen, setWarningBannerOpen] = useState(true);
  const [errorBannerOpen, setErrorBannerOpen] = useState(true);

  // Edit inventory state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  
  // Inline description editing state
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [inlineDescription, setInlineDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  
  // Delete inventory state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  
  // Add host state
  const [addHostDialogOpen, setAddHostDialogOpen] = useState(false);
  const [addingHost, setAddingHost] = useState(false);
  const [hostForm, setHostForm] = useState({
    name: '',
    description: '',
    hostname: '',
    port: 22,
  });

  // Edit host state
  const [editHostDialogOpen, setEditHostDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState(false);
  const [hostToEdit, setHostToEdit] = useState<AnsibleInventoryHost | null>(null);
  const [editHostForm, setEditHostForm] = useState({
    name: '',
    description: '',
    hostname: '',
    port: 22,
    enabled: true,
  });

  // Add group state
  const [addGroupDialogOpen, setAddGroupDialogOpen] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
  });

  // Add source state (for dynamic inventories)
  const [addSourceDialogOpen, setAddSourceDialogOpen] = useState(false);
  
  // Edit source state
  const [editSourceDialogOpen, setEditSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(false);
  const [sourceToEdit, setSourceToEdit] = useState<AnsibleInventorySource | null>(null);
  const [editSourceForm, setEditSourceForm] = useState<CreateInventorySourceInput>({
    name: '',
    description: '',
    type: 'aws',
    credential_id: '',
    config: {},
    update_on_launch: true,
    group_by_region: true,
    hostname_var: 'public_ip',
    enabled: true,
  });
  const [editAzureAuthMethod, setEditAzureAuthMethod] = useState<'oidc' | 'credential'>('credential');
  
  // Azure auth method state
  const [azureAuthMethod, setAzureAuthMethod] = useState<'oidc' | 'credential'>('credential');
  
  // Sync state (for VCS inventories)
  const [syncing, setSyncing] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  
  // File content state (for VCS inventories)
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentLoading, setFileContentLoading] = useState(false);
  const [fileContentError, setFileContentError] = useState<string | null>(null);
  const [sourceForm, setSourceForm] = useState<CreateInventorySourceInput>({
    name: '',
    description: '',
    type: 'aws',
    credential_id: '',
    config: {},
    update_on_launch: true,
    group_by_region: true,
    hostname_var: 'public_ip',
    enabled: true,
  });

  // Fetch inventory details
  const { isLoading: loading, data: queryData, refetch } = useQuery({
    queryKey: ['inventoryDetail', inventoryId, orgName],
    queryFn: async (): Promise<InventoryDetailData> => {
      const invRes = await ansibleInventoriesApi.get(inventoryId!);
      const inv = getAnsibleInventoryFromJsonApi(invRes.data);

      const [hostsRes, groupsRes, sourcesRes, vcsConnsResult, azureOIDCResult, credsResult] = await Promise.all([
        ansibleHostsApi.list(inventoryId!),
        ansibleGroupsApi.list(inventoryId!),
        ansibleInventorySourcesApi.list(inventoryId!),
        vcsConnectionsApi.list(orgName ?? '').catch(() => [] as VCSConnection[]),
        azureOIDCConfigApi.list(orgName ?? '').catch(() => ({ data: [] as AzureOIDCConfiguration[] })),
        ansibleCredentialsApi.list(orgName!).catch((err: unknown) => {
          console.warn('Failed to load credentials:', err);
          return { data: [] as JsonApiResource[] };
        }),
      ]);

      const hostsData = (hostsRes.data || []).map(getAnsibleHostFromJsonApi);
      const groupsData = (groupsRes.data || []).map((groupResource: JsonApiResource) => {
        const group = getAnsibleGroupFromJsonApi(groupResource);
        const hostRelationships = (groupResource.relationships?.hosts as { data?: Array<{ id: string }> | { id: string } })?.data;
        const hostIds = Array.isArray(hostRelationships)
          ? hostRelationships.map((h: { id: string }) => h.id)
          : hostRelationships ? [hostRelationships.id] : [];
        return { ...group, hostIds };
      });
      const sourcesData = (sourcesRes.data || []).map(getAnsibleInventorySourceFromJsonApi);

      const vcsConns = vcsConnsResult;
      const azureOIDCData = azureOIDCResult.data;
      const hasOIDC = azureOIDCData.length > 0;
      const oidcConfig = hasOIDC ? azureOIDCData[0] : null;

      const allCreds = (credsResult.data || []).map(getAnsibleCredentialFromJsonApi);
      const filteredCreds = allCreds.filter(c => ['aws', 'azure', 'gcp', 'vmware'].includes(c.type));

      return {
        inventory: inv,
        vcsConnections: vcsConns,
        hosts: hostsData,
        groups: groupsData,
        sources: sourcesData,
        credentials: filteredCreds,
        hasAzureOIDC: hasOIDC,
        azureOIDCConfig: oidcConfig,
      };
    },
    enabled: !!inventoryId && !!orgName,
  });

  // Derive server data from query result
  const inventory = queryData?.inventory ?? null;
  const vcsConnections = queryData?.vcsConnections ?? [];
  const hosts = queryData?.hosts ?? [];
  const groups = queryData?.groups ?? [];
  const sources = queryData?.sources ?? [];
  const credentials = queryData?.credentials ?? [];
  const hasAzureOIDC = queryData?.hasAzureOIDC ?? false;
  const azureOIDCConfig = queryData?.azureOIDCConfig ?? null;

  // Initialize form state and active tab when query data first loads
  useEffect(() => {
    if (inventory && !activeTabInitialized) {
      setEditForm({ name: inventory.name, description: inventory.description || '' });
      setInlineDescription(inventory.description || '');
      if (inventory.type === 'dynamic') {
        setActiveTab('sources');
      }
      if (hasAzureOIDC) {
        setAzureAuthMethod('oidc');
      }
      setActiveTabInitialized(true);
    }
  }, [inventory, hasAzureOIDC, activeTabInitialized]);

  // Auto-open the add source dialog if setup=true (coming from create dynamic inventory)
  useEffect(() => {
    if (!loading && inventory?.type === 'dynamic' && searchParams.get('setup') === 'true') {
      setAddSourceDialogOpen(true);
      // Remove the setup param from URL
      setSearchParams({});
    }
  }, [loading, inventory, searchParams, setSearchParams]);

  // Reset confirmation name when delete dialog opens
  useEffect(() => {
    if (deleteDialogOpen) {
      setConfirmName('');
    }
  }, [deleteDialogOpen]);

  const handleUpdate = async () => {
    if (!inventory || !editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      await ansibleInventoriesApi.update(inventory.id, {
        name: editForm.name,
        description: editForm.description || undefined,
      });
      await refetch();
      setEditDialogOpen(false);
      toast.success('Inventory updated successfully');
    } catch (err: unknown) {
      console.error('Failed to update inventory:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update inventory';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInlineDescription = async () => {
    if (!inventory) return;

    setSavingDescription(true);
    try {
      await ansibleInventoriesApi.update(inventory.id, {
        name: inventory.name,
        description: inlineDescription.trim() || undefined,
      });
      await refetch();
      setIsEditingDescription(false);
      toast.success('Description updated successfully');
    } catch (err: unknown) {
      console.error('Failed to update description:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update description';
      toast.error(errorMessage);
    } finally {
      setSavingDescription(false);
    }
  };

  const handleCancelInlineDescription = () => {
    setInlineDescription(inventory?.description || '');
    setIsEditingDescription(false);
  };

  const handleDelete = async () => {
    if (!inventory) return;

    if (confirmName !== inventory.name) {
      toast.error('Inventory name does not match');
      return;
    }

    setDeleting(true);
    try {
      await ansibleInventoriesApi.delete(inventory.id);
      toast.success('Inventory deleted successfully');
      void Promise.resolve(navigate(`/app/${orgName}/ansible/inventories`));
    } catch (err: unknown) {
      console.error('Failed to delete inventory:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete inventory';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddHost = async () => {
    // Auto-fill name from hostname if left blank
    const effectiveName = hostForm.name.trim() || hostForm.hostname.trim();
    
    if (!inventoryId || !effectiveName) {
      toast.error('Host name or hostname is required');
      return;
    }

    setAddingHost(true);
    try {
      await ansibleHostsApi.create(inventoryId, {
        name: effectiveName,
        description: hostForm.description || undefined,
        hostname: hostForm.hostname || undefined,
        port: hostForm.port || 22,
      });
      await refetch();
      setAddHostDialogOpen(false);
      setHostForm({ name: '', description: '', hostname: '', port: 22 });
      toast.success('Host added successfully');
    } catch (err: unknown) {
      console.error('Failed to add host:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add host';
      toast.error(errorMessage);
    } finally {
      setAddingHost(false);
    }
  };

  const handleDeleteHost = async (hostId: string) => {
    try {
      await ansibleHostsApi.delete(hostId);
      await refetch();
      toast.success('Host deleted');
    } catch (err: unknown) {
      console.error('Failed to delete host:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete host');
    }
  };

  const handleEditHost = (host: AnsibleInventoryHost) => {
    setHostToEdit(host);
    setEditHostForm({
      name: host.name,
      description: host.description || '',
      hostname: host.hostname || '',
      port: host.port || 22,
      enabled: host.enabled !== false,
    });
    setEditHostDialogOpen(true);
  };

  const handleUpdateHost = async () => {
    if (!hostToEdit) return;

    setEditingHost(true);
    try {
      await ansibleHostsApi.update(hostToEdit.id, {
        name: editHostForm.name,
        description: editHostForm.description || undefined,
        hostname: editHostForm.hostname || undefined,
        port: editHostForm.port,
        enabled: editHostForm.enabled,
      });
      await refetch();
      setEditHostDialogOpen(false);
      setHostToEdit(null);
      toast.success('Host updated successfully');
    } catch (err: unknown) {
      console.error('Failed to update host:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update host');
    } finally {
      setEditingHost(false);
    }
  };

  const handleToggleHostEnabled = async (host: AnsibleInventoryHost) => {
    try {
      // Toggle the enabled state: if enabled (or undefined which means enabled), disable it; otherwise enable it
      const newEnabledState = host.enabled !== false ? false : true;
      await ansibleHostsApi.update(host.id, {
        enabled: newEnabledState,
      });
      await refetch();
      toast.success(`Host ${newEnabledState ? 'enabled' : 'disabled'}`);
    } catch (err: unknown) {
      console.error('Failed to toggle host enabled state:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update host');
    }
  };

  const handleAddGroup = async () => {
    if (!inventoryId || !groupForm.name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setAddingGroup(true);
    try {
      await ansibleGroupsApi.create(inventoryId, {
        name: groupForm.name,
        description: groupForm.description || undefined,
      });
      await refetch();
      setAddGroupDialogOpen(false);
      setGroupForm({ name: '', description: '' });
      toast.success('Group added successfully');
    } catch (err: unknown) {
      console.error('Failed to add group:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add group';
      toast.error(errorMessage);
    } finally {
      setAddingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await ansibleGroupsApi.delete(groupId);
      await refetch();
      toast.success('Group deleted');
    } catch (err: unknown) {
      console.error('Failed to delete group:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete group');
    }
  };

  // Inventory Source handlers
  const handleAddSource = async () => {
    if (!inventoryId || !sourceForm.name.trim()) {
      toast.error('Source name is required');
      return;
    }

    setAddingSource(true);
    try {
      await ansibleInventorySourcesApi.create(inventoryId, sourceForm);
      await refetch();
      setAddSourceDialogOpen(false);
      setSourceForm({
        name: '',
        description: '',
        type: 'aws',
        credential_id: '',
        config: {},
        update_on_launch: true,
        group_by_region: true,
        hostname_var: 'public_ip',
        enabled: true,
      });
      toast.success('Inventory source added successfully');
    } catch (err: unknown) {
      console.error('Failed to add inventory source:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add inventory source');
    } finally {
      setAddingSource(false);
    }
  };

  const handleSync = async () => {
    if (!inventoryId || !inventory) return;

    setSyncing(true);
    try {
      await ansibleInventoriesApi.sync(inventoryId);
      toast.success('Inventory sync started');

      // Poll for updated inventory status (sync is async)
      let pollCount = 0;
      const maxPolls = 30; // 30 polls * 2 seconds = 60 seconds max
      const pollInterval = setInterval(() => {
        void (async () => {
          pollCount++;
          try {
            const refreshed = await ansibleInventoriesApi.get(inventoryId);
            const updated = getAnsibleInventoryFromJsonApi(refreshed.data);

            // Refetch all data to keep query cache in sync
            void refetch();

            // If sync is complete (not syncing anymore), stop polling
            if (updated.last_sync_status && updated.last_sync_status !== 'syncing') {
              clearInterval(pollInterval);
              setSyncing(false);
              if (updated.last_sync_status === 'successful') {
                const hostCount = updated.last_sync_hosts_discovered ?? 0;
                if (hostCount > 0) {
                  toast.success(`Inventory synced successfully — ${hostCount} host${hostCount === 1 ? '' : 's'} discovered`);
                } else {
                  toast.warning('Inventory synced successfully but 0 hosts were discovered. Check the inventory plugin configuration and authentication.');
                }
              } else if (updated.last_sync_status === 'failed') {
                toast.error(`Inventory sync failed: ${updated.last_sync_error || 'Unknown error'}`);
              } else {
                // Fallback for any other status
                toast.info(`Inventory sync completed with status: ${updated.last_sync_status}`);
              }
            } else if (pollCount >= maxPolls) {
              // Timeout - stop polling
              clearInterval(pollInterval);
              setSyncing(false);
              toast.warning('Sync is taking longer than expected');
            }
          } catch (err) {
            console.warn('Failed to refresh inventory after sync:', err);
            clearInterval(pollInterval);
            setSyncing(false);
          }
        })();
      }, 2000); // Poll every 2 seconds
    } catch (err: unknown) {
      console.error('Failed to sync inventory:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync inventory';
      toast.error(errorMessage);
      setSyncing(false);
    }
  };

  const handleSyncSource = async (sourceId: string) => {
    setSyncingSourceId(sourceId);
    try {
      await ansibleInventorySourcesApi.sync(sourceId);
      toast.success('Sync started');

      // Poll for updated status (sync runs async in the runner)
      let pollCount = 0;
      const maxPolls = 30; // 30 polls × 2s = 60s max
      const pollInterval = setInterval(() => {
        void (async () => {
          pollCount++;
          try {
            const sourcesRes = await ansibleInventorySourcesApi.list(inventoryId!);
            const updatedSources = (sourcesRes.data || []).map(getAnsibleInventorySourceFromJsonApi);

            const syncedSource = updatedSources.find(s => s.id === sourceId);
            if (syncedSource && syncedSource.status !== 'syncing') {
              clearInterval(pollInterval);
              setSyncingSourceId(null);

              // Refetch all data to keep query cache in sync
              void refetch();

              if (syncedSource.status === 'successful') {
                const hostCount = syncedSource.hosts_count ?? 0;
                if (hostCount > 0) {
                  toast.success(`Source synced — ${hostCount} host${hostCount === 1 ? '' : 's'} discovered`);
                } else {
                  toast.warning('Source synced but 0 hosts discovered. Check configuration and authentication.');
                }
              } else if (syncedSource.status === 'failed') {
                toast.error(`Source sync failed: ${syncedSource.last_sync_error || 'Unknown error'}`);
              }
            } else {
              // Still syncing - refetch to update UI with intermediate state
              void refetch();

              if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                setSyncingSourceId(null);
                toast.warning('Sync is taking longer than expected');
              }
            }
          } catch (err) {
            console.warn('Failed to poll source sync status:', err);
            clearInterval(pollInterval);
            setSyncingSourceId(null);
          }
        })();
      }, 2000);
    } catch (err: unknown) {
      console.error('Failed to sync inventory source:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to sync inventory source');
      setSyncingSourceId(null);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await ansibleInventorySourcesApi.delete(sourceId);
      await refetch();
      toast.success('Inventory source deleted');
    } catch (err: unknown) {
      console.error('Failed to delete inventory source:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete inventory source');
    }
  };

  const handleOpenEditSource = (source: AnsibleInventorySource) => {
    setSourceToEdit(source);
    setEditSourceForm({
      name: source.name,
      description: source.description || '',
      type: source.type,
      credential_id: source.credential_id || '',
      config: source.config || {},
      update_on_launch: source.update_on_launch,
      update_cache_timeout: source.update_cache_timeout,
      group_by_instance_id: source.group_by_instance_id,
      group_by_region: source.group_by_region,
      group_by_availability_zone: source.group_by_availability_zone,
      group_by_tag: source.group_by_tag || '',
      hostname_var: source.hostname_var || 'public_ip',
      instance_filters: source.instance_filters || '',
      enabled: source.enabled,
      sync_schedule: source.sync_schedule || undefined,
    });
    // Determine auth method: if Azure without credential and OIDC is available, it's OIDC
    if (source.type === 'azure' && !source.credential_id && hasAzureOIDC) {
      setEditAzureAuthMethod('oidc');
    } else {
      setEditAzureAuthMethod('credential');
    }
    setEditSourceDialogOpen(true);
  };

  const handleUpdateSource = async () => {
    if (!sourceToEdit || !editSourceForm.name.trim()) {
      toast.error('Source name is required');
      return;
    }

    setEditingSource(true);
    try {
      // If switching to OIDC, clear credential_id
      const updateData: Partial<CreateInventorySourceInput> = {
        ...editSourceForm,
        credential_id: editSourceForm.type === 'azure' && editAzureAuthMethod === 'oidc'
          ? ''  // Empty string signals backend to clear credential
          : editSourceForm.credential_id || undefined,
      };
      await ansibleInventorySourcesApi.update(sourceToEdit.id, updateData);
      await refetch();
      setEditSourceDialogOpen(false);
      setSourceToEdit(null);
      toast.success('Inventory source updated');
    } catch (err: unknown) {
      console.error('Failed to update inventory source:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update inventory source');
    } finally {
      setEditingSource(false);
    }
  };

  /** Map source type to cloud provider icon */
  const sourceTypeIconMap: Record<string, { icon: string; bg: string }> = {
    azure: { icon: '/icons/azurerm.svg?v=2', bg: 'bg-blue-500/10' },
    aws: { icon: '/icons/aws.svg', bg: 'bg-orange-500/10' },
    gcp: { icon: '/icons/google.svg', bg: 'bg-red-500/10' },
  };

  const getSourceTypeIcon = (type: InventorySourceType) => {
    const mapping = sourceTypeIconMap[type];
    if (mapping) {
      return <img src={mapping.icon} alt="" className="h-5 w-5" />;
    }
    switch (type) {
      case 'vmware':
        return <Server className="h-5 w-5 text-green-500" />;
      default:
        return <Cloud className="h-5 w-5" />;
    }
  };

  const getSourceIconBg = (type: InventorySourceType) => {
    return sourceTypeIconMap[type]?.bg || 'bg-primary/10';
  };

  const getSourceStatusBadge = (status: string) => {
    switch (status) {
      case 'successful':
        return <Badge variant="default" className="bg-green-600"><Check className="h-3 w-3 mr-1" />Synced</Badge>;
      case 'syncing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Syncing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Never Synced</Badge>;
    }
  };

  // Load file content when switching to content tab
  const loadFileContent = async () => {
    if (!inventory || !inventory.vcs_connection_id || !inventory.vcs_repository || !inventory.inventory_path) return;
    
    setFileContentLoading(true);
    setFileContentError(null);
    try {
      // Parse owner/repo from vcs_repository (format: "owner/repo")
      const [owner, repo] = inventory.vcs_repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format');
      }
      
      const res = await vcsConnectionsApi.getFileContent(
        inventory.vcs_connection_id,
        owner,
        repo,
        inventory.inventory_path,
        inventory.vcs_branch
      );
      setFileContent(res.content);
    } catch (err: unknown) {
      console.error('Failed to load file content:', err);
      setFileContentError(err instanceof Error ? err.message : 'Failed to load file content');
    } finally {
      setFileContentLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'content' && !fileContent && !fileContentLoading) {
      void loadFileContent();
    }
  };

  // Resolve the VCS connection for this inventory (needed for provider-aware URLs)
  const inventoryVcsConn = vcsConnections.find(c => c.id === inventory?.vcs_connection_id);

  // Detect if this VCS inventory is a dynamic inventory plugin
  const dynamicPlugin: DynamicInventoryPlugin | null = inventory?.type === 'vcs'
    ? detectDynamicInventoryPlugin(inventory.inventory_path, fileContent)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Inventory not found</h2>
          <Button variant="outline" onClick={() => { void navigate(`/app/${orgName}/ansible/inventories`); }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventories
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { void navigate(`/app/${orgName}/ansible/inventories`); }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              inventory.type === 'static' ? 'bg-orange-500/10' : 
              inventory.type === 'dynamic' ? 'bg-cyan-500/10' : 
              dynamicPlugin ? dynamicPlugin.bgClass :
              'bg-purple-500/10'
            }`}>
              {inventory.type === 'static' ? (
                <Database className="h-6 w-6 text-orange-500" />
              ) : inventory.type === 'dynamic' ? (
                <Cloud className="h-6 w-6 text-cyan-500" />
              ) : dynamicPlugin ? (
                <img src={dynamicPlugin.iconPath} alt="" className="h-6 w-6" />
              ) : (
                <GitBranch className="h-6 w-6 text-purple-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{inventory.name}</h1>
                {dynamicPlugin && (
                  <Badge variant="outline" className={`${dynamicPlugin.textClass} ${dynamicPlugin.darkTextClass} border-current/30`}>
                    <img src={dynamicPlugin.iconPath} alt="" className="h-3.5 w-3.5 mr-1" />
                    Dynamic
                  </Badge>
                )}
              </div>
              {isEditingDescription ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={inlineDescription}
                    onChange={(e) => setInlineDescription(e.target.value)}
                    placeholder="Add description"
                    className="max-w-md"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleSaveInlineDescription();
                      } else if (e.key === 'Escape') {
                        handleCancelInlineDescription();
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { void handleSaveInlineDescription(); }}
                    disabled={savingDescription}
                  >
                    {savingDescription ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelInlineDescription}
                    disabled={savingDescription}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => {
                    setInlineDescription(inventory.description || '');
                    setIsEditingDescription(true);
                  }}
                >
                  {inventory.description || 'add description'}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inventory.type === 'vcs' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleSync(); }}
              disabled={syncing || !inventory.vcs_connection_id}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from VCS
            </Button>
          )}
          <Dialog open={editDialogOpen} onOpenChange={(open) => {
              if (open && inventory) {
                setEditForm({ name: inventory.name, description: inventory.description || '' });
              }
              setEditDialogOpen(open);
            }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Inventory</DialogTitle>
                <DialogDescription>
                  Update the inventory name and description.
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => { void handleUpdate(); }} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Inventory</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this inventory? This will also delete all hosts and groups. This action cannot be undone.
                  <br /><br />
                  To confirm, please type <strong>{inventory.name}</strong> below:
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="confirm-name">Inventory Name</Label>
                  <Input
                    id="confirm-name"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={inventory.name}
                    disabled={deleting}
                    className="font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setConfirmName('');
                  }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { void handleDelete(); }}
                  disabled={deleting || confirmName !== inventory.name}
                >
                  {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete Inventory
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hosts</CardTitle>
            <Server className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hosts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Groups</CardTitle>
            <FolderTree className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
          </CardContent>
        </Card>
        {inventory.type === 'dynamic' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sources</CardTitle>
              <Cloud className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sources.length}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Type</CardTitle>
            {inventory.type === 'static' ? (
              <Database className="h-4 w-4 text-orange-500" />
            ) : inventory.type === 'dynamic' ? (
              <Cloud className="h-4 w-4 text-cyan-500" />
            ) : dynamicPlugin ? (
              <img src={dynamicPlugin.iconPath} alt="" className="h-4 w-4" />
            ) : (
              <GitBranch className="h-4 w-4 text-purple-500" />
            )}
          </CardHeader>
          <CardContent>
            {dynamicPlugin ? (
              <Badge variant="outline" className={`${dynamicPlugin.textClass} ${dynamicPlugin.darkTextClass} border-current/30`}>
                <img src={dynamicPlugin.iconPath} alt="" className="h-3 w-3 mr-1" />
                {dynamicPlugin.label}
              </Badge>
            ) : (
              <Badge variant="outline" className="uppercase">
                {inventory.type === 'vcs' ? 'VCS' : inventory.type}
              </Badge>
            )}
          </CardContent>
        </Card>
        {inventory.type === 'vcs' && inventory.last_sync_at && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
              {inventory.last_sync_status === 'successful' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : inventory.last_sync_status === 'failed' ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : inventory.last_sync_status === 'syncing' ? (
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {inventory.last_sync_hosts_discovered !== undefined && inventory.last_sync_hosts_discovered !== null ? (
                  <span>{inventory.last_sync_hosts_discovered} host{inventory.last_sync_hosts_discovered === 1 ? '' : 's'} discovered</span>
                ) : (
                  <Badge variant="outline" className={
                    inventory.last_sync_status === 'successful' ? 'text-green-600 dark:text-green-400' :
                    inventory.last_sync_status === 'failed' ? 'text-red-600 dark:text-red-400' :
                    ''
                  }>
                    {inventory.last_sync_status}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(inventory.last_sync_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="hosts">
            <Server className="h-4 w-4 mr-2" />
            Hosts ({hosts.length})
          </TabsTrigger>
          <TabsTrigger value="groups">
            <FolderTree className="h-4 w-4 mr-2" />
            Groups ({groups.length})
          </TabsTrigger>
          {inventory.type === 'vcs' && (
            <TabsTrigger value="content">
              <FileText className="h-4 w-4 mr-2" />
              Content
            </TabsTrigger>
          )}
          {inventory.type === 'dynamic' && (
            <TabsTrigger value="sources">
              <Cloud className="h-4 w-4 mr-2" />
              Sources ({sources.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Hosts Tab */}
        <TabsContent value="hosts" className="space-y-4">
          {/* Dynamic inventory info banner */}
          {inventory.type === 'dynamic' && (
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="flex items-start gap-3 py-4">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Dynamic Inventory
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Hosts in this inventory are automatically discovered from cloud sources. 
                    Go to the <button className="text-blue-500 hover:underline font-medium" onClick={() => setActiveTab('sources')}>Sources</button> tab 
                    to configure and sync cloud providers (AWS, Azure, GCP, VMware).
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sync error banners for dynamic inventories (from sources) */}
          {inventory.type === 'dynamic' && sources.filter(s => s.status === 'failed' && s.last_sync_error).map(source => (
            <Card key={`err-${source.id}`} className="bg-red-500/5 border-red-500/20">
              <CardContent className="flex items-start gap-3 py-4">
                <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      Source &ldquo;{source.name}&rdquo; Sync Failed
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => {
                        void navigator.clipboard.writeText(source.last_sync_error || '').then(() => {
                          toast.success('Copied to clipboard');
                        }).catch(() => {
                          toast.error('Failed to copy to clipboard');
                        });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-40 overflow-y-auto">
                    {source.last_sync_error}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Sync warning banners for dynamic inventories (stderr from sources) */}
          {inventory.type === 'dynamic' && sources.filter(s => s.status === 'successful' && s.last_sync_log).map(source => (
            <Card key={`warn-${source.id}`} className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <button
                    type="button"
                    className="flex-1 text-left cursor-pointer"
                    onClick={() => { setWarningBannerOpen(!warningBannerOpen); }}
                  >
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Source &ldquo;{source.name}&rdquo; Sync Warnings
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                      onClick={() => {
                        void navigator.clipboard.writeText(source.last_sync_log || '').then(() => {
                          toast.success('Copied to clipboard');
                        }).catch(() => {
                          toast.error('Failed to copy to clipboard');
                        });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center cursor-pointer"
                      onClick={() => { setWarningBannerOpen(!warningBannerOpen); }}
                    >
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${warningBannerOpen ? 'rotate-0' : '-rotate-90'}`} />
                    </button>
                  </div>
                </div>
                {warningBannerOpen && (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-40 overflow-y-auto mt-2 ml-8">
                    {source.last_sync_log}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}

          {/* VCS inventory info banner */}
          {inventory.type === 'vcs' && (
            <Card className={dynamicPlugin
              ? `${dynamicPlugin.bgClassLight} ${dynamicPlugin.borderClass}`
              : 'bg-purple-500/5 border-purple-500/20'
            }>
              <CardContent className="py-4">
                <button
                  type="button"
                  className="flex items-center gap-3 w-full text-left cursor-pointer"
                  onClick={() => { setInfoBannerOpen(!infoBannerOpen); }}
                >
                  {dynamicPlugin ? (
                    <img src={dynamicPlugin.iconPath} alt="" className="h-5 w-5 shrink-0" />
                  ) : (
                    <Info className="h-5 w-5 text-purple-500 shrink-0" />
                  )}
                  <p className={`text-sm font-medium flex-1 ${dynamicPlugin ? `${dynamicPlugin.textClass} ${dynamicPlugin.darkTextClass}` : 'text-purple-600 dark:text-purple-400'}`}>
                    {dynamicPlugin ? dynamicPlugin.label : 'VCS Inventory'}
                  </p>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${infoBannerOpen ? 'rotate-0' : '-rotate-90'}`} />
                </button>
                {infoBannerOpen && (
                  <div className="space-y-3 mt-3 pl-8">
                    <p className="text-sm text-muted-foreground">
                      {dynamicPlugin
                        ? `Hosts are automatically discovered from ${dynamicPlugin.provider === 'azure' ? 'Azure' : dynamicPlugin.provider === 'aws' ? 'AWS' : 'GCP'} and cached locally. Click "Sync from VCS" to refresh.${hasAzureOIDC && dynamicPlugin.provider === 'azure' ? ' Authenticated via OIDC Workload Identity.' : ''}`
                        : 'This inventory is loaded from a Git repository. Hosts and groups are automatically parsed from the inventory file.'
                      }
                    </p>
                    <div className="space-y-2">
                      {inventory.vcs_repository && (() => {
                        const repoUrl = getVcsRepoUrl(inventoryVcsConn?.provider ?? '', inventory.vcs_repository, inventoryVcsConn?.account_name);
                        const accentClass = dynamicPlugin ? `${dynamicPlugin.textClass} ${dynamicPlugin.darkTextClass}` : 'text-purple-600 dark:text-purple-400';
                        return (
                          <div className="flex items-center gap-2 text-sm">
                            {getVcsProviderIcon(inventoryVcsConn?.provider ?? '', 'h-4 w-4 text-muted-foreground shrink-0')}
                            <span className="text-muted-foreground">Repository:</span>
                            {repoUrl ? (
                              <a href={repoUrl} target="_blank" rel="noopener noreferrer"
                                className={`${accentClass} hover:underline font-medium flex items-center gap-1`}>
                                {inventory.vcs_repository}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="font-medium">{inventory.vcs_repository}</span>
                            )}
                          </div>
                        );
                      })()}
                      {inventory.inventory_path && (
                        <div className="flex items-center gap-2 text-sm">
                          {dynamicPlugin ? (
                            <img src={dynamicPlugin.iconPath} alt="" className="h-4 w-4 shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-muted-foreground">{dynamicPlugin ? 'Plugin:' : 'File:'}</span>
                          <a
                            href={getVcsFileUrl(inventoryVcsConn?.provider ?? '', inventory.vcs_repository || '', inventory.vcs_branch || 'main', inventory.inventory_path, inventoryVcsConn?.account_name) ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${dynamicPlugin ? `${dynamicPlugin.textClass} ${dynamicPlugin.darkTextClass}` : 'text-purple-600 dark:text-purple-400'} hover:underline font-medium flex items-center gap-1`}
                          >
                            {inventory.inventory_path}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {dynamicPlugin && hasAzureOIDC && dynamicPlugin.provider === 'azure' && (
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/30">
                            <Check className="h-3 w-3 mr-1" />
                            OIDC Workload Identity
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sync error/warning for VCS inventories */}
          {inventory.type === 'vcs' && inventory.last_sync_status === 'failed' && inventory.last_sync_error && (
            <Card className="bg-red-500/5 border-red-500/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <button
                    type="button"
                    className="flex-1 text-left cursor-pointer"
                    onClick={() => { setErrorBannerOpen(!errorBannerOpen); }}
                  >
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      Sync Failed
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => {
                        void navigator.clipboard.writeText(inventory.last_sync_error || '').then(() => {
                          toast.success('Copied to clipboard');
                        }).catch(() => {
                          toast.error('Failed to copy to clipboard');
                        });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center cursor-pointer"
                      onClick={() => { setErrorBannerOpen(!errorBannerOpen); }}
                    >
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${errorBannerOpen ? 'rotate-0' : '-rotate-90'}`} />
                    </button>
                  </div>
                </div>
                {errorBannerOpen && (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-40 overflow-y-auto mt-2 ml-8">
                    {inventory.last_sync_error}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sync log (stderr warnings) for VCS inventories */}
          {inventory.type === 'vcs' && inventory.last_sync_status === 'successful' && inventory.last_sync_log && (
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <button
                    type="button"
                    className="flex-1 text-left cursor-pointer"
                    onClick={() => { setWarningBannerOpen(!warningBannerOpen); }}
                  >
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Sync Warnings
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                      onClick={() => {
                        void navigator.clipboard.writeText(inventory.last_sync_log || '').then(() => {
                          toast.success('Copied to clipboard');
                        }).catch(() => {
                          toast.error('Failed to copy to clipboard');
                        });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center cursor-pointer"
                      onClick={() => { setWarningBannerOpen(!warningBannerOpen); }}
                    >
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${warningBannerOpen ? 'rotate-0' : '-rotate-90'}`} />
                    </button>
                  </div>
                </div>
                {warningBannerOpen && (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-40 overflow-y-auto mt-2 ml-8">
                    {inventory.last_sync_log}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          {/* Only show Add Host for static inventories */}
          {inventory.type === 'static' && (
            <div className="flex justify-end">
              <Dialog open={addHostDialogOpen} onOpenChange={setAddHostDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Host
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Host</DialogTitle>
                    <DialogDescription>
                      Add a new host to this inventory.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="host-name">Name</Label>
                      <Input
                        id="host-name"
                        placeholder="web-server-01 (auto-filled from hostname if blank)"
                        value={hostForm.name}
                        onChange={(e) => setHostForm({ ...hostForm, name: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to use hostname/IP as name
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="host-hostname">Hostname / IP *</Label>
                      <Input
                        id="host-hostname"
                        placeholder="192.168.1.100"
                        value={hostForm.hostname}
                        onChange={(e) => setHostForm({ ...hostForm, hostname: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="host-port">SSH Port</Label>
                      <Input
                        id="host-port"
                        type="number"
                        value={hostForm.port}
                        onChange={(e) => setHostForm({ ...hostForm, port: parseInt(e.target.value) || 22 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="host-description">Description</Label>
                      <Textarea
                        id="host-description"
                        placeholder="Production web server"
                        value={hostForm.description}
                        onChange={(e) => setHostForm({ ...hostForm, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddHostDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => { void handleAddHost(); }} disabled={addingHost}>
                      {addingHost && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add Host
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {hosts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">No hosts</h3>
                <p className="text-muted-foreground text-sm mb-4 text-center max-w-md">
                  {inventory.type === 'dynamic' 
                    ? 'Configure a cloud source and sync to discover hosts automatically.'
                    : inventory.type === 'vcs'
                    ? 'Hosts will appear here after the inventory file is synced from the repository.'
                    : 'Add hosts to this inventory to manage them with Ansible.'}
                </p>
                {inventory.type === 'dynamic' ? (
                  <Button onClick={() => setActiveTab('sources')}>
                    <Cloud className="h-4 w-4 mr-2" />
                    Configure Sources
                  </Button>
                ) : inventory.type === 'static' ? (
                  <Button onClick={() => setAddHostDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Host
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {hosts.map((host) => (
                <Card 
                  key={host.id} 
                  className={`group ${inventory.type === 'static' ? 'cursor-pointer hover:border-primary/50' : ''} transition-colors`}
                  onClick={() => {
                    if (inventory.type === 'static') {
                      handleEditHost(host);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                          <Server className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-base mb-1">{host.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {host.hostname || host.name}:{host.port || 22}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleHostEnabled(host);
                          }}
                          className="cursor-pointer"
                        >
                          <Badge variant={host.enabled !== false ? 'default' : 'secondary'} className="text-xs">
                            {host.enabled !== false ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </button>
                        {/* Only show edit/delete for static inventories */}
                        {inventory.type === 'static' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => { void handleEditHost(host); }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => { void handleDeleteHost(host.id); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          {inventory.type !== 'vcs' && (
            <div className="flex justify-end">
              <Dialog open={addGroupDialogOpen} onOpenChange={setAddGroupDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Group</DialogTitle>
                    <DialogDescription>
                      Add a new group to organize hosts.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="group-name">Name *</Label>
                      <Input
                        id="group-name"
                        placeholder="webservers"
                        value={groupForm.name}
                        onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="group-description">Description</Label>
                      <Textarea
                        id="group-description"
                        placeholder="Web server group"
                        value={groupForm.description}
                        onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddGroupDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => { void handleAddGroup(); }} disabled={addingGroup}>
                      {addingGroup && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add Group
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderTree className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">No groups</h3>
                <p className="text-muted-foreground text-sm mb-4 text-center">
                  {inventory.type === 'vcs' 
                    ? 'Groups will appear here after the inventory file is synced from the repository.'
                    : 'Create groups to organize hosts for targeted playbook runs.'}
                </p>
                {inventory.type !== 'vcs' && (
                  <Button onClick={() => setAddGroupDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {groups.map((group) => {
                // Find hosts that belong to this group using hostIds from relationships
                const groupHosts = group.hostIds 
                  ? hosts.filter(host => group.hostIds!.includes(host.id))
                  : [];
                
                return (
                  <Card key={group.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                            <FolderTree className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-base mb-1">{group.name}</div>
                            {group.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {group.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {inventory.type !== 'vcs' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => { void handleDeleteGroup(group.id); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      
                      {groupHosts.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Server className="h-3.5 w-3.5" />
                            <span>{groupHosts.length} host{groupHosts.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {groupHosts.map((host) => (
                              <Badge 
                                key={host.id} 
                                variant="secondary" 
                                className="text-xs font-normal px-2 py-0.5"
                              >
                                {host.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Server className="h-3.5 w-3.5" />
                          <span>No hosts</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Content Tab (for VCS inventories) */}
        {inventory.type === 'vcs' && (
          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Inventory File Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!inventory.vcs_connection_id || !inventory.vcs_repository || !inventory.inventory_path ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">No VCS Connection</h3>
                    <p className="text-muted-foreground">
                      This inventory is not connected to a VCS repository.
                    </p>
                  </div>
                ) : fileContentLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : fileContentError ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                    <h3 className="text-lg font-semibold">Failed to Load Content</h3>
                    <p className="text-muted-foreground">{fileContentError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { void loadFileContent(); }}
                      className="mt-4"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : fileContent ? (
                  <InventoryFileViewer 
                    content={fileContent}
                    maxHeight="600px"
                    showLineNumbers={true}
                    showCopyButton={true}
                    showWrapToggle={true}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Click the Content tab to load the inventory file.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Sources Tab (for dynamic inventories) */}
        {inventory.type === 'dynamic' && (
          <TabsContent value="sources" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={addSourceDialogOpen} onOpenChange={setAddSourceDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Source
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Inventory Source</DialogTitle>
                    <DialogDescription>
                      Configure a cloud provider to automatically discover hosts.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label htmlFor="source-name">Name *</Label>
                      <Input
                        id="source-name"
                        placeholder="aws-production"
                        value={sourceForm.name}
                        onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="source-description">Description</Label>
                      <Textarea
                        id="source-description"
                        placeholder="Production EC2 instances"
                        value={sourceForm.description}
                        onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="source-type">Source Type</Label>
                      <Select 
                        value={sourceForm.type} 
                        onValueChange={(value: InventorySourceType) => setSourceForm({ ...sourceForm, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select source type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aws">AWS EC2</SelectItem>
                          <SelectItem value="azure">Azure VMs</SelectItem>
                          <SelectItem value="gcp">Google Cloud Compute</SelectItem>
                          <SelectItem value="vmware">VMware vSphere</SelectItem>
                          <SelectItem value="custom">Custom Script</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Azure Auth Method Selection */}
                    {sourceForm.type === 'azure' && hasAzureOIDC && (
                      <div className="space-y-2">
                        <Label>Authentication Method</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors ${
                              azureAuthMethod === 'oidc'
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/25'
                            }`}
                            onClick={() => {
                              setAzureAuthMethod('oidc');
                              setSourceForm({ ...sourceForm, credential_id: undefined });
                            }}
                          >
                            <RefreshCw className="h-5 w-5 text-blue-500" />
                            <span className="font-medium">OIDC Workload Identity</span>
                            <span className="text-xs text-muted-foreground">Keyless, auto-rotating</span>
                          </button>
                          <button
                            type="button"
                            className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors ${
                              azureAuthMethod === 'credential'
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/25'
                            }`}
                            onClick={() => setAzureAuthMethod('credential')}
                          >
                            <FileText className="h-5 w-5 text-amber-500" />
                            <span className="font-medium">Cloud Credential</span>
                            <span className="text-xs text-muted-foreground">Client ID + secret</span>
                          </button>
                        </div>
                        {azureAuthMethod === 'oidc' && azureOIDCConfig && (
                          <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3 text-sm">
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-medium text-blue-700 dark:text-blue-300">Using OIDC Workload Identity</p>
                                <p className="text-muted-foreground mt-1">
                                  Tenant: {azureOIDCConfig.tenant_id}<br />
                                  Client: {azureOIDCConfig.client_id}<br />
                                  Subscription: {azureOIDCConfig.subscription_id}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cloud Credential (hidden when Azure OIDC is selected) */}
                    {!(sourceForm.type === 'azure' && azureAuthMethod === 'oidc') && (
                      <div className="space-y-2">
                        <Label htmlFor="source-credential">Cloud Credential</Label>
                        <Select 
                          value={sourceForm.credential_id || 'none'} 
                          onValueChange={(value) => setSourceForm({ ...sourceForm, credential_id: value === 'none' ? undefined : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select credential (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (use environment)</SelectItem>
                            {credentials
                              .filter(c => c.type === sourceForm.type || 
                                (sourceForm.type === 'aws' && c.type === 'aws') ||
                                (sourceForm.type === 'azure' && c.type === 'azure') ||
                                (sourceForm.type === 'gcp' && c.type === 'gcp') ||
                                (sourceForm.type === 'vmware' && c.type === 'vmware'))
                              .map(cred => (
                                <SelectItem key={cred.id} value={cred.id}>
                                  {cred.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select a cloud credential or leave empty to use environment variables.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="source-hostname">Hostname Variable</Label>
                      <Select 
                        value={sourceForm.hostname_var || 'public_ip'} 
                        onValueChange={(value) => setSourceForm({ ...sourceForm, hostname_var: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select hostname source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public_ip">Public IP</SelectItem>
                          <SelectItem value="private_ip">Private IP</SelectItem>
                          <SelectItem value="name">Instance Name</SelectItem>
                          <SelectItem value="dns_name">DNS Name</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label>Grouping Options</Label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="group-by-region"
                          checked={sourceForm.group_by_region}
                          onChange={(e) => setSourceForm({ ...sourceForm, group_by_region: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="group-by-region" className="text-sm">Group by region</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="group-by-az"
                          checked={sourceForm.group_by_availability_zone}
                          onChange={(e) => setSourceForm({ ...sourceForm, group_by_availability_zone: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="group-by-az" className="text-sm">Group by availability zone</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="group-by-instance-id"
                          checked={sourceForm.group_by_instance_id}
                          onChange={(e) => setSourceForm({ ...sourceForm, group_by_instance_id: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="group-by-instance-id" className="text-sm">Group by instance ID</label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="group-by-tag">Group by Tag</Label>
                      <Input
                        id="group-by-tag"
                        placeholder="Environment"
                        value={sourceForm.group_by_tag || ''}
                        onChange={(e) => setSourceForm({ ...sourceForm, group_by_tag: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Tag key to use for grouping (e.g., "Environment" creates groups like "Environment_production").
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="update-on-launch"
                        checked={sourceForm.update_on_launch}
                        onChange={(e) => setSourceForm({ ...sourceForm, update_on_launch: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="update-on-launch" className="text-sm">Update on launch (sync before each job run)</label>
                    </div>

                    {/* Sync Schedule */}
                    <div className="space-y-2 border-t pt-4">
                      <Label htmlFor="source-schedule" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Sync Schedule
                      </Label>
                      <Select
                        value={sourceForm.sync_schedule || 'none'}
                        onValueChange={(value) => setSourceForm({ ...sourceForm, sync_schedule: value === 'none' ? undefined : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No automatic sync" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No automatic sync</SelectItem>
                          <SelectItem value="*/15 * * * *">Every 15 minutes</SelectItem>
                          <SelectItem value="*/30 * * * *">Every 30 minutes</SelectItem>
                          <SelectItem value="0 * * * *">Every hour</SelectItem>
                          <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                          <SelectItem value="0 0 * * *">Daily (midnight)</SelectItem>
                          <SelectItem value="0 0 * * 1">Weekly (Monday midnight)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Automatically sync this inventory source on a schedule (cron expression).
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddSourceDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => { void handleAddSource(); }} disabled={addingSource}>
                      {addingSource && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add Source
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {sources.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Cloud className="h-12 w-12 text-cyan-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No inventory sources</h3>
                  <p className="text-muted-foreground text-sm mb-4 text-center max-w-md">
                    Add cloud sources to automatically discover and import hosts from AWS, Azure, GCP, or VMware.
                  </p>
                  <Button onClick={() => setAddSourceDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Source
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {sources.map((source) => (
                  <Card key={source.id} className="group">
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getSourceIconBg(source.type)}`}>
                          {getSourceTypeIcon(source.type)}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {source.name}
                            {source.type === 'azure' && !source.credential_id && hasAzureOIDC ? (
                              <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                <RefreshCw className="h-3 w-3 mr-1" />
                                OIDC
                              </Badge>
                            ) : source.credential_id ? (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                <FileText className="h-3 w-3 mr-1" />
                                Credential
                              </Badge>
                            ) : null}
                            {source.sync_schedule && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Scheduled
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            {source.hosts_count} hosts discovered
                            {source.last_sync_at && (
                              <>
                                <span>•</span>
                                <span>Last sync: {new Date(source.last_sync_at).toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSourceStatusBadge(source.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { void handleSyncSource(source.id); }}
                          disabled={syncingSourceId === source.id || source.status === 'syncing'}
                        >
                          {syncingSourceId === source.id || source.status === 'syncing' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-2">Sync</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleOpenEditSource(source)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { void handleDeleteSource(source.id); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                    {source.last_sync_error && source.status === 'failed' && (
                      <CardContent className="pt-0 pb-4">
                        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md relative">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <pre className="whitespace-pre-wrap font-mono text-xs flex-1 overflow-auto max-h-40">{source.last_sync_error}</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
                              onClick={() => {
                                void navigator.clipboard.writeText(source.last_sync_error || '');
                                toast.success('Copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    )}
                    {source.last_sync_log && source.status === 'successful' && (
                      <CardContent className="pt-0 pb-4">
                        <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-md relative">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <pre className="whitespace-pre-wrap font-mono text-xs flex-1 overflow-auto max-h-40">{source.last_sync_log}</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
                              onClick={() => {
                                void navigator.clipboard.writeText(source.last_sync_log || '');
                                toast.success('Copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Host Dialog */}
      <Dialog open={editHostDialogOpen} onOpenChange={setEditHostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Host</DialogTitle>
            <DialogDescription>
              Update the host configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-host-name">Name</Label>
              <Input
                id="edit-host-name"
                value={editHostForm.name}
                onChange={(e) => setEditHostForm({ ...editHostForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-host-hostname">Hostname / IP</Label>
              <Input
                id="edit-host-hostname"
                placeholder="192.168.1.100"
                value={editHostForm.hostname}
                onChange={(e) => setEditHostForm({ ...editHostForm, hostname: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-host-port">SSH Port</Label>
              <Input
                id="edit-host-port"
                type="number"
                value={editHostForm.port}
                onChange={(e) => setEditHostForm({ ...editHostForm, port: parseInt(e.target.value) || 22 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-host-description">Description</Label>
              <Textarea
                id="edit-host-description"
                placeholder="Production web server"
                value={editHostForm.description}
                onChange={(e) => setEditHostForm({ ...editHostForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-host-enabled"
                checked={editHostForm.enabled}
                onChange={(e) => setEditHostForm({ ...editHostForm, enabled: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="edit-host-enabled" className="text-sm">Host enabled</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditHostDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleUpdateHost(); }} disabled={editingHost}>
              {editingHost && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Source Dialog */}
      <Dialog open={editSourceDialogOpen} onOpenChange={setEditSourceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Inventory Source</DialogTitle>
            <DialogDescription>
              Update the source configuration and authentication method.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="edit-source-name">Name *</Label>
              <Input
                id="edit-source-name"
                value={editSourceForm.name}
                onChange={(e) => setEditSourceForm({ ...editSourceForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-source-description">Description</Label>
              <Textarea
                id="edit-source-description"
                value={editSourceForm.description}
                onChange={(e) => setEditSourceForm({ ...editSourceForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Source Type</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="uppercase text-sm py-1 px-3">
                  {editSourceForm.type}
                </Badge>
                <span className="text-xs text-muted-foreground">Source type cannot be changed after creation</span>
              </div>
            </div>

            {/* Azure Auth Method Selection */}
            {editSourceForm.type === 'azure' && hasAzureOIDC && (
              <div className="space-y-2">
                <Label>Authentication Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors ${
                      editAzureAuthMethod === 'oidc'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/25'
                    }`}
                    onClick={() => {
                      setEditAzureAuthMethod('oidc');
                      setEditSourceForm({ ...editSourceForm, credential_id: undefined });
                    }}
                  >
                    <RefreshCw className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">OIDC Workload Identity</span>
                    <span className="text-xs text-muted-foreground">Keyless, auto-rotating</span>
                  </button>
                  <button
                    type="button"
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors ${
                      editAzureAuthMethod === 'credential'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/25'
                    }`}
                    onClick={() => setEditAzureAuthMethod('credential')}
                  >
                    <FileText className="h-5 w-5 text-amber-500" />
                    <span className="font-medium">Cloud Credential</span>
                    <span className="text-xs text-muted-foreground">Client ID + secret</span>
                  </button>
                </div>
                {editAzureAuthMethod === 'oidc' && azureOIDCConfig && (
                  <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-blue-700 dark:text-blue-300">Using OIDC Workload Identity</p>
                        <p className="text-muted-foreground mt-1">
                          Tenant: {azureOIDCConfig.tenant_id}<br />
                          Client: {azureOIDCConfig.client_id}<br />
                          Subscription: {azureOIDCConfig.subscription_id}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cloud Credential (hidden when Azure OIDC is selected) */}
            {!(editSourceForm.type === 'azure' && editAzureAuthMethod === 'oidc') && (
              <div className="space-y-2">
                <Label htmlFor="edit-source-credential">Cloud Credential</Label>
                <Select
                  value={editSourceForm.credential_id || 'none'}
                  onValueChange={(value) => setEditSourceForm({ ...editSourceForm, credential_id: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select credential (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (use environment)</SelectItem>
                    {credentials
                      .filter(c => c.type === editSourceForm.type ||
                        (editSourceForm.type === 'aws' && c.type === 'aws') ||
                        (editSourceForm.type === 'azure' && c.type === 'azure') ||
                        (editSourceForm.type === 'gcp' && c.type === 'gcp') ||
                        (editSourceForm.type === 'vmware' && c.type === 'vmware'))
                      .map(cred => (
                        <SelectItem key={cred.id} value={cred.id}>
                          {cred.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-source-hostname">Hostname Variable</Label>
              <Select
                value={editSourceForm.hostname_var || 'public_ip'}
                onValueChange={(value) => setEditSourceForm({ ...editSourceForm, hostname_var: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select hostname source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public_ip">Public IP</SelectItem>
                  <SelectItem value="private_ip">Private IP</SelectItem>
                  <SelectItem value="name">Instance Name</SelectItem>
                  <SelectItem value="dns_name">DNS Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Grouping Options</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-group-by-region"
                  checked={editSourceForm.group_by_region}
                  onChange={(e) => setEditSourceForm({ ...editSourceForm, group_by_region: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="edit-group-by-region" className="text-sm">Group by region</label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-group-by-az"
                  checked={editSourceForm.group_by_availability_zone}
                  onChange={(e) => setEditSourceForm({ ...editSourceForm, group_by_availability_zone: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="edit-group-by-az" className="text-sm">Group by availability zone</label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-group-by-instance-id"
                  checked={editSourceForm.group_by_instance_id}
                  onChange={(e) => setEditSourceForm({ ...editSourceForm, group_by_instance_id: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="edit-group-by-instance-id" className="text-sm">Group by instance ID</label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-group-by-tag">Group by Tag</Label>
              <Input
                id="edit-group-by-tag"
                placeholder="Environment"
                value={editSourceForm.group_by_tag || ''}
                onChange={(e) => setEditSourceForm({ ...editSourceForm, group_by_tag: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-update-on-launch"
                checked={editSourceForm.update_on_launch}
                onChange={(e) => setEditSourceForm({ ...editSourceForm, update_on_launch: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="edit-update-on-launch" className="text-sm">Update on launch (sync before each job run)</label>
            </div>

            {/* Sync Schedule */}
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="edit-source-schedule" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Sync Schedule
              </Label>
              <Select
                value={editSourceForm.sync_schedule || 'none'}
                onValueChange={(value) => setEditSourceForm({ ...editSourceForm, sync_schedule: value === 'none' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No automatic sync" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No automatic sync</SelectItem>
                  <SelectItem value="*/15 * * * *">Every 15 minutes</SelectItem>
                  <SelectItem value="*/30 * * * *">Every 30 minutes</SelectItem>
                  <SelectItem value="0 * * * *">Every hour</SelectItem>
                  <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                  <SelectItem value="0 0 * * *">Daily (midnight)</SelectItem>
                  <SelectItem value="0 0 * * 1">Weekly (Monday midnight)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-source-enabled"
                checked={editSourceForm.enabled}
                onChange={(e) => setEditSourceForm({ ...editSourceForm, enabled: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="edit-source-enabled" className="text-sm">Source enabled</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSourceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleUpdateSource(); }} disabled={editingSource}>
              {editingSource && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
