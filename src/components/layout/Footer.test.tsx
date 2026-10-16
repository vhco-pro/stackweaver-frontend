// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the public footer: every entry leads somewhere real, external ones to the public
// organization, and the bottom row is the copyright line and nothing else.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );

const EXTERNAL: Record<string, string> = {
  'License (BSL 1.1)': 'https://github.com/vhco-pro/stackweaver-api/blob/main/LICENSE',
  'Trademark Policy': 'https://github.com/vhco-pro/.github/blob/main/TRADEMARK.md',
  'Security Policy': 'https://github.com/vhco-pro/.github/blob/main/SECURITY.md',
  Support: 'https://github.com/vhco-pro/.github/blob/main/SUPPORT.md',
};

describe('Footer', () => {
  it('links the four external entries to their exact public URLs', () => {
    renderFooter();
    for (const [name, href] of Object.entries(EXTERNAL)) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('links Privacy Policy and Terms of Service to their in-app pages', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
  });

  it('has no placeholder link and no promise of a link to come', () => {
    const { container } = renderFooter();
    for (const a of container.querySelectorAll('a')) {
      expect(a.getAttribute('href'), a.textContent ?? '').not.toBe('#');
    }
    expect(container.textContent).not.toMatch(/available soon/i);
  });

  it('points every GitHub link at the public organization', () => {
    const { container } = renderFooter();
    const github = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '').filter((h) => h.includes('github.com'));
    expect(github.length).toBeGreaterThan(0);
    for (const href of github) expect(href).toMatch(/^https:\/\/github\.com\/vhco-pro(\/|$)/);
  });

  it('ends on the copyright line, with no credit line', () => {
    const { container } = renderFooter();
    const text = container.textContent ?? '';
    expect(text).toMatch(/©.*VH & Co BV/);
    expect(text).not.toMatch(/Made with/i);
    expect(container.innerHTML).not.toMatch(/truyens\.pro/);
    expect(container.innerHTML).not.toMatch(/vhco\.pro/);
  });
});
