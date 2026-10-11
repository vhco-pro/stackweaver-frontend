// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the delete confirmation: clicking a version's delete button opens the in-app dialog
// and deletes nothing, cancelling deletes nothing, and the version is deleted only once the
// dialog's confirm button is clicked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { adminTerraformVersionsApi, organizationsApi, type TerraformVersionResource } from '@/api/client';
import TofuVersions from './TofuVersions';

vi.mock('@/api/client', () => ({
  adminTerraformVersionsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  organizationsApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const customVersion: TerraformVersionResource = {
  id: 'tv-custom',
  type: 'terraform-versions',
  attributes: {
    version: '1.99.0',
    url: 'https://example.com/tofu_1.99.0_linux_amd64.zip',
    sha: '',
    deprecated: false,
    'deprecated-reason': null,
    official: false,
    enabled: true,
    beta: false,
    usage: 0,
    'created-at': '2026-06-01T10:00:00Z',
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/settings/tofu-versions']}>
        <Routes>
          <Route path="/app/:orgName/settings/tofu-versions" element={<TofuVersions />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TofuVersions delete confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminTerraformVersionsApi.list).mockResolvedValue({
      data: [customVersion],
      meta: { pagination: { 'current-page': 1, 'page-size': 20, 'total-pages': 1, 'total-count': 1 } },
    });
    vi.mocked(adminTerraformVersionsApi.delete).mockResolvedValue(undefined);
    vi.mocked(organizationsApi.get).mockResolvedValue({ default_terraform_version: '' } as never);
  });

  it('asks before deleting, deletes nothing on cancel, and deletes once on confirm', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete OpenTofu 1.99.0' }));

    // The click opens the in-app dialog and deletes nothing yet.
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete OpenTofu 1.99.0?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('OpenTofu 1.99.0 will no longer be available to workspaces. You can add it again later.')
    ).toBeInTheDocument();
    expect(adminTerraformVersionsApi.delete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(adminTerraformVersionsApi.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete OpenTofu 1.99.0' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete version' }));

    await waitFor(() => {
      expect(adminTerraformVersionsApi.delete).toHaveBeenCalledWith('tv-custom');
    });
    expect(adminTerraformVersionsApi.delete).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
