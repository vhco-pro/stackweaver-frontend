// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, CheckCircle2, Plus, ExternalLink } from 'lucide-react';
import { getVcsProviderIcon } from '@/lib/vcs';

function AzureDevOpsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 10.204L2.753 6.678l8.094-3.29V.78l6.986 5.124L2.789 8.985v7.67L0 10.204zm24 3.098l-3 3.294-8.094 3.29v2.614L5.906 17.38l13.044-2.182V7.529L24 13.302z" />
    </svg>
  );
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { vcsConnectionsApi } from '@/api/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface VCSProviderSelectorProps {
  orgName: string;
  selectedConnectionId?: string;
  onConnectionSelect: (connectionId: string | null) => void;
  showConfigureOption?: boolean;
}

export function VCSProviderSelector({
  orgName,
  selectedConnectionId,
  onConnectionSelect,
  showConfigureOption = true,
}: VCSProviderSelectorProps) {
  const navigate = useNavigate();
  const [adoOrg, setAdoOrg] = useState('');
  const [adoConnecting, setAdoConnecting] = useState(false);
  const [showAdoInput, setShowAdoInput] = useState(false);

  const { data: connections = [], isLoading: loading } = useQuery({
    queryKey: ['vcs-connections', orgName],
    queryFn: async () => {
      const conns = await vcsConnectionsApi.list(orgName);
      return conns || [];
    },
  });

  const handleConnectGitHub = async () => {
    try {
      const redirectUrl = window.location.href;
      const response = await vcsConnectionsApi.initiateInstallationWithRedirect(orgName, redirectUrl);
      const installUrl = response?.install_url;
      
      if (installUrl) {
        window.location.href = installUrl;
      } else {
        toast.error('Failed to get GitHub App installation URL');
      }
    } catch (error: unknown) {
      console.error('Failed to initiate GitHub App installation:', error);
      const message = error instanceof Error ? error.message : 'Failed to initiate GitHub App installation';
      toast.error(message);
    }
  };

  const handleConnectAzureDevOps = async () => {
    if (!adoOrg.trim()) {
      toast.error('Please enter your Azure DevOps organization name');
      return;
    }
    setAdoConnecting(true);
    try {
      const returnPath = window.location.pathname + window.location.search;
      const response = await vcsConnectionsApi.initiateAzureDevOpsInstallation(orgName, adoOrg.trim(), returnPath);
      const authUrl = response?.auth_url;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        toast.error('Failed to get Azure DevOps authorization URL');
        setAdoConnecting(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to initiate Azure DevOps installation';
      toast.error(message);
      setAdoConnecting(false);
    }
  };

  const handleConfigure = () => {
    void navigate(`/app/${orgName}/settings/vcs-connections`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const githubConnections = connections.filter(c => c.provider === 'github');
  const adoConnections = connections.filter(c => c.provider === 'azure_devops');
  const hasGitHubConnection = githubConnections.length > 0;
  const hasADOConnection = adoConnections.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Connect to a version control provider</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose the version control provider that hosts your configuration.
        </p>
      </div>

      {/* GitHub Option */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl border-2 p-4 cursor-pointer transition-all duration-200',
          selectedConnectionId && githubConnections.some(c => c.id === selectedConnectionId)
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
            : 'border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/30',
          'bg-white dark:bg-white/5'
        )}
        onClick={() => {
          if (hasGitHubConnection && githubConnections.length === 1) {
            onConnectionSelect(githubConnections[0].id);
          } else if (hasGitHubConnection) {
            // If multiple, let user select from dropdown
            onConnectionSelect(selectedConnectionId === githubConnections[0].id ? null : githubConnections[0].id);
          }
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg mt-0.5',
              'bg-gradient-to-br from-gray-800 to-gray-900'
            )}>
              {getVcsProviderIcon('github', 'h-5 w-5 text-white')}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">GitHub</h4>
                {hasGitHubConnection && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                GitHub App
              </p>
              {hasGitHubConnection && githubConnections.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Connected: {githubConnections[0].account_name} ({githubConnections[0].account_type})
                </div>
              )}
            </div>
          </div>
          {selectedConnectionId && githubConnections.some(c => c.id === selectedConnectionId) && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
              <CheckCircle2 className="h-3 w-3" />
            </div>
          )}
        </div>
        {!hasGitHubConnection && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                void handleConnectGitHub();
              }}
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-2" />
              Connect GitHub
            </Button>
          </div>
        )}
      </div>

      {/* Azure DevOps Option */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl border-2 p-4 cursor-pointer transition-all duration-200',
          selectedConnectionId && adoConnections.some(c => c.id === selectedConnectionId)
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
            : 'border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/30',
          'bg-white dark:bg-white/5'
        )}
        onClick={() => {
          if (hasADOConnection && adoConnections.length === 1) {
            onConnectionSelect(adoConnections[0].id);
          } else if (hasADOConnection) {
            onConnectionSelect(selectedConnectionId === adoConnections[0].id ? null : adoConnections[0].id);
          } else {
            setShowAdoInput(!showAdoInput);
          }
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg mt-0.5',
              'bg-gradient-to-br from-blue-600 to-blue-800'
            )}>
              <AzureDevOpsIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">Azure DevOps</h4>
                {hasADOConnection && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                OAuth2 via Microsoft Entra
              </p>
              {hasADOConnection && adoConnections.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Connected: {adoConnections[0].account_name} ({adoConnections[0].account_type})
                </div>
              )}
            </div>
          </div>
          {selectedConnectionId && adoConnections.some(c => c.id === selectedConnectionId) && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
              <CheckCircle2 className="h-3 w-3" />
            </div>
          )}
        </div>
        {!hasADOConnection && showAdoInput && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10 space-y-2" onClick={e => e.stopPropagation()}>
            <Label htmlFor="ado-org-selector" className="text-xs">Azure DevOps Organization Name</Label>
            <Input
              id="ado-org-selector"
              placeholder="e.g. mycompany"
              value={adoOrg}
              onChange={(e) => setAdoOrg(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { void handleConnectAzureDevOps(); } }}
              className="h-8 text-xs"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { void handleConnectAzureDevOps(); }}
              disabled={adoConnecting || !adoOrg.trim()}
              className="w-full"
            >
              {adoConnecting ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Plus className="h-3 w-3 mr-2" />}
              Authorize with Microsoft
            </Button>
          </div>
        )}
        {!hasADOConnection && !showAdoInput && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setShowAdoInput(true);
              }}
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-2" />
              Connect Azure DevOps
            </Button>
          </div>
        )}
      </div>

      {/* GitLab (Coming Soon) */}
      <div className={cn(
        'group relative overflow-hidden rounded-xl border-2 p-4',
        'border-gray-200 dark:border-white/5',
        'bg-white/50 dark:bg-white/2',
        'opacity-60 cursor-not-allowed'
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg mt-0.5 bg-gradient-to-br from-orange-500 to-red-500">
              <GitBranch className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">GitLab</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Coming Soon
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Configure Link */}
      {showConfigureOption && (
        <div className="pt-2 border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => { handleConfigure(); }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Connect to a different VCS
          </button>
        </div>
      )}
    </div>
  );
}

