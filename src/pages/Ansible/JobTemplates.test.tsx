// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins where the job templates page keeps what it fetched (#896).
//
// The page used to fill component state from inside its `queryFn` and return null, so the query
// cache held null and the data lived only in the instance that ran the fetch. The application
// keeps a query fresh for 30 seconds, so a second mount inside that window did not fetch, and
// rendered the initial empty arrays: "No job templates found" for an organization that has
// templates. Launch followed by the browser's Back button is the common way to get there, since
// it is a client-side move that keeps the cache.
//
// Every test below mounts the page, does something, and mounts it again on the same query
// client: what the first mount fetched or changed must be what the second one shows.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ansibleJobTemplatesApi,
  ansiblePlaybooksApi,
  ansibleInventoriesApi,
  ansibleCredentialsApi,
  ansibleJobsApi,
  type AnsiblePlaybook,
} from '@/api/ansible';
import { agentPoolsApi } from '@/api/client';
import type { PlaybookSelection } from '@/components/ansible/playbook-selection';
import type { JsonApiResource } from '@/utils/jsonapi';
import JobTemplates from './JobTemplates';

vi.mock('@/api/ansible', () => ({
  ansibleJobTemplatesApi: {
    listByOrganization: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    launch: vi.fn(),
  },
  ansiblePlaybooksApi: { listByOrganization: vi.fn() },
  ansibleInventoriesApi: { list: vi.fn() },
  ansibleCredentialsApi: { list: vi.fn() },
  ansibleJobsApi: { listByOrganization: vi.fn() },
}));

vi.mock('@/api/client', () => ({ agentPoolsApi: { list: vi.fn() } }));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ currentOrg: { id: 'org-1', name: 'acme' } }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ canManageJobTemplates: true, canExecuteJobs: true }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The real picker walks VCS connections and repositories. Here it only has to show which
// playbooks the page handed it, and let one be chosen.
vi.mock('@/components/ansible/PlaybookSourcePicker', () => ({
  PlaybookSourcePicker: ({
    playbooks,
    onChange,
  }: {
    playbooks: AnsiblePlaybook[];
    onChange: (selection: PlaybookSelection) => void;
  }) => (
    <div data-testid="playbook-picker">
      {playbooks.map((playbook) => (
        <button
          key={playbook.id}
          type="button"
          onClick={() => { onChange({ kind: 'registered', playbookId: playbook.id }); }}
        >
          {playbook.name}
        </button>
      ))}
    </div>
  ),
}));

const template = (id: string, name: string, enabled = true): JsonApiResource => ({
  id,
  type: 'ansible-job-templates',
  attributes: { name, enabled, verbosity: 0, forks: 5 },
  relationships: {
    playbook: { data: { id: 'pb-1', type: 'ansible-playbooks' } },
    inventory: { data: { id: 'inv-1', type: 'ansible-inventories' } },
  },
});

const job = (id: string, templateId: string, status: string): JsonApiResource => ({
  id,
  type: 'ansible-jobs',
  attributes: { status, 'created-at': new Date().toISOString() },
  relationships: { template: { data: { id: templateId, type: 'ansible-job-templates' } } },
});

const named = (id: string, type: string, name: string): JsonApiResource => ({ id, type, attributes: { name } });

// What the server holds. The list mocks read these, so a test that changes the server's state
// (a launch adds a job) sees it in the next request and in none before it.
let serverTemplates: JsonApiResource[];
let serverJobs: JsonApiResource[];

// The application keeps query results fresh for 30 seconds (see the QueryClient in App.tsx), so
// within that window a query that already ran answers from the cache without a new request.
const cachingClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });

function JobPage() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Job page</h1>
      <button type="button" onClick={() => { void navigate(-1); }}>Back</button>
    </div>
  );
}

