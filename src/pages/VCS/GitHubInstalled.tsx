// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { vcsConnectionsApi } from '@/api/client';

export default function GitHubInstalled() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const processedRef = useRef(false);

  useMountEffect(() => {
    if (processedRef.current) return;
    const installationId = searchParams.get('installation_id') || '';
    const state = searchParams.get('state') || '';
    // state = "orgName|returnPath|uuid"
    const [orgName, escapedReturn] = state.split('|');
    const returnPath = escapedReturn ? decodeURIComponent(escapedReturn) : `/app/${orgName}/workspaces`;

    if (!installationId || !orgName) {
      toast.error('Invalid GitHub installation response');
      void navigate('/', { replace: true });
      return;
    }

    // Prevent double processing in React 18 strict mode
    processedRef.current = true;

    // Finalize connection
    void vcsConnectionsApi.createConnectionFromInstallation(orgName, installationId)
      .then(() => {
        toast.success('GitHub connected successfully');
        // Check if we should reopen the workspace dialog
        const pendingDialog = localStorage.getItem('pendingWorkspaceDialog');
        if (pendingDialog) {
          try {
            const parsed = JSON.parse(pendingDialog) as { orgName: string };
            const { orgName: pendingOrg } = parsed;
            if (pendingOrg === orgName) {
              // Navigate to workspaces page with dialog flag
              void navigate(`/app/${orgName}/workspaces?openDialog=true`, { replace: true });
              return;
            }
          } catch (err) {
            console.error('Failed to parse pending dialog state:', err);
          }
        }
        void navigate(returnPath || `/app/${orgName}/workspaces`, { replace: true });
      })
      .catch((err: unknown) => {
        console.error('Finalize GitHub connection failed:', err);
        let message = 'Failed to finalize GitHub connection';
        if (err && typeof err === 'object') {
          const error = err as { response?: { data?: { errors?: Array<{ detail?: string }> } }; message?: string };
          message = error.response?.data?.errors?.[0]?.detail || error.message || message;
        }
        toast.error(message);
        void navigate(returnPath || `/app/${orgName}/workspaces`, { replace: true });
      });
  }); // navigate and searchParams are stable from react-router

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-muted-foreground">Finalizing GitHub connection…</div>
    </div>
  );
}


