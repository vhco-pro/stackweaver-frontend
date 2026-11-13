// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The edit workspace dialog names the OpenTofu version a run would use when the workspace pins none,
// and the level it came from (#933, D0, AC32), as it does for the run image and identity binding.

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { agentPoolsApi, terraformVersionsApi, vcsConnectionsApi, type Workspace } from '@/api/client';
import { effectiveSettingsApi, type EffectiveSetting } from '@/api/runPlacement';
import { EditWorkspaceDialog } from './EditWorkspaceDialog';

vi.mock('@/api/client', () => ({
  workspacesApi: { update: vi.fn() },
  vcsConnectionsApi: { list: vi.fn(), listAllRepositories: vi.fn(), listBranches: vi.fn(), listProjects: vi.fn() },
  agentPoolsApi: { list: vi.fn() },
  terraformVersionsApi: { listEnabled: vi.fn() },
}));
vi.mock('@/api/runPlacement', () => ({ effectiveSettingsApi: { get: vi.fn() } }));
vi.mock('@/hooks/useRunPlacement', () => ({
  useRunImages: () => ({ data: [] }),
  useIdentityBindingOptions: () => ({ data: [] }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const workspace: Workspace = {
  id: 'ws-abc',
  project_id: 'proj-1',
  name: 'network-prod',
  auto_apply: false,
  force_delete: false,
  execution_mode: 'remote',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderDialog(ws: Workspace, tofuVersion: EffectiveSetting<string> = { value: '1.10.2', level: 'project' }) {
  vi.mocked(vcsConnectionsApi.list).mockResolvedValue([]);
  vi.mocked(agentPoolsApi.list).mockResolvedValue({ data: [] } as unknown as Awaited<ReturnType<typeof agentPoolsApi.list>>);
  vi.mocked(terraformVersionsApi.listEnabled).mockResolvedValue({ data: [] });
  vi.mocked(effectiveSettingsApi.get).mockResolvedValue({ tofu_version: tofuVersion });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EditWorkspaceDialog open onOpenChange={vi.fn()} orgName="acme" workspace={ws} onUpdated={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EditWorkspaceDialog: effective OpenTofu version', () => {
  it('names the inherited version and its level when the workspace pins none', async () => {
    renderDialog(workspace);
    const hint = await screen.findByTestId('edit-tofu-version-inherited');
    expect(hint).toHaveTextContent('Inherited from');
    expect(hint).toHaveTextContent('1.10.2');
  });

  // A pin is the workspace level of the effective setting: terraform_version alone reads the
  // effective version for every workspace since #1069 (D2), so the mock says level workspace.
  it('shows no hint when the workspace pins its own version', async () => {
    renderDialog({ ...workspace, terraform_version: '1.9.0' }, { value: '1.9.0', level: 'workspace' });
    await screen.findByRole('dialog');
    await waitFor(() => {
      expect(effectiveSettingsApi.get).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('edit-tofu-version-inherited')).not.toBeInTheDocument();
  });
});
