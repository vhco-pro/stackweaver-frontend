// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the standard names on the pool settings view (one-launcher spec, B1, AC27): the kind row
// reads "Hosted capacity" or "Agent pool" for the wire values hosted and customer, the
// deployment's launcher rate row reads "Launcher request limit", and a launcher under strict hosted
// isolation says so by that label rather than an internal "(strict)" suffix.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { platformSettingsApi, type AgentPool } from '@/api/client';
import { DeploymentSettingsPanel, LauncherDriver, PoolSettingsSummary } from './PoolPlacementSettings';

vi.mock('@/api/client', () => ({ platformSettingsApi: { get: vi.fn() } }));

const pool = (kind: string): AgentPool => ({
  id: 'pool-1', name: 'pool', organization_scoped: true, agent_count: 0, created_at: '',
  allowed_workspace_ids: [], allowed_project_ids: [], excluded_workspace_ids: [], kind,
  keep_failed_jobs_for: 0, cpu_limit: '', memory_limit: '', limits_required: false, local_readthrough: false,
});

describe('PoolSettingsSummary', () => {
  it('labels a hosted pool Hosted capacity', () => {
    render(<PoolSettingsSummary pool={pool('hosted')} />);
    expect(screen.getByText('Hosted capacity')).toBeInTheDocument();
    expect(screen.queryByText('Hosted')).not.toBeInTheDocument();
  });

  it('labels a customer pool Agent pool', () => {
    render(<PoolSettingsSummary pool={pool('customer')} />);
    expect(screen.getByText('Agent pool')).toBeInTheDocument();
    expect(screen.queryByText('Customer')).not.toBeInTheDocument();
  });
});

describe('DeploymentSettingsPanel', () => {
  it('labels the launcher rate row Launcher request limit', async () => {
    vi.mocked(platformSettingsApi.get).mockResolvedValue({
      organization_creation: 'everyone',
      deployment: {
        images_allowed_registries: [], hosted_default_max_concurrent_jobs: 0, run_timeout_default: 3600,
        sync_timeout: 600, job_log_max_bytes: 1024, cache_size_limit: 1024,
        runner_rate_limit: { rps: 5, burst: 10 }, job_rate_limit: { rps: 2, burst: 4 }, mirror: null,
      },
    } as unknown as Awaited<ReturnType<typeof platformSettingsApi.get>>);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DeploymentSettingsPanel />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Launcher request limit')).toBeInTheDocument();
    expect(screen.getByText('5 per second, bursts of 10')).toBeInTheDocument();
    expect(screen.queryByText(/runner/i)).not.toBeInTheDocument();
  });
});

describe('LauncherDriver', () => {
  it('shows Strict hosted isolation for a launcher under it', () => {
    render(<LauncherDriver driver="kubernetes" hostedStrict />);
    expect(screen.getByText('kubernetes')).toBeInTheDocument();
    expect(screen.getByText('Strict hosted isolation')).toBeInTheDocument();
    expect(screen.queryByText(/\(strict\)/)).not.toBeInTheDocument();
  });

  it('shows only the driver otherwise', () => {
    render(<LauncherDriver driver="container" hostedStrict={false} />);
    expect(screen.getByText('container')).toBeInTheDocument();
    expect(screen.queryByText('Strict hosted isolation')).not.toBeInTheDocument();
  });
});
