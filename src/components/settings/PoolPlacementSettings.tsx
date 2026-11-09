// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Server, SlidersHorizontal } from 'lucide-react';
import { platformSettingsApi, type AgentPool } from '@/api/client';
import { formatBytes, formatSeconds } from '@/lib/runPlacement';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

/**
 * PoolSettingsSummary shows a pool's own placement settings read-only in its expanded row (#933,
 * D4, D7, D15); the pool's edit dialog changes them.
 */
export function PoolSettingsSummary({ pool }: { pool: AgentPool }) {
  const limits = [pool.cpu_limit && `${pool.cpu_limit} CPU`, pool.memory_limit && `${pool.memory_limit} memory`].filter(Boolean).join(', ');
  return (
    <div className="p-4 space-y-3" data-testid="pool-settings-summary">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Job placement</h4>
      </div>
      <dl className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Row label="Kind" value={pool.kind === 'hosted' ? 'Hosted capacity' : 'Agent pool'} />
        <Row label="Limits" value={limits ? `${limits}${pool.limits_required ? ' (required)' : ''}` : 'None'} />
        <Row label="Failed jobs kept" value={pool.keep_failed_jobs_for ? formatSeconds(pool.keep_failed_jobs_for) : 'Removed at once'} />
        <Row label="Node-local cache" value={pool.local_readthrough ? 'On' : 'Off'} />
      </dl>
    </div>
  );
}

/**
 * LauncherDriver shows the driver a launcher reported and, for a hosted launcher under strict hosted
 * isolation (`launcher.hostedStrict`), that setting by its label.
 */
export function LauncherDriver({ driver, hostedStrict }: { driver?: string; hostedStrict: boolean }) {
  return (
    <>
      {driver || '-'}
      {hostedStrict && (
        <span className="ml-2 inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-300">
          Strict hosted isolation
        </span>
      )}
    </>
  );
}

/**
 * DeploymentSettingsPanel shows the deployment-wide launcher settings read-only (#933, D0, D15): the
 * chart or env files set them, so neither this page nor the API changes them. Collapsed by default.
 */
export function DeploymentSettingsPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platformSettings'],
    queryFn: () => platformSettingsApi.get(),
  });
  const d = data?.deployment;
  return (
    <details className="group p-4" data-testid="deployment-settings">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500/50 rounded-md">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
        <Server className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Deployment settings
        <span className="text-xs font-normal text-muted-foreground">- set by the platform installer, read-only</span>
      </summary>
      <div className="mt-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : isError || !d ? (
          <p className="text-sm text-muted-foreground">The deployment settings are not available.</p>
        ) : (
          <dl className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Row label="Allowed registries" value={d.images_allowed_registries.length ? d.images_allowed_registries.join(', ') : 'Any'} />
            <Row label="Run timeout default" value={formatSeconds(d.run_timeout_default)} />
            <Row label="Sync timeout" value={formatSeconds(d.sync_timeout)} />
            <Row label="Job log cap" value={formatBytes(d.job_log_max_bytes)} />
            <Row label="Cache size limit" value={formatBytes(d.cache_size_limit)} />
            <Row label="Hosted default cap" value={d.hosted_default_max_concurrent_jobs ? String(d.hosted_default_max_concurrent_jobs) : 'Unlimited'} />
            <Row label="Launcher request limit" value={`${d.runner_rate_limit.rps} per second, bursts of ${d.runner_rate_limit.burst}`} />
            <Row label="Job request limit" value={`${d.job_rate_limit.rps} per second, bursts of ${d.job_rate_limit.burst}`} />
            <Row label="OpenTofu releases" value={d.mirror?.tofu_releases_url || 'Public'} />
            <Row label="Provider mirror" value={d.mirror?.provider_network_mirror || 'Public registry'} />
            <Row label="Galaxy servers" value={d.mirror?.galaxy_servers.length ? d.mirror.galaxy_servers.map(g => g.name).join(', ') : 'Public Galaxy'} />
            <Row label="Proxy" value={d.mirror?.https_proxy || d.mirror?.http_proxy || 'None'} />
            <Row label="Extra CA certificates" value={d.mirror?.has_ca_certificates ? 'Configured' : 'None'} />
          </dl>
        )}
      </div>
    </details>
  );
}
