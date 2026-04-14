// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, X, Clock, Hash } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useMountEffect } from '@/hooks/useMountEffect';
import MiniSearch, { type SearchResult } from 'minisearch';

const MAX_QUERY_LENGTH = 256;
const DEBOUNCE_MS = 150;
const MAX_RESULTS = 12;
const SNIPPET_WINDOW = 120;
const MAX_RECENT = 5;
const RECENT_STORAGE_KEY = 'docs-recent-visited';

interface DocsSearchProps {
  docsBase?: string;
  searchIndexFile?: string;
}

interface SectionHeading {
  text: string;
  anchor: string;
  level: number;
}

interface StoredFields {
  title: string;
  description: string;
  path: string;
  sectionHeadings: string; // JSON string of SectionHeading[]
}

interface RecentDoc {
  path: string;
  title: string;
  timestamp: number;
}

function getRecentDocs(storageKeySuffix: string): RecentDoc[] {
  try {
    const raw = localStorage.getItem(`${RECENT_STORAGE_KEY}-${storageKeySuffix}`);
    if (!raw) return [];
    return JSON.parse(raw) as RecentDoc[];
  } catch {
    return [];
  }
}

function addRecentDoc(storageKeySuffix: string, path: string, title: string): void {
  const recent = getRecentDocs(storageKeySuffix).filter(d => d.path !== path);
  recent.unshift({ path, title, timestamp: Date.now() });
  try {
    localStorage.setItem(
      `${RECENT_STORAGE_KEY}-${storageKeySuffix}`,
      JSON.stringify(recent.slice(0, MAX_RECENT)),
    );
  } catch { /* localStorage full or unavailable */ }
}

/**
 * Extract a context snippet around the first occurrence of any matched term.
 * Returns { before, match, after } for controlled rendering (no raw HTML).
 */
function extractSnippet(
  body: string | undefined,
  terms: string[],
): { before: string; match: string; after: string } | null {
  if (!body || terms.length === 0) return null;

  const lower = body.toLowerCase();
  let bestIdx = -1;
  let bestTerm = '';

  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestTerm = term;
    }
  }

  if (bestIdx === -1) return null;

  const start = Math.max(0, bestIdx - SNIPPET_WINDOW / 2);
  const end = Math.min(body.length, bestIdx + bestTerm.length + SNIPPET_WINDOW / 2);

  const before = (start > 0 ? '…' : '') + body.slice(start, bestIdx);
  const match = body.slice(bestIdx, bestIdx + bestTerm.length);
  const after = body.slice(bestIdx + bestTerm.length, end) + (end < body.length ? '…' : '');

  return { before, match, after };
}

/**
 * Find the best matching section heading for a set of search terms.
 * Returns the heading whose text contains a matched term (case-insensitive).
 */
function findMatchingSection(
  sectionHeadingsJson: string | undefined,
  terms: string[],
): SectionHeading | null {
  if (!sectionHeadingsJson || terms.length === 0) return null;
  try {
    const headings = JSON.parse(sectionHeadingsJson) as SectionHeading[];
    for (const term of terms) {
      const lower = term.toLowerCase();
      const match = headings.find(h => h.text.toLowerCase().includes(lower));
      if (match) return match;
    }
  } catch { /* malformed JSON */ }
  return null;
}

