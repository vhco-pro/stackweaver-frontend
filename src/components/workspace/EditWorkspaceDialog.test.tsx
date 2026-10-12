// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The edit workspace dialog's "Allow destroy plans" checkbox.
//
// It opens showing what the workspace has stored: off only when the workspace says false, on for
// true and for a workspace that does not report the setting (the same reading the new-run dialog
// uses to enable its Destroy choice). Saving always sends the box's state, so turning the setting
// off and turning it back on are both one save.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  workspacesApi,
  vcsConnectionsApi,
  agentPoolsApi,
  terraformVersionsApi,
  type Workspace,
} from '@/api/client';
import { EditWorkspaceDialog } from './EditWorkspaceDialog';

vi.mock('@/api/client', () => ({
  workspacesApi: { update: vi.fn() },
  vcsConnectionsApi: {
    list: vi.fn(),
    listAllRepositories: vi.fn(),
    listBranches: vi.fn(),
    listProjects: vi.fn(),
  },
  agentPoolsApi: { list: vi.fn() },
  terraformVersionsApi: { listEnabled: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseWorkspace: Workspace = {
  id: 'ws-abc',
  project_id: 'proj-1',
  name: 'network-prod',
  auto_apply: false,
  force_delete: false,
  execution_mode: 'remote',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function setup(workspace: Workspace) {
  vi.mocked(vcsConnectionsApi.list).mockResolvedValue([]);
  vi.mocked(agentPoolsApi.list).mockResolvedValue(
    { data: [] } as unknown as Awaited<ReturnType<typeof agentPoolsApi.list>>,
  );
  vi.mocked(terraformVersionsApi.listEnabled).mockResolvedValue({ data: [] });
  vi.mocked(workspacesApi.update).mockResolvedValue(workspace);

  const onUpdated = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/workspaces/network-prod']}>
        <EditWorkspaceDialog open onOpenChange={vi.fn()} orgName="acme" workspace={workspace} onUpdated={onUpdated} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), onUpdated };
}

const dialog = () => within(screen.getByRole('dialog'));
const allowDestroyPlans = () => dialog().getByRole('checkbox', { name: 'Allow destroy plans' });

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(dialog().getByRole('button', { name: 'Update Workspace' }));
  await waitFor(() => {
    expect(workspacesApi.update).toHaveBeenCalledTimes(1);
  });
  return vi.mocked(workspacesApi.update).mock.calls[0];
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('EditWorkspaceDialog: Allow destroy plans (AC10)', () => {
  it.each([
    { stored: false, checked: false },
    { stored: true, checked: true },
    { stored: undefined, checked: true },
  ])('opens with the box checked=$checked when the workspace has allow_destroy_plan $stored', ({ stored, checked }) => {
    setup({ ...baseWorkspace, allow_destroy_plan: stored });

    if (checked) {
      expect(allowDestroyPlans()).toBeChecked();
    } else {
      expect(allowDestroyPlans()).not.toBeChecked();
    }
  });

  it('sits in the Destruction and Deletion box, above force delete', () => {
    setup({ ...baseWorkspace, allow_destroy_plan: true });

    const boxes = dialog().getAllByRole('checkbox').map((box) => box.id);
    expect(boxes.indexOf('edit-allow-destroy-plan')).toBeGreaterThanOrEqual(0);
    expect(boxes.indexOf('edit-allow-destroy-plan')).toBe(boxes.indexOf('edit-force-delete') - 1);

    const section = dialog().getByText('Destruction and Deletion').parentElement;
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByRole('checkbox', { name: 'Allow destroy plans' })).toBeInTheDocument();
  });

  it('saves allow_destroy_plan true after the box is checked on a workspace that had it off', async () => {
    const { user, onUpdated } = setup({ ...baseWorkspace, allow_destroy_plan: false });

    await user.click(allowDestroyPlans());
    expect(allowDestroyPlans()).toBeChecked();
    const [orgName, workspaceName, data] = await save(user);

    expect(orgName).toBe('acme');
    expect(workspaceName).toBe('network-prod');
    expect(data).toMatchObject({ allow_destroy_plan: true, auto_apply: false, force_delete: false });
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledTimes(1);
    });
  });

  it('saves allow_destroy_plan false after the box is unchecked', async () => {
    const { user } = setup({ ...baseWorkspace, allow_destroy_plan: true });

    await user.click(allowDestroyPlans());
    expect(allowDestroyPlans()).not.toBeChecked();
    const [, , data] = await save(user);

    expect(data).toMatchObject({ allow_destroy_plan: false });
  });

  it.each([
    { stored: false, sent: false },
    { stored: true, sent: true },
    { stored: undefined, sent: true },
  ])('saves allow_destroy_plan $sent untouched when the workspace has $stored', async ({ stored, sent }) => {
    const { user } = setup({ ...baseWorkspace, allow_destroy_plan: stored });

    const [, , data] = await save(user);

    expect(data).toMatchObject({ allow_destroy_plan: sent });
  });

  it('leaves the other checkboxes sending their own values', async () => {
    const { user } = setup({ ...baseWorkspace, allow_destroy_plan: false, auto_apply: true });

    await user.click(dialog().getByRole('checkbox', { name: /^Allow force delete/ }));
    const [, , data] = await save(user);

    expect(data).toMatchObject({ allow_destroy_plan: false, auto_apply: true, force_delete: true });
  });
});
