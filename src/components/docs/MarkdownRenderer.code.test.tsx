// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';
import { DocsEnvironmentContext } from './DocsEnvironment';
import { codeToHtml } from '@/lib/highlighter';
import { stubFenceViewport } from '@/test/stubFenceViewport';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));
vi.mock('@/lib/highlighter', () => ({
  codeToHtml: vi.fn((code: string) => Promise.resolve(`<pre><code>${code}</code></pre>`)),
  isUnknownLanguageError: () => false,
}));

beforeEach(() => { stubFenceViewport(); });
afterEach(() => { vi.unstubAllGlobals(); });

it('waits for a fence to approach the viewport and preserves its whitespace', async () => {
  const setNear = stubFenceViewport(false);
  const command = '    key: value  \u00a0\n\n';
  const article = <MarkdownRenderer content={'```yaml\n' + command + '```'} />;
  const staticHtml = renderToStaticMarkup(<MemoryRouter><ThemeProvider><DocsEnvironmentContext.Provider value={{ basePath: '', staticRender: true }}>{article}</DocsEnvironmentContext.Provider></ThemeProvider></MemoryRouter>);
  expect(staticHtml).toContain(command);
  const view = render(<MemoryRouter><ThemeProvider>{article}</ThemeProvider></MemoryRouter>);
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(view.container.querySelector('pre code')?.textContent).toBe(command);
  expect(codeToHtml).not.toHaveBeenCalled();
  act(() => { setNear(true); });
  await waitFor(() => { expect(codeToHtml).toHaveBeenCalledExactlyOnceWith(command, expect.objectContaining({ lang: 'yaml' })); });
});

it('keeps an inline-only article mounted without requesting block highlighting', async () => {
  const view = render(<MemoryRouter><ThemeProvider><MarkdownRenderer content={'# Inline article\n\nUse `stackweaver` and [read more](https://example.com).'} /></ThemeProvider></MemoryRouter>);
  const heading = view.getByRole('heading', { name: 'Inline article' });
  const link = view.getByRole('link', { name: 'read more' });
  link.focus();
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(codeToHtml).not.toHaveBeenCalled();
  expect(view.getByRole('heading', { name: 'Inline article' })).toBe(heading);
  expect(document.activeElement).toBe(link);
  expect(view.container.querySelector('pre')).toBeNull();
});

it('highlights only the fenced command in a document containing inline code', async () => {
  const view = render(<MemoryRouter><ThemeProvider><MarkdownRenderer content={'Use `inline-command`.\n\n```sh\nprintf hello\n```'} /></ThemeProvider></MemoryRouter>);
  await waitFor(() => { expect(view.container.querySelector('.shiki-wrapper pre')).toHaveTextContent('printf hello'); });
  expect(codeToHtml).toHaveBeenCalledExactlyOnceWith('printf hello\n', expect.objectContaining({ lang: 'sh' }));
  expect(view.getByText('inline-command').tagName).toBe('CODE');
});

it('preserves unlabelled and empty fences and the JSON renderer', async () => {
  const view = render(<MemoryRouter><ThemeProvider><MarkdownRenderer content={'```\nplain command\n```\n\n```\n```\n\n```json\n{"ready":true}\n```'} /></ThemeProvider></MemoryRouter>);
  await waitFor(() => { expect(codeToHtml).toHaveBeenCalledExactlyOnceWith('plain command\n', expect.objectContaining({ lang: 'plaintext' })); });
  expect(view.container.querySelector('pre code:empty')).not.toBeNull();
  expect(view.getByText('"ready"')).toBeInTheDocument();
});

it('preserves authored attributes on inline and unhighlighted preformatted code', async () => {
  const view = render(<MemoryRouter><ThemeProvider><MarkdownRenderer content={'<code id="inline-anchor" title="Inline title">inline</code>\n\n<pre><code id="empty-anchor" title="Empty title"></code></pre>'} /></ThemeProvider></MemoryRouter>);
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(view.getByTitle('Inline title')).toHaveAttribute('id', 'inline-anchor');
  expect(view.getByTitle('Empty title')).toHaveAttribute('id', 'empty-anchor');
  expect(codeToHtml).not.toHaveBeenCalled();
});

it('displays and copies distinct commands whose first 100 characters match', async () => {
  const prefix = 'curl --fail-with-body --silent --show-error --get \\\n  "$STACKWEAVER_URL/api/v2/admin/users" \\\n  --header "Authorization: Bearer $TFE_TOKEN" \\\n  --data-urlencode ';
  const commands = [prefix + "'filter[admin]=true'", prefix + "'q=engineer@example.com'"];
  expect(commands[0].slice(0, 100)).toBe(commands[1].slice(0, 100));
  const copy = vi.fn().mockResolvedValue(undefined);
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  try {
    const { container } = render(<MemoryRouter><ThemeProvider><MarkdownRenderer content={commands.map(code => '```bash\n' + code + '\n```').join('\n\n')} /></ThemeProvider></MemoryRouter>);
    await waitFor(() => {
      const blocks = container.querySelectorAll('.shiki-wrapper pre');
      expect(blocks).toHaveLength(2);
      commands.forEach((code, index) => { expect(blocks[index].textContent).toBe(code + '\n'); });
    });
    for (let index = 0; index < commands.length; index++) {
      const wrapper = container.querySelectorAll<HTMLElement>('.shiki-wrapper')[index];
      fireEvent.click(within(wrapper).getByRole('button', { name: 'Copy code' }));
      await waitFor(() => { expect(copy).toHaveBeenNthCalledWith(index + 1, commands[index]); });
    }
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});
