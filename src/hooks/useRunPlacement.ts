// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { agentPoolsApi } from '@/api/client';
import { identityBindingsApi, runImagesApi, type IdentityBinding } from '@/api/runPlacement';

/** The run images of an organization, shared by every control on the page. */
export function useRunImages(orgName: string) {
  return useQuery({
    queryKey: ['runImages', orgName],
    queryFn: () => runImagesApi.list(orgName),
    enabled: !!orgName,
  });
}

/** A binding offered by one of the organization's pools, with that pool's name. */
export interface BindingOption {
  binding: IdentityBinding;
  poolName: string;
}

/** Every identity binding the organization's pools offer. */
export function useIdentityBindingOptions(orgName: string) {
  return useQuery({
    queryKey: ['identityBindingOptions', orgName],
    queryFn: async (): Promise<BindingOption[]> => {
      const pools = await agentPoolsApi.list(orgName, { pageSize: 100 });
      const lists = await Promise.all(
        pools.data.map(async pool => (await identityBindingsApi.list(pool.id)).map(binding => ({ binding, poolName: pool.name }))),
      );
      return lists.flat();
    },
    enabled: !!orgName,
  });
}

