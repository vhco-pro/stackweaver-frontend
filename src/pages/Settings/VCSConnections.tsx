// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { GitBranch, Plus, Trash2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { getVcsProviderIcon, getVcsProviderLabel } from '@/lib/vcs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { vcsConnectionsApi, organizationsApi, type VCSConnection, type Organization } from '@/api/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function VCSConnections() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connections, setConnections] = useState<VCSConnection[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>(orgName || '');
  const [loading, setLoading] = useState(true);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<VCSConnection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [adoDialogOpen, setAdoDialogOpen] = useState(false);
  const [adoOrg, setAdoOrg] = useState('');
  const [adoConnecting, setAdoConnecting] = useState(false);

  // Load organizations
  useEffect(() => {
    void organizationsApi.list()
      .then((res) => {
        const orgs = res.data || [];
        setOrganizations(orgs);
        setLoadingOrgs(false);
        
        // Check for org in URL params
        if (orgName) {
          setSelectedOrg(orgName);
        } else if (orgs.length > 0) {
          // Redirect to first org if no org in URL
          void Promise.resolve(navigate(`/app/${orgs[0].name}/settings/vcs-connections`, { replace: true }));
          setSelectedOrg(orgs[0].name);
        }
      })
      .catch((err) => {
        console.error('Failed to load organizations:', err);
        setLoadingOrgs(false);
      });
  }, [orgName, navigate]);

  const fetchConnections = useCallback(() => {
    if (!selectedOrg) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void vcsConnectionsApi.list(selectedOrg)
      .then((conns) => {
        const connections = Array.isArray(conns) ? conns : [];
        // Deduplicate by ID to prevent duplicates
        const uniqueConnections = Array.from(
          new Map(connections.map(conn => [conn.id, conn])).values()
        );
        setConnections(uniqueConnections);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load VCS connections:', err);
        toast.error('Failed to load VCS connections');
      setConnections([]);
      setLoading(false);
      });
  }, [selectedOrg]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const installationHandledRef = useRef(false);

  // Handle GitHub App redirect with installation_id
  useEffect(() => {
    const installationId = searchParams.get('installation_id');
    if (!installationId || !selectedOrg || installationHandledRef.current) return;

    installationHandledRef.current = true;
    // Create connection from installation and refresh
    void vcsConnectionsApi.createConnectionFromInstallation(selectedOrg, installationId)
      .then(() => {
        // Clean query params
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('installation_id');
        window.history.replaceState({}, '', `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`);
        // Refresh list
        fetchConnections();
        toast.success('GitHub connection established successfully');
      })
      .catch((err) => {
        console.error('Failed to create VCS connection from installation:', err);
        toast.error('Failed to create VCS connection');
      });
  }, [searchParams, selectedOrg, fetchConnections]);

  const handleConnectGitHub = async () => {
    if (!selectedOrg) {
      toast.error('Please select an organization');
      return;
    }

    try {
      const redirectUrl = `${window.location.origin}/app/${selectedOrg}/settings/vcs-connections`;
      const response = await vcsConnectionsApi.initiateInstallationWithRedirect(selectedOrg, redirectUrl);
      const installUrl = response?.install_url;
      
      if (installUrl) {
        window.location.href = installUrl;
      } else {
        toast.error('Failed to get GitHub App installation URL');
      }
    } catch (error: unknown) {
      console.error('Failed to initiate GitHub App installation:', error);
      const errorMessage = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Failed to initiate GitHub App installation';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async () => {
    if (!connectionToDelete) return;

    setDeleting(true);
    try {
      await vcsConnectionsApi.delete(connectionToDelete.id);
      toast.success('VCS connection deleted successfully');
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
      fetchConnections();
    } catch (error: unknown) {
      console.error('Failed to delete VCS connection:', error);
      // Handle v2 error format: { errors: [{ detail: "...", ... }] }
      let errorMessage = 'Failed to delete VCS connection';
      if (error && typeof error === 'object') {
        const err = error as { response?: { data?: { errors?: Array<{ detail?: string }> } }; message?: string };
        errorMessage = err.response?.data?.errors?.[0]?.detail || err.message || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleConnectAzureDevOps = async () => {
    if (!selectedOrg || !adoOrg.trim()) {
      toast.error('Please enter your Azure DevOps organization name');
      return;
    }
    setAdoConnecting(true);
    try {
      const returnPath = `/app/${selectedOrg}/settings/vcs-connections`;
      const response = await vcsConnectionsApi.initiateAzureDevOpsInstallation(selectedOrg, adoOrg.trim(), returnPath);
      const authUrl = response?.auth_url;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        toast.error('Failed to get Azure DevOps authorization URL');
        setAdoConnecting(false);
      }
    } catch (error: unknown) {
      console.error('Failed to initiate Azure DevOps installation:', error);
      const errorMessage = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Failed to initiate Azure DevOps installation';
      toast.error(errorMessage);
      setAdoConnecting(false);
    }
  };


  if (loadingOrgs) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading organizations...
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No organizations found. Please create an organization first.</p>
          <Button onClick={() => { void Promise.resolve(navigate('/organizations')); }}>
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
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
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              VCS Connections
            </h1>
            <p className="text-muted-foreground">
              Connect version control providers to enable repository access for workspaces and modules
            </p>
          </div>
          {organizations.length > 1 && (
            <div className="flex items-center gap-4">
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.name}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Connect New Provider */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Connect a Version Control Provider</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* GitHub */}
          <div className={cn(
            'group relative overflow-hidden rounded-xl border-2 p-6',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border-gray-300 dark:border-white/10',
            'transition-all duration-300',
            'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10',
            'cursor-pointer'
          )}
          onClick={() => { void handleConnectGitHub(); }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gray-800 to-gray-900">
                  {getVcsProviderIcon('github', 'h-6 w-6 text-white')}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">GitHub</h3>
                  <p className="text-sm text-muted-foreground">GitHub App</p>
                </div>
              </div>
              <CheckCircle2 className={cn(
                'h-5 w-5 transition-opacity',
                connections.some(c => c.provider === 'github') ? 'text-green-500 opacity-100' : 'opacity-0'
              )} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your GitHub account using GitHub App for secure, self-service repository access.
            </p>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {connections.some(c => c.provider === 'github') ? 'Manage Connection' : 'Connect GitHub'}
            </Button>
          </div>

          {/* Azure DevOps */}
          <div className={cn(
            'group relative overflow-hidden rounded-xl border-2 p-6',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border-gray-300 dark:border-white/10',
            'transition-all duration-300',
            'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10',
            'cursor-pointer'
          )}
          onClick={() => setAdoDialogOpen(true)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800">
                  {getVcsProviderIcon('azure_devops', 'h-6 w-6 text-white')}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Azure DevOps</h3>
                  <p className="text-sm text-muted-foreground">OAuth2 via Microsoft Entra</p>
                </div>
              </div>
              <CheckCircle2 className={cn(
                'h-5 w-5 transition-opacity',
                connections.some(c => c.provider === 'azure_devops') ? 'text-green-500 opacity-100' : 'opacity-0'
              )} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Azure DevOps organization for secure repository access to workspaces and Ansible resources.
            </p>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {connections.some(c => c.provider === 'azure_devops') ? 'Manage Connection' : 'Connect Azure DevOps'}
            </Button>
          </div>

          {/* GitLab (Coming Soon) */}
          <div className={cn(
            'group relative overflow-hidden rounded-xl border-2 p-6',
            'bg-gradient-to-br from-white/5 via-white/2 to-transparent',
            'dark:from-black/5 dark:via-black/2',
            'backdrop-blur-md border-gray-200 dark:border-white/5',
            'opacity-60 cursor-not-allowed'
          )}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
                  {getVcsProviderIcon('gitlab', 'h-6 w-6 text-white')}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">GitLab</h3>
                  <p className="text-sm text-muted-foreground">Coming Soon</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              GitLab integration will be available in a future release.
            </p>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </div>
        </div>
      </div>

      {/* Existing Connections */}
      <div className="border rounded-lg">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Connected Providers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your connected version control providers
          </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading connections...
            </div>
          </div>
        ) : connections.length === 0 ? (
          <div className="p-12 text-center">
            <GitBranch className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No VCS Connections</h3>
            <p className="text-muted-foreground mb-6">
              Connect a version control provider to get started
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getVcsProviderIcon(conn.provider, 'h-5 w-5')}
                      <span className="font-medium">{getVcsProviderLabel(conn.provider)}</span>
                    </div>
                  </TableCell>
                  <TableCell>{conn.account_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {conn.account_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setConnectionToDelete(conn);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Azure DevOps Connect Dialog */}
      <Dialog open={adoDialogOpen} onOpenChange={(open) => { setAdoDialogOpen(open); if (!open) setAdoOrg(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Azure DevOps</DialogTitle>
            <DialogDescription>
              Enter your Azure DevOps organization name to start the OAuth2 authorization flow. You will be redirected to Microsoft to authenticate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ado-org">Azure DevOps Organization Name</Label>
              <Input
                id="ado-org"
                placeholder="e.g. mycompany"
                value={adoOrg}
                onChange={(e) => setAdoOrg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { void handleConnectAzureDevOps(); } }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                The organization name from your Azure DevOps URL: dev.azure.com/<strong>{adoOrg || 'mycompany'}</strong>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdoDialogOpen(false); setAdoOrg(''); }}>
              Cancel
            </Button>
            <Button onClick={() => { void handleConnectAzureDevOps(); }} disabled={adoConnecting || !adoOrg.trim()}>
              {adoConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Authorize with Microsoft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete VCS Connection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the connection to {connectionToDelete?.provider} - {connectionToDelete?.account_name}?
              This will remove access to all repositories associated with this connection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

