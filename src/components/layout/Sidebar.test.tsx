// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins how the sidebar marks the page you are on: a gradient bar on the leading edge and a
// tint, with no border, ring or shadow. A boxed active item reads as a button; this one does
// not (owner decision 2026-10-11, option N1).

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Sidebar } from './Sidebar';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { email: 'admin@example.com' } }, logout: vi.fn() }),
}));
vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ currentOrg: { id: 'org-1', name: 'demo' } }),
}));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/UserAvatar', () => ({ UserAvatar: () => null }));

function renderSidebar(collapsed = false) {
  return render(
    <MemoryRouter initialEntries={['/app/demo/ansible/inventories']}>
      <Routes>
        <Route path="/app/:orgName/*" element={<Sidebar collapsed={collapsed} />} />
      </Routes>
    </MemoryRouter>
  );
}

const boxed = (el: Element) =>
  [...el.classList].filter((c) => /^(border|ring|shadow)(-|$)/.test(c) && c !== 'border-0');

describe('Sidebar active item', () => {
  it('marks the current page with a leading bar and a tint, and no border, ring or shadow', () => {
    renderSidebar();
    const active = screen.getByRole('link', { name: 'Inventories' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.querySelector('[data-active-bar]')).not.toBeNull();
    expect([...active.classList].some((c) => c.startsWith('bg-'))).toBe(true);
    expect(boxed(active)).toEqual([]);
  });

  it('leaves the other items unmarked', () => {
    renderSidebar();
    const other = screen.getByRole('link', { name: 'Playbooks' });
    expect(other).not.toHaveAttribute('aria-current');
    expect(other.querySelector('[data-active-bar]')).toBeNull();
  });

  it('keeps the bar and a tint, and stays unboxed, when the sidebar is collapsed', () => {
    const { container } = renderSidebar(true);
    const active = container.querySelector('a[aria-current="page"]') as HTMLElement;
    expect(active).not.toBeNull();
    expect(active.getAttribute('href')).toBe('/app/demo/ansible/inventories');
    expect(active.querySelector('[data-active-bar]')).not.toBeNull();
    expect([...active.classList].some((c) => c.startsWith('bg-'))).toBe(true);
    expect(boxed(active)).toEqual([]);
  });
});
