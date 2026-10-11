// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for Sessions' `immutability` warning fix (the mount effect
// referenced `loadSessions` before its declaration; the fix reorders the declaration
// above the effect). Pins: on mount sessions are fetched and rendered, and revoking
// a session calls the API and reloads.
//
// Revoking asks for confirmation in the in-app dialog, not the browser's native
// `confirm`: the session is revoked only once the dialog's confirm button is clicked,
// and never when the dialog is cancelled.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  // A native confirm that would say yes: if the page still called it, the session would be
  // revoked without the in-app dialog and the assertions below would catch it.
  const nativeConfirm = vi.fn(() => true);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsApi.listSessions).mockResolvedValue({ sessions: [mockSession] });
    vi.mocked(settingsApi.revokeSession).mockResolvedValue({ message: 'ok' });
    vi.stubGlobal('confirm', nativeConfirm);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads sessions on mount and renders them', async () => {
    render(<MemoryRouter><Sessions /></MemoryRouter>);

    expect(await screen.findByText('Firefox on Linux')).toBeInTheDocument();
    expect(screen.queryByText('Loading sessions...')).not.toBeInTheDocument();
    expect(settingsApi.listSessions).toHaveBeenCalledTimes(1);
  });

  it('revokes a session only after the in-app dialog is confirmed, then reloads the list', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Sessions /></MemoryRouter>);

    await screen.findByText('Firefox on Linux');
    await user.click(screen.getByRole('button', { name: /revoke/i }));

    // The click opens the in-app dialog and revokes nothing yet.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Revoke session?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Are you sure you want to revoke this session? You will be logged out from that device.'
      )
    ).toBeInTheDocument();
    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(settingsApi.revokeSession).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(settingsApi.revokeSession).toHaveBeenCalledWith('s1');
    });
    expect(settingsApi.revokeSession).toHaveBeenCalledTimes(1);
    // reload after revoke: listSessions called on mount + after revoke
    await waitFor(() => {
      expect(settingsApi.listSessions).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('does not revoke the session when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Sessions /></MemoryRouter>);

    await screen.findByText('Firefox on Linux');
    await user.click(screen.getByRole('button', { name: /revoke/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(settingsApi.revokeSession).not.toHaveBeenCalled();
    // Nothing was revoked, so the list is not reloaded either.
    expect(settingsApi.listSessions).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Firefox on Linux')).toBeInTheDocument();
  });
});
