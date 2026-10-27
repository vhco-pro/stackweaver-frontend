// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));
vi.mock('@/lib/highlighter', () => ({
  codeToHtml: vi.fn((code: string) => Promise.resolve(`<pre><code>${code}</code></pre>`)),
  isUnknownLanguageError: () => false,
}));

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
      commands.forEach((code, index) => { expect(blocks[index].textContent).toBe(code); });
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
