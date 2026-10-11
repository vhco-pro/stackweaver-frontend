// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the three corrections to the privacy page: it names a contact address the project
// owns, its revision date is written down instead of being whatever day the visitor loads
// it, and it is readable in light as well as dark.

import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Privacy from './Privacy';

const renderPage = () =>
  render(
    <MemoryRouter>
      <Privacy />
    </MemoryRouter>
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('Privacy', () => {
  it('lists contact@vhco.pro and no address on a domain the project does not own', () => {
    const { container } = renderPage();
    expect(screen.getAllByText(/contact@vhco\.pro/).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/stackweaver\.io/);
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
    expect(dateIn2027).not.toMatch(/2027/);
  });

  it('pairs its background and text for light and dark', () => {
    const { container } = renderPage();
    const root = container.firstElementChild as HTMLElement;
    const classes = [...root.classList];
    expect(classes.some((c) => c.startsWith('dark:from-'))).toBe(true);
    expect(classes.some((c) => c.startsWith('from-') && !c.includes('950'))).toBe(true);
    expect(classes).toContain('dark:text-white');
    expect(classes).not.toContain('text-white');
  });
});
