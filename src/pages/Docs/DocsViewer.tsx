// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'react-router-dom';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';

/** Check whether a fetch response is Vite's SPA fallback (index.html) rather than an actual doc file. */
function isHtmlFallback(response: Response): boolean {
  const ct = response.headers.get('content-type') ?? '';
  return ct.includes('text/html');
}


interface DocsViewerProps {
  docsBase?: string;
  indexFile?: string;
}

export default function DocsViewer({ docsBase = '/docs', indexFile = '/docs-index.json' }: DocsViewerProps) {
  const params = useParams<{ '*': string }>();
  const location = useLocation();

  // Convert URL path to file path
  const docPath = params['*'] || 'README';

  const { data: docData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['doc', docsBase, docPath, location.pathname],
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

  if (loading) {
    return (
      <DocsLayout docsBase={docsBase} indexFile={indexFile}>
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
      <DocsLayout docsBase={docsBase} indexFile={indexFile}>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-sm">Error loading document</h2>
            <p className="text-xs mt-1 opacity-90">{error}</p>
          </div>
        </div>
      </DocsLayout>
    );
  }

  return (
    <DocsLayout docsBase={docsBase} indexFile={indexFile}>
      <MarkdownRenderer
        content={content}
        docPath={docPath}
        docsBase={docsBase}
        isDirectoryPage={isDirectoryPage}
        enableCallouts={true}
        enableCodeGroups={true}
        enableMermaid={true}
      />
    </DocsLayout>
  );
}
