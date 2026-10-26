// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface DocTreeNode {
  type: 'directory' | 'file';
  name: string;
  path: string;
  title?: string;
  description?: string;
  status?: string;
  nav_order?: number;
  children?: DocTreeNode[];
}
export interface DocsIndex {
  tree: DocTreeNode[];
  flat: Record<string, DocTreeNode>;
  generated: string;
}
export interface DocsCollection {
  id: string;
  docsBase: string;
  indexFile: string;
  searchIndexFile: string;
  title: string;
  description: string;
  statusFilter?: boolean;
  statusStorageKey?: string;
}
export const publicDocs: DocsCollection = {
  id: 'public', docsBase: '/docs', indexFile: '/docs-index.json', searchIndexFile: '/docs-search-index.json',
  title: 'Documentation', description: 'Explore the guides, concepts, and references for your infrastructure automation.',
};
export const internalDocs: DocsCollection = {
  id: 'internal', docsBase: '/internal-docs', indexFile: '/internal-docs-index.json', searchIndexFile: '/internal-docs-search-index.json',
  title: 'Internal documentation', description: 'Browse engineering plans, investigations, guidelines, and operational knowledge.',
  statusFilter: true, statusStorageKey: 'internal-docs-hide-completed',
};
export interface CollectionProps { collection?: DocsCollection; docsBase?: string; indexFile?: string }
/** Legacy route props are resolved at the host boundary, not inside presentation components. */
export function resolveCollection({ collection, docsBase = '/docs', indexFile }: CollectionProps): DocsCollection {
  if (collection) return collection;
  const defaults = docsBase === internalDocs.docsBase ? internalDocs : publicDocs;
  return { ...defaults, docsBase, indexFile: indexFile ?? defaults.indexFile };
}
export function useDocsIndex(collection: DocsCollection) {
  return useQuery<DocsIndex>({
    queryKey: ['docs-index', collection.id, collection.docsBase, collection.indexFile],
    queryFn: async ({ signal }) => {
      const response = await fetch(collection.indexFile, { signal });
      if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('Unable to load documentation');
      const data = await response.json() as DocsIndex;
      if (!Array.isArray(data.tree) || !data.flat) throw new Error('Invalid documentation index');
      return data;
    },
    staleTime: 60_000,
  });
}
export const docLabel = (node: DocTreeNode): string => {
  const fallback = node.name.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
  if (node.title && node.title !== 'README' && node.title !== fallback) return node.title;
  return fallback.replace(/\b\w/g, c => c.toUpperCase()).replace(/\bApi\b/g, 'API');
};
export function docUrl(base: string, path: string): string {
  return `${base}/${path.replace(/\/README\.md$/i, '').replace(/\.md$/i, '')}`;
}
export function findDirectory(nodes: DocTreeNode[], path: string): DocTreeNode | undefined {
  for (const node of nodes) {
    if (node.type !== 'directory') continue;
    if (node.path === path) return node;
    const found = findDirectory(node.children ?? [], path);
    if (found) return found;
  }
}
export function filterCompleted(nodes: DocTreeNode[]): DocTreeNode[] {
  return nodes.flatMap(node => {
    if (node.type === 'file') return node.status === 'complete' ? [] : [node];
    const children = filterCompleted(node.children ?? []);
    return children.length ? [{ ...node, children }] : [];
  });
}
const countFiles = (node: DocTreeNode): number => node.type === 'file' ? 1 : (node.children ?? []).reduce((sum, child) => sum + countFiles(child), 0);
export function homepageEntries(index: DocsIndex, folder = '', hideCompleted = false) {
  const all = folder ? findDirectory(index.tree, folder)?.children ?? [] : index.tree;
  const nodes = hideCompleted ? filterCompleted(all) : all;
  const folders = nodes.filter(n => n.type === 'directory').map(node => {
    const overview = index.flat[`${node.path}/README.md`] ?? index.flat[`${node.path}/readme.md`];
    return {
      ...node, title: overview?.title && overview.title !== 'README' ? overview.title : docLabel(node),
      description: overview?.description || `Explore the ${docLabel(node).toLowerCase()} documentation.`,
      count: countFiles(node), links: (node.children ?? []).filter(n => n.type === 'file' && !/^readme\.md$/i.test(n.name)).slice(0, 2),
    };
  });
  return { folders, files: nodes.filter(n => n.type === 'file' && !/^readme\.md$/i.test(n.name)) };
}

const FILTER_EVENT = 'docs-filter-change';
function subscribeFilter(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(FILTER_EVENT, listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(FILTER_EVENT, listener); };
}
/** The sidebar and homepage share a collection's persisted filter, including same-tab updates. */
export function useCompletedFilter(collection: DocsCollection): [boolean, (value: boolean) => void] {
  const key = collection.statusStorageKey ?? `${collection.id}-hide-completed`;
  const value = useSyncExternalStore(subscribeFilter, () => {
    try { return !!collection.statusFilter && localStorage.getItem(key) === 'true'; } catch { return false; }
  }, () => false);
  return [value, next => {
    try { localStorage.setItem(key, String(next)); } catch { return; }
    window.dispatchEvent(new Event(FILTER_EVENT));
  }];
}