function renderPage(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/ansible/job-templates']}>
        <Routes>
          <Route path="/app/:orgName/ansible/job-templates" element={<JobTemplates />} />
          <Route path="/app/:orgName/ansible/jobs/:jobId" element={<JobPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Unmounts the page and mounts it again on the same client: a return inside the stale window. */
async function remount(view: ReturnType<typeof render>, client: QueryClient) {
  view.unmount();
  const next = renderPage(client);
  // Whatever the page shows, it has settled once the header is there and the spinner is not.
  await screen.findByRole('heading', { name: 'Job Templates' });
  return next;
}

/** The card of one template: the element that holds its name and its buttons. */
async function card(name: string) {
  const title = await screen.findByText(name);
  const element = title.closest('[class*="cursor-pointer"]');
  if (!(element instanceof HTMLElement)) throw new Error(`no card around "${name}"`);
  return within(element);
}

/**
 * The trigger of the select that currently shows the given text. The dialog's selects carry no
 * accessible name (their labels point at ids no element has), so the shown value finds them.
 */
function selectShowing(scope: { getAllByRole: (role: string) => HTMLElement[] }, text: string) {
  const trigger = scope.getAllByRole('combobox').find((element) => element.textContent?.trim() === text);
  if (!trigger) throw new Error(`no select showing "${text}"`);
  return trigger;
}

async function chooseAction(user: ReturnType<typeof userEvent.setup>, templateName: string, action: string) {
  await user.click((await card(templateName)).getByRole('button', { name: 'Job template actions' }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
}

// Radix Select drives its listbox with pointer capture and scrolls the chosen option into view;
// the test DOM implements neither.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  serverTemplates = [template('tpl-1', 'deploy-web'), template('tpl-2', 'patch-fleet')];
  serverJobs = [job('job-1', 'tpl-1', 'successful')];
  vi.mocked(ansibleJobTemplatesApi.listByOrganization).mockImplementation(() =>
    Promise.resolve({ data: [...serverTemplates] }));
  vi.mocked(ansibleJobsApi.listByOrganization).mockImplementation(() =>
    Promise.resolve({ data: [...serverJobs] }));
  vi.mocked(ansiblePlaybooksApi.listByOrganization).mockResolvedValue({
    data: [named('pb-1', 'ansible-playbooks', 'site.yml')],
  });
  vi.mocked(ansibleInventoriesApi.list).mockResolvedValue({
    data: [named('inv-1', 'ansible-inventories', 'production')],
  });
  vi.mocked(ansibleCredentialsApi.list).mockResolvedValue({
    data: [named('cred-1', 'ansible-credentials', 'deploy-key')],
  });
  vi.mocked(agentPoolsApi.list).mockResolvedValue({
    data: [{
      id: 'pool-1', name: 'edge-pool', organization_scoped: true, agent_count: 1, created_at: '',
      allowed_workspace_ids: [], allowed_project_ids: [], excluded_workspace_ids: [],
    }],
    meta: { pagination: { 'current-page': 1, 'page-size': 20, 'total-count': 1 } },
  });
});

describe('JobTemplates: a return inside the stale window', () => {
  it('still lists the templates and their last run, without asking for them again', async () => {
    const client = cachingClient();
    const view = renderPage(client);
    expect((await card('deploy-web')).getByText('successful')).toBeInTheDocument();

    await remount(view, client);

    expect(screen.queryByText('No job templates found')).toBeNull();
    expect(screen.getByText('deploy-web')).toBeInTheDocument();
    expect(screen.getByText('patch-fleet')).toBeInTheDocument();
    expect((await card('deploy-web')).getByText('successful')).toBeInTheDocument();
    expect((await card('patch-fleet')).getByText('Never run')).toBeInTheDocument();
    expect(ansibleJobTemplatesApi.listByOrganization).toHaveBeenCalledTimes(1);
    expect(ansibleJobsApi.listByOrganization).toHaveBeenCalledTimes(1);
  });

  it('lists the templates after a launch and the Back button, with the launched job as the last run', async () => {
    const user = userEvent.setup();
    const client = cachingClient();
    // The template's own page is cached too, and a launch makes its "Recent Jobs" out of date.
    client.setQueryData(['jobTemplateDetail', 'tpl-2', 'acme'], { relatedJobs: [] });
    client.setQueryData(['jobTemplateDetail', 'tpl-1', 'acme'], { relatedJobs: [] });
    vi.mocked(ansibleJobTemplatesApi.launch).mockImplementation(() => {
      serverJobs = [job('job-2', 'tpl-2', 'pending'), ...serverJobs];
      return Promise.resolve({ data: serverJobs[0] });
    });
    renderPage(client);

    await user.click((await card('patch-fleet')).getByRole('button', { name: 'Launch' }));
    await screen.findByRole('heading', { name: 'Job page' });
    expect(ansibleJobTemplatesApi.launch).toHaveBeenCalledWith('tpl-2');

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect((await card('patch-fleet')).getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('deploy-web')).toBeInTheDocument();
    expect(screen.queryByText('No job templates found')).toBeNull();
    // The launched template's page must fetch again when it is next opened; the other one is
    // none of this launch's business.
    expect(client.getQueryState(['jobTemplateDetail', 'tpl-2', 'acme'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['jobTemplateDetail', 'tpl-1', 'acme'])?.isInvalidated).toBe(false);
  });

  it('shows the job of a background launch, and still shows it after a return', async () => {
    const user = userEvent.setup();
    const client = cachingClient();
    client.setQueryData(['jobTemplateDetail', 'tpl-2', 'acme'], { relatedJobs: [] });
    vi.mocked(ansibleJobTemplatesApi.launch).mockImplementation(() => {
      serverJobs = [job('job-2', 'tpl-2', 'running'), ...serverJobs];
      return Promise.resolve({ data: serverJobs[0] });
    });
    const view = renderPage(client);

    await chooseAction(user, 'patch-fleet', 'Background Launch');

    await waitFor(async () => {
      expect((await card('patch-fleet')).getByText('running')).toBeInTheDocument();
    });
    expect(client.getQueryState(['jobTemplateDetail', 'tpl-2', 'acme'])?.isInvalidated).toBe(true);

    await remount(view, client);

    expect((await card('patch-fleet')).getByText('running')).toBeInTheDocument();
    expect((await card('deploy-web')).getByText('successful')).toBeInTheDocument();
  });

  it('keeps a template disabled from its menu disabled', async () => {
    const user = userEvent.setup();
    const client = cachingClient();
    vi.mocked(ansibleJobTemplatesApi.update).mockResolvedValue({ data: template('tpl-1', 'deploy-web', false) });
    const view = renderPage(client);

    await chooseAction(user, 'deploy-web', 'Disable');

    await waitFor(async () => {
      expect((await card('deploy-web')).getByText('Disabled')).toBeInTheDocument();
    });
    expect(ansibleJobTemplatesApi.update).toHaveBeenCalledWith('tpl-1', { enabled: false });

    await remount(view, client);

    expect((await card('deploy-web')).getByText('Disabled')).toBeInTheDocument();
    expect((await card('patch-fleet')).queryByText('Disabled')).toBeNull();
    expect(ansibleJobTemplatesApi.listByOrganization).toHaveBeenCalledTimes(1);
  });

  it('keeps a deleted template gone and the others listed', async () => {
    const user = userEvent.setup();
    const client = cachingClient();
    vi.mocked(ansibleJobTemplatesApi.delete).mockResolvedValue(undefined);
    const view = renderPage(client);

    await chooseAction(user, 'deploy-web', 'Delete');
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('deploy-web')).toBeNull();
    });
    expect(ansibleJobTemplatesApi.delete).toHaveBeenCalledWith('tpl-1');
    expect(screen.getByText('patch-fleet')).toBeInTheDocument();

    await remount(view, client);

    expect(screen.getByText('patch-fleet')).toBeInTheDocument();
    expect(screen.queryByText('deploy-web')).toBeNull();
    expect(ansibleJobTemplatesApi.listByOrganization).toHaveBeenCalledTimes(1);
  });

  it('keeps a created template listed', async () => {
    const user = userEvent.setup();
    const client = cachingClient();
    vi.mocked(ansibleJobTemplatesApi.create).mockResolvedValue({ data: template('tpl-3', 'rotate-certs') });
    const view = renderPage(client);

    await user.click(await screen.findByRole('button', { name: 'New Job Template' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Name *'), 'rotate-certs');
    await user.click(await dialog.findByRole('button', { name: 'site.yml' }));
    await user.click(selectShowing(dialog, 'Select an inventory'));
    await user.click(await screen.findByRole('option', { name: 'production' }));
    await user.click(dialog.getByRole('button', { name: 'Create Template' }));

    await waitFor(() => {
      expect(ansibleJobTemplatesApi.create).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(ansibleJobTemplatesApi.create).mock.calls[0]).toEqual([
      'acme',
      expect.objectContaining({ name: 'rotate-certs', playbook_id: 'pb-1', inventory_id: 'inv-1' }),
    ]);
    expect(await screen.findByText('rotate-certs')).toBeInTheDocument();

    await remount(view, client);

    expect(screen.getByText('rotate-certs')).toBeInTheDocument();
    expect(screen.getByText('deploy-web')).toBeInTheDocument();
    expect(screen.getByText('patch-fleet')).toBeInTheDocument();
    expect(ansibleJobTemplatesApi.listByOrganization).toHaveBeenCalledTimes(1);
  });

  it('fills the create dialog pickers again, without asking for their options again', async () => {
    const user = userEvent.setup();
    const client = cachingClient();
    const view = renderPage(client);

    await user.click(await screen.findByRole('button', { name: 'New Job Template' }));
    await within(await screen.findByRole('dialog')).findByRole('button', { name: 'site.yml' });

    await remount(view, client);
    await user.click(await screen.findByRole('button', { name: 'New Job Template' }));
    const dialog = within(await screen.findByRole('dialog'));

    expect(await dialog.findByRole('button', { name: 'site.yml' })).toBeInTheDocument();
    // Each select is opened and its option chosen, which also closes it for the next one. The
    // credential and agent pool selects start on their "none" entry, so that is what they show.
    await user.click(selectShowing(dialog, 'Select an inventory'));
    await user.click(await screen.findByRole('option', { name: 'production' }));
    await user.click(selectShowing(dialog, 'None'));
    await user.click(await screen.findByRole('option', { name: 'deploy-key' }));
    await user.click(selectShowing(dialog, 'Default (built-in runner)'));
    expect(await screen.findByRole('option', { name: 'edge-pool' })).toBeInTheDocument();

    expect(ansiblePlaybooksApi.listByOrganization).toHaveBeenCalledTimes(1);
    expect(ansibleInventoriesApi.list).toHaveBeenCalledTimes(1);
    expect(ansibleCredentialsApi.list).toHaveBeenCalledTimes(1);
    expect(agentPoolsApi.list).toHaveBeenCalledTimes(1);
  });
});
