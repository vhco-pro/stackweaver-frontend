// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins bulk launcher operations: select-all and per-row selection, a bulk delete that confirms with
// the count and names before calling the per-launcher delete for each, partial-failure handling,
// and bulk label add that patches only launchers whose labels change. Also pins the standard names
// on the page and the Add a launcher dialog (one-launcher spec, B4, B5, AC26, AC29).

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

function runner(id: string, name: string, labels: string[] = [], runnerType = 'tofu'): Runner {
  return {
    id,
    name,
    labels,
    status: 'offline',
    runner_type: runnerType,
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

  it('hides bulk actions until a launcher is selected, and select-all selects every launcher', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');

    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select all launchers' }));
    expect(screen.getByText(/of 3 selected/)).toBeInTheDocument();
    for (const name of ['alpha', 'beta', 'gamma']) {
      expect(screen.getByRole('checkbox', { name: `Select launcher ${name}` })).toBeChecked();
    }

    // Select-all again clears.
    await user.click(screen.getByRole('checkbox', { name: 'Select all launchers' }));
    expect(screen.getByRole('checkbox', { name: 'Select launcher alpha' })).not.toBeChecked();
  });

  it('confirms a bulk delete with the count and deletes each selected launcher', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');

    await user.click(screen.getByRole('checkbox', { name: 'Select launcher alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select launcher gamma' }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    const dialog = screen.getByRole('dialog', { name: 'Delete 2 launchers' });
    const listed = within(within(dialog).getByRole('list', { name: 'Launchers to delete' })).getAllByRole('listitem');
    expect(listed.map((li) => li.textContent)).toEqual(['alpha', 'gamma']);
    expect(runnersApi.delete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete 2 launchers' }));
    expect(runnersApi.delete).toHaveBeenCalledTimes(2);
    expect(runnersApi.delete).toHaveBeenCalledWith('r1');
    expect(runnersApi.delete).toHaveBeenCalledWith('r3');
  });

  it('keeps only the failed launchers selected after a partial failure', async () => {
    vi.mocked(runnersApi.delete).mockImplementation((id: string) =>
      id === 'r2' ? Promise.reject(new Error('busy')) : Promise.resolve(undefined as never));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');

    await user.click(screen.getByRole('checkbox', { name: 'Select all launchers' }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: 'Delete 3 launchers' }));

    expect(await screen.findByRole('checkbox', { name: 'Select all launchers' })).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByRole('checkbox', { name: 'Select launcher beta' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select launcher alpha' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select launcher gamma' })).not.toBeChecked();
  });

  it('adds a label only to selected launchers that lack it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');

    await user.click(screen.getByRole('checkbox', { name: 'Select launcher alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select launcher beta' }));
    await user.click(screen.getByRole('button', { name: /add label/i }));
    await user.type(screen.getByLabelText('Label'), 'GPU');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /add label/i }));

    // alpha already has "gpu", so only beta is patched, keeping its other labels.
    expect(runnersApi.update).toHaveBeenCalledTimes(1);
    expect(runnersApi.update).toHaveBeenCalledWith('r2', { labels: ['gpu'] });
  });

  it('names the page, its launchers and their engines with the standard names', async () => {
    vi.mocked(runnersApi.list).mockResolvedValue({
      data: [runner('r1', 'alpha', [], 'tofu'), runner('r2', 'beta', [], 'ansible'), runner('r3', 'gamma', [], 'combined')],
    } as never);
    renderPage();
    await screen.findByText('alpha');

    expect(screen.getByRole('heading', { name: 'Launchers' })).toBeInTheDocument();
    expect(screen.getByText('Manage the launchers that start your agent pools\' OpenTofu runs and Ansible jobs')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Bulk launcher actions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete launcher alpha' })).toBeInTheDocument();
    expect(screen.getByText('OpenTofu')).toBeInTheDocument();
    expect(screen.getByText('Ansible')).toBeInTheDocument();
    expect(screen.getByText('OpenTofu and Ansible')).toBeInTheDocument();
    expect(screen.queryByText('combined')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\brunners?\b/i);
  });

  it('names the empty state with the standard names', async () => {
    vi.mocked(runnersApi.list).mockResolvedValue({ data: [] } as never);
    renderPage();
    expect(await screen.findByText('No launchers registered yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add a launcher/ }).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\brunners?\b/i);
  });

  it('adds a launcher with the pool agent token, a container command and in-process commands per engine', async () => {
    vi.mocked(agentPoolsApi.list).mockResolvedValue({ data: [{ id: 'pool-1', name: 'edge-pool' }] } as never);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('alpha');
    await user.click(screen.getByRole('button', { name: /Add a launcher/ }));

    const dialog = within(screen.getByRole('dialog', { name: 'Add a launcher' }));
    expect(dialog.getByText(/registers with an agent pool and starts that pool's jobs/)).toBeInTheDocument();

    // 1. The agent pool.
    await user.click(dialog.getByRole('combobox', { name: 'Agent pool' }));
    await user.click(await screen.findByRole('option', { name: 'edge-pool' }));

    // 2. The credential: the pool's agent token is recommended, a key with the Launcher
    // registration scope is the alternative.
    const tokens = dialog.getByRole('link', { name: 'agent token' });
    expect(tokens).toHaveAttribute('href', '/app/acme/settings/agent-pools?pool=pool-1#agent-tokens');
    expect(dialog.getByText(/Recommended/)).toBeInTheDocument();
    expect(dialog.getByText(/Launcher registration/)).toBeInTheDocument();

    // 3. The commands, pointed at the API's own origin.
    const container = dialog.getByTestId('launcher-command-container').textContent ?? '';
    expect(container).toContain('-e RUNNER_DRIVER=container');
    expect(container).toContain('-e RUNNER_AGENT_POOL_ID=pool-1');
    expect(container).toContain('-e STACKWEAVER_SERVER=http://localhost:8022');
    expect(container.trim().endsWith('ghcr.io/vhco-pro/stackweaver-launcher:latest')).toBe(true);
    const tofu = dialog.getByTestId('launcher-command-tofu').textContent ?? '';
    expect(tofu).toContain('-e STACKWEAVER_SERVER=http://localhost:8022');
    expect(tofu.trim().endsWith('ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest')).toBe(true);
    const ansible = dialog.getByTestId('launcher-command-ansible').textContent ?? '';
    expect(ansible.trim().endsWith('ghcr.io/vhco-pro/stackweaver-ansible-runner:latest')).toBe(true);
    expect(container + tofu + ansible).not.toContain('/api/v2');

    await user.click(dialog.getByRole('button', { name: 'Copy container launcher command' }));
    // userEvent stands in a clipboard of its own, so what the button wrote is read back from it.
    expect(await navigator.clipboard.readText()).toBe(container);
    expect(dialog.getByRole('button', { name: 'Copy OpenTofu in-process launcher command' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Copy Ansible in-process launcher command' })).toBeInTheDocument();
    // The job image names keep "runner" (one-launcher spec, OD3); nothing else in the dialog does.
    const dialogText = (screen.getByRole('dialog', { name: 'Add a launcher' }).textContent ?? '').replace(/stackweaver-(opentofu|ansible)-runner/g, '');
    expect(dialogText).not.toMatch(/\brunners?\b|runner:register/i);
  });
});
