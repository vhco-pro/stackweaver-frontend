// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
// @vitest-environment node
import { createServer } from 'vite';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readPrototype, internalDocPrototypes } from './internalDocPrototypes';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'docs-prototype-test-')); roots.push(root);
  const source = join(root, 'prototypes'); mkdirSync(join(source, 'example'), { recursive: true });
  writeFileSync(join(source, 'example/index.html'), '<h1>Saved review</h1>');
  writeFileSync(join(source, 'example/review.js'), 'document.title="Saved review";');
  writeFileSync(join(source, 'example/review.css'), 'body{color:purple}');
  writeFileSync(join(root, 'private.txt'), 'outside prototype root');
  symlinkSync(join(root, 'private.txt'), join(source, 'example/escape.js'));
  return source;
}
it('serves saved HTML and relative assets with MIME types, HEAD and an isolated document policy', async () => {
  const root = fixture();
  const html = await readPrototype(root, 'example/index.html?v=1', 'GET');
  expect(html.status).toBe(200); expect(html.headers['Content-Type']).toContain('text/html');
  expect(html.body?.toString()).toContain('Saved review');
  expect(html.headers['Content-Security-Policy']).toContain("connect-src 'none'");
  expect(html.headers['Content-Security-Policy']).toContain("frame-ancestors 'self'");
  expect((await readPrototype(root, 'example/review.js', 'GET')).headers['Content-Type']).toContain('javascript');
  expect((await readPrototype(root, 'example/review.css', 'HEAD')).body).toBeUndefined();
});
it('rejects missing files, writes, unknown types, malformed and escaping paths without an SPA fallback', async () => {
  const root = fixture();
  for (const path of ['missing.html', '../private.txt', '%2e%2e/private.txt', 'example%2f..%2f..%2fprivate.txt', 'example/escape.js', 'example/index.html/..', 'example/a%00.js', '%ZZ', '/example/index.html', 'example/unknown.exe']) {
    expect((await readPrototype(root, path, 'GET')).status, path).toBe(404);
  }
  expect((await readPrototype(root, 'example/index.html', 'POST')).status).toBe(405);
  const plugin = internalDocPrototypes(root);
  expect(plugin.apply).toBe('serve'); expect(plugin.configurePreviewServer).toBeUndefined();
  expect(plugin.generateBundle).toBeUndefined();
});

it('serves the mounted development endpoint with Connect request paths and fails missing resources closed', async () => {
  const root = fixture();
  const server = await createServer({ configFile: false, root, cacheDir: join(root, '.vite'), plugins: [internalDocPrototypes(root)], server: { host: '127.0.0.1', port: 0 } });
  try {
    await server.listen(); const address = server.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server address');
    const origin = `http://127.0.0.1:${address.port}/__dev/docs-prototypes/`;
    const response = await fetch(origin + 'example/index.html');
    expect(response.status).toBe(200); expect(await response.text()).toContain('Saved review');
    expect((await fetch(origin + 'example/review.css')).headers.get('content-type')).toContain('text/css');
    expect((await fetch(origin + 'missing.html')).status).toBe(404);
    expect((await fetch(origin + 'example/index.html', { method: 'POST' })).status).toBe(405);
  } finally { await server.close(); }
});
