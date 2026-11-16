// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The connection picker guard (#938, AC-15, R-31 F-01). An organization can hold a GitHub App
// connection and a token connection for the same account, so every picker lists each connection the
// API returns and labels it with getVcsConnectionLabel, which says which one it is. A list keyed by
// provider and account would hide one of the two, and a label of provider and account alone would
// show two identical entries.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Connections keyed by provider and account, which merges an App and a token connection. */
const DEDUPLICATED = /\$\{\s*\w+\.provider\s*\}-\$\{\s*\w+\.account_name\s*\}/;
/** A picker label of provider and account without the connection's kind. */
const UNMARKED_LABEL = /getVcsProviderLabel\(\s*\w+\.provider\s*\)\}\s*-\s*\{\s*\w+\.account_name\s*\}/;

describe('VCS connection pickers', () => {
  const files = sources(SRC).map((path) => ({ path: relative(SRC, path), text: readFileSync(path, 'utf8') }));

  it('never merge connections of one account', () => {
    expect(files.filter((f) => DEDUPLICATED.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('label every connection with its kind', () => {
    expect(files.filter((f) => UNMARKED_LABEL.test(f.text)).map((f) => f.path)).toEqual([]);
  });
});
