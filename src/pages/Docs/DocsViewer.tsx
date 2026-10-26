// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import DocsIndex from './DocsIndex';
import { resolveCollection, useDocsIndex, findDirectory, type CollectionProps } from '@/components/docs/docsCollection';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { DocAnchorScroll } from '@/components/docs/DocAnchorScroll';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';

// This import and its component are eliminated from production bundles.
const DevDocsPrototype = import.meta.env.DEV ? lazy(() => import('@/components/docs/DevDocsPrototype')) : null;

/** Check whether a fetch response is Vite's SPA fallback (index.html) rather than an actual doc file. */
function isHtmlFallback(response: Response): boolean {
  const ct = response.headers.get('content-type') ?? '';
  return ct.includes('text/html');
}


export default function DocsViewer(props: CollectionProps) {
  const collection = resolveCollection(props);
  const { docsBase } = collection;
  const { data: index, isError: indexError } = useDocsIndex(collection);
  const params = useParams<{ '*': string }>();
  const location = useLocation();

  // Convert URL path to file path
  const docPath = params['*'] || 'README';
  const isDevPrototype = import.meta.env.DEV && collection.id === 'internal' &&
    /\.html$/i.test(docPath);
  const directoryPath = docPath.replace(/\/$/, '');
  const indexOnlyDirectory = !!index && !!findDirectory(index.tree, directoryPath) &&
    !index.flat[`${directoryPath}/README.md`] && !index.flat[`${directoryPath}/readme.md`];

  // Renaming a published doc changes a live URL, so docs/redirects.json maps the old path to the
  // new one (see scripts/build-docs-index.js, which emits it here). Resolved before the fetch so a
  // stale bookmark or external link lands on the renamed page instead of "Document not found".
  const { data: redirects } = useQuery<Record<string, string>>({
    queryKey: ['docs-redirects', docsBase],
    queryFn: async () => {
      const res = await fetch(`${docsBase === '/docs' ? '' : docsBase}/docs-redirects.json`);
      if (!res.ok || isHtmlFallback(res)) return {};
      return (await res.json()) as Record<string, string>;
    },
    staleTime: Infinity,
  });
  const redirectTarget = redirects?.[docPath.replace(/\/$/, '')];

  const { data: docData, isPending: loading, error: queryError } = useQuery({
    queryKey: ['doc', collection.id, collection.indexFile, docsBase, docPath, location.pathname],
    enabled: (!!index || indexError) && !indexOnlyDirectory && !isDevPrototype,
    queryFn: async () => {
      // Determine file path: try folder/README.md first, then fall back to path.md
      let filePath: string;
      let resolvedAsDirectory = true;
      if (docPath === '' || docPath === 'README') {
        filePath = 'README.md';
      } else {
        // First try as a folder with README.md
        filePath = `${docPath}/README.md`;
      }

      let response = await fetch(`${docsBase}/${filePath}`);

      // If README.md wasn't found, try lowercase readme.md (some directories use it)
      if (docPath !== '' && docPath !== 'README' &&
          (!response.ok || isHtmlFallback(response)) &&
          filePath.endsWith('/README.md')) {
        filePath = `${docPath}/readme.md`;
        response = await fetch(`${docsBase}/${filePath}`);
      }

      // If the folder README still wasn't found, try as a regular .md file instead.
      if (docPath !== '' && docPath !== 'README' &&
          (!response.ok || isHtmlFallback(response))) {
        filePath = `${docPath}.md`;
        resolvedAsDirectory = false;
        response = await fetch(`${docsBase}/${filePath}`);
      }

      // Validate the final response
      if (!response.ok || isHtmlFallback(response)) {
        throw new Error('Document not found');
      }

      const text = await response.text();
      return { content: text, isDirectoryPage: resolvedAsDirectory };
    },
  });

  const content = docData?.content ?? '';
  const isDirectoryPage = docData?.isDirectoryPage ?? false;
  const error = queryError instanceof Error ? queryError.message : queryError ? 'Failed to load document' : null;

  // `replace` so the retired URL does not linger in history and the back button still works.
  if (redirectTarget) {
    return <Navigate to={`${docsBase}/${redirectTarget}`} replace />;
  }

  if (indexOnlyDirectory) {
    return <DocsIndex collection={collection} folderPath={directoryPath} />;
  }

  if (isDevPrototype && DevDocsPrototype) {
    return <DocsLayout collection={collection}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><DevDocsPrototype docPath={docPath} docsBase={docsBase} /></Suspense>
    </DocsLayout>;
  }

  if (loading) {
    return (
      <DocsLayout collection={collection}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-64 w-full mt-8" />
        </div>
      </DocsLayout>
    );
  }

  if (error) {
    return (
      <DocsLayout collection={collection}>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-semibold text-sm">Error loading document</h2>
            <p className="text-xs mt-1 opacity-90">{error}</p>
          </div>
        </div>
      </DocsLayout>
    );
  }

  return (
    <DocsLayout collection={collection}>
      <MarkdownRenderer
        content={content}
        docPath={docPath}
        docsBase={docsBase}
        isDirectoryPage={isDirectoryPage}
        enableCallouts={true}
        enableCodeGroups={true}
        enableMermaid={true}
      />
      {/* After the content, so the heading a URL anchor names exists when it looks for it. */}
      <DocAnchorScroll />
    </DocsLayout>
  );
}
