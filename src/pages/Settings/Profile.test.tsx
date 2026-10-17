// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for Profile's `immutability` warning fix (the mount effect
// referenced `loadProfile` before its declaration; the fix reorders the declaration
// above the effect). Pins the observable contract: on mount the profile is fetched
// and its values populate the form inputs.
//
// The profile is the `users` resource of the account surface, so the fetch stub answers
// GET /account/details and PATCH /account/update with that document and the page reads it
// through the real API client.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { stubJsonApiFetch, requestsTo, type SentRequest } from '@/test/jsonapi-fetch';
import Profile from './Profile';

vi.mock('@/lib/zitadel', () => ({ getAccessToken: () => 'test-token' }));

const userDocument = {
  data: {
    id: 'u1',
    type: 'users',
    attributes: {
      username: 'ada',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      bio: 'Mathematician',
      company: 'Analytical Engines',
      location: 'London',
      'avatar-url': '',
      'is-service-account': false,
      'v2-only': true,
      'created-at': '2026-06-01T10:00:00Z',
      'updated-at': '2026-06-01T10:00:00Z',
    },
  },
};

describe('Profile', () => {
  let sent: () => SentRequest[];

  beforeEach(() => {
    sent = stubJsonApiFetch({
      'GET /account/details': { body: userDocument },
      'PATCH /account/update': { body: userDocument },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the profile on mount and populates the form', async () => {
    render(<MemoryRouter><Profile /></MemoryRouter>);

    // Form is populated from the fetched profile once the mount load resolves.
    expect(await screen.findByDisplayValue('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ada@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ada')).toBeInTheDocument();
    expect(requestsTo(sent(), 'GET /account/details')).toHaveLength(1);
  });

  it('saves the form as a users document and reloads the profile', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Profile /></MemoryRouter>);

    const company = await screen.findByDisplayValue('Analytical Engines');
    await user.clear(company);
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(requestsTo(sent(), 'GET /account/details')).toHaveLength(2);
    });
    const [update] = requestsTo(sent(), 'PATCH /account/update');
    // Every field is sent; the cleared one as "" so the server clears it.
    expect(update.body).toEqual({
      data: {
        type: 'users',
        attributes: {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          username: 'ada',
          bio: 'Mathematician',
          company: '',
          location: 'London',
        },
      },
    });
  });
});
