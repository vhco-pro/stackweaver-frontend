// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for Sessions' `immutability` warning fix (the mount effect
// referenced `loadSessions` before its declaration; the fix reorders the declaration
// above the effect). Pins: on mount sessions are fetched and rendered, and revoking
// a session calls the API and reloads.
//
// Revoking asks for confirmation in the in-app dialog, not the browser's native
// `confirm`: the session is revoked only once the dialog's confirm button is clicked,
// and never when the dialog is cancelled.
//
// The fetch stub answers the settings routes with JSON:API documents (a `sessions` collection,
// 204 to the revoke), so the page reads them through the real API client.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { stubJsonApiFetch, requestsTo, type SentRequest } from '@/test/jsonapi-fetch';
import Sessions from './Sessions';


vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({}),
}));

const sessionsDocument = {
  data: [
    {
      id: 's1',
      type: 'sessions',
      attributes: {
        'user-agent': 'Firefox on Linux',
        'ip-address': '10.0.0.1',
        'creation-date': '2026-06-01T10:00:00Z',
        'expiration-date': '2026-06-08T10:00:00Z',
        factors: ['password'],
        'is-current': true,
      },
    },
  ],
  meta: {
    pagination: { 'current-page': 1, 'page-size': 1, 'prev-page': null, 'next-page': null, 'total-pages': 1, 'total-count': 1 },
  },
};

const LIST = 'GET /settings/sessions';
const REVOKE = 'DELETE /settings/sessions/s1';

describe('Sessions', () => {
  // A native confirm that would say yes: if the page still called it, the session would be
  // revoked without the in-app dialog and the assertions below would catch it.
  const nativeConfirm = vi.fn(() => true);
  let sent: () => SentRequest[];

  beforeEach(() => {
    vi.clearAllMocks();
    sent = stubJsonApiFetch({
      [LIST]: { body: sessionsDocument },
      [REVOKE]: { status: 204 },
    });
    vi.stubGlobal('confirm', nativeConfirm);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads sessions on mount and renders them', async () => {
    render(<MemoryRouter><Sessions /></MemoryRouter>);

    expect(await screen.findByText('Firefox on Linux')).toBeInTheDocument();
    expect(screen.queryByText('Loading sessions...')).not.toBeInTheDocument();
    expect(requestsTo(sent(), LIST)).toHaveLength(1);
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
    expect(requestsTo(sent(), REVOKE)).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(requestsTo(sent(), REVOKE)).toHaveLength(1);
    });
    // reload after revoke: listSessions called on mount + after revoke
    await waitFor(() => {
      expect(requestsTo(sent(), LIST)).toHaveLength(2);
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
    expect(requestsTo(sent(), REVOKE)).toHaveLength(0);
    // Nothing was revoked, so the list is not reloaded either.
    expect(requestsTo(sent(), LIST)).toHaveLength(1);
    expect(screen.getByText('Firefox on Linux')).toBeInTheDocument();
  });
});
