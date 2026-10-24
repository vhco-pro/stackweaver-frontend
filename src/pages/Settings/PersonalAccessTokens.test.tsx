// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the platform admin token option: the create form offers the "Platform admin" checkbox to
// a platform administrator only, a token created with it is asked for with `platform_admin`,
// and the list badges the tokens that carry it.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tokensApi, type UserToken } from '@/api/client';
import PersonalAccessTokens from './PersonalAccessTokens';

const platform = vi.hoisted(() => ({ isSiteAdmin: false }));

vi.mock('@/hooks/usePlatformAdmin', () => ({
  usePlatformAdmin: () => ({
    isSiteAdmin: platform.isSiteAdmin,
    declared: false,
    canCreateOrganizations: true,
    loading: false,
    isError: false,
  }),
}));

vi.mock('@/api/client', () => ({
  tokensApi: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const adminToken: UserToken = { id: 't-1', description: 'Provider admin', created_at: '2026-10-01T00:00:00Z', platform_admin: true };
const plainToken: UserToken = { id: 't-2', description: 'Laptop CLI', created_at: '2026-10-01T00:00:00Z', platform_admin: false };

const CHECKBOX = 'Platform admin: this token may call the install-wide admin API';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PersonalAccessTokens />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PersonalAccessTokens: platform admin tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform.isSiteAdmin = false;
    vi.mocked(tokensApi.list).mockResolvedValue([adminToken, plainToken]);
  });

  it('badges only the tokens that carry the platform admin scope', async () => {
    renderPage();

    const adminCard = (await screen.findByText('Provider admin')).closest('div.rounded-2xl') as HTMLElement;
    const plainCard = screen.getByText('Laptop CLI').closest('div.rounded-2xl') as HTMLElement;
    expect(within(adminCard).getByText('Platform admin')).toBeInTheDocument();
    expect(within(plainCard).queryByText('Platform admin')).not.toBeInTheDocument();
  });

  it('offers no platform admin checkbox to anyone else', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Create Token/ }));
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.queryByLabelText(CHECKBOX)).not.toBeInTheDocument();
  });

  it('asks for a platform admin token when a platform administrator ticks the box', async () => {
    platform.isSiteAdmin = true;
    vi.mocked(tokensApi.create).mockResolvedValue({
      id: 't-3',
      token: 'tfe-secret',
      description: 'Terraform provider',
      created_at: '2026-10-24T00:00:00Z',
      platform_admin: true,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Create Token/ }));
    await user.type(screen.getByLabelText('Description'), 'Terraform provider');
    await user.click(screen.getByLabelText(CHECKBOX));
    const form = screen.getByLabelText('Description').closest('form') as HTMLFormElement;
    await user.click(within(form).getByRole('button', { name: 'Create Token' }));

    await waitFor(() => {
      expect(tokensApi.create).toHaveBeenCalledWith({ description: 'Terraform provider', platform_admin: true });
    });
  });
});
