// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins bulk runner operations: select-all and per-row selection, a bulk delete that confirms with
// the count and names before calling the per-runner delete for each, partial-failure handling, and
// bulk label add that patches only runners whose labels change.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runnersApi, agentPoolsApi, type Runner } from '@/api/client';
import Runners from './Runners';

vi.mock('@/api/client', () => ({
  runnersApi: {
    list: vi.fn(),
    getStats: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  agentPoolsApi: { list: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function runner(id: string, name: string, labels: string[] = []): Runner {
  return {
    id,
    name,
    labels,
    status: 'offline',
    runner_type: 'tofu',
    description: '',
    last_heartbeat_at: null,
    current_jobs: 0,
    max_concurrent_jobs: 1,
  } as unknown as Runner;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/settings/runners']}>
        <Routes>
          <Route path="/app/:orgName/settings/runners" element={<Runners />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Runners bulk operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runnersApi.list).mockResolvedValue({
      data: [runner('r1', 'alpha', ['gpu']), runner('r2', 'beta'), runner('r3', 'gamma')],
    } as never);
    vi.mocked(runnersApi.getStats).mockResolvedValue({ total: 3, online: 0, offline: 3 });
    vi.mocked(agentPoolsApi.list).mockResolvedValue({ data: [] } as never);
    vi.mocked(runnersApi.delete).mockResolvedValue(undefined);
    vi.mocked(runnersApi.update).mockResolvedValue(undefined as never);
  });

  it('hides bulk actions until a runner is selected, and select-all selects every runner', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');

    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select all runners' }));
    expect(screen.getByText(/of 3 selected/)).toBeInTheDocument();
    for (const name of ['alpha', 'beta', 'gamma']) {
      expect(screen.getByRole('checkbox', { name: `Select runner ${name}` })).toBeChecked();
    }

    // Select-all again clears.
    await user.click(screen.getByRole('checkbox', { name: 'Select all runners' }));
    expect(screen.getByRole('checkbox', { name: 'Select runner alpha' })).not.toBeChecked();
  });

  it('confirms a bulk delete with the count and deletes each selected runner', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');

    await user.click(screen.getByRole('checkbox', { name: 'Select runner alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select runner gamma' }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    const dialog = screen.getByRole('dialog', { name: 'Delete 2 runners' });
    const listed = within(within(dialog).getByRole('list', { name: 'Runners to delete' })).getAllByRole('listitem');
    expect(listed.map((li) => li.textContent)).toEqual(['alpha', 'gamma']);
    expect(runnersApi.delete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete 2 runners' }));
    expect(runnersApi.delete).toHaveBeenCalledTimes(2);
    expect(runnersApi.delete).toHaveBeenCalledWith('r1');
    expect(runnersApi.delete).toHaveBeenCalledWith('r3');
  });

  it('keeps only the failed runners selected after a partial failure', async () => {
    vi.mocked(runnersApi.delete).mockImplementation((id: string) =>
      id === 'r2' ? Promise.reject(new Error('busy')) : Promise.resolve(undefined as never));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');

    await user.click(screen.getByRole('checkbox', { name: 'Select all runners' }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: 'Delete 3 runners' }));

    expect(await screen.findByRole('checkbox', { name: 'Select all runners' })).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByRole('checkbox', { name: 'Select runner beta' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select runner alpha' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select runner gamma' })).not.toBeChecked();
  });

  it('adds a label only to selected runners that lack it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');

    await user.click(screen.getByRole('checkbox', { name: 'Select runner alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select runner beta' }));
    await user.click(screen.getByRole('button', { name: /add label/i }));
    await user.type(screen.getByLabelText('Label'), 'GPU');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /add label/i }));

    // alpha already has "gpu", so only beta is patched, keeping its other labels.
    expect(runnersApi.update).toHaveBeenCalledTimes(1);
    expect(runnersApi.update).toHaveBeenCalledWith('r2', { labels: ['gpu'] });
  });
});
