// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Clock,
  FileText,
  Layers,
  List,
  PlayCircle,
  Server,
  Zap,
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { TIME_RANGES, useAnalytics, type TimeRange } from './useAnalytics';
import { formatDuration, formatRate, useChartPalette } from './chartTheme';
import { AnalyticsCard, ChartSkeleton, ErrorState } from '@/components/ui/analytics-card';
import { KpiTile } from './components/KpiTile';
import { percentDelta, pointDelta } from './delta';
import { ChartLegend, OutcomeOverTimeChart } from './components/OutcomeOverTimeChart';
import { StatusDonut } from './components/StatusDonut';
import { DurationTrend } from './components/DurationTrend';
import { ActivityBreakdown, ActivityTrend } from './components/ActivityTrend';
import { TopTemplates, TopWorkspaces } from './components/TopList';
import { RecentFailures } from './components/RecentFailures';
import { DayExecutionsSheet, type DaySelection } from './components/DayExecutionsSheet';

export default function Usage() {
  const { orgName } = useParams<{ orgName: string }>();
  const { organizations, loading: orgsLoading } = useOrganization();
  const [range, setRange] = useState<TimeRange>('30d');
  // Which chart bar the reader drilled into, if any. Null closes the panel.
  const [daySelection, setDaySelection] = useState<DaySelection | null>(null);
  const palette = useChartPalette();

  const { data, isLoading, isError, error, refetch, window } = useAnalytics(orgName, range);

  // The org-less /usage route sends the reader to their first organization. Doing it declaratively
  // keeps the redirect out of a data-fetching callback, where the old page ran it as a side effect.
  if (!orgName) {
    if (orgsLoading) return <UsageSkeleton />;
    if (organizations.length > 0) {
      return <Navigate to={`/app/${organizations[0].name}/usage`} replace />;
    }
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p>Create an organization to see usage analytics.</p>
      </div>
    );
  }

  const runs = data?.runs;
  const jobs = data?.ansible_jobs;
  const activeNow = data?.running_now.total ?? 0;

  const runSpark = data?.daily.map(point => point.runs_succeeded + point.runs_failed + point.runs_other) ?? [];
  const jobSpark = data?.daily.map(point => point.jobs_succeeded + point.jobs_failed + point.jobs_other) ?? [];
  const activitySpark = data?.daily.map(point => point.activity) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 bg-gradient-to-r from-purple-600 dark:from-purple-400 via-indigo-600 dark:via-indigo-400 to-blue-600 dark:to-blue-400 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            Usage &amp; Analytics
          </h1>
          <p className="text-muted-foreground">
            Delivery health for <span className="font-medium text-foreground">{orgName}</span>
            {data ? ` · ${window.comparisonLabel.replace('vs ', 'compared with ')}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bounded presets only - see the note on TimeRange for why "all time" is gone.
              Organization is chosen from the app-wide selector in the top bar, not here. */}
          <div
            className="inline-flex rounded-xl border border-white/20 bg-white/5 p-1 dark:border-white/10"
            role="group"
            aria-label="Time range"
          >
            {TIME_RANGES.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setRange(option.value);
                }}
                aria-pressed={range === option.value}
                title={option.label}
                className={cn(
                  'min-h-[32px] rounded-lg px-3 text-xs font-semibold transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                  range === option.value
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option.short}
              </button>
            ))}
          </div>
        </div>
      </header>

      {isError ? (
        <AnalyticsCard>
          <ErrorState
            message={error instanceof Error ? error.message : 'The analytics request did not complete.'}
            onRetry={() => {
              void refetch();
            }}
          />
        </AnalyticsCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <KpiTile
              label="OpenTofu runs"
              value={String(runs?.total ?? 0)}
              delta={runs ? percentDelta(runs.total, runs.previous.total) : undefined}
              spark={runSpark}
              sparkColor={palette.terraform}
              loading={isLoading}
            />
            <KpiTile
              label="Success rate"
              value={formatRate(runs?.success_rate ?? null)}
              // The sublabel only shows when there is no delta to show, so it has to describe the
              // value that is actually on screen rather than assume the empty case.
              sublabel={
                runs && runs.success_rate !== null
                  ? `${runs.succeeded} of ${runs.succeeded + runs.failed} decided`
                  : 'no runs decided yet'
              }
              delta={runs ? pointDelta(runs.success_rate, runs.previous.success_rate) : undefined}
              spark={runSpark}
              sparkColor={palette.succeeded}
              loading={isLoading}
            />
            <KpiTile
              label="Avg duration"
              value={runs && runs.duration_samples > 0 ? formatDuration(runs.avg_duration_seconds) : '—'}
              sublabel={
                runs && runs.duration_samples > 0
                  ? `over ${runs.duration_samples} ${runs.duration_samples === 1 ? 'run' : 'runs'}`
                  : 'nothing completed yet'
              }
              delta={
                runs && runs.duration_samples > 0
                  ? percentDelta(runs.avg_duration_seconds, runs.previous.avg_duration_seconds, {
                      lowerIsBetter: true,
                    })
                  : undefined
              }
              spark={runSpark}
              sparkColor={palette.terraform}
              loading={isLoading}
            />
            {/* The one tile on this row that is NOT window-scoped, and deliberately so. It used to
                count executions *started in the period* that were still running, which reported 0
                on a 7-day range while a run started three weeks ago was still applying - the single
                most interesting thing in the org, hidden by the range picker. The server now answers
                it live, so the label can mean what it says. */}
            <KpiTile
              label="Running now"
              value={String(activeNow)}
              sublabel={activeNow === 1 ? 'execution in flight' : 'executions in flight'}
              spark={activitySpark}
              sparkColor={palette.running}
              loading={isLoading}
            />
            <KpiTile
              label="Ansible jobs"
              value={String(jobs?.total ?? 0)}
              delta={jobs ? percentDelta(jobs.total, jobs.previous.total) : undefined}
              spark={jobSpark}
              sparkColor={palette.ansible}
              loading={isLoading}
            />
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0">
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="terraform" className="gap-2">
                <Server className="h-4 w-4" /> Terraform
              </TabsTrigger>
              <TabsTrigger value="ansible" className="gap-2">
                <PlayCircle className="h-4 w-4" /> Ansible
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2">
                <Zap className="h-4 w-4" /> Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <AnalyticsCard
                title="Executions per day"
                hint="OpenTofu runs and Ansible jobs, stacked by outcome"
                icon={<Activity className="h-4 w-4 text-purple-400" />}
              >
                {isLoading || !data ? (
                  <ChartSkeleton height={260} />
                ) : (
                  <OutcomeOverTimeChart data={data.daily} source="combined" onSelectDay={setDaySelection} />
                )}
              </AnalyticsCard>

              <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsCard
                  title="Platform split"
                  hint="Share of executions this period"
                  icon={<Layers className="h-4 w-4 text-indigo-400" />}
                >
                  {isLoading || !data ? <ChartSkeleton height={90} /> : <PlatformSplit terraform={data.runs.total} ansible={data.ansible_jobs.total} />}
                </AnalyticsCard>

                <AnalyticsCard
                  title="Recent failures"
                  hint="Most recent first, linked to the run or job"
                  icon={<Clock className="h-4 w-4 text-red-400" />}
                >
                  {isLoading || !data ? <ChartSkeleton height={160} /> : <RecentFailures failures={data.recent_failures} orgName={orgName} />}
                </AnalyticsCard>
              </div>
            </TabsContent>

            <TabsContent value="terraform" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                <AnalyticsCard
                  title="Runs per day"
                  hint="Stacked by outcome"
                  icon={<Activity className="h-4 w-4 text-purple-400" />}
                >
                  {isLoading || !data ? (
                    <ChartSkeleton />
                  ) : (
                    <OutcomeOverTimeChart data={data.daily} source="terraform" onSelectDay={setDaySelection} />
                  )}
                </AnalyticsCard>
                <AnalyticsCard
                  title="Run status"
                  hint={data ? `${data.runs.total} runs this period` : undefined}
                  icon={<PlayCircle className="h-4 w-4 text-purple-400" />}
                >
                  {isLoading || !data ? <ChartSkeleton height={168} /> : <StatusDonut outcome={data.runs} totalLabel="runs" />}
                </AnalyticsCard>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsCard
                  title="Duration"
                  hint="Completed runs only"
                  icon={<Clock className="h-4 w-4 text-indigo-400" />}
                >
                  {isLoading || !data ? <ChartSkeleton height={200} /> : <DurationTrend outcome={data.runs} daily={data.daily} source="terraform" />}
                </AnalyticsCard>
                <AnalyticsCard
                  title="Busiest workspaces"
                  hint="By run count this period"
                  icon={<Layers className="h-4 w-4 text-violet-400" />}
                >
                  {isLoading || !data ? <ChartSkeleton height={200} /> : <TopWorkspaces rows={data.top_workspaces} orgName={orgName} />}
                </AnalyticsCard>
              </div>
            </TabsContent>

            <TabsContent value="ansible" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                <AnalyticsCard
                  title="Jobs per day"
                  hint="Stacked by outcome"
                  icon={<Activity className="h-4 w-4 text-cyan-400" />}
                >
                  {isLoading || !data ? (
                    <ChartSkeleton />
                  ) : (
                    <OutcomeOverTimeChart data={data.daily} source="ansible" onSelectDay={setDaySelection} />
                  )}
                </AnalyticsCard>
                <AnalyticsCard
                  title="Job status"
                  hint={data ? `${data.ansible_jobs.total} jobs this period` : undefined}
                  icon={<PlayCircle className="h-4 w-4 text-cyan-400" />}
                >
                  {isLoading || !data ? <ChartSkeleton height={168} /> : <StatusDonut outcome={data.ansible_jobs} totalLabel="jobs" />}
                </AnalyticsCard>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsCard
                  title="Duration"
                  hint="Successful jobs only"
                  icon={<Clock className="h-4 w-4 text-cyan-400" />}
                >
                  {isLoading || !data ? <ChartSkeleton height={200} /> : <DurationTrend outcome={data.ansible_jobs} daily={data.daily} source="ansible" />}
                </AnalyticsCard>
                <AnalyticsCard
                  title="Busiest templates"
                  hint="By job count this period"
                  icon={<FileText className="h-4 w-4 text-cyan-400" />}
                >
                  {isLoading || !data ? <ChartSkeleton height={200} /> : <TopTemplates rows={data.top_templates} />}
                </AnalyticsCard>
              </div>
              <AnalyticsCard title="Automation assets" icon={<List className="h-4 w-4 text-cyan-400" />}>
                {isLoading || !data ? (
                  <ChartSkeleton height={70} />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <ResourceCount label="Playbooks" value={data.resources.playbooks} />
                    <ResourceCount label="Job templates" value={data.resources.job_templates} />
                    <ResourceCount label="Inventories" value={data.resources.inventories} />
                    <ResourceCount label="Projects" value={data.resources.projects} />
                    <ResourceCount label="Workspaces" value={data.resources.workspaces} />
                  </div>
                )}
              </AnalyticsCard>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <AnalyticsCard
                title="Activity per day"
                hint={data ? `${data.activity.total} audit events across the organization` : undefined}
                icon={<Zap className="h-4 w-4 text-indigo-400" />}
              >
                {isLoading || !data ? <ChartSkeleton height={220} /> : <ActivityTrend daily={data.daily} />}
              </AnalyticsCard>
              <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsCard title="By action" hint="What people did" icon={<Activity className="h-4 w-4 text-purple-400" />}>
                  {isLoading || !data ? (
                    <ChartSkeleton height={180} />
                  ) : (
                    <ActivityBreakdown items={data.activity.by_action} color={palette.terraform} emptyMessage="No recorded actions in this period." />
                  )}
                </AnalyticsCard>
                <AnalyticsCard title="By resource type" hint="What they touched" icon={<Layers className="h-4 w-4 text-cyan-400" />}>
                  {isLoading || !data ? (
                    <ChartSkeleton height={180} />
                  ) : (
                    <ActivityBreakdown items={data.activity.by_resource_type} color={palette.ansible} emptyMessage="No recorded resources in this period." />
                  )}
                </AnalyticsCard>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <DayExecutionsSheet
        selection={daySelection}
        orgName={orgName}
        window={window}
        onOpenChange={open => {
          if (!open) setDaySelection(null);
        }}
      />
    </div>
  );
}

/** Part-to-whole across exactly two categories: one bar, not a pie. */
function PlatformSplit({ terraform, ansible }: { terraform: number; ansible: number }) {
  const palette = useChartPalette();
  const total = terraform + ansible;

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No executions in this period.</p>;
  }
  const terraformShare = Math.round((terraform / total) * 100);

  return (
    <div>
      <div className="flex h-7 gap-0.5 overflow-hidden rounded-lg">
        {terraform > 0 && (
          <div
            className="grid place-items-center text-[11px] font-bold text-white"
            style={{ flex: terraform, backgroundColor: palette.terraform }}
          >
            {terraformShare >= 12 ? `${terraformShare}%` : ''}
          </div>
        )}
        {ansible > 0 && (
          <div
            className="grid place-items-center text-[11px] font-bold text-white"
            style={{ flex: ansible, backgroundColor: palette.ansible }}
          >
            {100 - terraformShare >= 12 ? `${100 - terraformShare}%` : ''}
          </div>
        )}
      </div>
      <ChartLegend
        items={[
          { label: `Terraform · ${terraform}`, color: palette.terraform },
          { label: `Ansible · ${ansible}`, color: palette.ansible },
        ]}
      />
      <p className="mt-2 text-xs text-muted-foreground">{total} executions total</p>
    </div>
  );
}

function ResourceCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
