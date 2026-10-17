// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the title block every page shares, and the page wrapper that owns its colour.
// These two components replace per-page hand-written headers, which is how three button
// recipes and several header shapes came to coexist.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Server } from 'lucide-react';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RAMPS } from '@/lib/ramps';
import { Page, PageDialogContent } from './Page';
import { PageHeader } from './PageHeader';

function renderInPage(ui: React.ReactNode, ramp: Parameters<typeof Page>[0]['ramp'] = 'app') {
  return render(
    <MemoryRouter>
      <Page ramp={ramp}>{ui}</Page>
    </MemoryRouter>
  );
}

const action = <button type="button">New Runner</button>;

describe('Page', () => {
  it('sets the three ring properties of its ramp on its own element', () => {
    renderInPage(<p>content</p>, 'runners');
    const root = screen.getByText('content').parentElement as HTMLElement;
    expect(root.style.getPropertyValue('--sw-ring-c1')).toBe(RAMPS.runners.ring[0]);
    expect(root.style.getPropertyValue('--sw-ring-c2')).toBe(RAMPS.runners.ring[1]);
    expect(root.style.getPropertyValue('--sw-ring-c3')).toBe(RAMPS.runners.ring[2]);
  });

  it('defaults to the app ramp', () => {
    render(
      <MemoryRouter>
        <Page>
          <p>content</p>
        </Page>
      </MemoryRouter>
    );
    const root = screen.getByText('content').parentElement as HTMLElement;
    expect(root.style.getPropertyValue('--sw-ring-c1')).toBe(RAMPS.app.ring[0]);
  });

  it('hands its ramp to dialog content, which renders through a portal outside the page', () => {
    renderInPage(
      <Dialog open>
        <PageDialogContent>
          <DialogTitle>Create runner</DialogTitle>
          <DialogDescription>Register a runner.</DialogDescription>
        </PageDialogContent>
      </Dialog>,
      'runners'
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.getPropertyValue('--sw-ring-c1')).toBe(RAMPS.runners.ring[0]);
    expect(dialog.style.getPropertyValue('--sw-ring-c3')).toBe(RAMPS.runners.ring[2]);
  });
});

describe('PageHeader', () => {
  it('renders the icon, a gradient title at one size, and the subtitle', () => {
    renderInPage(<PageHeader icon={Server} title="Inventories" subtitle="Manage Ansible inventories" />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Inventories' });
    expect(heading).toHaveClass('text-3xl', 'bg-clip-text', 'text-transparent');
    expect(heading.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Manage Ansible inventories')).toBeInTheDocument();
  });

  it('pairs the title gradient and the icon for light and dark from the page ramp', () => {
    renderInPage(<PageHeader icon={Server} title="Self-Hosted Runners" />, 'runners');
    const heading = screen.getByRole('heading', { level: 1 });
    for (const cls of RAMPS.runners.title.split(' ')) expect(heading).toHaveClass(cls);
    const icon = heading.querySelector('svg') as SVGElement;
    for (const cls of RAMPS.runners.icon.split(' ')) expect(icon).toHaveClass(cls);
  });

  it('shows a back control only when the page asks for one', () => {
    const { unmount } = renderInPage(<PageHeader icon={Server} title="Inventories" />);
    expect(screen.queryByRole('link', { name: /back to/i })).toBeNull();
    unmount();
    renderInPage(
      <PageHeader icon={Server} title="Self-Hosted Runners" backTo={{ to: '/app/demo/settings', label: 'Back to Settings' }} />
    );
    expect(screen.getByRole('link', { name: 'Back to Settings' })).toHaveAttribute('href', '/app/demo/settings');
  });

  it('gives a detail page, which passes no icon, a plain title', () => {
    renderInPage(<PageHeader title="prod-network" backTo={{ to: '/app/demo/workspaces', label: 'Back to workspaces' }} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('prod-network');
    expect(heading.querySelector('svg')).toBeNull();
  });

  it('renders the stats row and secondary actions when given', () => {
    renderInPage(
      <PageHeader icon={Server} title="Runners" stats={<span>3 total</span>} actions={<button type="button">Edit</button>} action={action} />
    );
    expect(screen.getByText('3 total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Runner' })).toBeInTheDocument();
  });

  it('does not render the primary action while the list is known to be empty', () => {
    renderInPage(<PageHeader icon={Server} title="Runners" action={action} listState="empty" />);
    expect(screen.queryByRole('button', { name: 'New Runner' })).toBeNull();
  });

  it('holds the action place with a skeleton while the first load is pending', () => {
    renderInPage(<PageHeader icon={Server} title="Runners" action={action} listState="loading" />);
    expect(screen.queryByRole('button', { name: 'New Runner' })).toBeNull();
    expect(screen.getByTestId('page-header-action-skeleton')).toBeInTheDocument();
  });

  it('shows the action when the load failed, since emptiness is unknown', () => {
    renderInPage(<PageHeader icon={Server} title="Runners" action={action} listState="error" />);
    expect(screen.getByRole('button', { name: 'New Runner' })).toBeInTheDocument();
  });

  it('renders no action, and no skeleton, for a user who may not create', () => {
    renderInPage(<PageHeader icon={Server} title="Runners" listState="loading" />);
    expect(screen.queryByTestId('page-header-action-skeleton')).toBeNull();
  });
});