export function DocsSearch({ docsBase = '/docs', searchIndexFile = '/docs-search-index.json' }: DocsSearchProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchIndexRef = useRef<MiniSearch | null>(null);
  const loadingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const pendingQueryRef = useRef('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [indexLoaded, setIndexLoaded] = useState(false);

  // Load index on first open
  const loadIndex = useCallback(async () => {
    if (searchIndexRef.current || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch(searchIndexFile);
      if (!response.ok) throw new Error('Failed to load search index');
      const json = await response.text();
      searchIndexRef.current = MiniSearch.loadJSON(json, {
        fields: ['title', 'description', 'headings', 'body'],
        storeFields: ['title', 'description', 'path', 'sectionHeadings'],
        searchOptions: {
          boost: { title: 3, description: 2, headings: 1.5 },
          fuzzy: 0.2,
          prefix: true,
        },
      });
      setIndexLoaded(true);
      // Re-trigger search if user typed while index was loading
      if (pendingQueryRef.current && searchIndexRef.current) {
        const results = searchIndexRef.current.search(pendingQueryRef.current).slice(0, MAX_RESULTS);
        setSearchResults(results);
        setSelectedIndex(0);
      }
    } catch (e) {
      console.error('Failed to load search index:', e);
    } finally {
      loadingRef.current = false;
    }
  }, [searchIndexFile]);

  // Perform search with debounce
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = q.slice(0, MAX_QUERY_LENGTH).trim();
    pendingQueryRef.current = trimmed;
    if (!trimmed || !searchIndexRef.current) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }

    debounceRef.current = setTimeout(() => {
      if (!searchIndexRef.current) return;
      const results = searchIndexRef.current.search(trimmed).slice(0, MAX_RESULTS);
      setSearchResults(results);
      setSelectedIndex(0);
    }, DEBOUNCE_MS);
  }, []);

  // Global Cmd/Ctrl+K listener
  useMountEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  });

  // Handle open state change — load index, focus input
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void loadIndex();
      // Focus input on next frame
      queueMicrotask(() => { inputRef.current?.focus(); });
    } else {
      setQuery('');
      setSearchResults([]);
      setSelectedIndex(0);
    }
  }, [loadIndex]);

  const storageKeySuffix = docsBase === '/internal-docs' ? 'internal' : 'public';

  // Navigate to result, optionally with a section anchor
  const navigateToResult = useCallback((result: SearchResult | RecentDoc, anchor?: string) => {
    const stored = 'score' in result ? result as unknown as StoredFields : null;
    const docPathRaw = stored?.path ?? (result as RecentDoc).path;
    const title = stored?.title ?? (result as RecentDoc).title;

    let docPath = docPathRaw;
    // Strip .md extension and /README.md suffix for clean URLs
    if (docPath.endsWith('/README.md')) {
      docPath = docPath.replace(/\/README\.md$/, '');
    } else if (docPath === 'README.md') {
      docPath = '';
    } else {
      docPath = docPath.replace(/\.md$/, '');
    }

    addRecentDoc(storageKeySuffix, docPathRaw, title);
    setOpen(false);
    const hash = anchor ? `#${anchor}` : '';
    void navigate(`${docsBase}/${docPath}${hash}`);
  }, [docsBase, navigate, storageKeySuffix]);

  // Extract match terms for snippets
  const matchTerms = useMemo(() => {
    const terms = new Set<string>();
    for (const r of searchResults) {
      if (r.match) {
        for (const term of Object.keys(r.match)) {
          terms.add(term);
        }
      }
    }
    return [...terms];
  }, [searchResults]);

  // Keyboard nav inside dialog
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => {
        const next = Math.min(prev + 1, searchResults.length - 1);
        // Scroll the selected item into view
        queueMicrotask(() => {
          resultsContainerRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => {
        const next = Math.max(prev - 1, 0);
        queueMicrotask(() => {
          resultsContainerRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        });
        return next;
      });
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      const result = searchResults[selectedIndex];
      const stored = result as unknown as StoredFields;
      const section = findMatchingSection(stored.sectionHeadings, matchTerms);
      navigateToResult(result, section?.anchor);
    }
  }, [searchResults, selectedIndex, navigateToResult, matchTerms]);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

  return (
    <>
      {/* Search trigger button */}
      <button
        type="button"
        onClick={() => { handleOpenChange(true); }}
        className="flex items-center w-full gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:border-border transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search docs…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-sm border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          {shortcutLabel}
        </kbd>
      </button>

      {/* Search dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-lg p-0 gap-0 overflow-hidden"
          onKeyDown={handleKeyDown}
          hideCloseButton
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>Search documentation</DialogTitle>
            <DialogDescription>Search across all documentation pages</DialogDescription>
          </VisuallyHidden>
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search docs…"
              value={query}
              maxLength={MAX_QUERY_LENGTH}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                doSearch(val);
              }}
              className="flex-1 bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setSearchResults([]); setSelectedIndex(0); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div
            ref={resultsContainerRef}
            className="max-h-[400px] overflow-y-auto"
          >
            {/* Empty query: show recently visited */}
            {!query.trim() && (() => {
              const recent = getRecentDocs(storageKeySuffix);
              if (recent.length === 0) {
                return (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Type to search across all documentation
                  </div>
                );
              }
              return (
                <>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Recently visited
                  </div>
                  {recent.map((doc) => (
                    <button
                      key={doc.path}
                      type="button"
                      onClick={() => { navigateToResult(doc); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      <span className="text-sm truncate">{doc.title}</span>
                    </button>
                  ))}
                </>
              );
            })()}

            {query.trim() && !indexLoaded && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading search index…
              </div>
            )}

            {query.trim() && indexLoaded && searchResults.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query.trim()}&rdquo;
              </div>
            )}

            {searchResults.map((result, idx) => {
              const stored = result as unknown as StoredFields;
              const snippet = extractSnippet(
                (result as unknown as { body?: string }).body,
                matchTerms,
              );
              const matchedSection = findMatchingSection(stored.sectionHeadings, matchTerms);

              return (
                <button
                  key={String(result.id)}
                  type="button"
                  onClick={() => { navigateToResult(result, matchedSection?.anchor); }}
                  className={`flex items-start gap-3 w-full px-4 py-3 text-left transition-colors ${
                    idx === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {stored.title}
                    </div>
                    {matchedSection && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Hash className="h-3 w-3 shrink-0" />
                        <span className="truncate">{matchedSection.text}</span>
                      </div>
                    )}
                    {!matchedSection && stored.description && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {stored.description}
                      </div>
                    )}
                    {snippet && (
                      <div className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                        {snippet.before}
                        <mark className="bg-yellow-200/60 dark:bg-yellow-500/30 text-foreground rounded-xs px-0.5">
                          {snippet.match}
                        </mark>
                        {snippet.after}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground/50 mt-1 font-mono truncate">
                      {stored.path}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          {searchResults.length > 0 && (
            <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span><kbd className="rounded-sm border border-border/60 bg-muted/50 px-1 py-0.5 font-mono">↑↓</kbd> Navigate</span>
              <span><kbd className="rounded-sm border border-border/60 bg-muted/50 px-1 py-0.5 font-mono">↵</kbd> Open</span>
              <span><kbd className="rounded-sm border border-border/60 bg-muted/50 px-1 py-0.5 font-mono">Esc</kbd> Close</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
