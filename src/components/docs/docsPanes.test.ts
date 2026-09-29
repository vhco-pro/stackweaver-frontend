// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Persistence and sizing rules for the resizable/collapsible docs panes (#131).

import { describe, it, expect } from 'vitest';
import {
  type PaneStorage,
  KEYBOARD_STEP,
  KEYBOARD_STEP_LARGE,
  SIDEBAR_PANE,
  TOC_PANE,
  clampWidth,
  loadPaneState,
  savePaneState,
  widthFromDrag,
  widthFromKey,
} from './docsPanes';

function memoryStorage(initial: Record<string, string> = {}): PaneStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('clampWidth', () => {
  it('keeps a width inside the pane bounds and rounds it', () => {
    expect(clampWidth(10, SIDEBAR_PANE)).toBe(SIDEBAR_PANE.minWidth);
    expect(clampWidth(10_000, SIDEBAR_PANE)).toBe(SIDEBAR_PANE.maxWidth);
    expect(clampWidth(300.6, SIDEBAR_PANE)).toBe(301);
  });

  it('falls back to the default for a non-finite width', () => {
    expect(clampWidth(Number.NaN, TOC_PANE)).toBe(TOC_PANE.defaultWidth);
  });
});

describe('loadPaneState / savePaneState', () => {
  it('returns the defaults when nothing is stored or storage is unavailable', () => {
    expect(loadPaneState(memoryStorage(), SIDEBAR_PANE)).toEqual({ width: 256, collapsed: false });
    expect(loadPaneState(undefined, TOC_PANE)).toEqual({ width: 256, collapsed: false });
  });

  it('round-trips width and collapsed state per pane', () => {
    const storage = memoryStorage();
    savePaneState(storage, SIDEBAR_PANE, { width: 320, collapsed: true });
    savePaneState(storage, TOC_PANE, { width: 200, collapsed: false });

    expect(loadPaneState(storage, SIDEBAR_PANE)).toEqual({ width: 320, collapsed: true });
    expect(loadPaneState(storage, TOC_PANE)).toEqual({ width: 200, collapsed: false });
    expect(Object.keys(storage.data).sort()).toEqual(['docs-sidebar-pane', 'docs-toc-pane']);
  });

  it('clamps an out-of-range stored width, on save and on load', () => {
    const storage = memoryStorage({ 'docs-sidebar-pane': JSON.stringify({ width: 5000, collapsed: false }) });
    expect(loadPaneState(storage, SIDEBAR_PANE).width).toBe(SIDEBAR_PANE.maxWidth);

    savePaneState(storage, TOC_PANE, { width: 1, collapsed: false });
    expect(JSON.parse(storage.data['docs-toc-pane'])).toEqual({ width: TOC_PANE.minWidth, collapsed: false });
  });

  it('ignores malformed entries instead of throwing', () => {
    for (const raw of ['not json', 'null', '42', JSON.stringify({ width: 'wide', collapsed: 'yes' })]) {
      const storage = memoryStorage({ 'docs-toc-pane': raw });
      expect(loadPaneState(storage, TOC_PANE)).toEqual({ width: 256, collapsed: false });
    }
  });

  it('swallows storage exceptions (disabled storage, quota)', () => {
    const throwing: PaneStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadPaneState(throwing, SIDEBAR_PANE)).toEqual({ width: 256, collapsed: false });
    expect(() => {
      savePaneState(throwing, SIDEBAR_PANE, { width: 300, collapsed: true });
    }).not.toThrow();
  });
});

describe('widthFromDrag', () => {
  it('widens the left pane as its handle moves right', () => {
    expect(widthFromDrag(256, 100, 180, SIDEBAR_PANE)).toBe(336);
    expect(widthFromDrag(256, 100, 60, SIDEBAR_PANE)).toBe(216);
  });

  it('widens the right pane as its handle moves left', () => {
    expect(widthFromDrag(256, 1000, 940, TOC_PANE)).toBe(316);
    expect(widthFromDrag(256, 1000, 1040, TOC_PANE)).toBe(216);
  });

  it('never leaves the bounds', () => {
    expect(widthFromDrag(256, 0, 5000, SIDEBAR_PANE)).toBe(SIDEBAR_PANE.maxWidth);
    expect(widthFromDrag(256, 0, 5000, TOC_PANE)).toBe(TOC_PANE.minWidth);
  });
});

describe('widthFromKey', () => {
  it('moves the separator in the arrow direction', () => {
    expect(widthFromKey('ArrowRight', false, 256, SIDEBAR_PANE)).toBe(256 + KEYBOARD_STEP);
    expect(widthFromKey('ArrowLeft', false, 256, SIDEBAR_PANE)).toBe(256 - KEYBOARD_STEP);
    expect(widthFromKey('ArrowLeft', false, 256, TOC_PANE)).toBe(256 + KEYBOARD_STEP);
    expect(widthFromKey('ArrowRight', false, 256, TOC_PANE)).toBe(256 - KEYBOARD_STEP);
  });

  it('takes a larger step with Shift and jumps to the bounds with Home/End', () => {
    expect(widthFromKey('ArrowRight', true, 256, SIDEBAR_PANE)).toBe(256 + KEYBOARD_STEP_LARGE);
    expect(widthFromKey('Home', false, 300, SIDEBAR_PANE)).toBe(SIDEBAR_PANE.minWidth);
    expect(widthFromKey('End', false, 300, TOC_PANE)).toBe(TOC_PANE.maxWidth);
  });

  it('returns null for keys that do not resize', () => {
    expect(widthFromKey('Enter', false, 256, SIDEBAR_PANE)).toBeNull();
    expect(widthFromKey('ArrowUp', false, 256, SIDEBAR_PANE)).toBeNull();
  });
});
