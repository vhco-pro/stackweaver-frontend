// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import type { QueryClient } from '@tanstack/react-query';
import type { DocsIndex } from '../components/docs/docsTypes';
import type { PublicPage } from './publicRoutes';

const ELEMENT_ID = 'sw-public-docs';
interface PublicDocsBootstrap {
  version: 1;
  path: string;
  index: DocsIndex;
  content: string;
  isDirectoryPage: boolean;
}

/** Carry the same public source data as the HTML, without executable inline code. */
export function publicDocsBootstrapMarkup(page: PublicPage, input: { index: DocsIndex; content: string }): string {
  if (page.kind !== 'docs' && page.kind !== 'docs-index') return '';
  const data: PublicDocsBootstrap = { version: 1, path: page.path, index: input.index, content: input.content, isDirectoryPage: page.folder !== undefined };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script id="${ELEMENT_ID}" type="application/json">${json}</script>`;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Only the current public page may warm its cache, including on a customer mount. */
export function readPublicDocsBootstrap(document: Document, pathname: string, basePath: string): PublicDocsBootstrap | null {
  const base = basePath.replace(/\/$/, '');
  if (base && !pathname.startsWith(`${base}/`)) return null;
  const path = pathname.slice(base.length);
  if (path !== '/docs' && !path.startsWith('/docs/')) return null;
  const element = document.getElementById(ELEMENT_ID);
  if (!element || element.getAttribute('type') !== 'application/json') return null;
  try {
    const data: unknown = JSON.parse(element.textContent ?? '');
    if (!record(data) || data.version !== 1 || data.path !== path || typeof data.content !== 'string' || typeof data.isDirectoryPage !== 'boolean') return null;
    if (!record(data.index) || !Array.isArray(data.index.tree) || !record(data.index.flat) || typeof data.index.generated !== 'string') return null;
    return data as unknown as PublicDocsBootstrap;
  } catch {
    return null;
  }
}

export function seedPublicDocsBootstrap(client: QueryClient, data: PublicDocsBootstrap): void {
  client.setQueryData(['docs-index', 'public', '/docs', '/docs-index.json'], data.index);
  const docPath = data.path.replace(/^\/docs\/?/, '') || 'README';
  client.setQueryData(['doc', 'public', '/docs-index.json', '/docs', docPath, data.path], { content: data.content, isDirectoryPage: data.isDirectoryPage });
  if (data.path === '/docs') client.setQueryData(['docs-overview-introduction', 'public', '/docs-index.json', '/docs'], data.content);
}
