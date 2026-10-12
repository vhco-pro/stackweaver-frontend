// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The create workspace dialog's three checkboxes, and the project it preselects.
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
  type Repository,
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

// A second installation; the dialog lists connections once per provider and account.
const otherConnection: VCSConnection = { ...githubConnection, id: 'conn-2', account_name: 'other-org' };

type ProjectStub = { id: string; name: string };

const defaultProject: ProjectStub = { id: 'proj-default', name: 'default' };
const platformProject: ProjectStub = { id: 'proj-platform', name: 'platform' };
const sandboxProject: ProjectStub = { id: 'proj-sandbox', name: 'sandbox' };

/** A repository whose only branch is its default branch. */
function repository(id: number, owner: string, name: string, defaultBranch: string): Repository {
  return {
    id,
    name,
    full_name: `${owner}/${name}`,
    description: '',
    private: false,
    default_branch: defaultBranch,
    url: '',
    clone_url: '',
    ssh_url: '',
  };
}

const networkRepo = repository(1, 'acme-org', 'network', 'main');
const legacyRepo = repository(2, 'acme-org', 'legacy', 'trunk');
const billingRepo = repository(3, 'other-org', 'billing', 'main');

/** What each connection can see. One repository unless a test asks for more. */
type RepositoriesByConnection = Record<string, Repository[]>;

function mockApi(
  connections: VCSConnection[] = [],
  projects: ProjectStub[] = [defaultProject],
  repositories: RepositoriesByConnection = { 'conn-1': [networkRepo] },
) {
  vi.mocked(projectsApi.list).mockResolvedValue({
    data: projects,
  } as Awaited<ReturnType<typeof projectsApi.list>>);
  vi.mocked(vcsConnectionsApi.list).mockResolvedValue(connections);
  vi.mocked(vcsConnectionsApi.listAllRepositories).mockImplementation(
    (connectionId) => Promise.resolve(repositories[connectionId] ?? []),
  );
  vi.mocked(vcsConnectionsApi.listBranches).mockImplementation((connectionId, owner, name) => {
    const repo = (repositories[connectionId] ?? []).find((r) => r.full_name === `${owner}/${name}`);
    return Promise.resolve(
      repo ? [{ name: repo.default_branch, commit: { sha: 'abc', url: '' }, protected: false }] : [],
    );
  });
  vi.mocked(agentPoolsApi.list).mockResolvedValue(
    { data: [] } as unknown as Awaited<ReturnType<typeof agentPoolsApi.list>>,
  );
  vi.mocked(terraformVersionsApi.listEnabled).mockResolvedValue({ data: [] });
  vi.mocked(workspacesApi.create).mockResolvedValue(
    { id: 'ws-1', name: 'network' } as Awaited<ReturnType<typeof workspacesApi.create>>,
  );
}

interface OpenOptions {
  connections?: VCSConnection[];
  projects?: ProjectStub[];
  repositories?: RepositoriesByConnection;
  /** Set by the project page, which opens the dialog for its own project. */
  projectId?: string;
  /** Shared between two renders to reach the dialog with its reference data already cached. */
  client?: QueryClient;
}

// The application keeps query results fresh for 30 seconds (see the QueryClient in App.tsx), so
// within that window a query that already ran answers from the cache without a new request.
const cachingClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });

/** Opens the dialog and waits for its reference data, without touching any control. */
async function openDialog({ connections, projects, repositories, projectId, client }: OpenOptions = {}) {
  mockApi(connections, projects, repositories);
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/acme/workspaces']}>
        <CreateWorkspaceDialog open onOpenChange={vi.fn()} orgName="acme" projectId={projectId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => {
    expect(screen.queryByText('Loading VCS connections...')).toBeNull();
  });
  return { user: userEvent.setup(), unmount: view.unmount };
}

async function pickProject(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(projectSelect());
  await user.click(await screen.findByRole('option', { name }));
}

async function setup(connections: VCSConnection[] = []) {
  const { user } = await openDialog({ connections });
  // The checkbox tests pick the project the way a user does, so they hold whatever the dialog
  // preselects. The preselection has its own tests below.
  await pickProject(user, 'default');
  return user;
}

const dialog = () => within(screen.getByRole('dialog'));
const projectSelect = () => dialog().getByRole('combobox', { name: /^Project/ });
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

// The Project select is required, so a dialog that opens without a project blocks the submit
// until the user picks one by hand. Opened from the Workspaces list the dialog has no project of
// its own and has to choose one: the project named `default`, otherwise the first.
describe('CreateWorkspaceDialog: the project is preselected', () => {
  it('preselects the project named default when opened without a project', async () => {
    // `default` is listed second, so it is chosen by name and not by position.
    const { user } = await openDialog({ projects: [platformProject, defaultProject] });

    expect(projectSelect()).toHaveTextContent('default');
    const [orgName, data] = await submit(user);

    expect(orgName).toBe('acme');
    expect(data).toMatchObject({ name: 'network', project_id: 'proj-default' });
  });

  it('preselects the first project when none is named default', async () => {
    const { user } = await openDialog({ projects: [platformProject, sandboxProject] });

    expect(projectSelect()).toHaveTextContent('platform');
    const [, data] = await submit(user);

    expect(data).toMatchObject({ project_id: 'proj-platform' });
  });

  it('keeps a project the user picked over the preselected one', async () => {
    const { user } = await openDialog({ projects: [defaultProject, platformProject] });

    await pickProject(user, 'platform');
    expect(projectSelect()).toHaveTextContent('platform');
    const [, data] = await submit(user);

    expect(data).toMatchObject({ project_id: 'proj-platform' });
  });

  it('preselects the project of the project page it was opened from', async () => {
    const { user } = await openDialog({
      projects: [defaultProject, platformProject],
      projectId: 'proj-platform',
    });

    expect(projectSelect()).toHaveTextContent('platform');
    const [, data] = await submit(user);

    expect(data).toMatchObject({ project_id: 'proj-platform' });
  });

  it('lets the user leave the project the project page preselected', async () => {
    const { user } = await openDialog({
      projects: [defaultProject, platformProject],
      projectId: 'proj-platform',
    });

    await pickProject(user, 'default');
    const [, data] = await submit(user);

    expect(data).toMatchObject({ project_id: 'proj-default' });
  });

  it('still has its projects and connections when it is mounted again while they are cached', async () => {
    // Leaving the page and coming back mounts the dialog again without a new request.
    const client = cachingClient();
    const options = { client, connections: [githubConnection], projects: [platformProject, defaultProject] };
    const first = await openDialog(options);
    expect(projectSelect()).toHaveTextContent('default');
    first.unmount();

    const { user } = await openDialog(options);

    expect(projectsApi.list).toHaveBeenCalledTimes(1);
    expect(projectSelect()).toHaveTextContent('default');
    expect(dialog().getByText('GitHub - acme-org')).toBeInTheDocument();
    const [, data] = await submit(user);

    expect(data).toMatchObject({ project_id: 'proj-default' });
  });
});

