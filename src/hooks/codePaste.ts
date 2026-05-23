// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Pure logic behind the useCodePaste hook. Kept in its own file so the
 * vitest node environment can import it without pulling in the config
 * module (which reads `window`, unavailable under node).
 *
 * Returns true when the paste was consumed and a submit was scheduled.
 */
export function handleCodePasteEvent(
  event: React.ClipboardEvent<HTMLInputElement>,
  onSubmit: (value: string) => void,
  expectedLength: number,
  enabled: boolean,
): boolean {
  if (!enabled) return false;

  const pasted = (event.clipboardData?.getData('text') ?? '').trim().replace(/\s+/g, '');
  if (pasted.length !== expectedLength) return false;
  if (!/^\d+$/.test(pasted)) return false;

  // Don't call preventDefault — we want the Input to still receive the
  // paste so its controlled value reflects reality if the submit fails.
  // Submit on next tick so React commits the input state first.
  queueMicrotask(() => { onSubmit(pasted); });
  return true;
}
