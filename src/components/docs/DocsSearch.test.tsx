// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MiniSearch from 'minisearch';
import { DocsSearch } from './DocsSearch';
const encoded = (...titles: string[]) => {
  const index = new MiniSearch({ fields: ['title', 'description', 'headings', 'body'], storeFields: ['title', 'description', 'path', 'sectionHeadings'] });
  for (const title of titles) index.add({ id: title, title, description: '', headings: '', body: '', path: `${title}.md`, sectionHeadings: [] });
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
it('moves the selection with the arrow keys and scrolls it into view once per key press, also under Strict Mode', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(encoded('Alpha one', 'Alpha two', 'Alpha three'))));
  const scrolled: Element[] = [];
  const scrollIntoView = vi.fn(function (this: Element) { scrolled.push(this); });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  render(<StrictMode><MemoryRouter><DocsSearch docsBase="/docs" searchIndexFile="/public.json" /></MemoryRouter></StrictMode>);
  fireEvent.click(screen.getByRole('button', { name: /Search docs/ }));
  const input = screen.getByRole('textbox', { name: 'Search docs' });
  fireEvent.change(input, { target: { value: 'alpha' } });
  const results = (await screen.findAllByRole('button', { name: /Alpha/ }));
  expect(results).toHaveLength(3);
  const selected = () => results.filter(button => button.className.includes('bg-accent'));
  expect(selected()).toEqual([results[0]]);

  fireEvent.keyDown(input, { key: 'ArrowDown' });
  await waitFor(() => { expect(selected()).toEqual([results[1]]); });
  await Promise.resolve();
  expect(scrolled).toEqual([results[1]]);

  fireEvent.keyDown(input, { key: 'ArrowUp' });
  await waitFor(() => { expect(selected()).toEqual([results[0]]); });
  await Promise.resolve();
  expect(scrolled).toEqual([results[1], results[0]]);
});
