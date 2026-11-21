// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Layers, XCircle } from 'lucide-react';
import { StatusFilterChip, StatusFilterChips } from './StatusFilterChips';

function chips(onErrored = () => {}) {
  return (
    <StatusFilterChips>
      <StatusFilterChip icon={Layers} label="All" count={4} tone="purple" active onClick={() => {}} />
      <StatusFilterChip icon={XCircle} label="Errored" count={1} tone="red" active={false} onClick={onErrored} />
    </StatusFilterChips>
  );
}

describe('StatusFilterChips', () => {
  it('names each chip by its label and count and reports which one is selected', () => {
    const onErrored = vi.fn();
    render(chips(onErrored));
    const all = screen.getByRole('button', { name: 'All: 4' });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(all.getAttribute('title')).toBe('All');
    const errored = screen.getByRole('button', { name: 'Errored: 1' });
    expect(errored.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(errored);
    expect(onErrored).toHaveBeenCalledOnce();
  });

  it('shows the labels while there is room for them', () => {
    render(chips());
    const group = screen.getByRole('group', { name: 'Filter by status' });
    expect(within(group).getByText('Errored')).toBeTruthy();
  });

  it('keeps the measuring copy out of the accessibility tree and the tab order', () => {
    const { container } = render(chips());
    expect(screen.getAllByRole('button')).toHaveLength(2);
    const copy = container.querySelector('[aria-hidden="true"][inert]');
    expect(copy?.querySelectorAll('button')).toHaveLength(2);
  });
});
