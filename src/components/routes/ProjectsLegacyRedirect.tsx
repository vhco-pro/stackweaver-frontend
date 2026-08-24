// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Navigate, useParams } from 'react-router-dom';

/**
 * Legacy `/organizations/:name` and `/organizations/:name/projects/:project` lived in the
 * pre-org-scoped shell. They now resolve to their `/app/:org/projects...` twins so old
 * bookmarks keep working (#700).
 */
export function ProjectsLegacyRedirect() {
  const { name, organizationName, projectName } = useParams<{
    name?: string;
    organizationName?: string;
    projectName?: string;
  }>();
  const org = organizationName ?? name;

  if (!org) {
    return <Navigate to="/organizations" replace />;
  }
  if (projectName) {
    return <Navigate to={`/app/${org}/projects/${projectName}`} replace />;
  }
  return <Navigate to={`/app/${org}/projects`} replace />;
}
