// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
// Run with: node --test frontend/tests/seo-serving.http.mjs (requires Docker).
// Uses isolated files and the pinned production runtime; never connects to the dev stack.
import { siteSettings } from '../scripts/site-settings.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { before, after, describe, it } from 'node:test';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dockerfile = readFileSync(join(frontend, 'Dockerfile'), 'utf8');
const image = /^FROM (cgr\.dev\/chainguard\/nginx@sha256:[a-f0-9]+)/m.exec(dockerfile)?.[1];
assert.ok(image, 'Use the exact runtime pinned by the production Dockerfile');
const shell = '<!doctype html><title>Serving fixture</title><div id="root">SPA fixture</div>';
const publicDocument='<h1>Public documentation fixture</h1><p>A substantive procedure.</p>';
const sitemap = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://customer.example/docs</loc></url></urlset>';
const containers = [];
const directories = [];
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function fixture({ crawlerFiles = true, suppliedSitemap = false, indexing = true } = {}) {
  const stage = mkdtempSync(join(tmpdir(), 'sw-seo-serving-'));
  directories.push(stage);
  const html = join(stage, 'html');
  mkdirSync(join(html, '_site/docs'), { recursive: true });
  mkdirSync(join(html, 'assets'), { recursive: true });
  mkdirSync(join(html, 'docs', 'get-started'), { recursive: true });
  for (const [name, value] of Object.entries({
    'index.html': shell,
    'app-shell.html': shell,
    '_site/index.html': publicDocument,
    '_site/docs.html': publicDocument,
    '_site/docs/get-started.html': publicDocument,
    '404.html': '<h1>Page not found</h1>',
    'assets/present.js': 'window.servingFixture = true;',
    'env.js': 'window.__STACKWEAVER__ = {};',
    'docs-index.json': '{"docs":[]}',
    'docs/get-started/readme.md': '# Getting started',
  })) writeFileSync(join(html, name), value);
  const robots = join(frontend, 'public/robots.txt');
  if (crawlerFiles && existsSync(robots)) writeFileSync(join(html, 'robots.txt'), readFileSync(robots));
  if (suppliedSitemap) writeFileSync(join(html, 'sitemap.xml'), sitemap);
  writeFileSync(join(stage,'public-site-settings.conf'),siteSettings({url:'https://customer.example',indexing}));
  const id = docker('create', '--publish', '127.0.0.1::8080', '--cap-drop=ALL', '--security-opt=no-new-privileges', image);
  containers.push(id);
  docker('cp', `${html}/.`, `${id}:/usr/share/nginx/html/`);
  docker('cp', join(frontend, 'nginx.conf'), `${id}:/etc/nginx/conf.d/nginx.default.conf`);
  docker('cp', join(frontend, 'security-headers.conf'), `${id}:/etc/nginx/security-headers.conf`);
  docker('cp', join(stage,'public-site-settings.conf'), `${id}:/etc/nginx/public-site-settings.conf`);
  docker('cp', join(frontend,'.public-build/public-private-routes.conf'), `${id}:/etc/nginx/public-private-routes.conf`);
  docker('start', id);
  const binding = docker('port', id, '8080/tcp');
  assert.match(binding, /^127\.0\.0\.1:\d+$/, 'Only publish on loopback');
  const origin = `http://${binding}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(origin + '/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return origin;
    } catch { /* nginx may still be starting */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`nginx did not become ready: ${docker('logs', id)}`);
}

function secure(response) {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
}

let origin, supplied, staging;
before(async () => {
  origin = await fixture();
  supplied = await fixture({ crawlerFiles: false, suppliedSitemap: true });
  staging = await fixture({ indexing: false, suppliedSitemap: true });
}, { timeout: 90_000 });
after(() => {
  for (const id of containers) docker('rm', '--force', id);
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

describe('production nginx crawler responses', () => {
  it('serves the shipped robots policy as text, never the application shell', async () => {
    const response = await fetch(origin + '/robots.txt');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^text\/plain/);
    const text = await response.text();
    assert.match(text, /^User-agent: \*/m);
    assert.match(text, /^Allow: \/$/m);
    assert.doesNotMatch(text, /Sitemap:|<!doctype|SPA fixture/i);
    secure(response);
  });
  it('returns 404 when a deployment has no robots file', async () => {
    const response = await fetch(supplied + '/robots.txt');
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /SPA fixture/);
    secure(response);
  });
  it('returns 404 for an absent sitemap instead of a successful shell', async () => {
    const response = await fetch(origin + '/sitemap.xml');
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /SPA fixture/);
    secure(response);
  });
  it('serves a supplied sitemap as XML without changing its deployment URLs', async () => {
    const response = await fetch(supplied + '/sitemap.xml');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^(?:application|text)\/xml/);
    assert.equal(await response.text(), sitemap);
    secure(response);
  });
  it('HEAD and GET use the same robots content type and status', async () => {
    const response = await fetch(origin + '/robots.txt', { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^text\/plain/);
    assert.equal(await response.text(), '');
    secure(response);
  });
});

describe('production nginx file and application boundaries', () => {
  for (const resource of ['/assets/missing.js', '/assets/missing.css', '/assets/missing.webp', '/assets/missing.bin', '/assets/no-extension']) {
    it(`returns a 404 without immutable caching for ${resource}`, async () => {
      const response = await fetch(origin + resource);
      assert.equal(response.status, 404);
      assert.doesNotMatch(response.headers.get('cache-control') ?? '', /immutable|31536000/);
      assert.doesNotMatch(await response.text(), /SPA fixture/);
      secure(response);
    });
  }
  it('keeps successful static assets immutable and secure', async () => {
    const response = await fetch(origin + '/assets/present.js');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /max-age=31536000, immutable/);
    assert.equal(await response.text(), 'window.servingFixture = true;');
    secure(response);
  });
  it('keeps runtime config uncached', async () => {
    const response = await fetch(origin + '/env.js');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    secure(response);
  });
  it('keeps documentation data outside immutable asset caching', async () => {
    const response = await fetch(origin + '/docs-index.json');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { docs: [] });
    assert.doesNotMatch(response.headers.get('cache-control') ?? '', /immutable/);
    secure(response);
  });
  for (const route of ['/docs', '/docs/get-started', '/login', '/app/example/workspaces/example', '/app/example/workspaces/with.json']) {
    it(`preserves the correct document without a slash redirect at ${route}`, async () => {
      const response = await fetch(origin + route, { redirect: 'manual' });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('location'), null);
      assert.equal(await response.text(), route.startsWith('/docs')?publicDocument:shell);
      assert.equal(response.headers.get('x-robots-tag'),route.startsWith('/docs')?null:'noindex, nofollow');
      secure(response);
    });
  }
});

describe('public/private indexing boundaries',()=>{
 for(const path of ['/not-a-real-page','/docs/not-a-real-guide','/internal-docs','/internal-docs-index.json','/_site/docs.html']) it(`returns a real 404 at ${path}`,async()=>{const r=await fetch(origin+path);assert.equal(r.status,404);assert.doesNotMatch(await r.text(),/SPA fixture/);});
 it('an indexing opt-out applies to public HTML and suppresses the sitemap',async()=>{const page=await fetch(staging+'/docs');assert.equal(page.headers.get('x-robots-tag'),'noindex, nofollow');const map=await fetch(staging+'/sitemap.xml');assert.equal(map.status,404);});
 it('canonicalizes the legacy landing URL with a permanent relative redirect',async()=>{const r=await fetch(origin+'/landing?source=old',{redirect:'manual'});assert.equal(r.status,308);assert.equal(r.headers.get('location'),'/?source=old');});
});
