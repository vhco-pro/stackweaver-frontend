// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// A pool's identity bindings in its expanded row (#933, D8, D15): a binding another manager
// declares cannot be edited here, and a new one is created with its service account mode.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { identityBindingsApi, type IdentityBinding } from '@/api/runPlacement';
import { AgentPoolIdentityBindings } from './AgentPoolIdentityBindings';

vi.mock('@/api/runPlacement', () => ({
  identityBindingsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function binding(over: Partial<IdentityBinding>): IdentityBinding {
  return {
    id: 'ib-1', agent_pool_id: 'pool-1', name: 'deploy', mechanism: 'aws-irsa', service_account: 'sw-deploy',
    annotations: {}, per_job_sa: false, reference: false, declared_externally: false, external_manager: '',
    object_present: null, reported_at: null, created_at: '', ...over,
  };
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

function renderRow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AgentPoolIdentityBindings poolId="pool-1" /></QueryClientProvider>);
}

describe('AgentPoolIdentityBindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(identityBindingsApi.list).mockResolvedValue([
      binding({}),
      binding({ id: 'ib-2', name: 'gitops', declared_externally: true, external_manager: 'argocd' }),
    ]);
    vi.mocked(identityBindingsApi.create).mockResolvedValue(binding({ id: 'ib-3' }));
  });

  it('keeps a binding another manager declares read-only', async () => {
    renderRow();
    const list = await screen.findByRole('list', { name: 'Identity bindings' });
    const [own, managed] = within(list).getAllByRole('listitem');
    expect(within(own).getByRole('button', { name: 'Edit identity binding deploy' })).toBeInTheDocument();
    expect(within(managed).getByText('Managed by argocd')).toBeInTheDocument();
    expect(within(managed).queryByRole('button', { name: /Edit identity binding/ })).not.toBeInTheDocument();
  });

  it('creates a per-job binding with its annotations', async () => {
    const user = userEvent.setup();
    renderRow();
    await screen.findByRole('list', { name: 'Identity bindings' });
    await user.click(screen.getByRole('button', { name: /New binding/ }));
    await user.type(screen.getByLabelText('Name'), 'deploy-prod');
    await user.type(screen.getByLabelText('Service account name'), 'sw-deploy');
    // Pasted, not typed: the test is about the binding it creates, and typing 55 characters one
    // re-render at a time pushed it past the timeout on a loaded host.
    await user.click(screen.getByLabelText('Annotations'));
    await user.paste('eks.amazonaws.com/role-arn=arn:aws:iam::1:role/deploy');
    await user.click(screen.getByRole('combobox', { name: 'Service account mode' }));
    await user.click(await screen.findByRole('option', { name: 'Create one per job' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(identityBindingsApi.create).toHaveBeenCalledWith('pool-1', {
        name: 'deploy-prod', mechanism: 'aws-irsa', service_account: 'sw-deploy',
        annotations: { 'eks.amazonaws.com/role-arn': 'arn:aws:iam::1:role/deploy' }, per_job_sa: true, reference: false,
      });
    });
  });

  it('refuses a name or an annotation line the API would refuse or drop', async () => {
    const user = userEvent.setup();
    renderRow();
    await screen.findByRole('list', { name: 'Identity bindings' });
    await user.click(screen.getByRole('button', { name: /New binding/ }));
    await user.type(screen.getByLabelText('Name'), 'Bad Name!!');
    await user.type(screen.getByLabelText('Service account name'), 'sw-deploy');
    await user.click(screen.getByLabelText('Annotations'));
    await user.paste('eks.amazonaws.com/role-arn=arn:aws:iam::1:role/deploy\nrole arn');
    expect(screen.getByTestId('binding-name-error')).toBeInTheDocument();
    expect(screen.getByTestId('binding-annotations-error')).toHaveTextContent('line 2');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'deploy-prod');
    expect(screen.queryByTestId('binding-name-error')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(identityBindingsApi.create).not.toHaveBeenCalled();
  });
});
