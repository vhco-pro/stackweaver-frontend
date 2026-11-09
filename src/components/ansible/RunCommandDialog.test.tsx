// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the standard names on the run command dialog's placement choice (one-launcher spec, B1,
// AC28): the hosted option reads "Hosted capacity", each pool is an agent pool, and the field is no
// longer called "Runner".

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ansibleAdHocApi } from '@/api/ansible';
import { agentPoolsApi } from '@/api/client';
import { RunCommandDialog } from './RunCommandDialog';

vi.mock('@/api/ansible', () => ({ ansibleAdHocApi: { listModules: vi.fn(), runCommand: vi.fn() } }));
vi.mock('@/api/client', () => ({ agentPoolsApi: { list: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const retired = /built-in runner|server-side|platform runner|platform managed|runner pool|\brunner\b/i;

describe('RunCommandDialog placement', () => {
  it('offers Hosted capacity and the organization agent pools', async () => {
    vi.mocked(ansibleAdHocApi.listModules).mockResolvedValue({ data: { attributes: { modules: ['ping'] } } });
    vi.mocked(agentPoolsApi.list).mockResolvedValue({ data: [{ id: 'pool-1', name: 'edge-pool' }] } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <RunCommandDialog open onOpenChange={vi.fn()} inventoryId="inv-1" orgName="acme" credentials={[]} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const trigger = await screen.findByRole('combobox', { name: 'Runs on' });
    expect(trigger).toHaveTextContent('Hosted capacity');
    await userEvent.setup().click(trigger);
    expect(await screen.findByRole('option', { name: 'Hosted capacity' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'edge-pool (agent pool)' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(retired);
  });
});
