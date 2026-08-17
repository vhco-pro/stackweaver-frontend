// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { KpiDelta } from '../delta';

/**
 * A headline number with its change against the previous period and a shape-of-the-trend sparkline.
 *
 * The delta carries an arrow as well as a colour, so the direction survives for a reader who cannot
 * separate the green from the red.
 */
export function KpiTile({
  label,
  value,
  sublabel,
  delta,
  spark,
  sparkColor,
  loading,
}: {
  label: string;
  value: string;
  sublabel?: string;
  delta?: KpiDelta;
  spark?: number[];
  sparkColor: string;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent',
        'dark:from-black/10 dark:via-black/5',
        'backdrop-blur-md border border-white/20 dark:border-white/10',
        'p-4 shadow-lg'
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {delta ? (
              <p
                className={cn(
                  'mt-0.5 flex items-center gap-1 text-xs font-semibold',
                  delta.direction === 'flat'
                    ? 'text-muted-foreground'
                    : delta.good
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                )}
              >
                {delta.direction === 'up' ? (
                  <ArrowUp className="h-3 w-3" aria-hidden="true" />
                ) : delta.direction === 'down' ? (
                  <ArrowDown className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Minus className="h-3 w-3" aria-hidden="true" />
                )}
                {delta.text}
              </p>
            ) : sublabel ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
            ) : null}
          </div>
          {/* The sparkline is the first thing to go on a narrow screen: it is shape-of-the-trend
              context, and keeping it would squeeze the headline number itself into an ellipsis. */}
          {spark && spark.length > 1 ? (
            <div className="hidden sm:block">
              <Sparkline data={spark} color={sparkColor} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Inline SVG rather than a charting-library instance: a sparkline has no axes, no legend, and no
 * tooltip, so mounting a full chart per tile would buy nothing and cost five more render trees.
 */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 78;
  const height = 26;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((value, i) => {
    const x = step * i;
    const y = height - 2 - (height - 6) * ((value - min) / span);
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={color} opacity={0.13} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.4} fill={color} />
    </svg>
  );
}

