// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the Platform Administrators page: the list of administrators with the declared one
// badged and offered no remove action, the add dialog that looks one account up by its exact
// email address (saying so when no account has it, and never offering a search), removal behind
// the in-app confirmation, the read-only deployment settings panel, and the not-found state a
// non-administrator gets, with no data, when the admin route answers 404.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { adminUsersApi, platformSettingsApi, type AdminUser } from '@/api/client';
import PlatformAdministrators from './PlatformAdministrators';

vi.mock('@/api/client', () => ({
  accountApi: { details: vi.fn() },
  adminUsersApi: {
    lookupAdmins: vi.fn(),
    lookupByEmail: vi.fn(),
    grantAdmin: vi.fn(),
    revokeAdmin: vi.fn(),
  },
  platformSettingsApi: { get: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const declared: AdminUser = {
  id: 'user-root',
  username: 'admin@stackweaver.local',
  email: 'admin@stackweaver.local',
  name: 'Root Admin',
  is_admin: true,
  platform_admin_declared: true,
};

const granted: AdminUser = {
  id: 'user-ada',
  username: 'ada',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  is_admin: true,
  platform_admin_declared: false,
};

const grace: AdminUser = {
  id: 'user-grace',
  username: 'grace',
  email: 'grace@example.com',
  name: 'Grace Hopper',
  is_admin: false,
  platform_admin_declared: false,
};

function renderPage() {
  // The page retries a failed load (never a 404); no delay between attempts here.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/settings/platform/administrators']}>
        <PlatformAdministrators />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pagination = { 'current-page': 1, 'page-size': 100, 'total-pages': 1, 'total-count': 2 };

// Radix menus use pointer capture and scroll the focused item into view.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

describe('PlatformAdministrators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminUsersApi.lookupAdmins).mockResolvedValue({ data: [declared, granted], pagination });
    vi.mocked(platformSettingsApi.get).mockResolvedValue({ organization_creation: 'platform-admins' });
  });

  it('badges the declared administrator and offers it no remove action', async () => {
    renderPage();

    const list = await screen.findByRole('list', { name: 'Platform administrators' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    const [declaredRow, grantedRow] = rows;
    expect(within(declaredRow).getByText('Root Admin')).toBeInTheDocument();
    expect(within(declaredRow).getByText('Declared by the deployment')).toBeInTheDocument();
    expect(within(declaredRow).queryByRole('button')).not.toBeInTheDocument();

    expect(within(grantedRow).queryByText('Declared by the deployment')).not.toBeInTheDocument();
    expect(within(grantedRow).getByRole('button', { name: 'Actions for ada@example.com' })).toBeInTheDocument();

    expect(adminUsersApi.lookupAdmins).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
  });

  it('shows the deployment settings panel with the organization-creation value and the guide link', async () => {
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Deployment settings' });
    expect(await within(panel).findByTestId('organization-creation-value')).toHaveTextContent('Platform administrators only');
    expect(within(panel).getByText(/Declared administrators are set in the deployment configuration/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Platform administration guide/ })).toHaveAttribute(
      'href',
      '/docs/user-guides/platform-administration',
    );
  });

  it('says no account has the address on an empty lookup, grants nothing and offers no search', async () => {
    vi.mocked(adminUsersApi.lookupByEmail).mockResolvedValue(null);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Add administrator' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email address'), 'nobody@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Add administrator' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No account has this email address');
    expect(adminUsersApi.lookupByEmail).toHaveBeenCalledWith('nobody@example.com');
    expect(adminUsersApi.grantAdmin).not.toHaveBeenCalled();
    // An exact lookup only: no suggestions, no list of accounts.
    expect(within(dialog).queryByRole('listbox')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('grants the account the exact lookup found and lists it', async () => {
    vi.mocked(adminUsersApi.lookupByEmail).mockResolvedValue(grace);
    vi.mocked(adminUsersApi.grantAdmin).mockResolvedValue({ ...grace, is_admin: true });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Add administrator' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email address'), 'grace@example.com');
    vi.mocked(adminUsersApi.lookupAdmins).mockResolvedValue({
      data: [declared, granted, { ...grace, is_admin: true }],
      pagination: { ...pagination, 'total-count': 3 },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add administrator' }));

    await waitFor(() => {
      expect(adminUsersApi.grantAdmin).toHaveBeenCalledWith('user-grace');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
  });

  it('removes a granted administrator only after the confirmation', async () => {
    vi.mocked(adminUsersApi.revokeAdmin).mockResolvedValue({ ...granted, is_admin: false });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Actions for ada@example.com' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove administrator' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Remove administrator?')).toBeInTheDocument();
    expect(adminUsersApi.revokeAdmin).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Remove administrator' }));
    await waitFor(() => {
      expect(adminUsersApi.revokeAdmin).toHaveBeenCalledWith('user-ada');
    });
    expect(adminUsersApi.revokeAdmin).toHaveBeenCalledTimes(1);
  });

  it('shows a non-administrator the not-found state and no data', async () => {
    vi.mocked(adminUsersApi.lookupAdmins).mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    renderPage();

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Platform administrators' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add administrator' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Deployment settings' })).not.toBeInTheDocument();
    expect(platformSettingsApi.get).not.toHaveBeenCalled();
    expect(adminUsersApi.lookupAdmins).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the list fails to load', async () => {
    vi.mocked(adminUsersApi.lookupAdmins).mockRejectedValue(Object.assign(new Error('server down'), { status: 500 }));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('server down')).toBeInTheDocument();
    vi.mocked(adminUsersApi.lookupAdmins).mockResolvedValue({ data: [declared, granted], pagination });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });
});
