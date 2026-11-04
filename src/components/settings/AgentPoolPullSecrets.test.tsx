// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// A pool's registry pull Secrets in its expanded row (#933, D8, D15): one another manager declares
// is shown read-only with the manager named, and a new one is created from a registry credential
// or as a reference to a Secret declared elsewhere.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pullSecretsApi, type PullSecret } from '@/api/runPlacement';
import { ansibleCredentialsApi } from '@/api/ansible';
import { AgentPoolPullSecrets } from './AgentPoolPullSecrets';

vi.mock('@/api/runPlacement', () => ({
  pullSecretsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/api/ansible', () => ({ ansibleCredentialsApi: { list: vi.fn() } }));
vi.mock('@/utils/ansible-jsonapi', () => ({ getAnsibleCredentialFromJsonApi: (c: { id: string; attributes: { name: string } }) => ({ id: c.id, name: c.attributes.name }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function secret(over: Partial<PullSecret>): PullSecret {
  return {
    id: 'ps-1', agent_pool_id: 'pool-1', name: 'ghcr', secret_name: 'sw-pull-ghcr', registry: 'ghcr.io',
    registry_credential_id: 'cred-1', reference: false, declared_externally: false, external_manager: '',
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
  return render(<QueryClientProvider client={client}><AgentPoolPullSecrets poolId="pool-1" orgName="acme" /></QueryClientProvider>);
}

describe('AgentPoolPullSecrets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ansibleCredentialsApi.list).mockResolvedValue({ data: [{ id: 'cred-1', attributes: { name: 'ghcr-robot' } }] } as never);
  });

  it('shows a Secret another manager declares read-only, naming the manager', async () => {
    vi.mocked(pullSecretsApi.list).mockResolvedValue([
      secret({ id: 'ps-1', name: 'ghcr', declared_externally: true, external_manager: 'Argo CD application platform' }),
      secret({ id: 'ps-2', name: 'quay', secret_name: 'registry-quay', registry: 'quay.io', reference: true, registry_credential_id: null, object_present: false }),
    ]);
    renderRow();
    const list = await screen.findByRole('list', { name: 'Registry pull Secrets' });
    const declared = within(list).getAllByRole('listitem')[0];
    expect(within(declared).getByText('Managed by Argo CD application platform')).toBeInTheDocument();
    expect(within(declared).queryByRole('button', { name: /Edit pull Secret/ })).toBeNull();
    const missing = within(list).getAllByRole('listitem')[1];
    expect(within(missing).getByText('Secret missing')).toBeInTheDocument();
    expect(within(missing).getByText(/registry-quay \(referenced\)/)).toBeInTheDocument();
  });

  it('creates a reference to a Secret declared elsewhere', async () => {
    vi.mocked(pullSecretsApi.list).mockResolvedValue([]);
    vi.mocked(pullSecretsApi.create).mockResolvedValue(secret({}));
    const user = userEvent.setup();
    renderRow();
    await user.click(await screen.findByRole('button', { name: /New pull Secret/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'internal');
    await user.type(within(dialog).getByLabelText('Registry'), 'registry.example:5000');
    await user.type(within(dialog).getByLabelText('Secret name'), 'registry-internal');
    await user.click(within(dialog).getByRole('combobox', { name: 'Secret mode' }));
    await user.click(await screen.findByRole('option', { name: 'Reference an existing one' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(pullSecretsApi.create).toHaveBeenCalledWith('pool-1', {
        name: 'internal', registry: 'registry.example:5000', secret_name: 'registry-internal', reference: true, registry_credential_id: null,
      });
    });
  });
});
