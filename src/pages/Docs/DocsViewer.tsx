// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';


export default function DocsViewer() {
  const params = useParams<{ '*': string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert URL path to file path
  const docPath = params['*'] || 'README';
  
  useEffect(() => {
    async function loadDoc() {
      setLoading(true);
      setError(null);

      try {
        // Determine file path: try folder/README.md first, then fall back to path.md
        let filePath: string;
        if (docPath === '' || docPath === 'README') {
          filePath = 'README.md';
        } else {
          // First try as a folder with README.md
          filePath = `${docPath}/README.md`;
        }
        
        let response = await fetch(`/docs/${filePath}`);
        let text = await response.text();
        
        // Check if we got HTML (Vite might serve index.html for 404s)
        // If docPath is not empty/README and response looks like HTML, try as regular file
        if (docPath !== '' && docPath !== 'README' && 
            (text.trim().startsWith('<!') || text.trim().startsWith('<html') || !response.ok)) {
          // Try as a regular file path instead
          filePath = `${docPath}.md`;
          response = await fetch(`/docs/${filePath}`);
          text = await response.text();
        }
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Document not found');
          }
          throw new Error(`Failed to load document: ${response.statusText}`);
        }
        console.log('DocsViewer: Fetched content, length:', text.length, 'first 100 chars:', text.substring(0, 100));
        setContent(text);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load document';
        setError(message);
        console.error('Error loading doc:', err);
      } finally {
        setLoading(false);
      }
    }

    void loadDoc();
  }, [docPath]);

  if (loading) {
    return (
      <DocsLayout>
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
      <DocsLayout>
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

  console.log('DocsViewer: Rendering, content length:', content.length, 'loading:', loading, 'error:', error);

  // If content is empty, show a message
  if (!content) {
    return (
      <DocsLayout>
        <div className="text-muted-foreground">No content loaded yet...</div>
      </DocsLayout>
    );
  }

  return (
    <DocsLayout>
      <MarkdownRenderer
        content={content}
        docPath={docPath}
        enableCallouts={true}
        enableCodeGroups={true}
        enableMermaid={true}
      />
    </DocsLayout>
  );
}
