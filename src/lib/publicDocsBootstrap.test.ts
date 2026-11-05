// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DocsIndex } from '@/components/docs/docsTypes';
import type { PublicPage } from './publicRoutes';
import { publicDocsBootstrapMarkup, readPublicDocsBootstrap, seedPublicDocsBootstrap } from './publicDocsBootstrap';

const index: DocsIndex = { tree: [], flat: {}, generated: '2026-11-05' };
const page: PublicPage = { path: '/docs/guide', kind: 'docs', title: 'Guide', description: 'Guide', source: 'guide.md' };
const content = '# Guide\n\nCopy this literally: </script><script>alert(1)</script> $& $`';
beforeEach(() => { document.body.innerHTML = ''; });

describe('public documentation startup data', () => {
  it('keeps authored text inert and seeds the same initial document at a customer prefix', () => {
    document.body.innerHTML = publicDocsBootstrapMarkup(page, { index, content });
    expect(document.querySelectorAll('script')).toHaveLength(1);
    const data = readPublicDocsBootstrap(document, '/customer/docs/guide', '/customer');
    expect(data).not.toBeNull();
    const client = new QueryClient();
    seedPublicDocsBootstrap(client, data!);
    expect(client.getQueryData(['docs-index', 'public', '/docs', '/docs-index.json'])).toEqual(index);
    expect(client.getQueryData(['doc', 'public', '/docs-index.json', '/docs', 'guide', '/docs/guide'])).toEqual({ content, isDirectoryPage: false });
    expect(client.getQueryData(['docs-overview-introduction', 'public', '/docs-index.json', '/docs'])).toBeUndefined();
    expect(client.getQueryData(['docs-redirects', '/docs'])).toBeUndefined();
    client.clear();
  });

  it('seeds the root introduction only for the root documentation page', () => {
    document.body.innerHTML = publicDocsBootstrapMarkup({ ...page, path: '/docs', folder: '', source: 'README.md', kind: 'docs-index' }, { index, content });
    const client = new QueryClient();
    seedPublicDocsBootstrap(client, readPublicDocsBootstrap(document, '/docs', '')!);
    expect(client.getQueryData(['docs-overview-introduction', 'public', '/docs-index.json', '/docs'])).toBe(content);
    expect(client.getQueryData(['doc', 'public', '/docs-index.json', '/docs', 'README', '/docs'])).toEqual({ content, isDirectoryPage: true });
    client.clear();
  });

  it('does not seed another page, application route, or near-matching customer prefix', () => {
    document.body.innerHTML = publicDocsBootstrapMarkup(page, { index, content });
    for (const path of ['/customer/docs/other', '/customer/orgs/example', '/customer-other/docs/guide']) {
      expect(readPublicDocsBootstrap(document, path, '/customer')).toBeNull();
    }
    expect(publicDocsBootstrapMarkup({ ...page, path: '/blog', kind: 'blog' }, { index, content })).toBe('');
  });

  it('ignores missing, malformed and unsupported startup data', () => {
    expect(readPublicDocsBootstrap(document, '/docs/guide', '')).toBeNull();
    for (const value of ['{', 'null', '{"version":2}', '{"version":1,"path":"/docs/guide","index":null,"content":"x","isDirectoryPage":false}']) {
      document.body.innerHTML = '<script id="sw-public-docs" type="application/json"></script>';
      document.querySelector('script')!.textContent = value;
      expect(readPublicDocsBootstrap(document, '/docs/guide', '')).toBeNull();
    }
  });
});
