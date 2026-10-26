// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));
it('keeps the summary native while prose, code and nested sections share one inset body', () => {
  const { container } = render(<MemoryRouter><ThemeProvider><MarkdownRenderer content={'<details>\n<summary>Configuration</summary>\n\nUse this value.\n\n```text\nexample: value\n```\n\n<details>\n<summary>Nested context</summary>\n\nSecondary detail.\n\n</details>\n\n</details>'} /></ThemeProvider></MemoryRouter>);
  const details = container.querySelector('details');
  const summary = screen.getByText('Configuration').closest('summary');
  expect(summary?.parentElement).toBe(details);
  const body = summary?.nextElementSibling;
  expect(body).toContainElement(screen.getByText('Use this value.'));
  expect(body?.querySelector('pre')).toHaveTextContent('example: value');
  expect(body?.querySelector('details > summary')).toHaveTextContent('Nested context');
  expect(details?.children).toHaveLength(2);
});
