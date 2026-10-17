// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for Security's two `immutability` warning fixes (the mount
// effect referenced `load2FAStatus` and `loadSessions` before their declarations;
// the fix reorders the effect below all three load functions). Pins: all three
// mount loaders fire on mount and the page renders without crashing.
//
// The fetch stub answers the settings routes with JSON:API documents (the `two-factor`
// resource, the `mfa-devices` and `sessions` collections, 204 to the disable), so the page
// reads them through the real API client.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { stubJsonApiFetch, requestsTo, type Routes, type SentRequest } from '@/test/jsonapi-fetch';
import Security from './Security';

vi.mock('@/lib/zitadel', () => ({ getAccessToken: () => 'test-token' }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({}),
}));

const emptyPage = {
  pagination: { 'current-page': 1, 'page-size': 0, 'prev-page': null, 'next-page': null, 'total-pages': 1, 'total-count': 0 },
};

function twoFactorDocument(enabled: boolean) {
  return { data: { id: 'u1', type: 'two-factor', attributes: { enabled } } };
}

const STATUS = 'GET /settings/2fa/status';
const DEVICES = 'GET /settings/mfa-devices';
const SESSIONS = 'GET /settings/sessions';
const DISABLE = 'DELETE /settings/2fa';

function routes(twoFactorEnabled: boolean): Routes {
  return {
    [STATUS]: { body: twoFactorDocument(twoFactorEnabled) },
    [DEVICES]: { body: { data: [], meta: emptyPage } },
    [SESSIONS]: { body: { data: [], meta: emptyPage } },
    [DISABLE]: { status: 204 },
  };
}

describe('Security', () => {
  let sent: () => SentRequest[];

  beforeEach(() => {
    sent = stubJsonApiFetch(routes(false));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs all three mount loaders and renders the page', async () => {
    render(<MemoryRouter><Security /></MemoryRouter>);

    // The page heading renders synchronously; the loaders fire on mount.
    expect(await screen.findByRole('heading', { name: /security/i })).toBeInTheDocument();
    // Each loader awaits the client's token lookup before its fetch, so the three land a tick apart.
    await waitFor(() => {
      expect(requestsTo(sent(), STATUS)).toHaveLength(1);
      expect(requestsTo(sent(), DEVICES)).toHaveLength(1);
      expect(requestsTo(sent(), SESSIONS)).toHaveLength(1);
    });
  });

  // Clicking this toggle starts the setup flow or asks to disable, so its state changes only
  // once the server agrees. What is pinned here is its name and that it reflects the status.
  it('names the two-factor toggle and reflects the loaded status', async () => {
    render(<MemoryRouter><Security /></MemoryRouter>);

    expect(await screen.findByRole('switch', { name: 'Two-Factor Authentication' })).toHaveAttribute('aria-checked', 'false');
  });

  it('turns the two-factor toggle off only after the disable dialog is confirmed', async () => {
    sent = stubJsonApiFetch(routes(true));
    const user = userEvent.setup();
    render(<MemoryRouter><Security /></MemoryRouter>);

    const toggle = await screen.findByRole('switch', { name: 'Two-Factor Authentication' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.click(toggle);

    const dialog = await screen.findByRole('dialog');
    expect(requestsTo(sent(), DISABLE)).toHaveLength(0);
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.click(within(dialog).getByRole('button', { name: 'Disable 2FA' }));

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Two-Factor Authentication' })).toHaveAttribute('aria-checked', 'false');
    });
    expect(requestsTo(sent(), DISABLE)).toHaveLength(1);
  });
});
