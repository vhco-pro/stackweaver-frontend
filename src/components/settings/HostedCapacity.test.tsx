// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the read-only hosted capacity row (#933, AC51): counts, the cap and the group, no control
// that selects, renames, deletes or reconfigures the hosted pool, and nothing at all when the
// organization has no hosted pool.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hostedCapacityApi } from '@/api/client';
import { HostedCapacity } from './HostedCapacity';

vi.mock('@/api/client', () => ({ hostedCapacityApi: { get: vi.fn() } }));

function renderCapacity() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HostedCapacity orgName="acme" />
    </QueryClientProvider>,
  );
}

describe('HostedCapacity', () => {
  it('shows in-flight against the cap, queued, launchers online and the group, read-only', async () => {
    vi.mocked(hostedCapacityApi.get).mockResolvedValue({
      pool_id: 'p', max_concurrent_jobs: 5, placement_group: 'eu-west', in_flight: 3, queued: 2,
      launchers_online: 4, queue_reason: '',
    });
    renderCapacity();
    expect(await screen.findByText('3 of 5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('eu-west')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('says there is no limit when the cap is unlimited', async () => {
    vi.mocked(hostedCapacityApi.get).mockResolvedValue({
      pool_id: 'p', max_concurrent_jobs: 0, placement_group: 'default', in_flight: 1, queued: 0,
      launchers_online: 1, queue_reason: '',
    });
    renderCapacity();
    expect(await screen.findByText('no concurrent limit')).toBeInTheDocument();
  });

  it('renders nothing when the organization has no hosted pool', async () => {
    vi.mocked(hostedCapacityApi.get).mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    const { container } = renderCapacity();
    await waitFor(() => { expect(container.innerHTML).toBe(''); });
  });

  it('offers a retry when the read fails', { timeout: 10000 }, async () => {
    vi.mocked(hostedCapacityApi.get).mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    renderCapacity();
    expect(await screen.findByRole('button', { name: /retry/i }, { timeout: 8000 })).toBeInTheDocument();
  });
});
