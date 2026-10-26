// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MiniSearch from 'minisearch';
import { DocsSearch } from './DocsSearch';
const encoded = (title: string) => {
  const index = new MiniSearch({ fields: ['title', 'description', 'headings', 'body'], storeFields: ['title', 'description', 'path', 'sectionHeadings'] });
  index.add({ id: title, title, description: '', headings: '', body: '', path: `${title}.md`, sectionHeadings: [] });
  return JSON.stringify(index);
};
it('loads a new search index when changing collections and drops prior results', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(input => Promise.resolve(new Response(encoded((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('team') ? 'TeamOnly' : 'PublicOnly'))));
  vi.stubGlobal('fetch', fetchMock);
  const { rerender } = render(<MemoryRouter><DocsSearch docsBase="/docs" searchIndexFile="/public.json" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Search docs/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search docs' }), { target: { value: 'PublicOnly' } });
  await screen.findByText('PublicOnly');
  rerender(<MemoryRouter><DocsSearch docsBase="/team" searchIndexFile="/team.json" /></MemoryRouter>);
  expect(screen.queryByText('PublicOnly')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Search docs/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search docs' }), { target: { value: 'TeamOnly' } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/team.json'));
  expect(await screen.findByText('TeamOnly')).toBeVisible();
});
