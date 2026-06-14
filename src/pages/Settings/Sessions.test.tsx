// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for Sessions' `immutability` warning fix (the mount effect
// referenced `loadSessions` before its declaration; the fix reorders the declaration
// above the effect). Pins: on mount sessions are fetched and rendered, and revoking
// a session calls the API and reloads.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { settingsApi } from '@/api/client';
import Sessions from './Sessions';

vi.mock('@/api/client', () => ({
  settingsApi: {
    listSessions: vi.fn(),
    revokeSession: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({}),
}));

const mockSession = {
  id: 's1',
  user_id: 'u1',
  user_agent: 'Firefox on Linux',
  creation_date: '2026-06-01T10:00:00Z',
  expiration_date: '2026-06-08T10:00:00Z',
  factors: ['password'],
  is_current: true,
};

describe('Sessions', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.listSessions).mockResolvedValue({ sessions: [mockSession] });
    vi.mocked(settingsApi.revokeSession).mockResolvedValue({ message: 'ok' });
  });

  it('loads sessions on mount and renders them', async () => {
    render(<MemoryRouter><Sessions /></MemoryRouter>);

    expect(await screen.findByText('Firefox on Linux')).toBeInTheDocument();
    expect(screen.queryByText('Loading sessions...')).not.toBeInTheDocument();
    expect(settingsApi.listSessions).toHaveBeenCalledTimes(1);
  });

  it('revokes a session and reloads the list', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const user = userEvent.setup();
    render(<MemoryRouter><Sessions /></MemoryRouter>);

    await screen.findByText('Firefox on Linux');
    await user.click(screen.getByRole('button', { name: /revoke/i }));

    expect(settingsApi.revokeSession).toHaveBeenCalledWith('s1');
    // reload after revoke: listSessions called on mount + after revoke
    expect(settingsApi.listSessions).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
