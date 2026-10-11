// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the one place page colours come from. A page's title gradient and its primary
// button ring both read the same ramp entry, so they cannot drift apart; these tests keep
// every entry complete and every Settings page mapped to one.

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { RAMPS, SETTINGS_PAGE_RAMPS, rampVars, type RampName } from './ramps';

const here = dirname(fileURLToPath(import.meta.url));

describe('RAMPS', () => {
  const names = Object.keys(RAMPS) as RampName[];

  it.each(names)('%s has three ring stops as hex colours', (name) => {
    expect(RAMPS[name].ring).toHaveLength(3);
    for (const stop of RAMPS[name].ring) expect(stop).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(names)('%s has a title gradient with light and dark stops', (name) => {
    const classes = RAMPS[name].title.split(/\s+/);
    for (const edge of ['from', 'via', 'to']) {
      expect(classes.some((c) => c.startsWith(`${edge}-`)), `light ${edge}`).toBe(true);
      expect(classes.some((c) => c.startsWith(`dark:${edge}-`)), `dark ${edge}`).toBe(true);
    }
  });

  it.each(names)('%s has an icon colour for light and dark', (name) => {
    const classes = RAMPS[name].icon.split(/\s+/);
    expect(classes.some((c) => c.startsWith('text-'))).toBe(true);
    expect(classes.some((c) => c.startsWith('dark:text-'))).toBe(true);
  });

  it('the app ramp is violet, indigo, blue', () => {
    expect(RAMPS.app.ring).toEqual(['#8b5cf6', '#6366f1', '#3b82f6']);
    expect(RAMPS.app.title).toContain('from-violet-600');
    expect(RAMPS.app.title).toContain('via-indigo-600');
    expect(RAMPS.app.title).toContain('to-blue-600');
  });
});

describe('rampVars', () => {
  it('exposes the ring stops as the properties .gradient-ring-btn reads', () => {
    expect(rampVars('runners')).toEqual({
      '--sw-ring-c1': RAMPS.runners.ring[0],
      '--sw-ring-c2': RAMPS.runners.ring[1],
      '--sw-ring-c3': RAMPS.runners.ring[2],
    });
  });
});

describe('SETTINGS_PAGE_RAMPS', () => {
  it('maps every Settings page file to a ramp that exists', () => {
    const files = readdirSync(join(here, '..', 'pages', 'Settings'))
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
      .map((f) => `Settings/${f}`);
    // Served under the Settings route although the file lives with the Ansible pages.
    files.push('Settings.tsx', 'Ansible/Credentials.tsx');
    for (const file of files) {
      const ramp = SETTINGS_PAGE_RAMPS[file];
      expect(ramp, `${file} has no ramp`).toBeDefined();
      expect(RAMPS[ramp], `${file} maps to an unknown ramp`).toBeDefined();
    }
  });
});