// The Branch select is required too, and its value is the repository's default branch, which
// arrives with the branch list. Going back to a repository or a connection that was already
// loaded has to show that repository's branches and that connection's repositories again.
describe('CreateWorkspaceDialog: repositories and branches follow the selection', () => {
  const branchSelect = () => dialog().getByRole('combobox', { name: /^Branch/ });

  async function pickRepository(user: ReturnType<typeof userEvent.setup>, fullName: string) {
    await user.click(await dialog().findByRole('combobox', { name: /^Repository/ }));
    await user.click(await screen.findByRole('option', { name: new RegExp(fullName) }));
  }

  async function createAndReadRequest(user: ReturnType<typeof userEvent.setup>) {
    await user.click(dialog().getByRole('button', { name: 'Create Workspace' }));
    await waitFor(() => {
      expect(workspacesApi.create).toHaveBeenCalledTimes(1);
    });
    return vi.mocked(workspacesApi.create).mock.calls[0][1];
  }

  const twoRepositories = { 'conn-1': [networkRepo, legacyRepo] };

  it('selects the default branch again when the user returns to a repository', async () => {
    const { user } = await openDialog({ connections: [githubConnection], repositories: twoRepositories });
    await user.click(dialog().getByText('GitHub - acme-org'));

    await pickRepository(user, 'acme-org/network');
    await waitFor(() => { expect(branchSelect()).toHaveTextContent('main'); });
    await pickRepository(user, 'acme-org/legacy');
    await waitFor(() => { expect(branchSelect()).toHaveTextContent('trunk'); });
    await pickRepository(user, 'acme-org/network');
    await waitFor(() => { expect(branchSelect()).toHaveTextContent('main'); });

    expect(await createAndReadRequest(user)).toMatchObject({
      vcs_repository: 'acme-org/network',
      vcs_branch: 'main',
    });
  });

  it('selects the default branch again when the branch list is answered from the cache', async () => {
    const { user } = await openDialog({
      client: cachingClient(),
      connections: [githubConnection],
      repositories: twoRepositories,
    });
    await user.click(dialog().getByText('GitHub - acme-org'));

    await pickRepository(user, 'acme-org/network');
    await waitFor(() => { expect(branchSelect()).toHaveTextContent('main'); });
    await pickRepository(user, 'acme-org/legacy');
    await waitFor(() => { expect(branchSelect()).toHaveTextContent('trunk'); });
    await pickRepository(user, 'acme-org/network');
    await waitFor(() => { expect(branchSelect()).toHaveTextContent('main'); });

    // One request per repository: the third selection did not ask again.
    expect(vcsConnectionsApi.listBranches).toHaveBeenCalledTimes(2);
    expect(await createAndReadRequest(user)).toMatchObject({
      vcs_repository: 'acme-org/network',
      vcs_branch: 'main',
    });
  });

  it('keeps a branch the user picked', async () => {
    const featureBranch = { name: 'feature', commit: { sha: 'def', url: '' }, protected: false };
    const { user } = await openDialog({ connections: [githubConnection] });
    vi.mocked(vcsConnectionsApi.listBranches).mockResolvedValue([
      { name: 'main', commit: { sha: 'abc', url: '' }, protected: false },
      featureBranch,
    ]);
    await user.click(dialog().getByText('GitHub - acme-org'));
    await pickRepository(user, 'acme-org/network');
    await waitFor(() => { expect(branchSelect()).toHaveTextContent('main'); });

    await user.click(branchSelect());
    await user.click(await screen.findByRole('option', { name: /feature/ }));

    expect(branchSelect()).toHaveTextContent('feature');
    expect(await createAndReadRequest(user)).toMatchObject({ vcs_branch: 'feature' });
  });

  it('lists the repositories of the connection the user returns to', async () => {
    const { user } = await openDialog({
      client: cachingClient(),
      connections: [githubConnection, otherConnection],
      repositories: { 'conn-1': [networkRepo], 'conn-2': [billingRepo] },
    });

    await user.click(dialog().getByText('GitHub - acme-org'));
    await pickRepository(user, 'acme-org/network');
    await user.click(dialog().getByText('GitHub - other-org'));
    await pickRepository(user, 'other-org/billing');
    await user.click(dialog().getByText('GitHub - acme-org'));

    await user.click(await dialog().findByRole('combobox', { name: /^Repository/ }));
    expect(await screen.findByRole('option', { name: /acme-org\/network/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /other-org\/billing/ })).toBeNull();
  });
});
