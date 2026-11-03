// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DocsEnvironmentContext } from '@/components/docs/DocsEnvironment';
import { publicDocs, type DocsIndex } from '@/components/docs/docsCollection';
import { ThemeProvider } from '@/contexts/ThemeContext';
import DocsViewer from './DocsViewer';

vi.mock('@/components/docs/DocsLayout', () => ({ DocsLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));
const fetchMock = vi.fn<typeof fetch>();
const requestUrl = (input: Parameters<typeof fetch>[0]) => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const collection = { ...publicDocs, id: 'handbook', docsBase: '/manual', indexFile: '/manual-index.json' };
const indexFor = (...paths: string[]): DocsIndex => ({ generated: '', tree: [], flat: Object.fromEntries(paths.map(path => [path, { type: 'file', name: path.split('/').at(-1)!, path }])) });
type Reply = { body: string; status?: number; type?: string };
function open(path: string, index: DocsIndex | null, replies: Record<string, Reply>) {
  fetchMock.mockImplementation(input => {
    const url = requestUrl(input);
    if (url === '/stack/manual-index.json') return Promise.resolve(new Response(JSON.stringify(index), { status: index ? 200 : 503 }));
    if (url === '/stack/manual/docs-redirects.json') return Promise.resolve(new Response('{}'));
    const reply = replies[url];
    return Promise.resolve(new Response(reply?.body ?? 'Missing', { status: reply?.status ?? (reply ? 200 : 404), headers: { 'content-type': reply?.type ?? 'text/markdown' } }));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const initial = `/manual/${path}`;
  render(<MemoryRouter initialEntries={[initial]}><QueryClientProvider client={client}><ThemeProvider><DocsEnvironmentContext.Provider value={{ basePath: '/stack', staticRender: false }}>
    <Link to="/elsewhere">Leave handbook</Link>
    <Routes><Route path="/manual/*" element={<DocsViewer collection={collection} />} /><Route path="/elsewhere" element={<Link to={initial}>Return to guide</Link>} /></Routes>
  </DocsEnvironmentContext.Provider></ThemeProvider></QueryClientProvider></MemoryRouter>);
}
const markdownRequests = () => fetchMock.mock.calls.map(([input]) => requestUrl(input)).filter(url => url.endsWith('.md'));
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); localStorage.clear(); });

it('loads the indexed article directly under an unrelated host collection and mount', async () => {
  open('guides/start', indexFor('guides/start.md'), { '/stack/manual/guides/start.md': { body: '# Loaded guide\n\n[Next step](./next.md)' } });
  expect(await screen.findByRole('heading', { name: 'Loaded guide' })).toBeVisible();
  expect(markdownRequests()).toEqual(['/stack/manual/guides/start.md']);
  expect(screen.getByRole('link', { name: 'Next step' })).toHaveAttribute('href', '/stack/manual/guides/next');
  fireEvent.click(screen.getByRole('link', { name: 'Leave handbook' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Return to guide' }));
  expect(await screen.findByRole('heading', { name: 'Loaded guide' })).toBeVisible();
  expect(markdownRequests()).toEqual(['/stack/manual/guides/start.md']);
});
it('loads an indexed lowercase folder README directly and keeps directory links', async () => {
  open('guides', indexFor('guides/readme.md'), { '/stack/manual/guides/readme.md': { body: '# Folder guide\n\n[Next step](./next.md)' } });
  expect(await screen.findByRole('heading', { name: 'Folder guide' })).toBeVisible();
  expect(markdownRequests()).toEqual(['/stack/manual/guides/readme.md']);
  expect(screen.getByRole('link', { name: 'Next step' })).toHaveAttribute('href', '/stack/manual/guides/next');
});
it('preserves folder precedence when both a folder README and an article are indexed', async () => {
  open('guides', indexFor('guides/README.md', 'guides.md'), { '/stack/manual/guides/README.md': { body: '# Folder wins' }, '/stack/manual/guides.md': { body: '# Article' } });
  expect(await screen.findByRole('heading', { name: 'Folder wins' })).toBeVisible();
  expect(markdownRequests()).toEqual(['/stack/manual/guides/README.md']);
});
it('falls back from a stale indexed HTML response to a real directory document', async () => {
  open('guides', indexFor('guides.md'), { '/stack/manual/guides.md': { body: '<html>SPA fallback</html>', type: 'text/html' }, '/stack/manual/guides/README.md': { body: '# Recovered folder\n\n[Next step](./next.md)' } });
  expect(await screen.findByRole('heading', { name: 'Recovered folder' })).toBeVisible();
  expect(markdownRequests()).toEqual(['/stack/manual/guides.md', '/stack/manual/guides/README.md']);
  expect(screen.getByRole('link', { name: 'Next step' })).toHaveAttribute('href', '/stack/manual/guides/next');
});
it('retains the legacy lookup if the index cannot be loaded', async () => {
  open('guides/start', null, { '/stack/manual/guides/start.md': { body: '# Offline index fallback' } });
  expect(await screen.findByRole('heading', { name: 'Offline index fallback' })).toBeVisible();
  expect(markdownRequests()).toEqual(['/stack/manual/guides/start/README.md', '/stack/manual/guides/start/readme.md', '/stack/manual/guides/start.md']);
});
it('loads the root README with its existing directory context', async () => {
  open('', indexFor('README.md'), { '/stack/manual/README.md': { body: '# Handbook\n\n[Guide](./guides/start.md)' } });
  expect(await screen.findByRole('heading', { name: 'Handbook' })).toBeVisible();
  expect(markdownRequests()).toEqual(['/stack/manual/README.md']);
  expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/stack/manual/guides/start');
});
it('reports a missing document after the bounded fallback paths fail', async () => {
  open('missing', indexFor('missing.md'), {});
  expect(await screen.findByText('Document not found')).toBeVisible();
  expect(markdownRequests()).toEqual(['/stack/manual/missing.md', '/stack/manual/missing/README.md', '/stack/manual/missing/readme.md']);
});
