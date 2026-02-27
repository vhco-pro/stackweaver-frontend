// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { runsApi, workspacesApi, organizationsApi } from '@/api/client';
import { getRunWorkspaceId } from '@/utils/jsonapi';
import { Loader2 } from 'lucide-react';

/**
 * Redirects from /runs/:id to /app/:org/:workspace/runs/:id
 * Fetches the run to get workspace info, then fetches workspace to get org/workspace names
 */
export default function RunRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      void Promise.resolve(navigate('/workspaces'));
      return;
    }

    // Fetch run to get workspace_id
    void runsApi.get(id)
      .then(async (runResponse) => {
        const workspaceId = getRunWorkspaceId(runResponse.data);
        if (!workspaceId) {
          void Promise.resolve(navigate('/workspaces'));
          return;
        }

        try {
          // Fetch workspace to get name and project_id
          // Note: We need to find which organization this workspace belongs to
          // For now, try to get workspace by ID (if API supports it) or list all workspaces
          // Since we have workspace_id, we need to find the workspace
          // The workspace API might require org name, so we'll need to search
          
          // Try to get workspace - we might need to list all orgs and search
          const orgs = await organizationsApi.list();
          
          for (const org of orgs.data) {
            try {
              const workspaces = await workspacesApi.list(org.name);
              const workspace = workspaces.data.find(w => w.id === workspaceId);
              
              if (workspace) {
                // Found it! Redirect to run detail page
                void Promise.resolve(navigate(`/app/${org.name}/workspaces/${workspace.name}/runs/${id}`, { replace: true }));
                return;
              }
            } catch {
              // Continue searching
              continue;
            }
          }
          
          // If not found, redirect to workspaces
          void Promise.resolve(navigate('/workspaces'));
        } catch (err) {
          console.error('Failed to fetch workspace:', err);
          void Promise.resolve(navigate('/workspaces'));
        }
      })
      .catch((err) => {
        console.error('Failed to fetch run:', err);
        setError(true);
        // Redirect to workspaces after a delay
        setTimeout(() => { void Promise.resolve(navigate('/workspaces')); }, 2000);
      });
  }, [id, navigate]);

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Run not found. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}

