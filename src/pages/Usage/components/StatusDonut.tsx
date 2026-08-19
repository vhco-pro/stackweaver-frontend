// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { CheckCircle2, CircleDashed, Clock, Loader2, XCircle } from 'lucide-react';
import type { AnalyticsOutcome } from '@/api/client';
import { ChartContainer, ChartTooltipSurface, type ChartTooltipProps } from '@/components/ui/chart';
import { formatRate, useChartPalette } from '../chartTheme';
import { EmptyState } from '@/components/ui/analytics-card';

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  Icon: typeof CheckCircle2;
}

/**
 * One donut for the whole status breakdown.
 *
 * The page this replaced drew a *separate* ring per status, each showing that status as a share of
 * the total - five rings that never composed into a whole and left the reader to do the addition.
 * A single donut is the honest form: the slices are parts of one thing, and the centre carries the
 * one number worth reading at a glance.
 */
export function StatusDonut({ outcome, totalLabel }: { outcome: AnalyticsOutcome; totalLabel: string }) {
  const palette = useChartPalette();

  const segments: Segment[] = [
    { key: 'succeeded', label: 'Succeeded', value: outcome.succeeded, color: palette.succeeded, Icon: CheckCircle2 },
    { key: 'failed', label: 'Failed', value: outcome.failed, color: palette.failed, Icon: XCircle },
    { key: 'running', label: 'Running', value: outcome.running, color: palette.running, Icon: Loader2 },
    { key: 'pending', label: 'Pending', value: outcome.pending, color: palette.pending, Icon: Clock },
    { key: 'canceled', label: 'Cancelled', value: outcome.canceled, color: palette.other, Icon: CircleDashed },
  ];
  const visible = segments.filter(segment => segment.value > 0);

  if (outcome.total === 0) {
    return <EmptyState message={`No ${totalLabel} in this period.`} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative">
        <ChartContainer height={168} className="w-[168px]">
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={76}
              startAngle={90}
              endAngle={-270}
              paddingAngle={visible.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {visible.map(segment => (
                <Cell key={segment.key} fill={segment.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={outcome.total} />} />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tracking-tight text-foreground">
            {formatRate(outcome.success_rate)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">success</span>
        </div>
      </div>

      {/* Icons carry the status alongside the swatch, so identity never rests on colour alone. */}
      <ul className="min-w-[160px] flex-1 space-y-1.5">
        {segments.map(segment => (
          <li key={segment.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: segment.color }} aria-hidden="true" />
            <segment.Icon className="h-3.5 w-3.5" style={{ color: segment.color }} aria-hidden="true" />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DonutTooltip({
  total,
  active,
  payload,
}: ChartTooltipProps<{ label?: string; value?: number; color?: string }> & { total: number }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = Number(item.value ?? 0);
  const share = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
  const label = item.payload?.label ?? item.name ?? '';

  return (
    <ChartTooltipSurface
      title={String(label)}
      rows={[
        {
          label: 'Count',
          value: String(value),
          color: item.payload?.color ?? item.color ?? 'currentColor',
        },
      ]}
      footer={`${share}% of ${total}`}
    />
  );
}
