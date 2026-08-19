// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { AnalyticsDailyPoint, AnalyticsLabeledCount } from '@/api/client';
import { ChartContainer, ChartTooltipSurface, type ChartTooltipProps } from '@/components/ui/chart';
import { formatDay, useChartPalette } from '../chartTheme';
import { EmptyState } from '@/components/ui/analytics-card';

/** Audit-event volume per day. One series, so it needs no legend - the card title names it. */
export function ActivityTrend({ daily }: { daily: AnalyticsDailyPoint[] }) {
  const palette = useChartPalette();
  const total = daily.reduce((sum, point) => sum + point.activity, 0);

  if (total === 0) {
    return <EmptyState message="No recorded activity in this period." />;
  }

  return (
    <ChartContainer height={220}>
      <AreaChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.terraform} stopOpacity={0.3} />
            <stop offset="100%" stopColor={palette.terraform} stopOpacity={0.02} />
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
        <Tooltip cursor={{ stroke: palette.axis }} content={<ActivityTooltip color={palette.terraform} />} />
        <Area
          type="monotone"
          dataKey="activity"
          stroke={palette.terraform}
          strokeWidth={2}
          fill="url(#activityFill)"
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function ActivityTooltip({ color, active, label, payload }: ChartTooltipProps & { color: string }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value ?? 0);
  return (
    <ChartTooltipSurface
      title={formatDay(String(label), true)}
      rows={[{ label: value === 1 ? 'Event' : 'Events', value: String(value), color }]}
    />
  );
}

/**
 * A ranked breakdown, drawn as labelled bars rather than a chart.
 *
 * With up to ten named categories the reader wants to look up a specific one and compare two, which
 * a sorted list of labels does better than any pie or axis-bound bar chart - the label sits next to
 * its own bar instead of in a legend the eye has to travel to.
 */
export function ActivityBreakdown({
  items,
  color,
  emptyMessage,
}: {
  items: AnalyticsLabeledCount[];
  color: string;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }
  const max = Math.max(...items.map(item => item.count));

  return (
    <ul className="space-y-2.5">
      {items.map(item => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground" title={item.label}>
              {item.label}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{item.count}</span>
          </div>
          <div className="mt-1 h-[7px] overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max((item.count / max) * 100, 2)}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
