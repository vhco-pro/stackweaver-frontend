// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { readFile, realpath, stat } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  // A script-only sandbox has an opaque origin. Its local assets must still load.
  'Cross-Origin-Resource-Policy': 'cross-origin',
  // Repo-owned HTML can use local or HTTPS assets, including older CDN-based reviews.
  // The opaque iframe denies parent/storage access; fetches and forms remain blocked.
  'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
};
interface PrototypeResponse { status: number; headers: Record<string, string>; body?: Buffer }
export async function readPrototype(root: string, resource: string, method: string): Promise<PrototypeResponse> {
  if (method !== 'GET' && method !== 'HEAD') return { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } };
  const missing = { status: 404, headers };
  try {
    const relative = decodeURIComponent(resource.split('?')[0]);
    if (relative.includes('\\') || relative.includes('\0') || relative.split('/').some(part => !part || part === '.' || part === '..')) return missing;
    const type = types[path.extname(relative).toLowerCase()];
    if (!type) return missing;
    const source = await realpath(root), file = await realpath(path.join(source, relative));
    if (!file.startsWith(source + path.sep) || !(await stat(file)).isFile()) return missing;
    return { status: 200, headers: { ...headers, 'Content-Type': type }, body: method === 'HEAD' ? undefined : await readFile(file) };
  } catch { return missing; }
}

/** Source-only: never copy prototypes into publicDir or attach this to a preview server. */
export function internalDocPrototypes(root: string): Plugin {
  return {
    name: 'internal-doc-prototypes', apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/docs-prototypes/', (req, res) => {
        void readPrototype(root, (req.url ?? '').replace(/^\//, ''), req.method ?? 'GET').then(result => {
          res.writeHead(result.status, result.headers); res.end(result.body);
        }).catch(() => { res.writeHead(500); res.end(); });
      });
    },
  };
}

/** Also guard direct `vite build`, after local dev docs have populated publicDir. */
export function excludeInternalDocs(): Plugin {
  return {
    name: 'exclude-internal-docs-from-production', apply: 'build',
    configResolved(config) {
      if (!config.publicDir) return;
      for (const file of ['internal-docs', 'internal-docs-index.json', 'internal-docs-search-index.json']) {
        rmSync(path.join(config.publicDir, file), { recursive: true, force: true });
      }
    },
  };
}
