// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { AlertCircle } from 'lucide-react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { DocsSearch } from '@/components/docs/DocsSearch';
import { DocsOverview } from '@/components/docs/DocsOverview';
import { resolveCollection, useDocsIndex, useCompletedFilter, docLabel, type CollectionProps } from '@/components/docs/docsCollection';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function DocsIndex(props: CollectionProps & { folderPath?: string; children?: ReactNode }) {
  const collection = resolveCollection(props);
  return <CollectionHome key={`${collection.id}:${collection.indexFile}`} collection={collection} folderPath={props.folderPath}>{props.children}</CollectionHome>;
}
function CollectionHome({ collection, folderPath = '', children }: Required<Pick<CollectionProps, 'collection'>> & { folderPath?: string; children?: ReactNode }) {
  const query = useDocsIndex(collection);
  const [hideCompleted, setHideCompleted] = useCompletedFilter(collection);
  const overview = query.data?.flat[`${folderPath ? `${folderPath}/` : ''}README.md`] ?? query.data?.flat[`${folderPath}/readme.md`];
  const root = !folderPath;
  const rootIntro = useQuery({
    queryKey: ['docs-overview-introduction', collection.id, collection.indexFile, collection.docsBase],
    enabled: root && !children && overview?.layout === 'overview',
    queryFn: async ({ signal }) => {
      const response = await fetch(`${collection.docsBase}/README.md`, { signal });
      if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('Unable to load introduction');
      return response.text();
    },
  });
  const context = children ?? (rootIntro.data ? <MarkdownRenderer content={rootIntro.data} hideTitle docPath="README" docsBase={collection.docsBase} isDirectoryPage /> : null);
  const title = root ? collection.title : overview?.title && overview.title !== 'README' ? overview.title : docLabel({ type: 'directory', name: folderPath.split('/').at(-1) ?? '', path: folderPath });
  return <DocsLayout collection={collection} homepage={root}>
    <div className="docs-overview mx-auto max-w-7xl py-2" data-docs-home={collection.id}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{collection.title}</p>
      <h1 className={`overview-title ${root ? 'overview-root-title' : ''}`}>{title}</h1>
      <p className="text-base text-muted-foreground max-w-3xl leading-relaxed mb-7">{root ? collection.description : overview?.description || `Browse the ${title.toLowerCase()} documentation.`}</p>
      {root && <div className="max-w-3xl mb-9"><DocsSearch docsBase={collection.docsBase} searchIndexFile={collection.searchIndexFile} prominent /></div>}
      {root && collection.statusFilter && <label className="flex items-center gap-2 text-sm text-muted-foreground mb-5 min-h-11"><input type="checkbox" checked={hideCompleted} onChange={e => { setHideCompleted(e.target.checked); }} />Hide completed</label>}
      {query.isPending && <div role="status" aria-label="Loading documentation"><span className="sr-only">Loading documentation</span><Skeleton className="h-40 w-full" /></div>}
      {query.isError && <div role="alert" className="flex items-center gap-3 rounded-xl border border-border p-5"><AlertCircle className="h-5 w-5" /><p>Unable to load documentation</p><Button variant="outline" onClick={() => { void query.refetch(); }}>Retry</Button></div>}
      {query.data && <DocsOverview index={query.data} folderPath={folderPath} docsBase={collection.docsBase} hideCompleted={hideCompleted} />}
      {rootIntro.isError && <div role="alert" className="mt-6 flex items-center gap-3"><p>Unable to load introduction</p><Button variant="outline" onClick={() => { void rootIntro.refetch(); }}>Retry introduction</Button></div>}
      {context && <div className="overview-context">{context}</div>}
    </div>
  </DocsLayout>;
}
