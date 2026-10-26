// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocsIndex from './DocsIndex';
import DocsViewer from './DocsViewer';
import { publicDocs, type DocsCollection, type DocsIndex as Index } from '@/components/docs/docsCollection';
vi.mock('@/components/docs/DocsLayout', () => ({ DocsLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/docs/DocsSearch', () => ({ DocsSearch: ({ searchIndexFile }: { searchIndexFile: string }) => <button>{searchIndexFile}</button> }));
const makeIndex = (name: string): Index => ({ generated: '', tree: [{ type: 'directory', name, path: name, children: [{ type: 'file', name: 'intro.md', path: `${name}/intro.md`, title: 'Introduction' }] }], flat: { [`${name}/README.md`]: { type: 'file', name: 'README.md', path: `${name}/README.md`, title: `${name} overview`, description: 'Generated description' } } });
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); localStorage.clear(); });
const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => <MemoryRouter><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>;
};
describe('generated docs homepage', () => {
  it('renders generated cards, descriptions and links using collection routes', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(makeIndex('guides'))));
    render(<DocsIndex />, { wrapper: wrapper() });
    expect(await screen.findByRole('heading', { name: 'guides overview' })).toBeVisible();
    expect(screen.getByText('Generated description')).toBeVisible();
    expect(screen.getByRole('link', { name: /Browse.*guides overview/ })).toHaveAttribute('href', '/docs/guides');
    expect(screen.getByRole('link', { name: 'Introduction' })).toHaveAttribute('href', '/docs/guides/intro');
  });
  it('switches to an unrelated generated collection without retaining cards', async () => {
    fetchMock.mockImplementation(input => Promise.resolve(new Response(JSON.stringify(makeIndex((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('team') ? 'team' : 'guides')))));
    const { rerender } = render(<DocsIndex />, { wrapper: wrapper() });
    await screen.findByRole('heading', { name: 'guides overview' });
    const collection: DocsCollection = { ...publicDocs, id: 'team', docsBase: '/team', indexFile: '/team.json', searchIndexFile: '/team-search.json', title: 'Team handbook' };
    rerender(<DocsIndex collection={collection} />);
    expect(await screen.findByRole('heading', { name: 'team overview' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'guides overview' })).not.toBeInTheDocument();
    expect(screen.getByText('/team-search.json')).toBeVisible();
  });
  it('exposes loading and retries a failed index request', async () => {
    fetchMock.mockResolvedValueOnce(new Response('error', { status: 503 })).mockResolvedValue(new Response(JSON.stringify(makeIndex('guides'))));
    render(<DocsIndex />, { wrapper: wrapper() });
    expect(screen.getByRole('status')).toHaveTextContent(/Loading/);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'guides overview' })).toBeVisible();
  });
  it('shows an empty state and root files without requiring a directory', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ tree: [], flat: {}, generated: '' })));
    render(<DocsIndex />, { wrapper: wrapper() });
    expect(await screen.findByText('No documentation yet')).toBeVisible();
  });
  it('honors the internal completed filter in homepage entries', async () => {
    localStorage.setItem('internal-docs-hide-completed', 'true');
    const data = makeIndex('guides');data.tree[0].children![0].status = 'complete';
    fetchMock.mockResolvedValue(new Response(JSON.stringify(data)));
    render(<DocsIndex collection={{ ...publicDocs, id: 'internal', statusFilter: true, statusStorageKey: 'internal-docs-hide-completed' }} />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByText('No documentation yet')).toBeVisible());
  });
});

it('browses a generated folder without a README without requesting missing Markdown', async () => {
  const data = makeIndex('no-overview');
  data.flat = {};
  fetchMock.mockImplementation(input => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === '/docs-index.json') return Promise.resolve(new Response(JSON.stringify(data)));
    if (url === '/docs-redirects.json') return Promise.resolve(new Response('{}'));
    return Promise.reject(new Error(`Unexpected Markdown request: ${url}`));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter initialEntries={['/docs/no-overview']}><QueryClientProvider client={client}><Routes><Route path="/docs/*" element={<DocsViewer />} /></Routes></QueryClientProvider></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Introduction' })).toHaveAttribute('href', '/docs/no-overview/intro');
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining(['/docs-index.json', '/docs-redirects.json']));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
