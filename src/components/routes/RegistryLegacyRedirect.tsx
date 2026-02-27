// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useParams, Navigate } from 'react-router-dom';

/**
 * Redirects legacy registry routes to new /app/:orgName/registry format
 */
export function RegistryLegacyRedirect() {
  const { organizationName, moduleName, provider, providerName } = useParams<{
    organizationName?: string;
    moduleName?: string;
    provider?: string;
    providerName?: string;
  }>();

  if (!organizationName) {
    return <Navigate to="/organizations" replace />;
  }

  // Module detail route
  if (moduleName && provider) {
    return <Navigate to={`/app/${organizationName}/registry/modules/${moduleName}/${provider}`} replace />;
  }

  // Provider detail route
  if (providerName) {
    return <Navigate to={`/app/${organizationName}/registry/providers/${providerName}`} replace />;
  }

  // Default to registry list
  return <Navigate to={`/app/${organizationName}/registry`} replace />;
}

