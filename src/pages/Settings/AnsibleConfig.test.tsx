// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins where the Ansible settings page keeps the organization's job retention and ad hoc module
// allowlist (#896, the same defect as the job templates list).
//
// The page used to fill the two inputs from inside a `queryFn` that returned null. The query
// cache held null, so a second mount inside the 30 second stale window fetched nothing and showed
// both inputs empty: an allowlist that reads as "use the built-in default" while the organization
// has one, one keystroke and a Save away from being overwritten.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { organizationsApi, projectsApi } from '@/api/client';
import { ansibleConfigApi } from '@/api/ansible';
import AnsibleConfiguration from './AnsibleConfig';

vi.mock('@/api/client', () => ({
  organizationsApi: { get: vi.fn(), update: vi.fn() },
  projectsApi: { list: vi.fn() },
}));

vi.mock('@/api/ansible', () => ({
  ansibleConfigApi: {
    getByOrganization: vi.fn(),
    getByProject: vi.fn(),
    upsertByOrganization: vi.fn(),
    upsertByProject: vi.fn(),
    deleteByOrganization: vi.fn(),
    deleteByProject: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Organization = Awaited<ReturnType<typeof organizationsApi.get>>;

// What the server holds; an update changes it, and the next read sees the change.
let serverOrg: Pick<Organization, 'ansible_job_retention_days' | 'ansible_adhoc_modules'>;

// The application keeps query results fresh for 30 seconds (see the QueryClient in App.tsx), so
// within that window a query that already ran answers from the cache without a new request.
const cachingClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });

function renderPage(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/settings/ansible']}>
        <Routes>
          <Route path="/app/:orgName/settings/ansible" element={<AnsibleConfiguration />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const retention = () => screen.findByLabelText('Retention (days)');
const allowlist = () => screen.findByLabelText('Allowed modules');

beforeEach(() => {
  serverOrg = { ansible_job_retention_days: 30, ansible_adhoc_modules: 'ping,setup' };
  vi.mocked(organizationsApi.get).mockImplementation(() =>
    Promise.resolve({ id: 'org-1', name: 'acme', ...serverOrg } as Organization));
  vi.mocked(organizationsApi.update).mockImplementation((_name, body) => {
    const attrs = (body as { data: { attributes: Record<string, unknown> } }).data.attributes;
    if ('ansible-job-retention-days' in attrs) {
      serverOrg.ansible_job_retention_days = attrs['ansible-job-retention-days'] as number;
    }
    if ('ansible-adhoc-modules' in attrs) {
      serverOrg.ansible_adhoc_modules = attrs['ansible-adhoc-modules'] as string;
    }
    return Promise.resolve({ id: 'org-1', name: 'acme', ...serverOrg } as Organization);
  });
  vi.mocked(projectsApi.list).mockResolvedValue({ data: [] } as unknown as Awaited<ReturnType<typeof projectsApi.list>>);
  vi.mocked(ansibleConfigApi.getByOrganization).mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
});

describe('AnsibleConfig: a return inside the stale window', () => {
  it('still shows the stored retention and allowlist, without asking for them again', async () => {
    const client = cachingClient();
    const view = renderPage(client);
    await waitFor(async () => { expect(await retention()).toHaveValue(30); });
    expect(await allowlist()).toHaveValue('ping,setup');

    view.unmount();
    renderPage(client);

    expect(await retention()).toHaveValue(30);
    expect(await allowlist()).toHaveValue('ping,setup');
    expect(organizationsApi.get).toHaveBeenCalledTimes(1);
  });

  it('shows what was saved, and not what was fetched before the save', async () => {
    const user = userEvent.setup();
    const client = cachingClient();
    const view = renderPage(client);
    await waitFor(async () => { expect(await retention()).toHaveValue(30); });

    await user.clear(await retention());
    await user.type(await retention(), '45');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]);
    await waitFor(() => {
      expect(organizationsApi.update).toHaveBeenCalledWith('acme', {
        data: { type: 'organizations', attributes: { 'ansible-job-retention-days': 45 } },
      });
    });

    await user.clear(await allowlist());
    await user.type(await allowlist(), 'ping');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]);
    await waitFor(() => {
      expect(organizationsApi.update).toHaveBeenCalledWith('acme', {
        data: { type: 'organizations', attributes: { 'ansible-adhoc-modules': 'ping' } },
      });
    });
    // Saving one field must not put the other back to what it was when the page loaded.
    expect(await retention()).toHaveValue(45);

    view.unmount();
    renderPage(client);

    expect(await retention()).toHaveValue(45);
    expect(await allowlist()).toHaveValue('ping');
  });

  it('does not let a save of one field discard an unsaved edit of the other', async () => {
    const user = userEvent.setup();
    renderPage(cachingClient());
    await waitFor(async () => { expect(await retention()).toHaveValue(30); });

    await user.clear(await allowlist());
    await user.type(await allowlist(), 'ping,setup,command');
    await user.clear(await retention());
    await user.type(await retention(), '45');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]);
    await waitFor(() => { expect(organizationsApi.update).toHaveBeenCalledTimes(1); });

    expect(await allowlist()).toHaveValue('ping,setup,command');
    expect(screen.getAllByRole('button', { name: 'Save' })[2]).toBeEnabled();
  });
});
