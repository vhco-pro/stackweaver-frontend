// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Width and collapse state for the two desktop panes of the docs viewer: the
 * navigation sidebar (left) and the "On this page" table of contents (right).
 *
 * Pure logic only, so it can be unit tested without a DOM. `useDocsPane` wires
 * it to React state, pointer dragging and localStorage.
 */

/** Which edge of the main content a pane sits on. It decides the drag direction. */
export type PaneSide = 'left' | 'right';

export interface PaneConfig {
  /** localStorage key the pane's state is persisted under. */
  storageKey: string;
  side: PaneSide;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
}

export interface PaneState {
  width: number;
  collapsed: boolean;
}

/** Arrow-key step, and the larger step used with Shift held. */
export const KEYBOARD_STEP = 16;
export const KEYBOARD_STEP_LARGE = 64;

export const SIDEBAR_PANE: PaneConfig = {
  storageKey: 'docs-sidebar-pane',
  side: 'left',
  minWidth: 200,
  maxWidth: 480,
  defaultWidth: 256,
};

export const TOC_PANE: PaneConfig = {
  storageKey: 'docs-toc-pane',
  side: 'right',
  minWidth: 176,
  maxWidth: 400,
  defaultWidth: 256,
};

/** The subset of the Web Storage API the panes use, so tests can pass a fake. */
export type PaneStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function clampWidth(width: number, config: PaneConfig): number {
  if (!Number.isFinite(width)) return config.defaultWidth;
  return Math.round(Math.min(config.maxWidth, Math.max(config.minWidth, width)));
}

export function defaultPaneState(config: PaneConfig): PaneState {
  return { width: config.defaultWidth, collapsed: false };
}

/**
 * Read a pane's persisted state. Anything missing, malformed or out of range
 * falls back to (or is clamped into) the defaults rather than throwing, since a
 * stale or hand-edited entry must never break the docs page.
 */
export function loadPaneState(storage: PaneStorage | undefined, config: PaneConfig): PaneState {
  const fallback = defaultPaneState(config);
  if (!storage) return fallback;

  let raw: string | null;
  try {
    raw = storage.getItem(config.storageKey);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null) return fallback;

  const record = parsed as Record<string, unknown>;
  return {
    width: typeof record.width === 'number' ? clampWidth(record.width, config) : config.defaultWidth,
    collapsed: typeof record.collapsed === 'boolean' ? record.collapsed : false,
  };
}

/** Persist a pane's state. Storage failures (quota, private mode) are ignored. */
export function savePaneState(storage: PaneStorage | undefined, config: PaneConfig, state: PaneState): void {
  if (!storage) return;
  try {
    storage.setItem(
      config.storageKey,
      JSON.stringify({ width: clampWidth(state.width, config), collapsed: state.collapsed }),
    );
  } catch {
    // Persistence is best effort; the in-memory state still applies.
  }
}

/**
 * Width after dragging the pane's handle from `startX` to `currentX`. The left
 * pane grows as its right-edge handle moves right; the right pane grows as its
 * left-edge handle moves left.
 */
export function widthFromDrag(startWidth: number, startX: number, currentX: number, config: PaneConfig): number {
  const delta = currentX - startX;
  return clampWidth(config.side === 'left' ? startWidth + delta : startWidth - delta, config);
}

/**
 * Width after a key press on the separator, or `null` when the key does not
 * resize. Arrow keys move the separator in the arrow's direction (so ArrowRight
 * widens the left pane and narrows the right one); Home and End jump to the
 * minimum and maximum width.
 */
export function widthFromKey(
  key: string,
  shiftKey: boolean,
  width: number,
  config: PaneConfig,
): number | null {
  const step = shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
  const grow = config.side === 'left' ? 'ArrowRight' : 'ArrowLeft';
  const shrink = config.side === 'left' ? 'ArrowLeft' : 'ArrowRight';
  switch (key) {
    case grow:
      return clampWidth(width + step, config);
    case shrink:
      return clampWidth(width - step, config);
    case 'Home':
      return config.minWidth;
    case 'End':
      return config.maxWidth;
    default:
      return null;
  }
}
