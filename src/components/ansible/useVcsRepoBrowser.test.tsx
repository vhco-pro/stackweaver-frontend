// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ansiblePlaybooksApi } from '@/api/ansible';
import { vcsConnectionsApi, type Repository, type VCSConnection } from '@/api/client';
import { useVcsRepoBrowser } from './useVcsRepoBrowser';

vi.mock('@/api/client', () => ({
  vcsConnectionsApi: {
    list: vi.fn(),
    listAllRepositories: vi.fn(),
    listBranches: vi.fn(),
  },
}));
vi.mock('@/api/ansible', () => ({ ansiblePlaybooksApi: { listVcsFiles: vi.fn() } }));

const connection = (id: string, account = id): VCSConnection => ({
  id, organization_id: 'org-fixture', provider: 'github', account_name: account,
  account_type: 'organization', created_at: '', updated_at: '',
});
const first = connection('connection-a');
const second = connection('connection-b');
const repository: Repository = {
  id: 1, name: 'playbooks', full_name: 'fixture/playbooks', description: '',
  private: true, default_branch: 'main', url: '', clone_url: '', ssh_url: '',
};
const connectionsKey = ['vcsRepoBrowserConnections', 'fixture'];
const clients: QueryClient[] = [];

function clientWith(connections?: VCSConnection[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  clients.push(client);
  if (connections) client.setQueryData(connectionsKey, connections);
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useVcsRepoBrowser connection selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(vcsConnectionsApi.list).mockResolvedValue([first]);
    vi.mocked(vcsConnectionsApi.listAllRepositories).mockResolvedValue([repository]);
    vi.mocked(vcsConnectionsApi.listBranches).mockResolvedValue([]);
    vi.mocked(ansiblePlaybooksApi.listVcsFiles).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.clear();
  });

  it('selects the sole deduplicated connection after an uncached response', async () => {
    const replacement = connection('connection-a-new', first.account_name);
    vi.mocked(vcsConnectionsApi.list).mockResolvedValue([first, replacement]);
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true), { wrapper: wrapperFor(clientWith()) });
    await waitFor(() => { expect(result.current.connectionId).toBe(replacement.id); });
    expect(result.current.connections).toEqual([replacement]);
    expect(result.current.connection).toEqual(replacement);
    await waitFor(() => { expect(vcsConnectionsApi.listAllRepositories).toHaveBeenCalledWith(replacement.id, undefined); });
  });

  it('selects a cached sole connection after remount without another list request', async () => {
    const wrapper = wrapperFor(clientWith());
    const original = renderHook(() => useVcsRepoBrowser('fixture', true), { wrapper });
    await waitFor(() => { expect(original.result.current.connectionId).toBe(first.id); });
    original.unmount();
    const remounted = renderHook(() => useVcsRepoBrowser('fixture', true), { wrapper });
    expect(remounted.result.current.connections).toEqual([first]);
    expect(remounted.result.current.connectionId).toBe(first.id);
    expect(vcsConnectionsApi.list).toHaveBeenCalledTimes(1);
  });

  it('uses an already cached sole connection even with an empty initial connection', () => {
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true, { connectionId: '' }), {
      wrapper: wrapperFor(clientWith([first])),
    });
    expect(result.current.connectionId).toBe(first.id);
    expect(vcsConnectionsApi.list).not.toHaveBeenCalled();
  });

  it.each([{ label: 'zero connections', connections: [] }, { label: 'multiple connections', connections: [first, second] }])('does not invent a selection for $label', ({ connections }) => {
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true), { wrapper: wrapperFor(clientWith(connections)) });
    expect(result.current.connectionId).toBe('');
    expect(result.current.connection).toBeUndefined();
    expect(vcsConnectionsApi.listAllRepositories).not.toHaveBeenCalled();
  });

  it('preserves an explicit initial connection and its repository/branch tuple', async () => {
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true, {
      connectionId: second.id, repository: repository.full_name, branch: 'release',
    }), { wrapper: wrapperFor(clientWith([first])) });
    expect(result.current).toMatchObject({ connectionId: second.id, repository: repository.full_name, branch: 'release' });
    await waitFor(() => { expect(vcsConnectionsApi.listBranches).toHaveBeenCalledWith(second.id, 'fixture', 'playbooks'); });
    await waitFor(() => { expect(ansiblePlaybooksApi.listVcsFiles).toHaveBeenCalledWith('fixture', {
      vcs_connection_id: second.id, repository: repository.full_name, branch: 'release',
    }); });
  });

  it('preserves a deliberate connection choice when connections data changes', async () => {
    const client = clientWith([first, second]);
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true), { wrapper: wrapperFor(client) });
    act(() => { result.current.selectConnection(second.id); });
    act(() => { client.setQueryData(connectionsKey, [first]); });
    await waitFor(() => { expect(result.current.connections).toEqual([first]); });
    expect(result.current.connectionId).toBe(second.id);
    await waitFor(() => { expect(vcsConnectionsApi.listAllRepositories).toHaveBeenCalledWith(second.id, undefined); });
  });

  it('keeps a deliberate empty choice after a connections refetch', async () => {
    const client = clientWith();
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true), { wrapper: wrapperFor(client) });
    await waitFor(() => { expect(result.current.connectionId).toBe(first.id); });
    act(() => { result.current.selectConnection(''); });
    expect(result.current.connectionId).toBe('');
    await act(async () => { await client.refetchQueries({ queryKey: connectionsKey, exact: true }); });
    expect(result.current.connectionId).toBe('');
    expect(result.current.connection).toBeUndefined();
  });

  it('stops every request while disabled, then loads the preserved initial draft when enabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useVcsRepoBrowser('fixture', enabled, {
      connectionId: first.id, repository: repository.full_name, branch: 'release',
    }), { wrapper: wrapperFor(clientWith()), initialProps: { enabled: false } });
    expect(vcsConnectionsApi.list).not.toHaveBeenCalled();
    expect(vcsConnectionsApi.listAllRepositories).not.toHaveBeenCalled();
    expect(vcsConnectionsApi.listBranches).not.toHaveBeenCalled();
    expect(ansiblePlaybooksApi.listVcsFiles).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => { expect(ansiblePlaybooksApi.listVcsFiles).toHaveBeenCalled(); });
    expect(result.current).toMatchObject({ connectionId: first.id, repository: repository.full_name, branch: 'release' });
  });

  it('does not fetch connections without an organization', () => {
    renderHook(() => useVcsRepoBrowser('', true), { wrapper: wrapperFor(clientWith()) });
    expect(vcsConnectionsApi.list).not.toHaveBeenCalled();
  });

  it('clears dependent selections and uses each chosen repository default branch', async () => {
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true, {
      connectionId: first.id, repository: repository.full_name, branch: 'release',
    }), { wrapper: wrapperFor(clientWith([first, second])) });
    act(() => { result.current.selectVcsProject('Project A'); });
    expect(result.current).toMatchObject({ connectionId: first.id, vcsProject: 'Project A', repository: '', branch: '' });
    await waitFor(() => { expect(result.current.repositories).toEqual([repository]); });
    act(() => { result.current.selectRepository(repository.full_name); });
    expect(result.current).toMatchObject({ repository: repository.full_name, branch: 'main' });
    act(() => { result.current.selectBranch('feature'); });
    expect(result.current).toMatchObject({ vcsProject: 'Project A', repository: repository.full_name, branch: 'feature' });
    act(() => { result.current.selectVcsProject('Project B'); });
    expect(result.current).toMatchObject({ vcsProject: 'Project B', repository: '', branch: '' });
    act(() => { result.current.selectConnection(second.id); });
    expect(result.current).toMatchObject({ connectionId: second.id, vcsProject: '', repository: '', branch: '' });
  });

  it('binds a partial initial repository draft to the first sole connection', async () => {
    const client = clientWith();
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true, {
      repository: repository.full_name, branch: 'release',
    }), { wrapper: wrapperFor(client) });
    await waitFor(() => { expect(result.current.connectionId).toBe(first.id); });
    await waitFor(() => { expect(ansiblePlaybooksApi.listVcsFiles).toHaveBeenCalledWith('fixture', {
      vcs_connection_id: first.id, repository: repository.full_name, branch: 'release',
    }); });
    vi.mocked(vcsConnectionsApi.list).mockResolvedValue([second]);
    await act(async () => { await client.refetchQueries({ queryKey: connectionsKey, exact: true }); });
    await waitFor(() => { expect(result.current.connections).toEqual([second]); });
    expect(result.current).toMatchObject({ connectionId: first.id, repository: repository.full_name, branch: 'release' });
    expect(ansiblePlaybooksApi.listVcsFiles).not.toHaveBeenCalledWith('fixture', {
      vcs_connection_id: second.id, repository: repository.full_name, branch: 'release',
    });
  });

  it('keeps an Azure project draft bound to its connection when the sole default changes', async () => {
    const azure = { ...first, provider: 'azure_devops' as const };
    const client = clientWith();
    vi.mocked(vcsConnectionsApi.list).mockResolvedValue([azure]);
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true), { wrapper: wrapperFor(client) });
    await waitFor(() => { expect(result.current.connectionId).toBe(azure.id); });
    act(() => { result.current.selectVcsProject('Project A'); });
    vi.mocked(vcsConnectionsApi.list).mockResolvedValue([{ ...second, provider: 'azure_devops' }]);
    await act(async () => { await client.refetchQueries({ queryKey: connectionsKey, exact: true }); });
    await waitFor(() => { expect(result.current.connections[0]?.id).toBe(second.id); });
    expect(result.current).toMatchObject({ connectionId: azure.id, vcsProject: 'Project A', repository: '', branch: '' });
    expect(vcsConnectionsApi.listAllRepositories).not.toHaveBeenCalledWith(second.id, 'Project A');
  });

  it('keeps repository and branch drafts bound to the connection that supplied them', async () => {
    const client = clientWith();
    const { result } = renderHook(() => useVcsRepoBrowser('fixture', true), { wrapper: wrapperFor(client) });
    await waitFor(() => { expect(result.current.repositories).toEqual([repository]); });
    act(() => { result.current.selectRepository(repository.full_name); });
    act(() => { result.current.selectBranch('feature'); });
    vi.mocked(vcsConnectionsApi.list).mockResolvedValue([second]);
    await act(async () => { await client.refetchQueries({ queryKey: connectionsKey, exact: true }); });
    await waitFor(() => { expect(result.current.connections).toEqual([second]); });
    expect(result.current).toMatchObject({ connectionId: first.id, vcsProject: '', repository: repository.full_name, branch: 'feature' });
    expect(vcsConnectionsApi.listAllRepositories).not.toHaveBeenCalledWith(second.id, expect.anything());
    expect(vcsConnectionsApi.listBranches).not.toHaveBeenCalledWith(second.id, 'fixture', 'playbooks');
  });
});
