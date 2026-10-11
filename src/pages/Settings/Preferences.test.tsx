// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the accessible name of every preference toggle: each switch is announced with the
// setting printed beside it, never as a bare "switch".

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RunDisplayPreferencesProvider } from '@/contexts/RunDisplayPreferencesContext';
import Preferences from './Preferences';

function renderPage() {
  return render(
    <MemoryRouter>
      <RunDisplayPreferencesProvider>
        <Preferences />
      </RunDisplayPreferencesProvider>
    </MemoryRouter>
  );
}

describe('Preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('names each toggle after the setting beside it', () => {
    renderPage();

    expect(screen.getByRole('switch', { name: 'Compact Mode' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Show Action Text' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Show Total Changes Badge' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Show Terminal During Planning' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('switch')).toHaveLength(4);
  });

  it('flips a general and a run display toggle on click', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('switch', { name: 'Compact Mode' }));
    expect(screen.getByRole('switch', { name: 'Compact Mode' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('switch', { name: 'Show Total Changes Badge' }));
    expect(screen.getByRole('switch', { name: 'Show Total Changes Badge' })).toHaveAttribute('aria-checked', 'false');
  });
});
