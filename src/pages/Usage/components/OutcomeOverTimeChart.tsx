// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { AnalyticsDailyPoint, AnalyticsOutcomeFilter } from '@/api/client';
import {
  ChartContainer,
  ChartTooltipSurface,
  type ChartTooltipProps,
  type ChartTooltipRow,
} from '@/components/ui/chart';
import { formatDay, useChartPalette, type ChartPalette } from '../chartTheme';
import { EmptyState } from '@/components/ui/analytics-card';
import type { DaySelection } from './DayExecutionsSheet';

export type OutcomeSource = 'combined' | 'terraform' | 'ansible';

interface Series {
  /** Doubles as the outcome filter sent to the drill-down, so the two cannot drift apart. */
  key: AnalyticsOutcomeFilter;
  label: string;
  color: string;
  value: (point: AnalyticsDailyPoint) => number;
}

/** One plotted day: the shape Recharts hands back on the clicked rectangle's `payload`. */
interface ChartRow {
  date: string;
  succeeded: number;
  failed: number;
  other: number;
}

function seriesFor(source: OutcomeSource, palette: ChartPalette): Series[] {
  const pick = (runField: number, jobField: number) => {
    if (source === 'terraform') return runField;
    if (source === 'ansible') return jobField;
    return runField + jobField;
  };
  const succeeded = (p: AnalyticsDailyPoint) => pick(p.runs_succeeded, p.jobs_succeeded);
  const failed = (p: AnalyticsDailyPoint) => pick(p.runs_failed, p.jobs_failed);
  const other = (p: AnalyticsDailyPoint) => pick(p.runs_other, p.jobs_other);

  return [
    { key: 'succeeded', label: 'Succeeded', color: palette.succeeded, value: succeeded },
    { key: 'failed', label: 'Failed', color: palette.failed, value: failed },
    // Cancelled and in-flight work is context, not a category: it wears the de-emphasis grey so the
    // eye reads the succeeded/failed split first.
    { key: 'other', label: 'In flight / cancelled', color: palette.other, value: other },
  ];
}

/**
 * Daily outcome volume as a stacked column per day.
 *
 * A stack is the right form here because the question is part-to-whole within a day ("how much of
 * Tuesday's work failed"), and the day totals are themselves comparable across the window.
 */
export function OutcomeOverTimeChart({
  data,
  source,
  height = 260,
  onSelectDay,
}: {
  data: AnalyticsDailyPoint[];
  source: OutcomeSource;
  height?: number;
  /** Called when a segment is clicked, scoped to the day and outcome that was clicked. */
  onSelectDay?: (selection: DaySelection) => void;
}) {
  const palette = useChartPalette();
  const series = seriesFor(source, palette);
  const interactive = Boolean(onSelectDay);

  // Recharts hands the clicked rectangle, which carries the chart row on `payload`. The series key
  // is captured per bar so the click knows which segment of the stack was hit, not just which day.
  // The row's own counts travel with the selection, so the panel's filter can offer exactly the
  // outcomes this bar was drawn from.
  const handleSegmentClick = (key: Series['key']) => (item: unknown) => {
    const row = (item as { payload?: ChartRow } | undefined)?.payload;
    if (!onSelectDay || !row?.date) return;
    onSelectDay({
      date: row.date,
      outcome: key,
      platform: source === 'combined' ? undefined : source,
      counts: { succeeded: row.succeeded, failed: row.failed, other: row.other },
    });
  };

  const rows: ChartRow[] = data.map(point => ({
    date: point.date,
    succeeded: series[0].value(point),
    failed: series[1].value(point),
    other: series[2].value(point),
  }));
  const total = rows.reduce((sum, row) => sum + row.succeeded + row.failed + row.other, 0);

  if (total === 0) {
    return <EmptyState message="No activity in this period." />;
  }

  return (
    <>
      <ChartContainer height={height}>
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={palette.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatDay(value)}
            tick={{ fill: palette.label, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: palette.axis }}
            minTickGap={22}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: palette.label, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: palette.grid }}
            content={<OutcomeTooltip series={series} interactive={interactive} />}
          />
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              stackId="outcome"
              fill={entry.color}
              // Rounding every segment reads as a 2px break between stacked colours, so adjacent
              // fills stay separable without a hard border that would fight the glass surface.
              radius={index === series.length - 1 ? [3, 3, 0, 0] : 2}
              maxBarSize={38}
              cursor={interactive ? 'pointer' : undefined}
              onClick={interactive ? handleSegmentClick(entry.key) : undefined}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <ChartLegend items={series.map(s => ({ label: s.label, color: s.color }))} />
      {interactive && (
        <p className="mt-2 text-xs text-muted-foreground">
          Select a bar to list that day&apos;s executions.
        </p>
      )}
    </>
  );
}

function OutcomeTooltip({
  series,
  interactive,
  active,
  label,
  payload,
}: ChartTooltipProps<{ date: string }> & { series: Series[]; interactive?: boolean }) {
  if (!active || !payload?.length) return null;

  const values = new Map(payload.map(item => [String(item.dataKey), Number(item.value ?? 0)]));
  const total = [...values.values()].reduce((sum, value) => sum + value, 0);
  const rows: ChartTooltipRow[] = series
    .filter(entry => (values.get(entry.key) ?? 0) > 0)
    .map(entry => ({
      label: entry.label,
      value: String(values.get(entry.key) ?? 0),
      color: entry.color,
    }));

  return (
    <ChartTooltipSurface
      title={formatDay(String(label), true)}
      rows={rows}
      footer={interactive ? `${total} total · select to list them` : `${total} total`}
    />
  );
}

/** Shared legend row. Present whenever a chart draws more than one series. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map(item => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
