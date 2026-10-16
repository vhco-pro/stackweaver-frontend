// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The page GitHub's Setup URL returns to after an installation. It hands the installation id and
// the state back to the server unchanged and sends the browser on to GitHub to authorize the App,
// which is how the server confirms the person can access the installation. It never completes
// the installation itself, and handles a refusal or a missing state with a message and a
// navigation rather than a crash.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { vcsConnectionsApi } from '@/api/client';
import { readGitHubInstallState } from '@/lib/vcs';
import GitHubInstalled from './GitHubInstalled';

vi.mock('@/api/client', () => ({
  vcsConnectionsApi: {
    authorizeGitHubInstallation: vi.fn(),
    createConnectionFromInstallation: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** A state shaped like the one the server issues; the signature is the server's to check. */
function issuedState(orgName: string, returnPath: string): string {
  const payload = [orgName, encodeURIComponent(returnPath), '7f1d2c3b-0000-4000-8000-000000000001', 'nonce'].join('|');
  const b64 = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64}.1792108636.c2lnbmF0dXJl`;
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/vcs/github/installed${search}`]}>
      <Routes>
        <Route path="/vcs/github/installed" element={<GitHubInstalled />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GitHubInstalled', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the browser to GitHub to authorize the App, passing the state through unchanged', async () => {
    vi.mocked(vcsConnectionsApi.authorizeGitHubInstallation).mockResolvedValue({
      auth_url: 'https://github.com/login/oauth/authorize?client_id=Iv1.x&state=next',
    });
    const state = issuedState('acme', '/app/acme/settings/vcs-connections');

    renderAt(`?installation_id=4242&setup_action=install&state=${encodeURIComponent(state)}`);

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://github.com/login/oauth/authorize?client_id=Iv1.x&state=next');
    });
    expect(vcsConnectionsApi.authorizeGitHubInstallation).toHaveBeenCalledWith('acme', '4242', state);
    expect(vcsConnectionsApi.createConnectionFromInstallation).not.toHaveBeenCalled();
  });

  it('shows the server refusal and returns to where the flow started', async () => {
    const refusal = Object.assign(new Error('This GitHub installation cannot be completed here.'), { status: 403 });
    vi.mocked(vcsConnectionsApi.authorizeGitHubInstallation).mockRejectedValue(refusal);
    const state = issuedState('acme', '/app/acme/settings/vcs-connections');

    renderAt(`?installation_id=4242&state=${encodeURIComponent(state)}`);

    expect(await screen.findByTestId('where')).toHaveTextContent('/app/acme/settings/vcs-connections');
    expect(toast.error).toHaveBeenCalledWith('This GitHub installation cannot be completed here.');
    expect(assign).not.toHaveBeenCalled();
  });

  it('completes nothing for an installation that came back without a state', async () => {
    renderAt('?installation_id=4242&setup_action=install');

    expect(await screen.findByTestId('where')).toHaveTextContent('/');
    expect(vcsConnectionsApi.authorizeGitHubInstallation).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('not started from Stackweaver'));
  });

  it('completes nothing for a state that is not one the server issues', async () => {
    renderAt(`?installation_id=4242&state=${encodeURIComponent('acme|%2F|uuid')}`);

    expect(await screen.findByTestId('where')).toHaveTextContent('/');
    expect(vcsConnectionsApi.authorizeGitHubInstallation).not.toHaveBeenCalled();
  });
});

describe('readGitHubInstallState', () => {
  it('reads the organization and return path', () => {
    expect(readGitHubInstallState(issuedState('acme', '/app/acme/workspaces?x=1'))).toEqual({
      orgName: 'acme',
      returnPath: '/app/acme/workspaces?x=1',
    });
  });

  it('reads a query-escaped space in the return path', () => {
    const payload = 'acme|%2Fapp%2Facme%2Fa+b|u|n';
    const state = `${btoa(payload).replace(/=+$/, '')}.1.sig`;
    expect(readGitHubInstallState(state)?.returnPath).toBe('/app/acme/a b');
  });

  it('keeps no return path that leaves the app', () => {
    expect(readGitHubInstallState(issuedState('acme', '//evil.example/x'))).toEqual({ orgName: 'acme', returnPath: null });
    expect(readGitHubInstallState(issuedState('acme', 'https://evil.example/'))).toEqual({ orgName: 'acme', returnPath: null });
  });

  it('is null for anything that is not an issued state', () => {
    expect(readGitHubInstallState(null)).toBeNull();
    expect(readGitHubInstallState('')).toBeNull();
    expect(readGitHubInstallState('acme|%2F|uuid')).toBeNull();
    expect(readGitHubInstallState('!!!.1.sig')).toBeNull();
  });
});
