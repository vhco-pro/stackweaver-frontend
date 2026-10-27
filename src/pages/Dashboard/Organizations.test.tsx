// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RoutePreloadProvider } from '@/components/routes/RoutePreloadContext';
import markup from '@/test/navigation-link-markup.json';
import { dashboardStats, orgStats } from './dashboard.fixtures';
import { Organizations } from './Organizations';
const stats = dashboardStats({ organizations: [orgStats({ name: 'demo', ansible_playbooks: 18, errored_job_templates: 2 })] });
describe('Organizations route intent', () => {
  it('preserves baseline link markup, anchor identity and keyboard focus', () => {
    const tree = () => <MemoryRouter><Organizations stats={stats} isLoading={false} isError={false} onRetry={() => undefined} /></MemoryRouter>;
    const view = render(tree());
    expect([...view.container.querySelectorAll('a')].map(a => a.outerHTML)).toEqual(markup.organizations);
    const anchor = view.container.querySelector<HTMLAnchorElement>('a[href^="/app/"]')!;
    anchor.focus(); view.rerender(tree());
    expect(view.container.querySelector('a[href^="/app/"]')).toBe(anchor);
    expect(document.activeElement).toBe(anchor);
  });
  it('starts only the destination code on pointerdown', () => {
    const prefetch = vi.fn(() => Promise.resolve());
    const Destination = Object.assign(() => null, { prefetch, preload: prefetch });
    const view = render(<MemoryRouter><RoutePreloadProvider routes={[{ path: '/app/:orgName/workspaces', element: <Destination /> }]}><Organizations stats={stats} isLoading={false} isError={false} onRetry={() => undefined} /></RoutePreloadProvider></MemoryRouter>);
    fireEvent.pointerDown(view.container.querySelector('a[href^="/app/"]')!);
    expect(prefetch).toHaveBeenCalledTimes(1);
  });
});
