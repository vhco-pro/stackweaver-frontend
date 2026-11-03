// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { organizationsApi, registryApi, type Module, type Organization } from '@/api/client';
import Registry from './Registry';

vi.mock('@/api/client', () => ({
  organizationsApi: { list: vi.fn() },
  registryApi: { modules: { list: vi.fn() } },
}));

// Keep the test at the page boundary: opening the real publishing dialog would
// introduce unrelated VCS requests. Observe its organization without writing.
vi.mock('@/components/registry/CreateModuleDialog', () => ({
  CreateModuleDialog: ({ open, orgName }: { open: boolean; orgName: string }) => open
    ? <div role="dialog" aria-label="Create module">Create for {orgName}</div>
    : null,
}));

const organization = (name: string): Organization => ({ id: name, name, created_at: '', updated_at: '' });
const organizations = [organization('bravo'), organization('alpha')];
const responseFor = (data = organizations): Awaited<ReturnType<typeof organizationsApi.list>> => ({
  data,
  meta: { pagination: { 'current-page': 1, 'page-size': 20, 'total-pages': 1, 'total-count': data.length } },
});
const moduleFor = (orgName: string): Module => ({
  id: `${orgName}-module`, organization_id: orgName, name: `${orgName}-module`, provider: 'aws',
  verified: false, auto_publish_tags: false, created_at: '', updated_at: '',
});
const clients: QueryClient[] = [];

function newClient(cached = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  clients.push(client);
  if (cached) {
    client.setQueryData(['registry-organizations', undefined], organizations);
    for (const org of organizations) client.setQueryData(['registry-organizations', org.name], organizations);
  }
  return client;
}

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="current-path">{location.pathname}</output>
    <button onClick={() => { void navigate(-1); }}>Back</button>
    <Outlet />
  </>;
}

function renderRegistry(client: QueryClient, initialEntries = ['/registry']) {
  const router = createMemoryRouter([{
    element: <NavigationProbe />,
    children: [
      { path: '/before', element: <p>Before Registry</p> },
      { path: '/registry', element: <Registry /> },
      { path: '/app/:orgName/registry', element: <Registry /> },
    ],
  }], { initialEntries, initialIndex: initialEntries.length - 1 });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}

describe('Registry organization cache', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(organizationsApi.list).mockResolvedValue(responseFor());
    vi.mocked(registryApi.modules.list).mockImplementation(orgName => Promise.resolve([moduleFor(orgName)]));
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.clear();
  });

  it('redirects a cached bare route to the first returned organization without refetching it', async () => {
    renderRegistry(newClient(true));
    await waitFor(() => { expect(screen.getByTestId('current-path')).toHaveTextContent('/app/bravo/registry'); });
    expect(await screen.findByRole('heading', { name: 'bravo-module' })).toBeInTheDocument();
    expect(organizationsApi.list).not.toHaveBeenCalled();
    expect(registryApi.modules.list).toHaveBeenCalledWith('bravo');
    expect(registryApi.modules.list).not.toHaveBeenCalledWith('alpha');
  });

  it('retains the first-organization default when organizations arrive from the network', async () => {
    renderRegistry(newClient());
    expect(screen.getByText('Loading organizations...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'bravo-module' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/app/bravo/registry');
    expect(organizationsApi.list).toHaveBeenCalled();
    expect(registryApi.modules.list).toHaveBeenCalledWith('bravo');
    expect(registryApi.modules.list).not.toHaveBeenCalledWith('alpha');
  });

  it('replaces the bare history entry so Back returns to the preceding page', async () => {
    renderRegistry(newClient(true), ['/before', '/registry']);
    await waitFor(() => { expect(screen.getByTestId('current-path')).toHaveTextContent('/app/bravo/registry'); });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Before Registry')).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/before');
  });

  it('honors an explicit route rather than the first organization and preserves filters and dialog scope', async () => {
    renderRegistry(newClient(true), ['/app/alpha/registry']);
    expect(await screen.findByRole('heading', { name: 'alpha-module' })).toBeInTheDocument();
    expect(registryApi.modules.list).toHaveBeenCalledWith('alpha');
    expect(registryApi.modules.list).not.toHaveBeenCalledWith('bravo');
    const filter = screen.getByRole('textbox', { name: 'Filter providers and modules' });
    fireEvent.change(filter, { target: { value: 'missing module' } });
    expect(screen.getByText('No modules match your search.')).toBeInTheDocument();
    fireEvent.change(filter, { target: { value: '' } });
    expect(screen.getByRole('heading', { name: 'alpha-module' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add New Module' }));
    expect(screen.getByRole('dialog', { name: 'Create module' })).toHaveTextContent('Create for alpha');
  });

  it('uses the URL organization after same-component changes with fresh cached organization results', async () => {
    const router = renderRegistry(newClient(true), ['/app/alpha/registry']);
    expect(await screen.findByRole('heading', { name: 'alpha-module' })).toBeInTheDocument();
    await act(async () => { await router.navigate('/app/bravo/registry'); });
    expect(await screen.findByRole('heading', { name: 'bravo-module' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'alpha-module' })).not.toBeInTheDocument();
    expect(registryApi.modules.list).toHaveBeenCalledWith('bravo');
    expect(organizationsApi.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add New Module' }));
    expect(screen.getByRole('dialog', { name: 'Create module' })).toHaveTextContent('Create for bravo');
    await act(async () => { await router.navigate('/app/alpha/registry'); });
    expect(await screen.findByRole('heading', { name: 'alpha-module' })).toBeInTheDocument();
    expect(registryApi.modules.list).toHaveBeenCalledTimes(2);
  });

  it('keeps the organizations loading screen while its request is pending', () => {
    vi.mocked(organizationsApi.list).mockReturnValue(new Promise(() => {}));
    renderRegistry(newClient());
    expect(screen.getByText('Loading organizations...')).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/registry');
    expect(registryApi.modules.list).not.toHaveBeenCalled();
    expect(screen.queryByText('Please select an organization to view modules.')).not.toBeInTheDocument();
  });

  it('keeps the empty-organizations screen without redirecting or requesting modules', async () => {
    vi.mocked(organizationsApi.list).mockResolvedValue(responseFor([]));
    renderRegistry(newClient());
    expect(await screen.findByText('No organizations found. Please create an organization first.')).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/registry');
    expect(registryApi.modules.list).not.toHaveBeenCalled();
  });
});
