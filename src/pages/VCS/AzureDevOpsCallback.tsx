// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { vcsConnectionsApi } from '@/api/client';
import { readAzureDevOpsInstallState } from '@/lib/vcs';

export default function AzureDevOpsCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processedRef = useRef(false);

  useMountEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const code = searchParams.get('code') || '';
    const state = searchParams.get('state') || '';
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Microsoft may return an error instead of a code
    if (error) {
      toast.error(`Azure DevOps authorization failed: ${errorDescription || error}`);
      void navigate('/', { replace: true });
      return;
    }

    if (!code || !state) {
      toast.error('Invalid Azure DevOps authorization response');
      void navigate('/', { replace: true });
      return;
    }

    // The state is the signed one the server issued at the start. It is passed back unchanged;
    // the organization and return path are only read out of it to know where to go next.
    const started = readAzureDevOpsInstallState(state);
    if (!started) {
      toast.error('Invalid Azure DevOps authorization state');
      void navigate('/', { replace: true });
      return;
    }
    const returnPath = started.returnPath ?? `/app/${started.orgName}/settings/vcs-connections`;

    void vcsConnectionsApi.completeAzureDevOpsInstallation(code, state)
      .then(() => {
        toast.success('Azure DevOps connected successfully');
        void navigate(returnPath, { replace: true });
      })
      .catch((err: unknown) => {
        console.error('Finalize Azure DevOps connection failed:', err);
        let message = 'Failed to finalize Azure DevOps connection';
        if (err && typeof err === 'object') {
          const e = err as { response?: { data?: { errors?: Array<{ detail?: string }> } }; message?: string };
          message = e.response?.data?.errors?.[0]?.detail || e.message || message;
        }
        toast.error(message);
        void navigate(returnPath, { replace: true });
      });
  });

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-muted-foreground">Finalizing Azure DevOps connection…</div>
    </div>
  );
}
