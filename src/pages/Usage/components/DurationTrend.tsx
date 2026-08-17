// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { AnalyticsDailyPoint, AnalyticsOutcome } from '@/api/client';
import { ChartContainer, ChartTooltipSurface, type ChartTooltipProps } from '@/components/ui/chart';
import { formatDay, formatDuration, useChartPalette } from '../chartTheme';
import { EmptyState } from './Card';
import { ChartLegend } from './OutcomeOverTimeChart';

/**
 * Execution time for the period, as the two numbers that actually get acted on: the average, and
 * the p95 that tells you how bad the slow tail is.
 *
 * Both are period figures rather than a per-day series - a daily average over a handful of runs is
 * mostly noise - so the chart shows the volume of completed work per day with the two summary
 * figures called out beside it.
 */
export function DurationTrend({
  outcome,
  daily,
  source,
}: {
  outcome: AnalyticsOutcome;
  daily: AnalyticsDailyPoint[];
  source: 'terraform' | 'ansible';
}) {
  const palette = useChartPalette();
  const accent = source === 'terraform' ? palette.terraform : palette.ansible;

  const rows = daily.map(point => ({
    date: point.date,
    completed: source === 'terraform' ? point.runs_succeeded : point.jobs_succeeded,
  }));
  const totalCompleted = rows.reduce((sum, row) => sum + row.completed, 0);

  if (outcome.duration_samples === 0) {
    return (
      <EmptyState
        message={
          outcome.total > 0
            ? 'Nothing has finished yet in this period, so there is no duration to report.'
            : 'No completed work in this period.'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Figure label="Average" value={formatDuration(outcome.avg_duration_seconds)} accent={accent} />
        <Figure label="p95 (slow tail)" value={formatDuration(outcome.p95_duration_seconds)} accent={accent} muted />
      </div>
      <p className="text-xs text-muted-foreground">
        Based on {outcome.duration_samples} completed {outcome.duration_samples === 1 ? 'execution' : 'executions'}.
      </p>

      {totalCompleted > 0 && (
        <>
          <ChartContainer height={150}>
            <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={`durationFill-${source}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatDay(value)}
                tick={{ fill: palette.label, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: palette.axis }}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: palette.label, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip cursor={{ stroke: palette.axis }} content={<CompletedTooltip color={accent} />} />
              <Area
                type="monotone"
                dataKey="completed"
                stroke={accent}
                strokeWidth={2}
                fill={`url(#durationFill-${source})`}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ChartContainer>
          <ChartLegend items={[{ label: 'Completed per day', color: accent }]} />
        </>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-[3px]"
          style={{ backgroundColor: accent, opacity: muted ? 0.45 : 1 }}
          aria-hidden="true"
        />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function CompletedTooltip({
  color,
  active,
  label,
  payload,
}: ChartTooltipProps<{ date: string }> & { color: string }) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipSurface
      title={formatDay(String(label), true)}
      rows={[{ label: 'Completed', value: String(payload[0].value ?? 0), color }]}
    />
  );
}
