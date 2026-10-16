// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The landing tour shows captures of the application's own pages. A capture goes stale
// silently: the page it depicts changes and the landing page keeps showing the old one. This
// test is what makes that loud. The manifest records, for each screen, the route component it
// depicts and that file's hash at capture time; when the file changes, the hash no longer
// matches and the screens have to be recaptured.
//
// Known limit: only the route component file is hashed. A change inside a shared component
// the page renders is not detected.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOUR_SCREENS } from './tourScreens';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..');
const MANIFEST = join(HERE, 'tourManifest.json');

const RECAPTURE = 'Recapture the tour with `make landing-captures` (it rewrites the images and tourManifest.json).';

interface ManifestScreen {
  id: string;
  path: string;
  page: string;
  sha256: string;
}

const readManifest = (): { screens: ManifestScreen[] } => {
  if (!existsSync(MANIFEST)) throw new Error(`tourManifest.json is missing. ${RECAPTURE}`);
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as { screens: ManifestScreen[] };
};

describe('landing tour screens', () => {
  it('walks the seven screens in the approved order', () => {
    expect(TOUR_SCREENS.map((s) => s.id)).toEqual(['dashboard', 'workspaces', 'workspace', 'runs', 'run', 'job', 'runners']);
  });

  it('gives every screen a caption, an address and a capture per theme', () => {
    for (const screen of TOUR_SCREENS) {
      expect(screen.title.length, screen.id).toBeGreaterThan(10);
      expect(screen.description.length, screen.id).toBeGreaterThan(40);
      expect(screen.url, screen.id).toMatch(/^\//);
      expect(screen.image.dark, screen.id).toMatch(/\.webp$/);
      expect(screen.image.light, screen.id).toMatch(/\.webp$/);
      expect(screen.image.dark).not.toBe(screen.image.light);
    }
  });
});

describe('landing tour manifest', () => {
  it('has one entry per tour screen, in the same order', () => {
    expect(readManifest().screens.map((s) => s.id)).toEqual(TOUR_SCREENS.map((s) => s.id));
  });

  it('records the current hash of the page each screen depicts', () => {
    const stale: string[] = [];
    for (const screen of readManifest().screens) {
      const file = join(SRC, screen.page);
      expect(existsSync(file), `${screen.id} depicts ${screen.page}, which does not exist`).toBe(true);
      const now = createHash('sha256').update(readFileSync(file)).digest('hex');
      if (now !== screen.sha256) stale.push(`${screen.id} (${screen.page})`);
    }
    expect(stale, `These pages changed after their landing-tour screens were captured. ${RECAPTURE}`).toEqual([]);
  });

  it('records the address each screen was captured at', () => {
    for (const screen of readManifest().screens) expect(screen.path, screen.id).toMatch(/^\/(dashboard|app\/[a-z0-9-]+\/)/);
  });

  it('has a capture on disk for every screen and theme', () => {
    for (const screen of readManifest().screens) {
      for (const theme of ['dark', 'light']) {
        const file = join(SRC, 'assets', 'landing', `${screen.id}-${theme}.webp`);
        expect(existsSync(file), `${screen.id}-${theme}.webp is missing. ${RECAPTURE}`).toBe(true);
      }
    }
  });
});

describe('production serving of the tour images', () => {
  // The production web server answers static files with a one-year immutable cache header, but
  // only for the extensions its rule lists. Without webp there the captures get no cache header,
  // and the Vite dev server hides the difference.
  it('lists webp in the static-asset rule of nginx.conf', () => {
    const conf = readFileSync(join(SRC, '..', 'nginx.conf'), 'utf8');
    const rule = /location ~\* \\\.\(([^)]+)\)\$ \{[^}]*immutable/.exec(conf);
    expect(rule, 'nginx.conf has a static-asset rule with an immutable cache header').not.toBeNull();
    expect(rule![1].split('|')).toContain('webp');
  });
});
