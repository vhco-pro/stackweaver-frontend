// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the job page's notice for a job that ran on inventory its update-on-launch syncs did not
// refresh: one line per source, naming it, its sync's error and the hosts the job ran against,
// and nothing at all for a job whose inventory was refreshed. Also pins how the page shows the
// playbook a job ran once that playbook is deleted: the recorded name marked deleted, no link to
// it, and no relaunch.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ansibleJobsApi, ansiblePlaybooksApi } from '@/api/ansible';
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

function finishedJob(attributes: Record<string, unknown>, playbookId?: string) {
  const resource = jobResource([]);
  return {
    ...resource,
    attributes: { ...resource.attributes, ...attributes },
    relationships: {
      ...resource.relationships,
      ...(playbookId ? { playbook: { data: { id: playbookId, type: 'ansible-playbooks' } } } : {}),
    },
  };
}

/** The Playbook row of the Details tab, which the test opens first. */
async function detailsPlaybookRow() {
  await userEvent.setup().click(screen.getByRole('tab', { name: /details/i }));
  const term = await screen.findByText('Playbook', { selector: 'dt' });
  return within(term.parentElement!);
}

describe('JobDetail playbook of a job', () => {
  beforeEach(() => {
    vi.mocked(ansibleJobsApi.getEvents).mockResolvedValue({ data: [] });
    vi.mocked(ansiblePlaybooksApi.get).mockReset();
  });

  it('shows a deleted playbook by its recorded name, without a link or relaunch', async () => {
    vi.mocked(ansibleJobsApi.get).mockResolvedValue({
      data: finishedJob({ 'job-type': 'run', 'playbook-name': 'site-deploy' }),
    });

    renderPage();

    expect(await screen.findByText('site-deploy')).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'site-deploy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /relaunch/i })).toBeDisabled();
    expect(ansiblePlaybooksApi.get).not.toHaveBeenCalled();

    const row = await detailsPlaybookRow();
    expect(row.getByText('site-deploy')).toBeInTheDocument();
    expect(row.getByText('Deleted')).toBeInTheDocument();
    expect(row.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says deleted playbook for a job that recorded no name', async () => {
    vi.mocked(ansibleJobsApi.get).mockResolvedValue({ data: finishedJob({ 'job-type': 'run' }) });

    renderPage();

    expect(await screen.findByText('Deleted playbook')).toBeInTheDocument();
    const row = await detailsPlaybookRow();
    expect(row.getByText('Deleted playbook')).toBeInTheDocument();
  });

  it('does not call an ad hoc job one of a deleted playbook', async () => {
    vi.mocked(ansibleJobsApi.get).mockResolvedValue({
      data: finishedJob({ 'job-type': 'adhoc', 'playbook-name': '' }),
    });

    renderPage();

    expect(await screen.findByText('Ad hoc command')).toBeInTheDocument();
    expect(screen.queryByText(/deleted/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /relaunch/i })).toBeEnabled();
    const row = await detailsPlaybookRow();
    expect(row.getByText('Ad hoc command')).toBeInTheDocument();
  });

  it('links a playbook that still exists', async () => {
    vi.mocked(ansibleJobsApi.get).mockResolvedValue({
      data: finishedJob({ 'job-type': 'run', 'playbook-name': 'site-deploy' }, 'pb-1'),
    });
    vi.mocked(ansiblePlaybooksApi.get).mockResolvedValue({
      data: { id: 'pb-1', type: 'ansible-playbooks', attributes: { name: 'site-deploy' } },
    });

    renderPage();

    expect(await screen.findByRole('button', { name: 'site-deploy' })).toBeInTheDocument();
    expect(screen.queryByText('Deleted')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /relaunch/i })).toBeEnabled();
    const row = await detailsPlaybookRow();
    expect(row.getByRole('button', { name: 'site-deploy' })).toBeInTheDocument();
  });
});

// The Details tab names where the job ran with the standard names (one-launcher spec, AC28): a job
// on no agent pool ran on Hosted capacity, and the process that started it is its launcher.
describe('JobDetail placement', () => {
  beforeEach(() => {
    vi.mocked(ansibleJobsApi.getEvents).mockResolvedValue({ data: [] });
  });

  it('shows Hosted capacity for a job on no agent pool, and the launcher that ran it', async () => {
    vi.mocked(ansibleJobsApi.get).mockResolvedValue({
      data: finishedJob({ 'job-type': 'run', 'runner-name': 'hosted-launcher-1' }),
    });
    renderPage();
    await screen.findByText('deploy web');
    await userEvent.setup().click(screen.getByRole('tab', { name: /details/i }));
    const pool = within((await screen.findByText('Agent pool', { selector: 'dt' })).parentElement!);
    expect(pool.getByText('Hosted capacity')).toBeInTheDocument();
    const launcher = within(screen.getByText('Launcher', { selector: 'dt' }).parentElement!);
    expect(launcher.getByText('hosted-launcher-1')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/server-side|built-in runner/i);
    expect(screen.queryByText('Runner', { selector: 'dt' })).not.toBeInTheDocument();
  });
});
