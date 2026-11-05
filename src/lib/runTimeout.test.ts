// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { MAX_RUN_TIMEOUT_MINUTES, minutesText, parseTimeoutMinutes } from './runTimeout';

describe('parseTimeoutMinutes', () => {
  it('reads an empty field as inherit', () => {
    expect(parseTimeoutMinutes('')).toEqual({ seconds: 0 });
    expect(parseTimeoutMinutes('  ')).toEqual({ seconds: 0 });
  });

  it('converts minutes to seconds, fractions included', () => {
    expect(parseTimeoutMinutes('30')).toEqual({ seconds: 1800 });
    expect(parseTimeoutMinutes('1.5')).toEqual({ seconds: 90 });
    expect(parseTimeoutMinutes(String(MAX_RUN_TIMEOUT_MINUTES))).toEqual({ seconds: 86400 });
  });

  it('refuses a negative value instead of saving it as inherit', () => {
    expect(parseTimeoutMinutes('-10').error).toMatch(/negative/);
  });

  it('refuses a value above 24 hours', () => {
    expect(parseTimeoutMinutes('100000').error).toMatch(/1440/);
    expect(parseTimeoutMinutes(String(MAX_RUN_TIMEOUT_MINUTES + 1)).error).toBeDefined();
  });

  it('refuses text that is not a number', () => {
    expect(parseTimeoutMinutes('abc').error).toBeDefined();
  });
});

describe('minutesText', () => {
  it('shows inherit as empty and keeps seconds that are not whole minutes', () => {
    expect(minutesText(0)).toBe('');
    expect(minutesText(undefined)).toBe('');
    expect(minutesText(3600)).toBe('60');
    expect(minutesText(90)).toBe('1.5');
  });

  it('round-trips any whole number of seconds', () => {
    for (const s of [1, 7, 59, 61, 100, 3599, 7200, 86400]) {
      expect(parseTimeoutMinutes(minutesText(s))).toEqual({ seconds: s });
    }
  });
});
