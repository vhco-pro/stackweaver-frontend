// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The page GitHub returns to after a person authorizes the GitHub App (the App's callback URL).
// It completes the installation the authorization state names, handing the code and the state to
// the server unchanged; the server connects it only if the person can access the installation.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { vcsConnectionsApi } from '@/api/client';
import { readGitHubAuthorizeState } from '@/lib/vcs';
import GitHubAuthorized from './GitHubAuthorized';

vi.mock('@/api/client', () => ({
  vcsConnectionsApi: {
    createConnectionFromInstallation: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** An authorization state shaped like the one the server issues. */
function authorizeState(orgName: string, returnPath: string, installationId: string): string {
  const payload = [orgName, encodeURIComponent(returnPath), '7f1d2c3b-0000-4000-8000-000000000001', installationId, 'nonce'].join('|');
  const b64 = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64}.1792108636.c2lnbmF0dXJl`;
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/vcs/github/authorized${search}`]}>
      <Routes>
        <Route path="/vcs/github/authorized" element={<GitHubAuthorized />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GitHubAuthorized', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('completes the installation the state names with the code and the state unchanged', async () => {
    vi.mocked(vcsConnectionsApi.createConnectionFromInstallation).mockResolvedValue({} as never);
    const state = authorizeState('acme', '/app/acme/settings/vcs-connections', '4242');

    renderAt(`?code=gh-code&state=${encodeURIComponent(state)}`);

    await waitFor(() => {
      expect(vcsConnectionsApi.createConnectionFromInstallation).toHaveBeenCalledWith('acme', '4242', 'gh-code', state);
    });
    expect(await screen.findByTestId('where')).toHaveTextContent('/app/acme/settings/vcs-connections');
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the server refusal and returns to where the flow started', async () => {
    vi.mocked(vcsConnectionsApi.createConnectionFromInstallation).mockRejectedValue(
      Object.assign(new Error('The GitHub account you authorized cannot access this installation of the GitHub App.'), { status: 403 }),
    );
    const state = authorizeState('acme', '/app/acme/settings/vcs-connections', '4242');

    renderAt(`?code=gh-code&state=${encodeURIComponent(state)}`);

    expect(await screen.findByTestId('where')).toHaveTextContent('/app/acme/settings/vcs-connections');
    expect(toast.error).toHaveBeenCalledWith('The GitHub account you authorized cannot access this installation of the GitHub App.');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('completes nothing when the authorization was declined at GitHub', async () => {
    const state = authorizeState('acme', '/app/acme/settings/vcs-connections', '4242');

    renderAt(`?error=access_denied&state=${encodeURIComponent(state)}`);

    expect(await screen.findByTestId('where')).toHaveTextContent('/app/acme/settings/vcs-connections');
    expect(vcsConnectionsApi.createConnectionFromInstallation).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('completes nothing for a state that is not one the server issues', async () => {
    renderAt('?code=gh-code&state=not-a-state');

    expect(await screen.findByTestId('where')).toHaveTextContent('/');
    expect(vcsConnectionsApi.createConnectionFromInstallation).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('readGitHubAuthorizeState', () => {
  it('reads the organization, return path and installation', () => {
    expect(readGitHubAuthorizeState(authorizeState('acme', '/app/acme/workspaces', '4242'))).toEqual({
      orgName: 'acme',
      returnPath: '/app/acme/workspaces',
      installationId: '4242',
    });
  });

  it('is null for an install state or anything else', () => {
    const install = btoa('acme|%2F|u|n').replace(/=+$/, '') + '.1.sig';
    expect(readGitHubAuthorizeState(install)).toBeNull();
    expect(readGitHubAuthorizeState('')).toBeNull();
  });
});
