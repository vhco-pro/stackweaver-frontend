// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

/**
 * Shared chart chrome: a fixed-height responsive frame and one tooltip surface every chart on the
 * page uses, so a hover reads identically whether it lands on a bar, a line, or a donut slice.
 */
export function ChartContainer({
  height = 240,
  className,
  children,
}: {
  height?: number;
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** One row of a tooltip: swatch, series name, value. */
export interface ChartTooltipRow {
  label: string;
  value: string;
  color: string;
}

/**
 * Tooltip surface. Takes already-formatted rows rather than raw Recharts payloads so each chart
 * decides what its own numbers mean (a duration is not a count), while the presentation stays
 * shared. Values are tabular so they line up across rows.
 */
export function ChartTooltipSurface({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: ChartTooltipRow[];
  footer?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="mt-1 space-y-0.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: row.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
      {footer ? <p className="mt-1.5 text-[11px] text-muted-foreground">{footer}</p> : null}
    </div>
  );
}

/**
 * The shape Recharts hands a custom tooltip. Declared locally (all fields optional, matching how
 * Recharts actually calls it) so charts stay typed without importing the library's internal
 * generics or reaching for `any`.
 */
export interface ChartTooltipPayloadItem<T = Record<string, unknown>> {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
  payload?: T;
}

export interface ChartTooltipProps<T = Record<string, unknown>> {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipPayloadItem<T>[];
}
