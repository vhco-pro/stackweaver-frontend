// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ReactNode } from 'react';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));
// The browser pass exercises the Radix portal. This test checks which source is handed to it.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
afterEach(() => localStorage.removeItem('theme'));

it('opens the displayed dark screenshot in the zoom dialog', async () => {
  localStorage.setItem('theme', 'dark');
  render(<MemoryRouter><ThemeProvider><MarkdownRenderer content={'![Example dashboard](./images/dashboard.png "Example data")'} docPath="user-guides/reading-the-dashboard" /></ThemeProvider></MemoryRouter>);
  const image = screen.getByRole('img', { name: 'Example dashboard' });
  expect(image).toHaveAttribute('src', '/docs/user-guides/images/dashboard-dark.png');
  fireEvent.click(image);
  expect((await screen.findByRole('dialog')).querySelector('img')).toHaveAttribute('src', '/docs/user-guides/images/dashboard-dark.png');
});

it('zooms the light fallback when a dark variant is absent', async () => {
  localStorage.setItem('theme', 'dark');
  render(<MemoryRouter><ThemeProvider><MarkdownRenderer content="![Example control](./control.png)" docPath="user-guides/example" /></ThemeProvider></MemoryRouter>);
  const image = screen.getByRole('img', { name: 'Example control' });
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/docs/user-guides/control.png');
  fireEvent.click(image);
  expect((await screen.findByRole('dialog')).querySelector('img')).toHaveAttribute('src', '/docs/user-guides/control.png');
});

it.each([
  'https://status.example.com/project/badge',
  'http://images.example.com/diagram.png',
  '//images.example.com/status.svg',
])('preserves the external image source in dark mode: %s', (src) => {
  localStorage.setItem('theme', 'dark');
  render(<MemoryRouter><ThemeProvider><MarkdownRenderer content={`![External evidence](${src})`} docPath="security/example" /></ThemeProvider></MemoryRouter>);
  expect(screen.getByRole('img', { name: 'External evidence' })).toHaveAttribute('src', src);
});
