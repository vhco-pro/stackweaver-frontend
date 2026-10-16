// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the terms page to the text the owner approved: sixteen clauses, the company's
// registered details, and nothing left as a placeholder.

import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Terms from './Terms';

const renderPage = () =>
  render(
    <MemoryRouter>
      <Terms />
    </MemoryRouter>
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('Terms', () => {
  it('renders sixteen numbered clauses, from who we are to contact', () => {
    const { container } = renderPage();
    const clauses = container.querySelectorAll('[data-clause]');
    expect(clauses).toHaveLength(16);
    expect([...clauses].map((c) => c.getAttribute('data-clause'))).toEqual(
      Array.from({ length: 16 }, (_, i) => String(i + 1))
    );
    expect(clauses[0].textContent).toMatch(/Who we are/);
    expect(clauses[15].textContent).toMatch(/Contact/);
  });

  it('names the company, its registered office and its enterprise number', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    expect(text).toContain('VH & Co BV');
    expect(text).toContain('Torenhoflaan 5, 3110 Rotselaar, Belgium');
    expect(text).toContain('1031.077.138');
    expect(text).toContain('courts of Leuven');
  });

  it('follows the published license and says no hosted instance is offered yet', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    expect(text).toMatch(/managed Stackweaver service/);
    expect(text).not.toMatch(/non-commercial/i);
    expect(text).toMatch(/We do not offer a hosted instance yet/);
    expect(text).toMatch(/We do not distribute or run Terraform/);
  });

  it('shows no placeholder and no long dash', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/xxx|TODO|TBD|trade mark number|date of publication/i);
    expect(text).not.toMatch(/[–—]/);
  });

  it('renders no stray punctuation between the blocks of a clause', () => {
    const { container } = renderPage();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const stray: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      // a lone full stop is fine (it follows a link); a lone comma is a leftover separator
      if (/^[,;]+$/.test(text)) stray.push(`"${text}" in clause ${node.parentElement?.closest('[data-clause]')?.getAttribute('data-clause')}`);
    }
    expect(stray).toEqual([]);
  });

  it('shows the same revision date whatever day it is loaded', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-03-05T12:00:00Z'));
    const first = renderPage();
    const dateIn2027 = first.getByText(/Last updated:/).textContent;
    first.unmount();
    vi.setSystemTime(new Date('2031-11-20T12:00:00Z'));
    const second = renderPage();
    expect(second.getByText(/Last updated:/).textContent).toBe(dateIn2027);
  });

  it('links to the privacy policy, the trademark policy and the security policy', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Trademark Policy' })).toHaveAttribute(
      'href',
      'https://github.com/vhco-pro/.github/blob/main/TRADEMARK.md'
    );
    expect(screen.getByRole('link', { name: 'Security Policy' })).toHaveAttribute(
      'href',
      'https://github.com/vhco-pro/.github/blob/main/SECURITY.md'
    );
  });

  it('pairs its background and text for light and dark', () => {
    const { container } = renderPage();
    const classes = [...(container.firstElementChild as HTMLElement).classList];
    expect(classes.some((c) => c.startsWith('dark:from-'))).toBe(true);
    expect(classes).toContain('dark:text-white');
    expect(classes).not.toContain('text-white');
  });
});
