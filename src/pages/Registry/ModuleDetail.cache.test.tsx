// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registryApi, type Module, type ModuleVersion } from '@/api/client';
import ModuleDetail from './ModuleDetail';

vi.mock('@/api/client', () => ({
  registryApi: { modules: {
    get: vi.fn(), getVersions: vi.fn(), publishVersion: vi.fn(),
    deleteVersion: vi.fn(), delete: vi.fn(),
  } },
}));

// Exercise the real page's metadata and controls without loading syntax engines.
vi.mock('@/components/docs/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <article>{content}</article>,
}));
vi.mock('@/components/code/HclSyntaxHighlighter', () => ({
  HclSyntaxHighlighter: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

const module: Module = {
  id: 'fixture-module', organization_id: 'fixture', name: 'network', provider: 'aws',
  verified: false, auto_publish_tags: false, created_at: '', updated_at: '',
};
const version = (n: number): ModuleVersion => ({
  id: `version-${n}`, module_id: module.id, version: `${n}.0.0`,
  published_at: '2026-10-21T12:00:00Z', downloads: 0, created_at: '', updated_at: '',
  readme: `Readme for version ${n}`,
  inputs: { inputs: [{ name: `input_${n}`, type: 'string', required: true }] },
  outputs: { outputs: [{ name: `output_${n}` }] },
});
const queryKey = ['moduleDetail', 'fixture', 'network', 'aws'];
const clients: QueryClient[] = [];

function mount(versions: ModuleVersion[], cached = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  clients.push(client);
  vi.mocked(registryApi.modules.getVersions).mockResolvedValue(versions);
  if (cached) client.setQueryData(queryKey, { module, versions });
  render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/app/fixture/registry/modules/network/aws']}>
      <Routes>
        <Route path="/app/:orgName/registry/modules/:moduleName/:provider" element={<ModuleDetail />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);
  return client;
}

async function refetch(client: QueryClient, versions: ModuleVersion[]) {
  vi.mocked(registryApi.modules.getVersions).mockResolvedValue(versions);
  await act(async () => { await client.refetchQueries({ queryKey }); });
}

function tab(name: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}( |$)`) }));
}

async function deleteSelected(selectedVersion: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Manage Module for Organization' }));
  const manage = screen.getByRole('dialog', { name: 'Manage Module for Organization' });
  fireEvent.click(within(manage).getByRole('button', { name: `Delete Version ${selectedVersion}` }));
  const confirm = screen.getByRole('dialog', { name: `Delete version ${selectedVersion}?` });
  fireEvent.click(within(confirm).getByRole('button', { name: `Delete Version ${selectedVersion}` }));
  await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Manage Module for Organization' })).not.toBeInTheDocument(); });
}

describe('ModuleDetail cached selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(registryApi.modules.get).mockResolvedValue(module);
    vi.mocked(registryApi.modules.publishVersion).mockResolvedValue({});
    vi.mocked(registryApi.modules.deleteVersion).mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.clear();
  });

  it('shows the first cached version metadata without requesting the fresh cache again', async () => {
    mount([version(1), version(2)], true);
    expect(await screen.findByText('input_1')).toBeInTheDocument();
    expect(screen.getByText(/version = "1.0.0"/)).toBeInTheDocument();
    tab('Outputs');
    expect(screen.getByText('output_1')).toBeInTheDocument();
    tab('Readme');
    expect(screen.getByText('Readme for version 1')).toBeInTheDocument();
    expect(registryApi.modules.get).not.toHaveBeenCalled();
    expect(registryApi.modules.getVersions).not.toHaveBeenCalled();
  });

  it('opens the empty Versions view from a cached result and allows manual tabs afterward', () => {
    mount([], true);
    expect(screen.getByText('No versions published yet')).toBeInTheDocument();
    tab('Inputs');
    expect(screen.getByText('No inputs defined for this module.')).toBeInTheDocument();
    expect(registryApi.modules.get).not.toHaveBeenCalled();
    expect(registryApi.modules.getVersions).not.toHaveBeenCalled();
  });

  it('keeps the first returned version as the cold default without sorting', async () => {
    mount([version(1), version(2)]);
    expect(screen.getByText('Loading module...')).toBeInTheDocument();
    expect(await screen.findByText('input_1')).toBeInTheDocument();
    expect(screen.queryByText('input_2')).not.toBeInTheDocument();
    expect(registryApi.modules.get).toHaveBeenCalledWith('fixture', 'network', 'aws');
    expect(registryApi.modules.getVersions).toHaveBeenCalledWith('fixture', 'network', 'aws');
  });

  it('preserves the automatic version object when a refetch inserts a new first version or updates metadata', async () => {
    const client = mount([version(1)]);
    await screen.findByText('input_1');
    const updated = { ...version(1), inputs: { inputs: [{ name: 'changed_input', required: true }] } };
    await refetch(client, [version(2), updated]);
    await screen.findByRole('button', { name: 'Versions 2' });
    expect(screen.getByText('input_1')).toBeInTheDocument();
    expect(screen.queryByText('changed_input')).not.toBeInTheDocument();
    expect(screen.queryByText('input_2')).not.toBeInTheDocument();
  });

  it('preserves an explicit version object and a chosen tab on nonempty refetch', async () => {
    const client = mount([version(2), version(1)]);
    await screen.findByText('input_2');
    tab('Versions');
    fireEvent.click(screen.getByText('1.0.0'));
    tab('Readme');
    expect(screen.getByText('Readme for version 1')).toBeInTheDocument();
    await refetch(client, [version(3), version(2), { ...version(1), readme: 'Updated readme' }]);
    await screen.findByRole('button', { name: 'Versions 3' });
    expect(screen.getByText('Readme for version 1')).toBeInTheDocument();
    expect(screen.queryByText('Updated readme')).not.toBeInTheDocument();
    tab('Inputs');
    expect(screen.getByText('input_1')).toBeInTheDocument();
  });

  it('resets on each empty success, permits manual tabs, and retains the tab when versions return', async () => {
    const client = mount([version(1)]);
    await screen.findByText('input_1');
    tab('Readme');
    const empty: ModuleVersion[] = [];
    await refetch(client, empty);
    expect(await screen.findByText('No versions published yet')).toBeInTheDocument();
    tab('Inputs');
    expect(screen.getByText('No inputs defined for this module.')).toBeInTheDocument();
    await refetch(client, empty);
    expect(await screen.findByText('No versions published yet')).toBeInTheDocument();
    tab('Outputs');
    await refetch(client, [version(2)]);
    expect(await screen.findByText('output_2')).toBeInTheDocument();
    expect(screen.queryByText('input_1')).not.toBeInTheDocument();
  });

  it('initializes cold empty results to Versions and permits a later tab choice', async () => {
    mount([]);
    await screen.findByText('No versions published yet');
    tab('Readme');
    expect(screen.getByText('No README available for this version.')).toBeInTheDocument();
  });

  it('resets selection to the refreshed first version after a mocked upload', async () => {
    mount([]);
    await screen.findByText('No versions published yet');
    fireEvent.click(screen.getByRole('button', { name: 'Upload Version' }));
    const dialog = screen.getByRole('dialog', { name: 'Upload Module Version' });
    const file = new File(['fixture archive'], 'module.tar.gz', { type: 'application/gzip' });
    fireEvent.change(within(dialog).getByLabelText('Version *'), { target: { value: '2.0.0' } });
    fireEvent.change(within(dialog).getByLabelText('Tarball File *'), { target: { files: [file] } });
    vi.mocked(registryApi.modules.getVersions).mockResolvedValue([version(2), version(1)]);
    const form = within(dialog).getByRole('button', { name: 'Upload' }).closest('form');
    if (!form) throw new Error('Upload form is missing');
    fireEvent.submit(form);
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Upload Module Version' })).not.toBeInTheDocument(); });
    tab('Inputs');
    expect(await screen.findByText('input_2')).toBeInTheDocument();
    expect(registryApi.modules.publishVersion).toHaveBeenCalledWith('fixture', 'network', 'aws', '2.0.0', file);
  });

  it('resets to the refreshed first remaining version after a mocked deletion', async () => {
    mount([version(2), version(1)]);
    await screen.findByText('input_2');
    vi.mocked(registryApi.modules.getVersions).mockResolvedValue([version(1)]);
    await deleteSelected('2.0.0');
    expect(await screen.findByText('input_1')).toBeInTheDocument();
    expect(screen.queryByText('input_2')).not.toBeInTheDocument();
    expect(registryApi.modules.deleteVersion).toHaveBeenCalledWith('fixture', 'network', 'aws', '2.0.0');
  });

  it('opens the empty Versions view after deleting the last version through mocked APIs', async () => {
    mount([version(1)]);
    await screen.findByText('input_1');
    vi.mocked(registryApi.modules.getVersions).mockResolvedValue([]);
    await deleteSelected('1.0.0');
    expect(await screen.findByText('No versions published yet')).toBeInTheDocument();
    expect(screen.queryByText('input_1')).not.toBeInTheDocument();
    expect(registryApi.modules.deleteVersion).toHaveBeenCalledWith('fixture', 'network', 'aws', '1.0.0');
  });

  it('leaves selection cleared when a successful deletion is followed by a failed refetch', async () => {
    mount([version(1)]);
    await screen.findByText('input_1');
    vi.mocked(registryApi.modules.get).mockRejectedValue(new Error('fixture refetch failure'));
    await deleteSelected('1.0.0');
    expect(screen.getByText('No inputs defined for this module.')).toBeInTheDocument();
    expect(screen.queryByText('input_1')).not.toBeInTheDocument();
  });

  it('clears the old selection while a deletion refetch is pending, then selects its first result', async () => {
    mount([version(2), version(1)]);
    await screen.findByText('input_2');
    let finishRefetch: (versions: ModuleVersion[]) => void = () => { throw new Error('Refetch not initialized'); };
    const pending = new Promise<ModuleVersion[]>(resolve => { finishRefetch = resolve; });
    vi.mocked(registryApi.modules.getVersions).mockReturnValue(pending);
    const deletion = deleteSelected('2.0.0');
    await screen.findByText('No inputs defined for this module.');
    expect(screen.queryByText('input_2')).not.toBeInTheDocument();
    await act(async () => { finishRefetch([version(1)]); await pending; });
    await deletion;
    expect(await screen.findByText('input_1')).toBeInTheDocument();
  });

  it('preserves the existing empty-version fallback when the version request rejects', async () => {
    const client = mount([version(1)]);
    await screen.findByText('input_1');
    vi.mocked(registryApi.modules.getVersions).mockRejectedValue(new Error('fixture failure'));
    await act(async () => { await client.refetchQueries({ queryKey }); });
    expect(await screen.findByText('No versions published yet')).toBeInTheDocument();
  });

  it('preserves the module-not-found view when the module request rejects', async () => {
    vi.mocked(registryApi.modules.get).mockRejectedValue(new Error('fixture missing'));
    mount([]);
    expect(await screen.findByText('Module not found')).toBeInTheDocument();
  });
});
