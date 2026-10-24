// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { accountApi } from '@/api/client';

/** The query key of the signed-in person's account resource, shared by every reader of it. */
export const ACCOUNT_DETAILS_QUERY_KEY = ['account-details'] as const;

interface UsePlatformAdminResult {
  /** TFE's `is-site-admin`: the person is a platform administrator of this installation. */
  isSiteAdmin: boolean;
  /** The administrator is declared by the deployment and cannot be removed in the UI. */
  declared: boolean;
  /**
   * TFE's `permissions.can-create-organizations`. It is false while the account resource is
   * loading, so a person who may not create never sees the button flash in, and true if the
   * resource failed to load: the API still enforces the setting on `POST /organizations`.
   */
  canCreateOrganizations: boolean;
  loading: boolean;
  isError: boolean;
}

/**
 * Whether the signed-in person is a platform administrator, read from the account resource.
 *
 * The answer is one request (`GET /account/details`), shared through React Query by every
 * component that asks, and it replaces probing an admin route for a 403. Everything it reports
 * is a hint for what the UI offers: the admin routes enforce the same rule and answer 404 to
 * anyone else.
 */
export function usePlatformAdmin(): UsePlatformAdminResult {
  const query = useQuery({
    queryKey: ACCOUNT_DETAILS_QUERY_KEY,
    queryFn: () => accountApi.details(),
    staleTime: 60_000,
  });

  const profile = query.data;
  return {
    isSiteAdmin: profile?.is_site_admin ?? false,
    declared: profile?.platform_admin_declared ?? false,
    canCreateOrganizations: profile ? profile.can_create_organizations : !query.isPending,
    loading: query.isPending,
    isError: query.isError,
  };
}
