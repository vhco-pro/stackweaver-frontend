// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Link } from 'react-router-dom';
import { Folder, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { DocsSearch } from '@/components/docs/DocsSearch';
import { resolveCollection, useDocsIndex, useCompletedFilter, homepageEntries, docUrl, docLabel, findDirectory, type CollectionProps } from '@/components/docs/docsCollection';
import { glassSurface } from '@/lib/surfaces';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function DocsIndex(props: CollectionProps & { folderPath?: string }) {
  const collection = resolveCollection(props);
  return <CollectionHome key={`${collection.id}:${collection.indexFile}`} collection={collection} folderPath={props.folderPath} />;
}
function CollectionHome({ collection, folderPath = '' }: Required<Pick<CollectionProps, 'collection'>> & { folderPath?: string }) {
  const query = useDocsIndex(collection);
  const [hideCompleted, setHideCompleted] = useCompletedFilter(collection);
  const entries = query.data ? homepageEntries(query.data, folderPath, hideCompleted) : null;
  const directory = folderPath && query.data ? findDirectory(query.data.tree, folderPath) : null;
  return (
    <DocsLayout collection={collection} homepage>
      <div className="mx-auto max-w-7xl py-2" data-docs-home={collection.id}>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{collection.title}</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">{directory ? docLabel(directory) : collection.title}</h1>
        <p className="text-base text-muted-foreground max-w-3xl leading-relaxed mb-7">{directory ? `Browse the ${docLabel(directory).toLowerCase()} documentation.` : collection.description}</p>
        <div className="max-w-3xl mb-9">
          <DocsSearch docsBase={collection.docsBase} searchIndexFile={collection.searchIndexFile} prominent />
        </div>
        {collection.statusFilter && <label className="flex items-center gap-2 text-sm text-muted-foreground mb-5 min-h-11"><input type="checkbox" checked={hideCompleted} onChange={e => { setHideCompleted(e.target.checked); }} />Hide completed</label>}
        {query.isPending && <div role="status" aria-label="Loading documentation"><span className="sr-only">Loading documentation</span><Skeleton className="h-40 w-full" /></div>}
        {query.isError && <div role="alert" className="flex items-center gap-3 rounded-xl border border-border p-5"><AlertCircle className="h-5 w-5" /><p>Unable to load documentation</p><Button variant="outline" onClick={() => { void query.refetch(); }}>Retry</Button></div>}
        {entries && <>
          <div className="flex items-center justify-between gap-4 mb-5"><h2 className="text-xl font-semibold">Browse documentation</h2><span className="text-xs text-muted-foreground">{entries.folders.length} folders</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
            {entries.folders.map(folder => <article key={folder.path} className={`${glassSurface} flex min-w-0 flex-col overflow-hidden`}>
              <div className="px-6 pt-6 flex items-center gap-3"><span className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400"><Folder className="h-5 w-5" /></span><h3 className="font-semibold text-lg"><Link to={docUrl(collection.docsBase, folder.path)} className="hover:underline">{folder.title}</Link></h3></div>
              <p className="text-sm text-muted-foreground leading-relaxed px-6 pt-4 pb-5">{folder.description}</p>
              <div className="px-6 pb-5 space-y-3">{folder.links.map(link => <Link key={link.path} to={docUrl(collection.docsBase, link.path)} className="block text-sm text-muted-foreground hover:text-foreground hover:underline">{docLabel(link)}</Link>)}</div>
              <div className="mt-auto border-t border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{folder.count} {folder.count === 1 ? 'page' : 'pages'}</span><Link aria-label={`Browse ${folder.title}`} to={docUrl(collection.docsBase, folder.path)} className="inline-flex min-h-11 items-center gap-2 text-foreground hover:underline">Browse folder<ArrowRight className="h-4 w-4" /></Link></div>
            </article>)}
          </div>
          <div className="mt-6 divide-y divide-border">{entries.files.map(file => <Link key={file.path} to={docUrl(collection.docsBase, file.path)} className="flex gap-3 py-5 items-center"><FileText className="h-5 w-5 shrink-0 text-muted-foreground" /><div><h3 className="font-medium">{docLabel(file)}</h3>{file.description && <p className="text-sm text-muted-foreground mt-1">{file.description}</p>}</div><ArrowRight className="h-4 w-4 ml-auto shrink-0" /></Link>)}</div>
          {!entries.folders.length && !entries.files.length && <p className="rounded-xl border border-dashed border-border p-8 text-muted-foreground">No documentation yet</p>}
        </>}
      </div>
    </DocsLayout>
  );
}
