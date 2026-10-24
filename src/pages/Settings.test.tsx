// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the Settings hub's platform section: at /settings a platform administrator sees a
// "Platform" heading with its three cards beneath the user settings, and anyone else sees no
// trace of it. The organization hub carries no "OpenTofu Versions" card for anyone, because the
// versions are install-wide and live under the platform section.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Settings from './Settings';

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

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ canManageWorkspaces: true }),
}));

// No session email, so the hub's membership and agent-pool probes stay disabled.
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: null }) }));

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/app/:orgName/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Settings hub: the platform section', () => {
  beforeEach(() => {
    platform.isSiteAdmin = false;
  });

  it('shows the Platform heading and its three cards to a platform administrator', () => {
    platform.isSiteAdmin = true;
    renderAt('/settings');

    const section = screen.getByRole('region', { name: 'Platform' });
    const links = within(section).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/settings/platform/administrators',
      '/settings/platform/terraform-versions',
      '/settings/platform/organizations',
    ]);
    expect(within(section).getByText('Platform Administrators')).toBeInTheDocument();
    expect(within(section).getByText('OpenTofu Versions')).toBeInTheDocument();
    expect(within(section).getByText('Organizations')).toBeInTheDocument();
    // The user settings are still there, above it.
    expect(screen.getByRole('link', { name: /Profile/ })).toHaveAttribute('href', '/settings/profile');
  });

  it('shows no trace of the platform section to anyone else', () => {
    renderAt('/settings');

    expect(screen.getByRole('link', { name: /Profile/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Platform' })).not.toBeInTheDocument();
    expect(screen.queryByText('Platform Administrators')).not.toBeInTheDocument();
    expect(screen.queryByText('OpenTofu Versions')).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/settings/platform/"]')).toBeNull();
  });

  it('shows no OpenTofu Versions card and no platform section on an organization hub', () => {
    platform.isSiteAdmin = true;
    renderAt('/app/acme/settings');

    expect(screen.getByRole('link', { name: /Variables/ })).toHaveAttribute('href', '/app/acme/settings/variable-sets');
    expect(screen.queryByText('OpenTofu Versions')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Platform' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href$="/terraform-versions"]')).toBeNull();
  });
});
