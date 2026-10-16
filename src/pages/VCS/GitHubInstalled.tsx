// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { vcsConnectionsApi } from '@/api/client';
import { readGitHubInstallState } from '@/lib/vcs';

/**
 * The GitHub App's Setup URL: GitHub returns here after an installation. The installation is
 * not connected yet. The page hands the installation id and the state to the server, which
 * answers with GitHub's page for authorizing the App; the App's callback page
 * (GitHubAuthorized) completes the connection once GitHub confirms the person can access the
 * installation.
 */
export default function GitHubInstalled() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const processedRef = useRef(false);

  useMountEffect(() => {
    if (processedRef.current) return;
    // Once per page load, refusals included: React strict mode mounts twice in development.
    processedRef.current = true;
    const installationId = searchParams.get('installation_id') || '';
    // Passed back to the server unchanged: it continues an installation only with the state its
    // start issued to this user, for this organization.
    const state = searchParams.get('state') || '';
    const started = readGitHubInstallState(state);

    if (!installationId) {
      toast.error('Invalid GitHub installation response');
      void navigate('/', { replace: true });
      return;
    }
    // GitHub returns no state for an installation started or changed on github.com. Such an
    // installation is not tied to any organization here, so nothing is completed.
    if (!started) {
      toast.error('This GitHub installation was not started from Stackweaver. Connect GitHub from your organization\'s VCS settings to use it.');
      void navigate('/', { replace: true });
      return;
    }
    const { orgName } = started;
    const returnPath = started.returnPath ?? `/app/${orgName}/workspaces`;

    void vcsConnectionsApi.authorizeGitHubInstallation(orgName, installationId, state)
      .then((res) => {
        window.location.assign(res.auth_url);
      })
      .catch((err: unknown) => {
        console.error('Authorizing the GitHub installation failed:', err);
        toast.error(err instanceof Error && err.message ? err.message : 'Failed to continue the GitHub connection');
        void navigate(returnPath, { replace: true });
      });
  }); // navigate and searchParams are stable from react-router

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-muted-foreground">Continuing to GitHub…</div>
    </div>
  );
}
