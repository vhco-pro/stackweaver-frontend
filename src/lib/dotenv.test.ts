// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { parseDotenv, looksSensitive } from './dotenv';

/** Convenience: parse and return the entries as a plain key -> value object. */
function values(input: string): Record<string, string> {
  return Object.fromEntries(parseDotenv(input).entries.map((e) => [e.key, e.value]));
}

describe('parseDotenv', () => {
  it('parses plain assignments', () => {
    expect(values('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores blank lines and comments', () => {
    const result = parseDotenv('# a comment\n\n  \nFOO=bar\n   # indented comment');
    expect(result.entries).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
  });

  it('accepts the export prefix', () => {
    expect(values('export FOO=bar')).toEqual({ FOO: 'bar' });
  });

  it('trims whitespace around the separator', () => {
    expect(values('  FOO = bar  ')).toEqual({ FOO: 'bar' });
  });

  it('keeps an empty value', () => {
    expect(values('FOO=')).toEqual({ FOO: '' });
  });

  it('strips inline comments from unquoted values', () => {
    expect(values('FOO=bar # trailing note')).toEqual({ FOO: 'bar' });
  });

  it('keeps a # that is part of an unquoted value', () => {
    expect(values('FOO=pa#ssword')).toEqual({ FOO: 'pa#ssword' });
  });

  it('keeps quoted values verbatim, including # and spaces', () => {
    expect(values('FOO="a # b"\nBAR=\'c # d\'')).toEqual({ FOO: 'a # b', BAR: 'c # d' });
  });

  it('expands escapes only inside double quotes', () => {
    expect(values('A="line1\\nline2"')).toEqual({ A: 'line1\nline2' });
    expect(values("A='line1\\nline2'")).toEqual({ A: 'line1\\nline2' });
  });

  it('keeps unknown escape sequences intact', () => {
    expect(values('RE="\\d+"')).toEqual({ RE: '\\d+' });
  });

  it('handles an escaped quote inside a double-quoted value', () => {
    expect(values('JSON="{\\"a\\": 1}"')).toEqual({ JSON: '{"a": 1}' });
  });

  it('supports backtick quoting', () => {
    expect(values('FOO=`a "b" c`')).toEqual({ FOO: 'a "b" c' });
  });

  it('reads multiline quoted values', () => {
    const pem = 'KEY="-----BEGIN-----\nline\n-----END-----"\nNEXT=after';
    expect(values(pem)).toEqual({
      KEY: '-----BEGIN-----\nline\n-----END-----',
      NEXT: 'after',
    });
  });

  it('does not interpolate references to other variables', () => {
    expect(values('A=one\nB="${A}/two"')).toEqual({ A: 'one', B: '${A}/two' });
  });

  it('normalises CRLF line endings and a BOM', () => {
    expect(values('\uFEFFFOO=bar\r\nBAZ=qux\r\n')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('lets the last assignment win but keeps the original position', () => {
    const result = parseDotenv('FOO=first\nBAR=x\nFOO=second');
    expect(result.entries.map((e) => e.key)).toEqual(['FOO', 'BAR']);
    expect(result.entries[0].value).toBe('second');
    expect(result.duplicateKeys).toEqual(['FOO']);
  });

  it('reports lines without a separator', () => {
    const result = parseDotenv('just some prose\nFOO=bar');
    expect(result.entries).toHaveLength(1);
    expect(result.issues).toEqual([{ line: 1, detail: 'not a KEY=value assignment' }]);
  });

  it('reports invalid keys', () => {
    const result = parseDotenv('9FOO=bar\nFO O=bar\nOK=1');
    expect(result.entries.map((e) => e.key)).toEqual(['OK']);
    expect(result.issues.map((i) => i.line)).toEqual([1, 2]);
  });

  it('reports a missing key', () => {
    expect(parseDotenv('=orphan').issues).toEqual([{ line: 1, detail: 'missing key before "="' }]);
  });

  it('reports an unterminated quote without swallowing the rest of the file', () => {
    const result = parseDotenv('BROKEN="oops\nFOO=bar');
    expect(result.issues).toEqual([{ line: 1, detail: 'unterminated quoted value' }]);
    expect(values('BROKEN="oops\nFOO=bar')).toEqual({ FOO: 'bar' });
  });

  it('records the source line of each entry', () => {
    const result = parseDotenv('# header\n\nFOO=bar\nBAZ=qux');
    expect(result.entries.map((e) => e.line)).toEqual([3, 4]);
  });

  it('returns nothing for an empty file', () => {
    expect(parseDotenv('')).toEqual({ entries: [], issues: [], duplicateKeys: [] });
  });
});

describe('looksSensitive', () => {
  it.each([
    'DB_PASSWORD',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_ACCESS_KEY_ID',
    'GITHUB_TOKEN',
    'api_key',
    'PRIVATE_KEY',
    'DATABASE_URL',
    'SESSION_SECRET',
    'TLS_CERT',
  ])('flags %s', (key) => {
    expect(looksSensitive(key)).toBe(true);
  });

  it.each(['AWS_REGION', 'LOG_LEVEL', 'instance_type', 'PORT', 'NODE_ENV'])(
    'does not flag %s',
    (key) => {
      expect(looksSensitive(key)).toBe(false);
    }
  );
});
