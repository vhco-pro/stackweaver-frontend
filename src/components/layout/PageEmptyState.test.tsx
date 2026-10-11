// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the empty-state card and the rule that goes with it: when a list has nothing in it
// the card carries the page's primary action (the header shows none), and when a list is
// empty only because of a search or filter the card offers to clear the filter instead.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Layers } from 'lucide-react';
import { PageEmptyState } from './PageEmptyState';

const action = <button type="button">New Variable Set</button>;

describe('PageEmptyState', () => {
  it('shows the icon, title, description and the primary action when nothing exists yet', () => {
    const { container } = render(
      <PageEmptyState
        icon={Layers}
        title="No variable sets yet"
        description="Create one to share variables across workspaces."
        action={action}
      />
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('No variable sets yet')).toBeInTheDocument();
    expect(screen.getByText('Create one to share variables across workspaces.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Variable Set' })).toBeInTheDocument();
  });

  it('uses the dashed empty surface', () => {
    const { container } = render(<PageEmptyState icon={Layers} title="No variable sets yet" />);
    expect(container.firstElementChild).toHaveClass('border-dashed');
  });

  it('renders no action for a user who may not create', () => {
    render(<PageEmptyState icon={Layers} title="No variable sets yet" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a second way to start beside the primary action, and drops it with the filter', () => {
    const second = <button type="button">Import from repository</button>;
    const { rerender } = render(
      <PageEmptyState icon={Layers} title="No playbooks yet" action={action} secondaryAction={second} />
    );
    expect(screen.getByRole('button', { name: 'New Variable Set' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from repository' })).toBeInTheDocument();

    rerender(
      <PageEmptyState icon={Layers} title="No playbooks match" action={action} secondaryAction={second} filtered />
    );
    expect(screen.queryByRole('button', { name: 'Import from repository' })).toBeNull();
  });

  it('offers to clear the filter, and not the primary action, when a filter emptied the list', async () => {
    const onClearFilters = vi.fn();
    render(
      <PageEmptyState
        icon={Layers}
        title="No variable sets match"
        action={action}
        filtered
        onClearFilters={onClearFilters}
      />
    );
    expect(screen.queryByRole('button', { name: 'New Variable Set' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
