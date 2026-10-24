// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the install-wide Organizations page: a read-only table of every organization, where a
// row the viewer is a member of links into it and every other row says "Not a member" and
// links nowhere, a search that is passed to the admin route, and the not-found state a
// non-administrator gets when the admin route answers 404.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { adminOrganizationsApi, organizationsApi, type AdminOrganization, type Organization } from '@/api/client';
import PlatformOrganizations from './PlatformOrganizations';

vi.mock('@/api/client', () => ({
  adminOrganizationsApi: { list: vi.fn() },
  organizationsApi: { list: vi.fn() },
}));

const demo: AdminOrganization = {
  name: 'demo',
  notification_email: 'ops@demo.test',
  created_at: '2026-06-01T00:00:00Z',
  member_count: 4,
  workspace_count: 6,
};
const other: AdminOrganization = { name: 'other', created_at: '2026-06-02T00:00:00Z', member_count: 1, workspace_count: 0 };
const memberOf: Organization[] = [{ id: 'demo', name: 'demo', created_at: '', updated_at: '' }];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PlatformOrganizations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlatformOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminOrganizationsApi.list).mockResolvedValue({
      data: [demo, other],
      pagination: { 'current-page': 1, 'page-size': 20, 'total-pages': 1, 'total-count': 2 },
    });
    vi.mocked(organizationsApi.list).mockResolvedValue({ data: memberOf, meta: undefined as never });
  });

  it('links the rows the viewer is a member of and says "Not a member" on the others', async () => {
    renderPage();

    const demoRow = (await screen.findByText('ops@demo.test')).closest('tr') as HTMLElement;
    await waitFor(() => {
      expect(within(demoRow).getByRole('link', { name: 'demo' })).toHaveAttribute('href', '/app/demo/workspaces');
    });
    expect(within(demoRow).getByText('4')).toBeInTheDocument();
    expect(within(demoRow).getByText('6')).toBeInTheDocument();

    const otherRow = screen.getByText('other').closest('tr') as HTMLElement;
    expect(within(otherRow).getByText('Not a member')).toBeInTheDocument();
    expect(within(otherRow).queryByRole('link')).not.toBeInTheDocument();
  });

  it('passes the search to the admin route', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('ops@demo.test');
    await user.type(screen.getByLabelText('Search organizations'), 'de');
    await waitFor(() => {
      expect(adminOrganizationsApi.list).toHaveBeenLastCalledWith({ search: 'de', page: 1, pageSize: 20 });
    });
  });

  it('shows a non-administrator the not-found state and no data', async () => {
    vi.mocked(adminOrganizationsApi.list).mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    renderPage();

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search organizations')).not.toBeInTheDocument();
    expect(organizationsApi.list).not.toHaveBeenCalled();
  });
});
