// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The page Microsoft returns to after an Azure DevOps authorization. It hands the code and the
// state to the server unchanged, and afterwards returns to the page the flow was started from,
// which it reads out of the signed state.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { vcsConnectionsApi } from '@/api/client';
import { readAzureDevOpsInstallState } from '@/lib/vcs';
import AzureDevOpsCallback from './AzureDevOpsCallback';

vi.mock('@/api/client', () => ({
  vcsConnectionsApi: {
    completeAzureDevOpsInstallation: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** A state shaped like the one the server issues; the signature is the server's to check. */
function issuedState(orgName: string, adoOrg: string, returnPath: string): string {
  const payload = [orgName, adoOrg, encodeURIComponent(returnPath), 'nonce'].join('|');
  const b64 = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64}.1792108636.c2lnbmF0dXJl`;
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/vcs/azure-devops/callback${search}`]}>
      <Routes>
        <Route path="/vcs/azure-devops/callback" element={<AzureDevOpsCallback />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AzureDevOpsCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes with the state unchanged and returns to where the flow started', async () => {
    vi.mocked(vcsConnectionsApi.completeAzureDevOpsInstallation).mockResolvedValue({} as never);
    const state = issuedState('acme', 'acme-ado', '/app/acme/settings/vcs-connections');

    renderAt(`?code=abc&state=${encodeURIComponent(state)}`);

    await waitFor(() => {
      expect(vcsConnectionsApi.completeAzureDevOpsInstallation).toHaveBeenCalledWith('abc', state);
    });
    expect(await screen.findByTestId('where')).toHaveTextContent('/app/acme/settings/vcs-connections');
    expect(toast.success).toHaveBeenCalled();
  });

  it('returns to the organization the flow started from after a refusal', async () => {
    vi.mocked(vcsConnectionsApi.completeAzureDevOpsInstallation).mockRejectedValue(new Error('Invalid or expired state parameter'));
    const state = issuedState('acme', 'acme-ado', '');

    renderAt(`?code=abc&state=${encodeURIComponent(state)}`);

    expect(await screen.findByTestId('where')).toHaveTextContent('/app/acme/settings/vcs-connections');
    expect(toast.error).toHaveBeenCalledWith('Invalid or expired state parameter');
  });

  it('completes nothing for a state that is not one the server issues', async () => {
    renderAt('?code=abc&state=not-a-state');

    expect(await screen.findByTestId('where')).toHaveTextContent('/');
    expect(vcsConnectionsApi.completeAzureDevOpsInstallation).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('readAzureDevOpsInstallState', () => {
  it('reads the organization and return path', () => {
    expect(readAzureDevOpsInstallState(issuedState('acme', 'acme-ado', '/app/acme/workspaces'))).toEqual({
      orgName: 'acme',
      returnPath: '/app/acme/workspaces',
    });
  });

  it('keeps no return path that leaves the app', () => {
    expect(readAzureDevOpsInstallState(issuedState('acme', 'x', '//evil.example/'))).toEqual({ orgName: 'acme', returnPath: null });
  });

  it('is null for anything that is not an issued state', () => {
    expect(readAzureDevOpsInstallState('')).toBeNull();
    expect(readAzureDevOpsInstallState('acme|x|%2F|n')).toBeNull();
  });
});
