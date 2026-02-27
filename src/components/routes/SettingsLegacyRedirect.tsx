// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useParams, Navigate } from 'react-router-dom';

/**
 * Redirects legacy organization settings routes to new /app/:orgName/settings format
 */
export function SettingsLegacyRedirect() {
  const { organizationName } = useParams<{ organizationName?: string }>();

  if (!organizationName) {
    return <Navigate to="/organizations" replace />;
  }

  // Redirect to organization settings (variable-sets is the default)
  return <Navigate to={`/app/${organizationName}/settings/variable-sets`} replace />;
}

