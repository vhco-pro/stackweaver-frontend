// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the platform-administrator probe: it is one read of the account resource, shared by
// every caller under one query key, and it reports the three platform attributes from it. Until
// the resource answers, nothing is reported as allowed, so no page flashes an action in; if the
// read fails, creation is not hidden (the API enforces the setting itself).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { accountApi, type UserProfile } from '@/api/client';
import { usePlatformAdmin } from './usePlatformAdmin';

vi.mock('@/api/client', () => ({ accountApi: { details: vi.fn() } }));

const profile = (overrides: Partial<UserProfile>): UserProfile => ({
  id: 'user-1',
  email: 'ada@example.com',
  name: 'Ada',
  username: 'ada',
  bio: '',
  company: '',
  location: '',
  created_at: '',
  updated_at: '',
  is_site_admin: false,
  platform_admin_declared: false,
  can_create_organizations: true,
  ...overrides,
});

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('usePlatformAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a declared platform administrator who may create organizations', async () => {
    vi.mocked(accountApi.details).mockResolvedValue(
      profile({ is_site_admin: true, platform_admin_declared: true, can_create_organizations: true }),
    );
    const { result } = renderHook(() => usePlatformAdmin(), { wrapper: wrapperFor(newClient()) });

    // Pending: nothing is allowed yet.
    expect(result.current.loading).toBe(true);
    expect(result.current.isSiteAdmin).toBe(false);
    expect(result.current.canCreateOrganizations).toBe(false);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current).toMatchObject({ isSiteAdmin: true, declared: true, canCreateOrganizations: true });
  });

  it('reports an ordinary user under platform-admins creation', async () => {
    vi.mocked(accountApi.details).mockResolvedValue(profile({ can_create_organizations: false }));
    const { result } = renderHook(() => usePlatformAdmin(), { wrapper: wrapperFor(newClient()) });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current).toMatchObject({ isSiteAdmin: false, declared: false, canCreateOrganizations: false });
  });

  it('shares one request between callers', async () => {
    vi.mocked(accountApi.details).mockResolvedValue(profile({ is_site_admin: true }));
    const wrapper = wrapperFor(newClient());
    const first = renderHook(() => usePlatformAdmin(), { wrapper });
    const second = renderHook(() => usePlatformAdmin(), { wrapper });

    await waitFor(() => {
      expect(first.result.current.isSiteAdmin).toBe(true);
      expect(second.result.current.isSiteAdmin).toBe(true);
    });
    expect(accountApi.details).toHaveBeenCalledTimes(1);
  });

  it('does not hide creation when the account resource fails to load', async () => {
    vi.mocked(accountApi.details).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePlatformAdmin(), { wrapper: wrapperFor(newClient()) });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.isSiteAdmin).toBe(false);
    expect(result.current.canCreateOrganizations).toBe(true);
  });
});
