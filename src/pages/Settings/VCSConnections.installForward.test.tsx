// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The VCS Connections and Project pages never complete a GitHub App installation themselves: an
// installation id that arrives on them is forwarded, query and all, to the App's Setup URL page,
// which carries it on to the App's authorization.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import VCSConnections from './VCSConnections';
import ProjectDetail from '../ProjectDetail';

vi.mock('@/api/client', () => ({
  vcsConnectionsApi: {
    list: vi.fn().mockResolvedValue([]),
    createConnectionFromInstallation: vi.fn(),
  },
  projectsApi: { get: vi.fn().mockReturnValue(new Promise(() => {})) },
  workspacesApi: { list: vi.fn().mockReturnValue(new Promise(() => {})) },
}));

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderAt(path: string, pattern: string, element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={pattern} element={element} />
          <Route path="/vcs/github/installed" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('an installation id on a page other than the Setup URL page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is forwarded unchanged from VCS Connections', async () => {
    renderAt('/app/acme/settings/vcs-connections?installation_id=4242&setup_action=install&state=abc',
      '/app/:orgName/settings/vcs-connections', <VCSConnections />);

    expect(await screen.findByTestId('where')).toHaveTextContent('/vcs/github/installed?installation_id=4242&setup_action=install&state=abc');
  });

  it('is forwarded unchanged from a project page', async () => {
    renderAt('/app/acme/projects/p1?installation_id=4242&state=abc',
      '/app/:orgName/projects/:projectName', <ProjectDetail />);

    expect(await screen.findByTestId('where')).toHaveTextContent('/vcs/github/installed?installation_id=4242&state=abc');
  });
});
