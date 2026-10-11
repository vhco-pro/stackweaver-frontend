// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the delete confirmation: choosing Delete in a schedule's actions menu opens the
// in-app dialog and deletes nothing, cancelling deletes nothing, and the schedule is deleted
// only once the dialog's confirm button is clicked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ansibleSchedulesApi, ansibleJobTemplatesApi, ansibleWorkflowsApi } from '@/api/ansible';
import Schedules from './Schedules';

vi.mock('@/api/ansible', () => ({
  ansibleSchedulesApi: {
    list: vi.fn(),
    create: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    runNow: vi.fn(),
    delete: vi.fn(),
  },
  ansibleJobTemplatesApi: { listByOrganization: vi.fn() },
  ansibleWorkflowsApi: { list: vi.fn() },
}));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ currentOrg: { id: 'org-1', name: 'acme' } }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ canManageSchedules: true }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const schedule = {
  id: 'sched-1',
  type: 'schedules',
  attributes: {
    name: 'nightly-backup',
    'schedule-type': 'job_template',
    status: 'enabled',
    'cron-expression': '0 2 * * *',
    timezone: 'UTC',
    'run-count': 3,
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/ansible/schedules']}>
        <Routes>
          <Route path="/app/:orgName/ansible/schedules" element={<Schedules />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function chooseDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Schedule actions' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
}

describe('Schedules delete confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ansibleSchedulesApi.list).mockResolvedValue({ data: [schedule] });
    vi.mocked(ansibleJobTemplatesApi.listByOrganization).mockResolvedValue({ data: [] });
    vi.mocked(ansibleWorkflowsApi.list).mockResolvedValue({ data: [] });
    vi.mocked(ansibleSchedulesApi.delete).mockResolvedValue(undefined);
  });

  it('asks before deleting, deletes nothing on cancel, and deletes once on confirm', async () => {
    const user = userEvent.setup();
    renderPage();

    await chooseDelete(user);

    // The menu entry opens the in-app dialog and deletes nothing yet.
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete schedule "nightly-backup"?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('"nightly-backup" will be removed and will no longer run. This action cannot be undone.')
    ).toBeInTheDocument();
    expect(ansibleSchedulesApi.delete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(ansibleSchedulesApi.delete).not.toHaveBeenCalled();

    await chooseDelete(user);
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete schedule' }));

    await waitFor(() => {
      expect(ansibleSchedulesApi.delete).toHaveBeenCalledWith('sched-1');
    });
    expect(ansibleSchedulesApi.delete).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
