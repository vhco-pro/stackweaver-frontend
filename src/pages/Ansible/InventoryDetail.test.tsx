// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins what the inventory page offers for adding hosts and groups by hand. A constructed
// inventory is derived-only: its hosts and groups come from its build, which replaces them all on
// every run, and the API refuses a host or group added to one by hand. So the page offers neither
// "Add Host" nor "Add Group" for it, in the toolbar or in the empty states, and says where its
// rows come from instead. A static inventory offers both.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ansibleInventoriesApi,
  ansibleHostsApi,
  ansibleGroupsApi,
  ansibleInventorySourcesApi,
  ansibleCredentialsApi,
} from '@/api/ansible';
import { vcsConnectionsApi, azureOIDCConfigApi } from '@/api/client';
import InventoryDetail from './InventoryDetail';

vi.mock('@/api/ansible', () => ({
  ansibleInventoriesApi: { get: vi.fn(), list: vi.fn() },
  ansibleHostsApi: { list: vi.fn() },
  ansibleGroupsApi: { list: vi.fn() },
  ansibleInventorySourcesApi: { list: vi.fn() },
  ansibleCredentialsApi: { list: vi.fn() },
}));

vi.mock('@/api/client', () => ({
  vcsConnectionsApi: { list: vi.fn() },
  azureOIDCConfigApi: { list: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type InventoryType = 'static' | 'constructed';

const page = (data: unknown[]) => ({
  data,
  meta: { pagination: { 'total-count': data.length, 'total-pages': 1 } },
});

function inventory(type: InventoryType) {
  return {
    data: {
      id: 'inv-1',
      type: 'ansible-inventories',
      attributes: {
        name: `${type}-inventory`,
        'inventory-type': type,
        ...(type === 'constructed'
          ? {
              'source-vars': "groups:\n  prod: env == 'prod'\n",
              'input-inventories': [{ id: 'inv-0', name: 'input' }],
              'last-sync-status': 'successful',
              'last-sync-at': '2026-10-16T08:00:00Z',
            }
          : {}),
      },
    },
  };
}

const host = {
  id: 'host-1',
  type: 'ansible-hosts',
  attributes: { name: 'web1', hostname: '10.0.0.5', port: 22, enabled: true },
  relationships: { groups: { data: [{ id: 'group-1', type: 'ansible-groups' }] } },
};

const group = {
  id: 'group-1',
  type: 'ansible-groups',
  attributes: { name: 'prod' },
  relationships: { hosts: { data: [{ id: 'host-1', type: 'ansible-hosts' }] } },
};

function mockInventory(type: InventoryType, withRows: boolean) {
  vi.mocked(ansibleInventoriesApi.get).mockResolvedValue(inventory(type));
  vi.mocked(ansibleHostsApi.list).mockResolvedValue(page(withRows ? [host] : []) as never);
  vi.mocked(ansibleGroupsApi.list).mockResolvedValue(page(withRows ? [group] : []) as never);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/ansible/inventories/inv-1']}>
        <Routes>
          <Route path="/app/:orgName/ansible/inventories/:inventoryId" element={<InventoryDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openGroupsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('tab', { name: /Groups/ }));
}

describe('InventoryDetail add controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ansibleInventoriesApi.list).mockResolvedValue(page([]) as never);
    vi.mocked(ansibleInventorySourcesApi.list).mockResolvedValue(page([]) as never);
    vi.mocked(ansibleCredentialsApi.list).mockResolvedValue({ data: [] });
    vi.mocked(vcsConnectionsApi.list).mockResolvedValue([] as never);
    vi.mocked(azureOIDCConfigApi.list).mockResolvedValue({ data: [] });
  });

  describe('a constructed inventory', () => {
    it('offers no Add Host or Add Group control beside its rows', async () => {
      const user = userEvent.setup();
      mockInventory('constructed', true);
      renderPage();

      expect(await screen.findByText('web1')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Add Host/ })).not.toBeInTheDocument();

      await openGroupsTab(user);
      expect(await screen.findByText('prod')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Add Group/ })).not.toBeInTheDocument();
    });

    it('says the rows come from the build where the empty states would offer to add them', async () => {
      const user = userEvent.setup();
      mockInventory('constructed', false);
      renderPage();

      expect(await screen.findByText('Hosts will appear here after the inventory is built from its inputs and rules.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Add Host/ })).not.toBeInTheDocument();

      await openGroupsTab(user);
      expect(await screen.findByText('Groups will appear here after the inventory is built from its inputs and rules.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Add Group/ })).not.toBeInTheDocument();
    });
  });

  describe('a static inventory', () => {
    it('offers Add Host and Add Group beside its rows', async () => {
      const user = userEvent.setup();
      mockInventory('static', true);
      renderPage();

      expect(await screen.findByText('web1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add Host/ })).toBeInTheDocument();

      await openGroupsTab(user);
      expect(await screen.findByText('prod')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add Group/ })).toBeInTheDocument();
    });

    it('offers Add Host and Add Group in the empty states', async () => {
      const user = userEvent.setup();
      mockInventory('static', false);
      renderPage();

      expect(await screen.findByText('Add hosts to this inventory to manage them with Ansible.')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Add Host/ }).length).toBeGreaterThan(0);

      await openGroupsTab(user);
      expect(await screen.findByText('Create groups to organize hosts for targeted playbook runs.')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Add Group/ }).length).toBeGreaterThan(0);
    });
  });
});
