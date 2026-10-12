// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The create workspace dialog's three checkboxes.
//
// "Allow destroy plans" decides whether destroy runs can be queued on the workspace. It is on by
// default, as it is in Terraform Enterprise, and an unchecked box has to reach the API as false:
// the dialog navigates straight to the new workspace, so a value lost on the way would show up
// only when a destroy run is refused or, worse, accepted.
//
// The auto-apply and auto-queue-runs rows are the same Checkbox primitive as the new row, so all
// three are reachable by role and name, and both still submit their values.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  workspacesApi,
  vcsConnectionsApi,
  projectsApi,
  agentPoolsApi,
  terraformVersionsApi,
  type VCSConnection,
} from '@/api/client';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';

vi.mock('@/api/client', () => ({
  workspacesApi: { create: vi.fn() },
  vcsConnectionsApi: {
    list: vi.fn(),
    listAllRepositories: vi.fn(),
    listBranches: vi.fn(),
    listProjects: vi.fn(),
  },
  projectsApi: { list: vi.fn() },
  agentPoolsApi: { list: vi.fn() },
  terraformVersionsApi: { listEnabled: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const githubConnection: VCSConnection = {
  id: 'conn-1',
  organization_id: 'org-1',
  provider: 'github',
  account_name: 'acme-org',
  account_type: 'organization',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function mockApi(connections: VCSConnection[] = []) {
  vi.mocked(projectsApi.list).mockResolvedValue({
    data: [{ id: 'proj-default', name: 'default' }],
  } as Awaited<ReturnType<typeof projectsApi.list>>);
  vi.mocked(vcsConnectionsApi.list).mockResolvedValue(connections);
  vi.mocked(vcsConnectionsApi.listAllRepositories).mockResolvedValue([
    {
      id: 1,
      name: 'network',
      full_name: 'acme-org/network',
      description: '',
      private: false,
      default_branch: 'main',
      url: '',
      clone_url: '',
      ssh_url: '',
    },
  ]);
  vi.mocked(vcsConnectionsApi.listBranches).mockResolvedValue([
    { name: 'main', commit: { sha: 'abc', url: '' }, protected: false },
  ]);
  vi.mocked(agentPoolsApi.list).mockResolvedValue(
    { data: [] } as unknown as Awaited<ReturnType<typeof agentPoolsApi.list>>,
  );
  vi.mocked(terraformVersionsApi.listEnabled).mockResolvedValue({ data: [] });
  vi.mocked(workspacesApi.create).mockResolvedValue(
    { id: 'ws-1', name: 'network' } as Awaited<ReturnType<typeof workspacesApi.create>>,
  );
}

async function setup(connections: VCSConnection[] = []) {
  mockApi(connections);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/workspaces']}>
        <CreateWorkspaceDialog open onOpenChange={vi.fn()} orgName="acme" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => {
    expect(screen.queryByText('Loading VCS connections...')).toBeNull();
  });
  // A workspace needs a project, and the tests pick it the way a user does rather than rely on
  // the dialog having preselected one.
  const user = userEvent.setup();
  await user.click(dialog().getByRole('combobox', { name: /^Project/ }));
  await user.click(await screen.findByRole('option', { name: 'default' }));
  return user;
}

const dialog = () => within(screen.getByRole('dialog'));
const allowDestroyPlans = () => dialog().getByRole('checkbox', { name: 'Allow destroy plans' });
const autoApply = () => dialog().getByRole('checkbox', { name: 'Automatically apply successful plans' });
const autoQueueRuns = () => dialog().getByRole('checkbox', { name: 'Automatically queue runs on VCS push' });

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(dialog().getByRole('textbox', { name: /^Name/ }), 'network');
  await user.click(dialog().getByRole('button', { name: 'Create Workspace' }));
  await waitFor(() => {
    expect(workspacesApi.create).toHaveBeenCalledTimes(1);
  });
  return vi.mocked(workspacesApi.create).mock.calls[0];
}

// Radix Select drives its listbox with pointer capture and scrolls the chosen option into view;
// jsdom implements neither.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('CreateWorkspaceDialog: Allow destroy plans (AC9)', () => {
  it('shows the checkbox checked by default', async () => {
    await setup();

    expect(allowDestroyPlans()).toBeChecked();
  });

  it('creates the workspace with allow_destroy_plan true when the box is left checked', async () => {
    const user = await setup();

    const [orgName, data] = await submit(user);

    expect(orgName).toBe('acme');
    expect(data).toMatchObject({ name: 'network', project_id: 'proj-default', allow_destroy_plan: true });
  });

  it('creates the workspace with allow_destroy_plan false when the box is unchecked', async () => {
    const user = await setup();

    await user.click(allowDestroyPlans());
    expect(allowDestroyPlans()).not.toBeChecked();
    const [, data] = await submit(user);

    expect(data).toMatchObject({ allow_destroy_plan: false });
  });

  it('toggles from its label, like the rows beside it', async () => {
    const user = await setup();

    await user.click(dialog().getByText('Allow destroy plans'));

    expect(allowDestroyPlans()).not.toBeChecked();
  });
});

describe('CreateWorkspaceDialog: the rows beside it are the same checkbox (AC11)', () => {
  // The shared Checkbox primitive renders a button that carries its state in data-state; a raw
  // <input type="checkbox"> has the role too, so the role alone would not tell them apart.
  const expectSharedCheckbox = (box: HTMLElement) => {
    expect(box.tagName).toBe('BUTTON');
    expect(box).toHaveAttribute('data-state');
  };

  it('renders all three rows with the shared Checkbox primitive', async () => {
    const user = await setup([githubConnection]);
    await user.click(dialog().getByText('GitHub - acme-org'));

    expectSharedCheckbox(allowDestroyPlans());
    expectSharedCheckbox(autoApply());
    expectSharedCheckbox(autoQueueRuns());
  });

  it('reaches auto-apply by role and submits it off by default', async () => {
    const user = await setup();

    expect(autoApply()).not.toBeChecked();
    const [, data] = await submit(user);

    expect(data).toMatchObject({ auto_apply: false });
    // With no VCS connection the workspace cannot queue runs from a push, so the value is not sent.
    expect(data.auto_queue_runs).toBeUndefined();
  });

  it('submits auto-apply on when it is checked', async () => {
    const user = await setup();

    await user.click(autoApply());
    expect(autoApply()).toBeChecked();
    const [, data] = await submit(user);

    expect(data).toMatchObject({ auto_apply: true, allow_destroy_plan: true });
  });

  it('shows auto-queue-runs only once a VCS connection is selected', async () => {
    const user = await setup([githubConnection]);

    expect(dialog().queryByRole('checkbox', { name: 'Automatically queue runs on VCS push' })).toBeNull();

    await user.click(dialog().getByText('GitHub - acme-org'));

    expect(autoQueueRuns()).not.toBeChecked();
  });

  it('submits auto-queue-runs with a VCS connection, repository and branch selected', async () => {
    const user = await setup([githubConnection]);

    await user.click(dialog().getByText('GitHub - acme-org'));
    await user.click(await dialog().findByRole('combobox', { name: /^Repository/ }));
    await user.click(await screen.findByRole('option', { name: /acme-org\/network/ }));
    // The repository's default branch is selected once the branch list loads.
    await waitFor(() => {
      expect(dialog().getByRole('combobox', { name: /^Branch/ })).toHaveTextContent('main');
    });

    await user.click(autoQueueRuns());
    expect(autoQueueRuns()).toBeChecked();
    await user.click(dialog().getByRole('button', { name: 'Create Workspace' }));

    await waitFor(() => {
      expect(workspacesApi.create).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(workspacesApi.create).mock.calls[0][1]).toMatchObject({
      // The name is filled in from the repository the user picked.
      name: 'network',
      vcs_connection_id: 'conn-1',
      vcs_repository: 'acme-org/network',
      vcs_branch: 'main',
      auto_queue_runs: true,
      auto_apply: false,
      allow_destroy_plan: true,
    });
  });
});
