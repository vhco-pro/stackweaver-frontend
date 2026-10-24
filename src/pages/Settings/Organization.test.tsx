// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the organization's default OpenTofu version, an organization setting on this page (the
// install-wide versions page has no organization to act on). The options are the open list of
// enabled versions without the deprecated ones, choosing one saves it through the organization
// update, and "Not set" clears it with an empty string.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { organizationsApi, terraformVersionsApi, type Organization, type TerraformVersionResource } from '@/api/client';
import OrganizationSettings from './Organization';

vi.mock('@/api/client', () => ({
  organizationsApi: { get: vi.fn(), update: vi.fn() },
  terraformVersionsApi: { listEnabled: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function version(v: string, overrides: Partial<TerraformVersionResource['attributes']> = {}): TerraformVersionResource {
  return {
    id: `tv-${v}`,
    type: 'terraform-versions',
    attributes: {
      version: v,
      url: '',
      sha: '',
      deprecated: false,
      'deprecated-reason': null,
      official: true,
      enabled: true,
      beta: false,
      usage: 0,
      'created-at': '2026-06-01T10:00:00Z',
      ...overrides,
    },
  };
}

const baseOrg: Organization = {
  id: 'acme',
  name: 'acme',
  email: 'ops@acme.test',
  collaborator_auth_policy: 'password',
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

// The stored default, as the organization resource answers it; the update changes it.
let storedDefault = '';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/settings/organization']}>
        <Routes>
          <Route path="/app/:orgName/settings/organization" element={<OrganizationSettings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const versionSelect = () => screen.getByRole('combobox', { name: 'Default OpenTofu version' });

// Radix Select drives its listbox with pointer capture and scrolls the chosen option into view;
// the DOM implementation provides neither.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

describe('Organization settings: default OpenTofu version', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedDefault = '';
    vi.mocked(organizationsApi.get).mockImplementation(() =>
      Promise.resolve({ ...baseOrg, default_terraform_version: storedDefault }),
    );
    vi.mocked(organizationsApi.update).mockImplementation((_name, body) => {
      const attrs = (body as { data: { attributes: Record<string, unknown> } }).data.attributes;
      if (typeof attrs['default-terraform-version'] === 'string') storedDefault = attrs['default-terraform-version'];
      return Promise.resolve({ ...baseOrg, default_terraform_version: storedDefault });
    });
    vi.mocked(terraformVersionsApi.listEnabled).mockResolvedValue({
      data: [version('1.9.0'), version('1.10.2'), version('1.6.0', { deprecated: true })],
    });
  });

  it('offers the enabled, non-deprecated versions newest first, sets one and clears it', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(versionSelect()).toHaveTextContent('Not set');
    });

    await user.click(versionSelect());
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Not set', '1.10.2', '1.9.0']);

    await user.click(screen.getByRole('option', { name: '1.10.2' }));
    await waitFor(() => {
      expect(organizationsApi.update).toHaveBeenCalledWith('acme', {
        data: { type: 'organizations', attributes: { 'default-terraform-version': '1.10.2' } },
      });
    });
    await waitFor(() => {
      expect(versionSelect()).toHaveTextContent('1.10.2');
    });

    await user.click(versionSelect());
    await user.click(await screen.findByRole('option', { name: 'Not set' }));
    await waitFor(() => {
      expect(organizationsApi.update).toHaveBeenLastCalledWith('acme', {
        data: { type: 'organizations', attributes: { 'default-terraform-version': '' } },
      });
    });
    await waitFor(() => {
      expect(versionSelect()).toHaveTextContent('Not set');
    });
    expect(organizationsApi.update).toHaveBeenCalledTimes(2);
  });

  it('keeps a stored default that is no longer offered selectable', async () => {
    storedDefault = '1.6.0';
    renderPage();

    await waitFor(() => {
      expect(versionSelect()).toHaveTextContent('1.6.0');
    });
  });
});
