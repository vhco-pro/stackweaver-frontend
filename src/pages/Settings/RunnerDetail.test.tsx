// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the remote drain (#933, D11): the Drain action confirms before calling the drain endpoint,
// and a runner whose drain was requested shows the draining badge with the action disabled.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runnersApi, type Runner } from '@/api/client';
import RunnerDetail from './RunnerDetail';

vi.mock('@/api/client', () => ({
  runnersApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    drain: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function runner(overrides: Partial<Runner> = {}): Runner {
  return {
    id: 'runner-1',
    name: 'edge-launcher',
    labels: [],
    status: 'online',
    runner_type: 'tofu',
    description: '',
    last_heartbeat_at: null,
    current_jobs: 0,
    max_concurrent_jobs: 2,
    drain_requested_at: null,
    ...overrides,
  } as unknown as Runner;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/settings/runners/runner-1']}>
        <Routes>
          <Route path="/app/:orgName/settings/runners/:runnerId" element={<RunnerDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RunnerDetail drain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms, then asks the API to drain the runner', async () => {
    vi.mocked(runnersApi.get).mockResolvedValue(runner());
    vi.mocked(runnersApi.drain).mockResolvedValue(runner({ drain_requested_at: '2026-10-25T12:00:00Z' }));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /^drain$/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/finishes the jobs it is running/i)).toBeInTheDocument();
    expect(runnersApi.drain).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: /^drain$/i }));
    expect(runnersApi.drain).toHaveBeenCalledWith('runner-1');
  });

  it('shows a requested drain and disables the action', async () => {
    vi.mocked(runnersApi.get).mockResolvedValue(runner({ drain_requested_at: '2026-10-25T12:00:00Z' }));
    renderPage();

    expect(await screen.findByTestId('runner-draining')).toHaveTextContent('draining');
    expect(screen.getByRole('button', { name: /^drain$/i })).toBeDisabled();
  });
});

// The launcher detail page names its subject with the standard names (one-launcher spec, B5, AC26):
// a launcher, never a runner, and its engines in words rather than the raw runner_type.
describe('RunnerDetail standard names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('names the launcher, its engines and its dialogs', async () => {
    vi.mocked(runnersApi.get).mockResolvedValue(runner({ runner_type: 'combined', agent_version: '5.110.0' }));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('OpenTofu and Ansible')).toBeInTheDocument();
    expect(screen.queryByText('combined')).not.toBeInTheDocument();
    expect(screen.getByText('Jobs this launcher started')).toBeInTheDocument();
    expect(screen.getByText('Launcher version')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Launchers/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\brunners?\b/i);

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    let dialog = await screen.findByRole('dialog', { name: 'Edit launcher' });
    expect(within(dialog).getByText('Update the launcher description and labels')).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText('Launcher description...')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: /^drain$/i }));
    dialog = await screen.findByRole('dialog', { name: 'Drain launcher' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    dialog = await screen.findByRole('dialog', { name: 'Delete launcher' });
    expect(within(dialog).getByText(/delete the launcher "edge-launcher"/)).toBeInTheDocument();
  });

  it('labels a single-engine launcher by its engine', async () => {
    vi.mocked(runnersApi.get).mockResolvedValue(runner({ runner_type: 'ansible' }));
    renderPage();
    expect(await screen.findByText('Ansible')).toBeInTheDocument();
    expect(screen.queryByText('ansible')).not.toBeInTheDocument();
  });

  it('says the launcher was not found', async () => {
    vi.mocked(runnersApi.get).mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    renderPage();
    expect(await screen.findByText('Launcher not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Launchers' })).toBeInTheDocument();
  });
});
