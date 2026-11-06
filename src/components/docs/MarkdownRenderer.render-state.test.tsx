// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { codeToHtml } from '@/lib/highlighter';
import { MarkdownRenderer } from './MarkdownRenderer';
import { stubFenceViewport } from '@/test/stubFenceViewport';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));
vi.mock('@/lib/highlighter', () => ({ codeToHtml: vi.fn(), isUnknownLanguageError: () => false }));

const content = '# Reader state\n\n<details>\n<summary>Configuration</summary>\n\n[Read more](https://example.com).\n\n<details>\n<summary>Nested context</summary>\n\nKeep this open.\n\n</details>\n\n```sh\nprintf hello\n```\n\n</details>';
const html = '<pre class="shiki"><code>printf hello</code></pre>';
const viewFor = (text: string) => <MemoryRouter><ThemeProvider><MarkdownRenderer content={text} /></ThemeProvider></MemoryRouter>;

beforeEach(() => {
  stubFenceViewport();
  document.documentElement.classList.remove('dark');
  vi.mocked(codeToHtml).mockReset().mockResolvedValue(html);
});
afterEach(() => {
  vi.unstubAllGlobals(); document.documentElement.classList.remove('dark'); });

it.each(['summary', 'link'] as const)('keeps open sections and focused %s when highlighting finishes', async target => {
  let finish: (value: string) => void = () => { throw new Error('Highlight has not started'); };
  const pending = new Promise<string>(resolve => { finish = resolve; });
  vi.mocked(codeToHtml).mockReturnValue(pending);
  const view = render(viewFor(content));
  await waitFor(() => { expect(codeToHtml).toHaveBeenCalledOnce(); });
  const heading = view.getByRole('heading', { name: 'Reader state' });
  const sections = [...view.container.querySelectorAll('details')];
  sections.forEach(section => { section.open = true; });
  const focus = target === 'summary' ? view.getByText('Configuration').closest('summary') : view.getByRole('link', { name: 'Read more' });
  if (!(focus instanceof HTMLElement)) throw new Error('Missing focus target');
  focus.focus();
  expect(document.activeElement).toBe(focus);
  await act(async () => { finish(html); await pending; });
  await waitFor(() => { expect(view.container.querySelector('.shiki')).toBeInTheDocument(); });
  expect(view.getByRole('heading', { name: 'Reader state' })).toBe(heading);
  expect([...view.container.querySelectorAll('details')]).toEqual(sections);
  sections.forEach(section => { expect(section.open).toBe(true); });
  expect(document.activeElement).toBe(focus);
});

it('keeps the copy control and surrounding section mounted while copy feedback changes', async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  try {
    const view = render(viewFor(content));
    const button = await view.findByRole('button', { name: 'Copy code' });
    const section = view.container.querySelector('details');
    if (!section) throw new Error('Missing section');
    section.open = true;
    button.focus();
    fireEvent.click(button);
    await waitFor(() => { expect(copy).toHaveBeenCalledExactlyOnceWith('printf hello'); });
    expect(await view.findByRole('button', { name: 'Copied' })).toBe(button);
    expect(view.container.querySelector('details')).toBe(section);
    expect(section.open).toBe(true);
    expect(document.activeElement).toBe(button);
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it.each(['summary', 'copy'] as const)('refreshes highlighting without replacing the focused %s', async target => {
  const view = render(viewFor(content));
  await waitFor(() => { expect(view.container.querySelector('.shiki')).toBeInTheDocument(); });
  const section = view.container.querySelector('details');
  const summary = view.getByText('Configuration').closest('summary');
  if (!section || !summary) throw new Error('Missing disclosure');
  section.open = true;
  const focus = target === 'summary' ? summary : view.getByRole('button', { name: 'Copy code' });
  focus.focus();
  let finish: (value: string) => void = () => { throw new Error('Refresh has not started'); };
  const refreshed = new Promise<string>(resolve => { finish = resolve; });
  vi.mocked(codeToHtml).mockReturnValueOnce(refreshed);
  await act(async () => {
    document.documentElement.classList.add('dark');
    await Promise.resolve(); // Flush the MutationObserver before checking highlighting.
  });
  await waitFor(() => { expect(codeToHtml).toHaveBeenLastCalledWith('printf hello\n', { lang: 'sh', theme: 'github-dark', tabindex: false }); });
  expect(view.container.querySelector('.shiki')).toBeNull();
  expect(focus).toBeInTheDocument();
  expect(document.activeElement).toBe(focus);
  await act(async () => { finish(html); await refreshed; });
  await waitFor(() => { expect(view.container.querySelector('.shiki')).toBeInTheDocument(); });
  expect(focus).toBeInTheDocument();
  expect(view.container.querySelector('details')).toBe(section);
  expect(section.open).toBe(true);
  expect(document.activeElement).toBe(focus);
});

it('renders changed document content instead of retaining the cached article', () => {
  const view = render(viewFor('# First document\n\nFirst body.'));
  view.rerender(viewFor('# Second document\n\nSecond body.'));
  expect(view.queryByRole('heading', { name: 'First document' })).toBeNull();
  expect(view.getByRole('heading', { name: 'Second document' })).toBeInTheDocument();
  expect(view.getByText('Second body.')).toBeInTheDocument();
});
