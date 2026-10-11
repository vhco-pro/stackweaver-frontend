// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the quiet red style every on-page destructive trigger shares. Delete buttons came in
// five styles before the sweep; this one is the only one, and solid red is reserved for the
// confirm button inside the dialog.

import { describe, it, expect } from 'vitest';
import { dangerGhostIcon, dangerOutline } from './surfaces';

describe('dangerOutline', () => {
  const classes = dangerOutline.split(/\s+/);

  it('is red text on a red border, paired for dark', () => {
    expect(classes.some((c) => /^text-red-\d+$/.test(c))).toBe(true);
    expect(classes.some((c) => /^dark:text-red-\d+$/.test(c))).toBe(true);
    expect(classes.some((c) => /^border-red-\d+(\/\d+)?$/.test(c))).toBe(true);
    expect(classes.some((c) => /^dark:border-red-\d+(\/\d+)?$/.test(c))).toBe(true);
  });

  it('tints on hover and never fills solid at rest', () => {
    expect(classes.some((c) => c.startsWith('hover:bg-red-'))).toBe(true);
    expect(classes.some((c) => /^bg-red-/.test(c))).toBe(false);
  });
});

describe('dangerGhostIcon', () => {
  const classes = dangerGhostIcon.split(/\s+/);

  it('is red, paired for dark, with no border', () => {
    expect(classes.some((c) => /^text-red-\d+$/.test(c))).toBe(true);
    expect(classes.some((c) => /^dark:text-red-\d+$/.test(c))).toBe(true);
    expect(classes.some((c) => c.includes('border'))).toBe(false);
  });
});
