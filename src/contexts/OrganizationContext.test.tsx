// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Organization } from '@/api/client';
import ApplicationProviders from '@/components/routes/ApplicationProviders';
import { useOrganization } from './OrganizationContext';

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/api/client', () => ({ organizationsApi: api }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ loading: false, session: { user: { id: 'person' } } }) }));

function Probe() {
  const { currentOrg, loading } = useOrganization();
  return <p>{loading ? 'Loading organizations' : currentOrg?.name ?? 'No organization'}</p>;
}

function Navigation() {
  const navigate = useNavigate();
  return <><button onClick={() => { void navigate('/docs'); }}>Docs</button><button onClick={() => { void navigate('/dashboard'); }}>Dashboard</button></>;
}

describe('organization persistence across public navigation', () => {
  afterEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  for (const cached of [false, true]) {
    it(`restores the saved organization with ${cached ? 'cached' : 'unresolved'} data`, async () => {
      const organization = { id: 'org-acme', name: 'acme' } as Organization;
      let finish: (value: { data: Organization[] }) => void = () => undefined;
      api.list.mockImplementation(() => new Promise<{ data: Organization[] }>((resolve) => { finish = resolve; }));
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } });
      if (cached) client.setQueryData(['organizations'], [organization]);
      localStorage.setItem('currentOrganization', 'acme');
      render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><Navigation /><Routes><Route element={<ApplicationProviders />}><Route path="/dashboard" element={<Probe />} /></Route><Route path="/docs" element={<p>Public docs</p>} /></Routes></MemoryRouter></QueryClientProvider>);
      if (!cached) expect(await screen.findByText('Loading organizations')).toBeInTheDocument();
      expect(localStorage.getItem('currentOrganization')).toBe('acme');
      fireEvent.click(screen.getByText('Docs'));
      expect(await screen.findByText('Public docs')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Dashboard'));
      if (!cached) await act(async () => { finish({ data: [organization] }); await Promise.resolve(); });
      expect(await screen.findByText('acme')).toBeInTheDocument();
      expect(localStorage.getItem('currentOrganization')).toBe('acme');
      client.clear();
    });
  }
});
