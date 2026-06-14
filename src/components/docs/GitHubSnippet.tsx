// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Copy, Check } from 'lucide-react';
import { getVcsProviderIcon } from '@/lib/vcs';

interface SnippetData {
  org: string;
  repo: string;
  ref: string;
  path: string;
  startLine: number | null;
  endLine: number | null;
  lang: string;
  content: string;
  url: string;
}

// Must match the build script's snippetHash function
function snippetHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export interface GitHubSnippetProps {
  url: string;
}

export function GitHubSnippet({ url }: GitHubSnippetProps) {
  const [copied, setCopied] = useState(false);

  // Track theme
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  useMountEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      const next: 'dark' | 'light' = el.classList.contains('dark') ? 'dark' : 'light';
      setThemeMode((prev) => (prev === next ? prev : next));
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  });

  // Fetch snippet data (immutable per URL → cache forever, no retry).
  const { data: snippet = null, isError: error } = useQuery({
    queryKey: ['docs-github-snippet', url],
    queryFn: async (): Promise<SnippetData> => {
      const hash = snippetHash(url);
      const res = await fetch(`/docs/_snippets/${hash}.snippet.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as SnippetData;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  // Syntax highlight (theme-dependent transform). Keyed by url + theme so a theme
  // toggle re-highlights; null while a new highlight resolves (skeleton shows).
  const { data: highlightedHtml = null } = useQuery({
    queryKey: ['docs-github-snippet-highlight', url, themeMode],
    queryFn: async (): Promise<string> => {
      const content = snippet!.content;
      try {
        const { codeToHtml } = await import('shiki');
        return await codeToHtml(content, {
          lang: snippet!.lang || 'text',
          theme: themeMode === 'dark' ? 'github-dark' : 'github-light',
        });
      } catch {
        // Fallback: render as plain text
        return `<pre><code>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
      }
    },
    enabled: !!snippet,
    staleTime: Infinity,
  });

  const handleCopy = async () => {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className="not-prose my-4 rounded-md border border-border/40 p-4 text-sm text-muted-foreground">
        Code snippet not available: Snippet not found.
      </div>
    );
  }

  if (!snippet) {
    return (
      <div className="not-prose my-4 rounded-md border border-border/40 overflow-hidden">
        <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
          <div className="h-4 w-64 rounded-sm bg-muted/60 animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded-sm bg-muted/60 animate-pulse" style={{ width: `${50 + (i % 3) * 15}%` }} />
          ))}
        </div>
      </div>
    );
  }

  const isCommit = /^[0-9a-f]{40}$/i.test(snippet.ref);
  const shortRef = isCommit ? snippet.ref.slice(0, 7) : snippet.ref;
  const commitUrl = `https://github.com/${snippet.org}/${snippet.repo}/commit/${snippet.ref}`;
  const lineInfo = snippet.startLine != null
    ? snippet.endLine != null && snippet.endLine !== snippet.startLine
      ? `L${snippet.startLine}-${snippet.endLine}`
      : `L${snippet.startLine}`
    : null;

  return (
    <div className="not-prose my-4 rounded-md border border-border/40 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <a
            href={`https://github.com/${snippet.org}/${snippet.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title={`${snippet.org}/${snippet.repo} on GitHub`}
          >
            {getVcsProviderIcon('github', 'h-4 w-4')}
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-foreground/80 hover:text-foreground truncate transition-colors"
          >
            <span className="text-muted-foreground">{snippet.org}/</span>{snippet.repo}<span className="text-muted-foreground">/{snippet.path}</span>
          </a>
          {lineInfo && (
            <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] font-mono bg-muted/60 text-muted-foreground border border-border/40">
              {lineInfo}
            </span>
          )}
          {isCommit ? (
            <a
              href={commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              title={`Commit ${snippet.ref}`}
            >
              {shortRef}
            </a>
          ) : (
            <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {shortRef}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => { void handleCopy(); }}
          className="ml-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={copied ? 'Copied!' : 'Copy'}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {/* Code */}
      <div className="github-snippet-code overflow-x-auto">
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 rounded-sm bg-muted/60 animate-pulse" style={{ width: `${60 + (i % 3) * 10}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
