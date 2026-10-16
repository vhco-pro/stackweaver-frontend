// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the job page's notice for a job that ran on inventory its update-on-launch syncs did not
// refresh: one line per source, naming it, its sync's error and the hosts the job ran against,
// and nothing at all for a job whose inventory was refreshed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ansibleJobsApi } from '@/api/ansible';
import JobDetail from './JobDetail';

vi.mock('@/api/ansible', () => ({
  ansibleJobsApi: {
    get: vi.fn(),
    getEvents: vi.fn(),
    listSliceGroup: vi.fn(),
    cancel: vi.fn(),
    relaunch: vi.fn(),
  },
  ansiblePlaybooksApi: { get: vi.fn().mockRejectedValue(new Error('not needed')) },
  ansibleInventoriesApi: { get: vi.fn().mockRejectedValue(new Error('not needed')) },
}));

// The run viewer draws the events; this test is about the page's own alerts.
vi.mock('./run-viewer/RunView', () => ({ RunView: () => null }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function jobResource(warnings: unknown[]) {
  return {
    id: 'job-1',
    type: 'ansible-jobs',
    attributes: {
      name: 'deploy web',
      status: 'successful',
      'created-at': '2026-10-16T10:00:00Z',
      'updated-at': '2026-10-16T10:05:00Z',
      'inventory-sync-warnings': warnings,
    },
    relationships: {
      project: { data: { id: 'proj-1', type: 'projects' } },
      inventory: { data: { id: 'inv-1', type: 'ansible-inventories' } },
    },
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/ansible/jobs/job-1']}>
        <Routes>
          <Route path="/app/:orgName/ansible/jobs/:jobId" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('JobDetail inventory sync warnings', () => {
  beforeEach(() => {
    vi.mocked(ansibleJobsApi.getEvents).mockResolvedValue({ data: [] });
  });

  it('names every source whose sync did not refresh the inventory', async () => {
    vi.mocked(ansibleJobsApi.get).mockResolvedValue({
      data: jobResource([
        {
          'source-id': 'src-1',
          'source-name': 'aws-prod',
          'failed-at': '2026-10-16T09:59:00Z',
          error: 'credentials expired',
          'last-successful-sync-at': '2026-10-15T08:00:00Z',
        },
        {
          'source-id': 'src-2',
          'source-name': 'azure-dev',
          'failed-at': '2026-10-16T09:59:30Z',
          error: 'plugin not found',
          'last-successful-sync-at': null,
        },
      ]),
    });

    renderPage();

    const alert = await screen.findByRole('alert', { name: /ran on inventory that was not refreshed/i });
    expect(within(alert).getByText('aws-prod')).toBeInTheDocument();
    expect(within(alert).getByText(/credentials expired/)).toBeInTheDocument();
    expect(within(alert).getByText(/last successful sync/i)).toBeInTheDocument();
    expect(within(alert).getByText('azure-dev')).toBeInTheDocument();
    expect(within(alert).getByText(/plugin not found/)).toBeInTheDocument();
    expect(within(alert).getByText(/never synced successfully/i)).toBeInTheDocument();
  });

  it('shows no notice when every source refreshed', async () => {
    vi.mocked(ansibleJobsApi.get).mockResolvedValue({ data: jobResource([]) });

    renderPage();

    expect(await screen.findByText('deploy web')).toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: /ran on inventory that was not refreshed/i })).not.toBeInTheDocument();
  });
});
