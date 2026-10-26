// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import DevDocsPrototype from './DevDocsPrototype';
import type { Window } from 'happy-dom';
beforeEach(() => {
  (window as unknown as Window).happyDOM.settings.disableIframePageLoading = true;
  const originalError = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (args[0] instanceof Error && args[0].message.includes('Iframe page loading is disabled')) return;
    originalError(...args);
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function preview() {
  return render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DevDocsPrototype docPath="design/prototypes/example/index.html" docsBase="/internal-docs" /></QueryClientProvider></MemoryRouter>);
}
it('embeds an available saved review without allowing access to the parent document', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  preview(); const frame = await screen.findByTitle('Saved HTML page');
  expect(frame).toHaveAttribute('src', '/__dev/docs-prototypes/design/prototypes/example/index.html');
  expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  expect(fetch).toHaveBeenCalledWith('/__dev/docs-prototypes/design/prototypes/example/index.html', { method: 'HEAD' });
});
it('shows a missing review instead of a blank iframe', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  preview(); expect(await screen.findByText('Saved review is unavailable')).toBeInTheDocument();
  expect(screen.queryByTitle('Saved HTML page')).not.toBeInTheDocument();
});

it('opens indexed HTML anywhere in internal docs and returns to its containing folder', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><DevDocsPrototype docPath="notes/example.html" docsBase="/internal-docs" /></QueryClientProvider></MemoryRouter>);
  const frame = await screen.findByTitle('Saved HTML page');
  expect(frame).toHaveAttribute('src', '/__dev/docs-prototypes/notes/example.html');
  expect(screen.getByRole('link', { name: 'Back to folder' })).toHaveAttribute('href', '/internal-docs/notes');
});
