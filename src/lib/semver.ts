// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Orders version strings newest first, comparing numeric parts as numbers (1.13.0 before 1.9.8
 * before 1.5.0) and other parts as text. Pass it to `Array.prototype.sort`.
 */
export function compareVersionsDesc(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split(/[-.]/).map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : p));
  const pb = b.replace(/^v/, '').split(/[-.]/).map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : p));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? (typeof pb[i] === 'string' ? '' : -1);
    const vb = pb[i] ?? (typeof pa[i] === 'string' ? '' : -1);
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va !== vb) return vb - va;
    } else {
      const cmp = String(vb).localeCompare(String(va));
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}
