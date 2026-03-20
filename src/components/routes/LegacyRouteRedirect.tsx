// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMountEffect } from '@/hooks/useMountEffect';
import { useParams } from 'react-router-dom';
import { organizationsApi } from '@/api/client';

/**
 * Redirects legacy routes to new structure.
 * Handles migrations like:
 * - /organizations/:orgName/workspaces -> /app/:orgName/workspaces
 */
interface LegacyRouteRedirectProps {
  redirectTo: (orgName: string) => string;
}

export function LegacyRouteRedirect({ redirectTo }: LegacyRouteRedirectProps) {
  const params = useParams();
  const orgName = params.organizationName || params.name;

  useMountEffect(() => {
    // If we already have an org name, redirect immediately
    if (orgName) {
      window.location.replace(redirectTo(orgName));
      return;
    }

    // Otherwise, try to load orgs and use first one
    void organizationsApi.list()
      .then((res) => {
        const orgs = res.data || [];
        if (orgs.length > 0) {
          window.location.replace(redirectTo(orgs[0].name));
        } else {
          window.location.replace('/organizations');
        }
      })
      .catch(() => {
        window.location.replace('/organizations');
      });
  });

  // Return null while redirecting
  return null;
}

