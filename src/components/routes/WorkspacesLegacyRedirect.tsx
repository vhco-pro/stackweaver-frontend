// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useParams, Navigate } from 'react-router-dom';

/**
 * Redirects legacy workspace routes to new /app/:orgName/workspaces format
 */
export function WorkspacesLegacyRedirect() {
  const { organizationName, workspaceName } = useParams<{
    organizationName?: string;
    workspaceName?: string;
  }>();

  if (!organizationName) {
    return <Navigate to="/organizations" replace />;
  }

  if (workspaceName) {
    return <Navigate to={`/app/${organizationName}/workspaces/${workspaceName}`} replace />;
  }

  return <Navigate to={`/app/${organizationName}/workspaces`} replace />;
}

