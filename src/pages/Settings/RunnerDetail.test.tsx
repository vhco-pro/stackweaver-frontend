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
