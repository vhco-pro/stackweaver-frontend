// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The Run Images page lists the organization's run images and creates one through the run-images
// route (#933, D6, D15): the image, its engine and the registry credential it is pulled with.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runImagesApi, type RunImage } from '@/api/runPlacement';
import { ansibleCredentialsApi } from '@/api/ansible';
import RunImages from './RunImages';

vi.mock('@/api/runPlacement', () => ({
  runImagesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/api/ansible', () => ({ ansibleCredentialsApi: { list: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const image: RunImage = {
  id: 'ri-1', name: 'tofu-aws-tools', kind: 'tofu', image: 'ghcr.io/acme/tofu-aws:1.9', digest: 'sha256:abc',
  registry_credential_id: 'cred-1', description: 'AWS CLI and jq', created_at: '', updated_at: '',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/settings/run-images']}>
        <Routes>
          <Route path="/app/:orgName/settings/run-images" element={<RunImages />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

describe('Run Images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runImagesApi.list).mockResolvedValue([image]);
    vi.mocked(runImagesApi.create).mockResolvedValue({ ...image, id: 'ri-2', name: 'awx-ee', kind: 'ansible' });
    vi.mocked(ansibleCredentialsApi.list).mockResolvedValue({
      data: [{ id: 'cred-1', type: 'ansible-credentials', attributes: { name: 'ghcr-pull', 'credential-type': 'registry' } }],
    });
  });

  it('lists each image with its engine, pin and credential', async () => {
    renderPage();
    const row = await screen.findByTestId('run-image-row');
    expect(within(row).getByText('tofu-aws-tools')).toBeInTheDocument();
    expect(within(row).getByText('OpenTofu')).toBeInTheDocument();
    expect(within(row).getByText('Pinned')).toBeInTheDocument();
    expect(within(row).getByText('ghcr.io/acme/tofu-aws:1.9@sha256:abc')).toBeInTheDocument();
    await waitFor(() => { expect(row).toHaveTextContent('Pulled with ghcr-pull'); });
  });

  it('creates an Ansible image pulled without a credential', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('run-image-row');
    await user.click(screen.getByRole('button', { name: /Add run image/ }));
    await user.type(screen.getByLabelText('Name'), 'awx-ee');
    await user.click(screen.getByRole('combobox', { name: 'Engine' }));
    await user.click(await screen.findByRole('option', { name: 'Ansible' }));
    await user.type(screen.getByLabelText('Image'), 'quay.io/ansible/awx-ee:24.6.1');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(runImagesApi.create).toHaveBeenCalledWith('acme', {
        name: 'awx-ee', kind: 'ansible', image: 'quay.io/ansible/awx-ee:24.6.1', digest: '', registry_credential_id: null, description: '',
      });
    });
  });

  it('offers to add the first image when there is none', async () => {
    vi.mocked(runImagesApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No run images yet')).toBeInTheDocument();
  });
});
