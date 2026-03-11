// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';

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

// Module-level cache (survives remounts)
const snippetCache = new Map<string, SnippetData>();

export interface GitHubSnippetProps {
  url: string;
}

export function GitHubSnippet({ url }: GitHubSnippetProps) {
  const [snippet, setSnippet] = useState<SnippetData | null>(() => snippetCache.get(url) ?? null);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Track theme
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      const next: 'dark' | 'light' = el.classList.contains('dark') ? 'dark' : 'light';
      setThemeMode((prev) => (prev === next ? prev : next));
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Fetch snippet data
  useEffect(() => {
    if (snippetCache.has(url)) {
      setSnippet(snippetCache.get(url)!);
      return;
    }
    let cancelled = false;
    const hash = snippetHash(url);
    fetch(`/docs/_snippets/${hash}.snippet.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SnippetData>;
      })
      .then(data => {
        if (cancelled) return;
        snippetCache.set(url, data);
        setSnippet(data);
      })
      .catch(() => {
        if (!cancelled) setError('Snippet not found.');
      });
    return () => { cancelled = true; };
  }, [url]);

  // Syntax highlight
  useEffect(() => {
    if (!snippet) return;
    let cancelled = false;
    setHighlightedHtml(null);

    void (async () => {
      try {
        const { codeToHtml } = await import('shiki');
        const html = await codeToHtml(snippet.content, {
          lang: snippet.lang || 'text',
          theme: themeMode === 'dark' ? 'github-dark' : 'github-light',
        });
        if (!cancelled) setHighlightedHtml(html);
      } catch {
        // Fallback: render as plain text
        if (!cancelled) {
          setHighlightedHtml(`<pre><code>${snippet.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [snippet, themeMode]);

  const handleCopy = async () => {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className="not-prose my-4 rounded-md border border-border/40 p-4 text-sm text-muted-foreground">
        Code snippet not available: {error}
      </div>
    );
  }

  if (!snippet) {
    return (
      <div className="not-prose my-4 rounded-md border border-border/40 overflow-hidden">
        <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
          <div className="h-4 w-64 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted/60 animate-pulse" style={{ width: `${50 + (i % 3) * 15}%` }} />
          ))}
        </div>
      </div>
    );
  }

  const shortRef = /^[0-9a-f]{40}$/i.test(snippet.ref) ? snippet.ref.slice(0, 7) : snippet.ref;
  const lineInfo = snippet.startLine != null
    ? snippet.endLine != null && snippet.endLine !== snippet.startLine
      ? `Lines ${snippet.startLine} to ${snippet.endLine}`
      : `Line ${snippet.startLine}`
    : null;

  return (
    <div className="not-prose my-4 rounded-md border border-border/40 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
        <div className="flex flex-col gap-0.5 min-w-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-primary hover:underline truncate"
          >
            {snippet.org}/{snippet.repo}/{snippet.path}
          </a>
          {lineInfo && (
            <span className="text-xs text-muted-foreground">
              {lineInfo} in <code className="text-xs font-mono bg-muted/50 px-1 rounded">{shortRef}</code>
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
              <div key={i} className="h-4 rounded bg-muted/60 animate-pulse" style={{ width: `${60 + (i % 3) * 10}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
