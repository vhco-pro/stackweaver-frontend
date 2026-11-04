// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Cloud, RefreshCw } from 'lucide-react';
import { hostedCapacityApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/surfaces';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The organization's hosted capacity (#933, D9, D15, AC51): what the hosted launchers run for this
 * organization, as read-only counts. The launchers are not the organization's, so they are counted
 * rather than named, and nothing here can be selected, renamed, deleted or reconfigured; only a
 * platform administrator sets the cap and the placement group.
 */
export function HostedCapacity({ orgName }: { orgName: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hostedCapacity', orgName],
    queryFn: () => hostedCapacityApi.get(orgName),
    enabled: !!orgName,
    refetchInterval: 15000,
    retry: (count, e: unknown) => (e as { status?: number })?.status !== 404 && count < 2,
  });

  // A deployment without a hosted pool for this organization has nothing to show.
  if (isError && (error as { status?: number })?.status === 404) return null;

  return (
    <section className={cn(glassSurface, 'p-6 space-y-4')} aria-labelledby="hosted-capacity-title" data-testid="hosted-capacity">
      <div className="flex items-start gap-2">
        <Cloud className="h-5 w-5 text-sky-500 mt-0.5" />
        <div>
          <h3 id="hosted-capacity-title" className="text-lg font-semibold">Hosted capacity</h3>
          <p className="text-sm text-muted-foreground">
            Runs and jobs in remote execution mode run on hosted launchers. This is read-only: a platform
            administrator sets the limit.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : isError || !data ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Could not load hosted capacity.</span>
          <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </div>
      ) : (
        <dl className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Stat
            label="In flight"
            value={data.max_concurrent_jobs > 0 ? `${data.in_flight} of ${data.max_concurrent_jobs}` : String(data.in_flight)}
            hint={data.max_concurrent_jobs > 0 ? 'concurrent limit' : 'no concurrent limit'}
          />
          <Stat label="Queued" value={String(data.queued)} hint={data.queue_reason === 'hosted_capacity_cap' ? 'waiting for a free slot' : undefined} />
          <Stat
            label="Launchers online"
            value={String(data.launchers_online)}
            hint={data.launchers_online === 0 ? 'work waits until one is online' : undefined}
          />
          <Stat label="Placement group" value={data.placement_group || 'default'} />
        </dl>
      )}
    </section>
  );
}
