// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/** The longest run timeout any level may set: 24 hours, the API's settings.MaxRunTimeoutSeconds. */
export const MAX_RUN_TIMEOUT_MINUTES = 24 * 60;

/** A timeout field as entered: its value in seconds (0 inherits), or why it cannot be saved. */
export type TimeoutField = { seconds: number; error?: undefined } | { seconds?: undefined; error: string };

/**
 * Reads a run timeout field entered in minutes. Empty inherits (0); fractions are allowed, so a
 * timeout stored as seconds that are not whole minutes is kept on save. A negative value, one above
 * MAX_RUN_TIMEOUT_MINUTES or text that is not a number is refused with a reason, never saved as
 * inherit.
 */
export function parseTimeoutMinutes(text: string): TimeoutField {
  const t = text.trim();
  if (t === '') return { seconds: 0 };
  const n = Number(t);
  if (!Number.isFinite(n)) return { error: 'Enter a number of minutes.' };
  if (n < 0) return { error: 'A timeout cannot be negative. Leave the field empty to inherit.' };
  if (n > MAX_RUN_TIMEOUT_MINUTES) return { error: `A timeout can be at most ${MAX_RUN_TIMEOUT_MINUTES} minutes (24 hours).` };
  return { seconds: Math.round(n * 60) };
}

/** A stored timeout in seconds as the minutes a field shows; 0 or unset (inherit) is empty. */
export function minutesText(seconds: number | null | undefined): string {
  return seconds ? String(Number((seconds / 60).toFixed(2))) : '';
}
