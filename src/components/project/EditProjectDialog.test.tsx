// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The Edit project dialog writes the project's own settings (#933, D0, D15): inheriting the
// organization's execution defaults clears the project's overwrite, and an empty run image,
// binding or timeout defers to the organization.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { agentPoolsApi, projectsApi, type Project } from '@/api/client';
import { EditProjectDialog } from './EditProjectDialog';

vi.mock('@/api/client', () => ({
  agentPoolsApi: { list: vi.fn() },
  projectsApi: { update: vi.fn() },
}));
vi.mock('@/api/runPlacement', () => ({
  runImagesApi: { list: vi.fn().mockResolvedValue([]) },
  identityBindingsApi: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const project: Project = {
  id: 'prj-1', organization_id: 'org-1', name: 'platform', description: 'Shared infra',
  default_execution_mode: 'agent', default_agent_pool_id: 'pool-1', settings_overwritten: true,
  run_timeout: 3600, tofu_run_image_id: null, ansible_run_image_id: null, identity_binding_id: null,
  created_at: '', updated_at: '',
};

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

describe('EditProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentPoolsApi.list).mockResolvedValue({ data: [], meta: { pagination: { 'current-page': 1, 'page-size': 20, 'total-count': 0 } } });
    vi.mocked(projectsApi.update).mockResolvedValue(project);
  });

  it('starts from the saved settings and inherits the organization defaults', async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <EditProjectDialog open onOpenChange={() => undefined} orgName="acme" project={project} onUpdated={onUpdated} />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('Run timeout (minutes)')).toHaveValue(60);
    await user.click(screen.getByRole('combobox', { name: 'Default execution mode' }));
    await user.click(await screen.findByRole('option', { name: 'Inherit from the organization' }));
    await user.clear(screen.getByLabelText('Run timeout (minutes)'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(projectsApi.update).toHaveBeenCalledWith('acme', 'platform', {
        name: 'platform', description: 'Shared infra', settings_overwritten: false, run_timeout: 0,
        tofu_run_image_id: '', ansible_run_image_id: '', identity_binding_id: '',
      });
    });
    expect(onUpdated).toHaveBeenCalled();
  });
});
