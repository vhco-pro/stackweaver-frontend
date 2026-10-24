// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins organization creation on the Organizations page against the account resource's
// `permissions.can-create-organizations`. When it is false (the deployment lets only platform
// administrators create organizations and this person is not one), the page offers "Create
// Organization" neither in the header nor in the empty state, and the empty state says who
// creates organizations instead. When it is true the page is unchanged. The page reads the
// permission from the account resource alone and never asks /platform/settings.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { accountApi, organizationsApi, platformSettingsApi, type Organization, type UserProfile } from '@/api/client';
import Organizations from './Organizations';

vi.mock('@/api/client', () => ({
  accountApi: { details: vi.fn() },
  organizationsApi: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
  platformSettingsApi: { get: vi.fn() },
}));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ refreshOrganizations: vi.fn(), switchOrganization: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const profile = (canCreate: boolean): UserProfile => ({
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
  can_create_organizations: canCreate,
});

const acme: Organization = { id: 'acme', name: 'acme', created_at: '', updated_at: '' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/organizations']}>
        <Organizations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SUBSTITUTE =
  'Organizations on this installation are created by a platform administrator. Ask yours to create one and add you to it.';

describe('Organizations: creation follows the account permission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides creation in the empty state and says who creates organizations when it is not allowed', async () => {
    vi.mocked(accountApi.details).mockResolvedValue(profile(false));
    vi.mocked(organizationsApi.list).mockResolvedValue({ data: [], meta: undefined as never });
    renderPage();

    expect(await screen.findByText(SUBSTITUTE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create Organization/ })).not.toBeInTheDocument();
    expect(platformSettingsApi.get).not.toHaveBeenCalled();
  });

  it('hides creation in the header when it is not allowed', async () => {
    vi.mocked(accountApi.details).mockResolvedValue(profile(false));
    vi.mocked(organizationsApi.list).mockResolvedValue({ data: [acme], meta: undefined as never });
    renderPage();

    expect(await screen.findByText('acme')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create Organization/ })).not.toBeInTheDocument();
    expect(platformSettingsApi.get).not.toHaveBeenCalled();
  });

  it('offers creation in the empty state and the header when it is allowed', async () => {
    vi.mocked(accountApi.details).mockResolvedValue(profile(true));
    vi.mocked(organizationsApi.list).mockResolvedValue({ data: [], meta: undefined as never });
    const view = renderPage();

    expect(await screen.findByText('Get started by creating your first organization.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Organization/ })).toBeInTheDocument();
    expect(screen.queryByText(SUBSTITUTE)).not.toBeInTheDocument();
    view.unmount();

    vi.mocked(organizationsApi.list).mockResolvedValue({ data: [acme], meta: undefined as never });
    renderPage();
    expect(await screen.findByText('acme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Organization/ })).toBeInTheDocument();
    expect(platformSettingsApi.get).not.toHaveBeenCalled();
  });
});
