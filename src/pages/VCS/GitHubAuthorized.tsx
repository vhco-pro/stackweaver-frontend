// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { vcsConnectionsApi } from '@/api/client';
import { readGitHubAuthorizeState } from '@/lib/vcs';

/**
 * The GitHub App's callback URL: GitHub returns here after a person authorizes the App, with a
 * code and the state the server issued. The page hands both to the server unchanged, which
 * connects the installation the state names only if that person can access it at GitHub.
 */
export default function GitHubAuthorized() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const processedRef = useRef(false);

  useMountEffect(() => {
    if (processedRef.current) return;
    // Once per page load: React strict mode mounts twice in development, and a code is single-use.
    processedRef.current = true;
    const code = searchParams.get('code') || '';
    const state = searchParams.get('state') || '';
    const authorized = readGitHubAuthorizeState(state);

    if (!authorized) {
      toast.error('This GitHub authorization was not started from Stackweaver. Connect GitHub from your organization\'s VCS settings.');
      void navigate('/', { replace: true });
      return;
    }
    const { orgName, installationId } = authorized;
    const returnPath = authorized.returnPath ?? `/app/${orgName}/workspaces`;

    // GitHub returns an error instead of a code when the person declines the authorization.
    if (!code) {
      const declined = searchParams.get('error_description') || searchParams.get('error');
      toast.error(declined ? `GitHub authorization was not granted: ${declined}` : 'GitHub returned no authorization');
      void navigate(returnPath, { replace: true });
      return;
    }

    void vcsConnectionsApi.createConnectionFromInstallation(orgName, installationId, code, state)
      .then(() => {
        toast.success('GitHub connected successfully');
        // Reopen the workspace dialog the connection was started from, if any.
        const pendingDialog = localStorage.getItem('pendingWorkspaceDialog');
        if (pendingDialog) {
          try {
            const parsed = JSON.parse(pendingDialog) as { orgName: string };
            if (parsed.orgName === orgName) {
              void navigate(`/app/${orgName}/workspaces?openDialog=true`, { replace: true });
              return;
            }
          } catch (err) {
            console.error('Failed to parse pending dialog state:', err);
          }
        }
        void navigate(returnPath, { replace: true });
      })
      .catch((err: unknown) => {
        console.error('Finalize GitHub connection failed:', err);
        toast.error(err instanceof Error && err.message ? err.message : 'Failed to finalize GitHub connection');
        void navigate(returnPath, { replace: true });
      });
  }); // navigate and searchParams are stable from react-router

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-muted-foreground">Finalizing GitHub connection…</div>
    </div>
  );
}
