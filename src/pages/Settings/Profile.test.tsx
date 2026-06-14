// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for Profile's `immutability` warning fix (the mount effect
// referenced `loadProfile` before its declaration; the fix reorders the declaration
// above the effect). Pins the observable contract: on mount the profile is fetched
// and its values populate the form inputs.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { settingsApi } from '@/api/client';
import Profile from './Profile';

vi.mock('@/api/client', () => ({
  settingsApi: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

const mockProfile = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  username: 'ada',
  bio: 'Mathematician',
  company: 'Analytical Engines',
  location: 'London',
  created_at: '',
  updated_at: '',
};

describe('Profile', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getProfile).mockResolvedValue(mockProfile);
  });

  it('loads the profile on mount and populates the form', async () => {
    render(<MemoryRouter><Profile /></MemoryRouter>);

    // Form is populated from the fetched profile once the mount load resolves.
    expect(await screen.findByDisplayValue('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ada@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ada')).toBeInTheDocument();
    expect(settingsApi.getProfile).toHaveBeenCalledTimes(1);
  });
});
