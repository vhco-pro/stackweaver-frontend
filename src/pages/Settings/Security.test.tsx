// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for Security's two `immutability` warning fixes (the mount
// effect referenced `load2FAStatus` and `loadSessions` before their declarations;
// the fix reorders the effect below all three load functions). Pins: all three
// mount loaders fire on mount and the page renders without crashing.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { settingsApi, twoFactorApi } from '@/api/client';
import Security from './Security';

vi.mock('@/api/client', () => ({
  settingsApi: {
    listSessions: vi.fn(),
    changePassword: vi.fn(),
    revokeSession: vi.fn(),
  },
  twoFactorApi: {
    getStatus: vi.fn(),
    listDevices: vi.fn(),
    start: vi.fn(),
    verify: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({}),
}));

describe('Security', () => {
  beforeEach(() => {
    vi.mocked(twoFactorApi.getStatus).mockResolvedValue({ enabled: false });
    vi.mocked(twoFactorApi.listDevices).mockResolvedValue({ devices: [] });
    vi.mocked(settingsApi.listSessions).mockResolvedValue({ sessions: [] });
  });

  it('runs all three mount loaders and renders the page', async () => {
    render(<MemoryRouter><Security /></MemoryRouter>);

    // The page heading renders synchronously; the loaders fire on mount.
    expect(await screen.findByRole('heading', { name: /security/i })).toBeInTheDocument();
    expect(twoFactorApi.getStatus).toHaveBeenCalledTimes(1);
    expect(twoFactorApi.listDevices).toHaveBeenCalledTimes(1);
    expect(settingsApi.listSessions).toHaveBeenCalledTimes(1);
  });
});
