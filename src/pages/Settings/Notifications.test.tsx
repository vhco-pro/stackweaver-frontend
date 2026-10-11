// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the accessible name of every notification toggle: a switch is announced with the
// event it belongs to and its channel, never as a bare "switch", and no two share a name.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Notifications from './Notifications';

describe('Notifications', () => {
  it('names each toggle after its event and channel', () => {
    render(<MemoryRouter><Notifications /></MemoryRouter>);

    expect(screen.getByRole('switch', { name: 'Run Status Updates: Email' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Workspace Changes: Push' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Project Updates: In-App' })).toHaveAttribute('aria-checked', 'true');

    const names = screen.getAllByRole('switch').map((toggle) => toggle.getAttribute('aria-label'));
    expect(names).toHaveLength(15);
    expect(names.every((name) => name)).toBe(true);
    expect(new Set(names).size).toBe(15);
  });

  it('flips a toggle on click and leaves its neighbours alone', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Notifications /></MemoryRouter>);

    const toggle = screen.getByRole('switch', { name: 'Team Activity: Email' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);

    expect(screen.getByRole('switch', { name: 'Team Activity: Email' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Team Activity: Push' })).toHaveAttribute('aria-checked', 'false');
  });
});
