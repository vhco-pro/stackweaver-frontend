// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useTheme } from '@/contexts/ThemeContext';

/**
 * Chart palette for the Usage page.
 *
 * Both columns are *selected*, not derived: the dark steps are the same hues re-stepped for the
 * dark surface, and each set was validated against its own surface for colourblind separation
 * (adjacent-pair CVD ΔE >= 8), a lightness band, a chroma floor, and >= 3:1 contrast. Editing a hex
 * here without re-validating the set can silently make two adjacent series indistinguishable to a
 * deuteranopic reader, so treat these as fixed values rather than taste.
 *
 * Semantic status colours (succeeded/failed/running/pending) are reserved and never reused as
 * "series 5". Cancelled and other transitional states get the de-emphasis grey: they are context,
 * not a category worth a hue.
 */
export interface ChartPalette {
  succeeded: string;
  failed: string;
  running: string;
  pending: string;
  /** Cancelled / transitional. Deliberately grey - a non-colour. */
  other: string;
  terraform: string;
  ansible: string;
  grid: string;
  axis: string;
  /** Axis tick + label ink. Text never wears a series colour. */
  label: string;
  tooltipBg: string;
  tooltipBorder: string;
}

const DARK: ChartPalette = {
  succeeded: '#0c9e6d',
  failed: '#ef4a47',
  running: '#3b82f6',
  pending: '#d97706',
  other: '#56506a',
  terraform: '#8b5cf6',
  ansible: '#0891b2',
  grid: 'rgba(255,255,255,0.07)',
  axis: 'rgba(255,255,255,0.16)',
  label: '#8d8699',
  tooltipBg: '#16151d',
  tooltipBorder: 'rgba(255,255,255,0.12)',
};

const LIGHT: ChartPalette = {
  succeeded: '#059669',
  failed: '#dc2626',
  running: '#2563eb',
  pending: '#b45309',
  other: '#b6b0c2',
  terraform: '#7c3aed',
  ansible: '#0891b2',
  grid: 'rgba(26,21,35,0.07)',
  axis: 'rgba(26,21,35,0.18)',
  label: '#6b6478',
  tooltipBg: '#ffffff',
  tooltipBorder: 'rgba(26,21,35,0.12)',
};

/** Returns the palette matching the resolved theme, so charts repaint when the user switches. */
export function useChartPalette(): ChartPalette {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? DARK : LIGHT;
}

/**
 * Formats a duration for display. Seconds below a minute keep one decimal only when they are small
 * enough for it to mean something; beyond an hour the seconds component is dropped as noise.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Formats a nullable success rate. Null means "nothing has finished", which is not 0%. */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`;
}

/** Formats an ISO day (YYYY-MM-DD) as a short axis/tooltip label. */
export function formatDay(date: string, withYear = false): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}
