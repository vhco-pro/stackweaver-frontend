// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { annotationProblem, bindingLabel, formatAnnotations, formatBytes, formatSeconds, parseAnnotations, parseGiB, runImageLabel } from './runPlacement';

describe('run placement helpers', () => {
  it('reads annotations one key=value per line and writes them back', () => {
    const parsed = parseAnnotations('eks.amazonaws.com/role-arn = arn:aws:iam::1:role/x\n\n=no-key\nflag=\nbare');
    expect(parsed).toEqual({ 'eks.amazonaws.com/role-arn': 'arn:aws:iam::1:role/x', flag: '' });
    expect(parseAnnotations(formatAnnotations(parsed))).toEqual(parsed);
  });

  it('writes durations and sizes the short way', () => {
    expect(formatSeconds(5400)).toBe('1h 30m');
    expect(formatSeconds(7200)).toBe('2h');
    expect(formatSeconds(0)).toBe('none');
    expect(formatBytes(50 * 1024 ** 3)).toBe('50 GiB');
    expect(formatBytes(1536)).toBe('1.5 KiB');
  });

  it('names the platform image and identity for an empty value', () => {
    expect(runImageLabel([], null)).toBe('the platform image');
    expect(bindingLabel([], null)).toBe('the platform identity');
    expect(runImageLabel([{ id: 'a', name: 'tofu-aws', kind: 'tofu', image: '', digest: '', registry_credential_id: null, description: '', created_at: '', updated_at: '' }], 'a')).toBe('tofu-aws');
  });
});

describe('parseGiB', () => {
  it('reads empty as the platform default and GiB as bytes', () => {
    expect(parseGiB('')).toEqual({ bytes: 0 });
    expect(parseGiB('1.5')).toEqual({ bytes: 1.5 * 1024 ** 3 });
  });

  it('refuses a negative size and text that is not a number', () => {
    expect(parseGiB('-1').error).toMatch(/negative/);
    expect(parseGiB('lots').error).toBeDefined();
  });
});

describe('annotationProblem', () => {
  it('accepts key=value lines and blank lines', () => {
    expect(annotationProblem('eks.amazonaws.com/role-arn=arn:aws:iam::1:role/x\n\nflag=')).toBeUndefined();
  });

  it('names a line that would be dropped instead of saving without it', () => {
    expect(annotationProblem('a=b\nbare')).toMatch(/line 2/);
    expect(annotationProblem('=no-key')).toMatch(/line 1/);
  });
});
