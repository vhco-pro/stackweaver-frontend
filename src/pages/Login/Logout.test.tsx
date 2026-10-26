// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The login UI's sign-out (backend-for-frontend-session-plan.md, AC5, AC21): both the single
// "Sign out" and "Sign out of all" submit a form POST to /auth/session/end, where the API ends the
// session and its Zitadel session. No ID token is read or sent from the page.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Logout from './Logout';

const authClient = vi.hoisted(() => ({ searchSessions: vi.fn(), deleteSession: vi.fn() }));
vi.mock('@/api/auth-client', () => authClient);

// LoginLayout pulls in ThemeContext; render its children directly.
vi.mock('./LoginLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderLogout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login/logout']}><Logout /></MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Records the forms the page submits instead of letting jsdom try to navigate. */
function captureSubmits(): Array<{ method: string; action: string; fields: number }> {
  const submitted: Array<{ method: string; action: string; fields: number }> = [];
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
    submitted.push({ method: this.method.toLowerCase(), action: this.action, fields: this.elements.length });
  });
  return submitted;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Logout', () => {
  it('signs out through the API when no account is listed', async () => {
    authClient.searchSessions.mockResolvedValue({ sessions: [] });
    const submitted = captureSubmits();
    renderLogout();
    (await screen.findByRole('button', { name: 'Sign out' })).click();
    expect(submitted).toHaveLength(1);
    expect(submitted[0].method).toBe('post');
    expect(submitted[0].action).toMatch(/\/auth\/session\/end$/);
  });

  it('"Sign out of all" signs out through the API', async () => {
    authClient.searchSessions.mockResolvedValue({
      sessions: [{ id: 'z-1', factors: { user: { id: 'u1', loginName: 'ada@example.com', displayName: 'Ada' } } }],
    });
    const submitted = captureSubmits();
    renderLogout();
    (await screen.findByRole('button', { name: /Sign out of all/ })).click();
    expect(submitted).toHaveLength(1);
    expect(submitted[0].method).toBe('post');
    expect(submitted[0].action).toMatch(/\/auth\/session\/end$/);
    expect(submitted[0].fields, 'the form carries no ID token or other field').toBe(0);
  });
});
