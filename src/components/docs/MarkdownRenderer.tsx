// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect, useRef, useMemo, type ReactNode, type KeyboardEvent } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import { Copy, Check, ChevronRight } from 'lucide-react';
import { JsonSyntaxHighlighter } from '@/components/code/JsonSyntaxHighlighter';
import { CalloutBox, type CalloutType } from '@/components/docs/CalloutBox';
import { CodeGroup } from '@/components/docs/CodeGroup';
import { MermaidDiagram } from '@/components/docs/MermaidDiagram';
import { FileTreeViewer } from '@/components/docs/FileTreeViewer';
import { CodeExplorer } from '@/components/docs/CodeExplorer';
import { GitHubSnippet } from '@/components/docs/GitHubSnippet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTheme } from '@/contexts/ThemeContext';

// Types for ReactMarkdown components
interface MarkdownHeadingProps {
  children?: ReactNode;
  id?: string;
  [key: string]: unknown;
}

interface MarkdownPreProps {
  children?: ReactNode;
  [key: string]: unknown;
}

interface MarkdownCodeProps {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}

interface MarkdownLinkProps {
  href?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

interface MarkdownBlockProps {
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

interface ReactElementLike {
  type?: string | ((props: unknown) => ReactNode) | { name?: string };
  props?: {
    children?: ReactNode;
    className?: string | string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CodeGroupItem {
  lang?: string;
  label?: string;
  value: string;
}

interface ParsedCallout {
  type: CalloutType | null;
  title?: string;
  content: ReactNode;
}

type UnknownRecord = Record<string, unknown>;

interface MarkdownImageProps {
  src?: string;
  alt?: string;
  title?: string;
  [key: string]: unknown;
}

interface DocImageProps {
  src?: string;
  alt?: string;
  title?: string;
  currentDir: string;
  docsBase: string;
  onLightbox: (src: string, alt: string) => void;
}

/**
 * Derive the expected dark-variant src from a resolved image src.
 * e.g. /docs/features/screenshot.png -> /docs/features/screenshot-dark.png
 */
function darkVariant(src: string): string {
  const dot = src.lastIndexOf('.');
  if (dot === -1) return src + '-dark';
  return src.slice(0, dot) + '-dark' + src.slice(dot);
}

/**
 * Standalone DocImage component for rendering doc images.
 * Must live outside the useMemo in MarkdownRenderer so hook state is preserved
 * across memo recomputations.
 */
function DocImage({ src, alt, title, currentDir, docsBase, onLightbox }: DocImageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [darkFailed, setDarkFailed] = useState(false);
  const [lastSrc, setLastSrc] = useState(src);

  // Resolve relative src to an absolute /docs/... path
  const resolvedSrc = (() => {
    if (!src) return '';
    // Pass through absolute URLs and data URIs
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('/') ||
      src.startsWith('data:')
    ) {
      return src;
    }
    // Relative path — strip leading ./
    let rel = src.startsWith('./') ? src.slice(2) : src;
    // Handle ../
    if (rel.startsWith('../')) {
      const upLevels = (rel.match(/\.\.\//g) || []).length;
      const dirParts = currentDir ? currentDir.split('/') : [];
      const targetDir = dirParts.slice(0, Math.max(0, dirParts.length - upLevels)).join('/');
      rel = rel.replace(/^(\.\.\/)+/, '');
      return `${docsBase}/${targetDir ? targetDir + '/' : ''}${rel}`;
    }
    return `${docsBase}/${currentDir ? currentDir + '/' : ''}${rel}`;
  })();

  // Reset darkFailed when the image src changes (derived state during render, no effect needed)
  if (lastSrc !== src) {
    setLastSrc(src);
    setDarkFailed(false);
  }

  const activeSrc = isDark && !darkFailed ? darkVariant(resolvedSrc) : resolvedSrc;

  const handleClick = () => {
    if (resolvedSrc) onLightbox(resolvedSrc, alt ?? '');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLImageElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const imgEl = (
    <img
      src={activeSrc}
      alt={alt ?? ''}
      title={title}
      loading="lazy"
      onError={isDark && !darkFailed ? () => { setDarkFailed(true); } : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="block max-w-full h-auto rounded-md border border-border/40 my-4 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );

  if (title) {
    return (
      <figure className="my-4">
        {/* Re-render img without the outer my-4 margin since figure handles it */}
        <img
          src={activeSrc}
          alt={alt ?? ''}
          loading="lazy"
          onError={isDark && !darkFailed ? () => { setDarkFailed(true); } : undefined}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="block max-w-full h-auto rounded-md border border-border/40 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {title}
        </figcaption>
      </figure>
    );
  }

  return imgEl;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function getNodeType(node: unknown): string | null {
  if (!isRecord(node)) return null;
  return typeof node.type === 'string' ? node.type : null;
}

function getChildren(node: unknown): unknown[] | null {
  if (!isRecord(node)) return null;
  return Array.isArray(node.children) ? (node.children as unknown[]) : null;
}

function paragraphText(node: unknown): string | null {
  if (getNodeType(node) !== 'paragraph') return null;
  const children = getChildren(node);
  if (!children) return null;
  const parts: string[] = [];
  for (const c of children) {
    if (!isRecord(c)) continue;
    const type = getNodeType(c);
    if (type === 'text') {
      if (typeof c.value === 'string') parts.push(c.value);
    } else if (type === 'link') {
      // remark auto-links bare URLs — extract href so directives containing URLs still match
      if (typeof c.url === 'string') parts.push(c.url);
    }
  }
  return parts.join('');
}

function isCodeGroupContainerStart(node: unknown): boolean {
  const text = paragraphText(node);
  return typeof text === 'string' && /^:::\s*code-group\s*$/i.test(text.trim());
}

function isCodeExplorerStart(node: unknown): { path: string; defaultFile: string; selfClosed: boolean } | null {
  const text = paragraphText(node);
  if (typeof text !== 'string') return null;
  // When there is no blank line between ::: code-explorer and :::, remark puts both
  // lines in the same paragraph as "::: code-explorer ./path\n:::". Check only the
  // first line so the pattern still matches.
  const lines = text.split('\n');
  const firstLine = (lines[0] ?? '').trim();
  const match = /^:::\s*code-explorer\s+(\S+)(?:\s+default="([^"]+)")?\s*$/i.exec(firstLine);
  if (!match) return null;
  // selfClosed: closing ::: is in the same paragraph (no blank line between directives)
  const selfClosed = lines.length > 1 && lines.slice(1).some((l) => /^:::\s*$/.test(l.trim()));
  return { path: match[1], defaultFile: match[2] ?? '', selfClosed };
}

const GITHUB_SNIPPET_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:#L(\d+)(?:-L(\d+))?)?$/;

function isCodeSnippetStart(node: unknown): { url: string; selfClosed: boolean } | null {
  const text = paragraphText(node);
  if (typeof text !== 'string') return null;
  const lines = text.split('\n');
  const firstLine = (lines[0] ?? '').trim();
  const directiveMatch = /^:::\s*code-snippet\s+(\S+)\s*$/i.exec(firstLine);
  if (!directiveMatch) return null;
  const url = directiveMatch[1];
  if (!GITHUB_SNIPPET_RE.test(url)) return null;
  const selfClosed = lines.length > 1 && lines.slice(1).some((l) => /^:::\s*$/.test(l.trim()));
  return { url, selfClosed };
}

function isCodeGroupContainerEnd(node: unknown): boolean {
  const text = paragraphText(node);
  return typeof text === 'string' && /^:::\s*$/.test(text.trim());
}

function isCodeNode(node: unknown): node is UnknownRecord {
  return getNodeType(node) === 'code' && isRecord(node);
}

/**
 * Markdown syntax for CodeGroup (minimal, explicit):
 *
 * ::: code-group
 * ```bash [Bash]
 * ...
 * ```
 * ```yaml [Kubernetes]
 * ...
 * ```
 * :::
 */
function remarkCodeGroup() {
  return (tree: unknown) => {
    const visit = (node: unknown) => {
      const children = getChildren(node);
      if (!children) return;
      const nextChildren: unknown[] = [];

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        // ::: code-snippet <github-url> ... ::: — single-file GitHub embed
        const snippetMatch = isCodeSnippetStart(child);
        if (snippetMatch) {
          if (snippetMatch.selfClosed) {
            nextChildren.push({ type: 'codeSnippet', url: snippetMatch.url });
            continue;
          }
          let j = i + 1;
          while (j < children.length && !isCodeGroupContainerEnd(children[j])) {
            j++;
          }
          if (j < children.length) {
            nextChildren.push({ type: 'codeSnippet', url: snippetMatch.url });
            i = j;
            continue;
          }
        }

        // ::: code-explorer <path> ... ::: — must be checked before code-group (same closer)
        const explorerMatch = isCodeExplorerStart(child);
        if (explorerMatch) {
          if (explorerMatch.selfClosed) {
            // Opening and closing ::: were in the same paragraph (no blank line between them)
            nextChildren.push({ type: 'codeExplorer', path: explorerMatch.path, defaultFile: explorerMatch.defaultFile });
            continue;
          }
          let j = i + 1;
          while (j < children.length && !isCodeGroupContainerEnd(children[j])) {
            j++;
          }
          if (j < children.length) {
            nextChildren.push({ type: 'codeExplorer', path: explorerMatch.path, defaultFile: explorerMatch.defaultFile });
            i = j; // skip through the closing :::
            continue;
          }
        }

        // Preferred authoring syntax: ::: code-group ... :::
        if (isCodeGroupContainerStart(child)) {
          const items: CodeGroupItem[] = [];
          let j = i + 1;
          let foundEnd = false;
          let valid = true;

          while (j < children.length) {
            const n = children[j];

            if (isCodeGroupContainerEnd(n)) {
              foundEnd = true;
              break;
            }

            if (isCodeNode(n)) {
              const langRaw = n.lang;
              const metaRaw = n.meta;
              const valueRaw = n.value;

              const lang =
                typeof langRaw === 'string' && langRaw.trim()
                  ? langRaw.trim()
                  : 'text';
              const meta = typeof metaRaw === 'string' ? metaRaw.trim() : '';
              const labelMatch = meta.match(/^\[(.+)\]$/);
              const label = (labelMatch?.[1] || meta || lang).trim();
              const value = typeof valueRaw === 'string' ? valueRaw : '';
              items.push({ lang, label, value });
            } else {
              // If container contains non-code content, don't transform (avoid swallowing content).
              valid = false;
              break;
            }

            j++;
          }

          if (valid && foundEnd && items.length >= 2) {
            nextChildren.push({ type: 'codeGroup', items });
            i = j; // skip everything through the closing :::
            continue;
          }
        }

        nextChildren.push(child);
      }

      if (isRecord(node)) {
        node.children = nextChildren;
      }
      for (const c of nextChildren) visit(c);
    };

    visit(tree);
  };
}

function codeGroupToHast(node: unknown) {
  const n = node as { items?: CodeGroupItem[] };
  return {
    type: 'element',
    tagName: 'codegroup',
    properties: {
      'data-code-group-items': JSON.stringify(n.items || []),
    },
    children: [],
  };
}

function codeExplorerToHast(node: unknown) {
  const n = node as { path?: string; defaultFile?: string };
  return {
    type: 'element',
    tagName: 'codeexplorer',
    properties: {
      'data-path': n.path ?? '',
      'data-default': n.defaultFile ?? '',
    },
    children: [],
  };
}

function codeSnippetToHast(node: unknown) {
  const n = node as { url?: string };
  return {
    type: 'element',
    tagName: 'codesnippet',
    properties: {
      'data-url': n.url ?? '',
    },
    children: [],
  };
}

// Generate hash for code block (simple hash function)
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Parse callout from blockquote children
// Matches patterns like: > [!NOTE], > [!WARNING], etc.
function parseCallout(children: ReactNode): ParsedCallout {
  // Simple recursive text extractor - handle React elements properly
  const getText = (node: ReactNode): string => {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (typeof node === 'boolean') return '';
    if (Array.isArray(node)) {
      return node.map(getText).join('');
    }
    if (typeof node === 'object' && 'props' in node) {
      const props = node.props as { children?: ReactNode };
      if (props.children) {
        return getText(props.children);
      }
    }
    return '';
  };

  // Must be array of children (paragraphs)
  if (!Array.isArray(children) || children.length === 0) {
    return { type: null, content: children };
  }

  // Type assertion: children is ReactNode[]
  const childrenArray = children as ReactNode[];

  // Check all children to find the one with [!NOTE] marker
  let markerChildIndex = -1;
  let markerText = '';
  
  for (let i = 0; i < childrenArray.length; i++) {
    const childText = getText(childrenArray[i]).trim();
    if (childText.includes('[!')) {
      markerChildIndex = i;
      markerText = childText;
      break;
    }
  }
  
  // If no marker found, return regular blockquote
  if (markerChildIndex === -1) {
    return { type: null, content: children };
  }
  
  // Match [!TYPE] - extract type
  const typeMatch = markerText.match(/\[!(\w+)\]/);
  
  if (!typeMatch) {
    return { type: null, content: children };
  }

  const type = typeMatch[1].toLowerCase();
  const validTypes: CalloutType[] = ['note', 'tip', 'important', 'warning', 'caution'];
  
  if (!validTypes.includes(type as CalloutType)) {
    return { type: null, content: children };
  }

  // Title is ONLY text immediately after [!TYPE] on the SAME line
  const lines = markerText.split('\n');
  const firstLine = lines[0] || '';
  const titleMatch = firstLine.match(/\[!(\w+)\]\s+(.+)$/);
  const title = titleMatch?.[2]?.trim() || undefined;

  // Content extraction: marker child contains [!NOTE] + content (separated by newline)
  // Extract content after [!NOTE] from markerText
  const contentAfterMarker = markerText.replace(/\[!(\w+)\]\s*/, '').trim();
  
  // Get subsequent children (after marker child)
  const subsequentChildren = childrenArray.slice(markerChildIndex + 1);
  
  // The marker child (children[markerChildIndex]) is a React element that contains both [!NOTE] and content
  // We need to filter the [!NOTE] part from it but keep the content (which has markdown formatting)
  // Since react-markdown already parsed it, the content is in React element form (with <strong>, <code>, etc.)
  
  // Try to filter the marker child's children to remove [!NOTE] text node but preserve content
  const markerChild = childrenArray[markerChildIndex];
  let filteredMarkerChild: ReactNode | null = null;
  
  if (contentAfterMarker && markerChild && typeof markerChild === 'object' && 'props' in markerChild) {
    // Type guard for React element with props
    const markerChildWithProps = markerChild as { props: { children?: ReactNode } };
    // Try to extract children from marker child and filter out [!NOTE]
    const markerProps = markerChildWithProps.props;
    if (markerProps.children) {
      // Filter children - remove [!NOTE] marker but keep all content after it
      const filterMarkerFromChildren = (node: ReactNode): ReactNode | null => {
        if (typeof node === 'string') {
          // If string contains [!NOTE], extract content after it
          // Match [!TYPE] and capture everything after it, even if content starts immediately (e.g., [!IMPORTANT]**)
          // The pattern allows for optional whitespace/newline but will capture content that starts immediately
          const markerMatch = node.match(/\[!(\w+)\](.*)/s);
          if (markerMatch && markerMatch[2] !== undefined) {
            // Return content after [!NOTE], removing leading whitespace/newlines but preserving other content
            // This handles cases like [!IMPORTANT]** or [!IMPORTANT] ** or [!IMPORTANT]\n**
            const afterMarker = markerMatch[2].replace(/^\s*(?:\n|\r\n?)?/, '').trimStart();
            return afterMarker || null;
          }
          // If string doesn't contain [!NOTE] marker, keep it
          return node;
        }
        if (Array.isArray(node)) {
          const filtered = node.map(filterMarkerFromChildren).filter(item => item !== null && item !== '');
          return filtered.length > 0 ? filtered : null;
        }
        if (node && typeof node === 'object' && 'props' in node) {
          const props = node.props as { children?: ReactNode };
          const filteredChildren = filterMarkerFromChildren(props.children || '');
          if (filteredChildren === null || filteredChildren === '') return null;
          return { ...node, props: { ...props, children: filteredChildren } };
        }
        return node;
      };
      
      filteredMarkerChild = filterMarkerFromChildren(markerProps.children);
      if (filteredMarkerChild && filteredMarkerChild !== '') {
        filteredMarkerChild = { ...markerChildWithProps, props: { ...markerProps, children: filteredMarkerChild } } as ReactNode;
      }
    }
  }
  
  // Build content array
  const content: ReactNode[] = [];
  if (filteredMarkerChild) {
    content.push(filteredMarkerChild);
  }
  // Add subsequent non-whitespace children
  subsequentChildren.forEach(child => {
    const childNode = child;
    const text = getText(childNode).trim();
    if (text.length > 0) {
      content.push(childNode);
    }
  });

  return {
    type: type as CalloutType,
    title,
    content: content.length > 0 ? content : null,
  };
}

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  enableCallouts?: boolean;
  enableCodeGroups?: boolean;
  enableMermaid?: boolean;
  // For internal link resolution (used in docs viewer)
  docPath?: string;
  // Base path for docs routes (e.g. '/docs' or '/internal-docs')
  docsBase?: string;
  // Whether the current page loaded a directory README (affects relative link resolution)
  isDirectoryPage?: boolean;
  // Custom link handler (optional, for non-docs contexts)
  onLinkClick?: (href: string) => void;
}

// ─── Frontmatter parsing ─────────────────────────────────────────────────────

interface DocFrontmatter {
  title?: string;
  description?: string;
  status?: string;
  status_description?: string;
  author?: string;
  priority?: string;
  created?: string;
  updated?: string;
  issue?: string;
  goal?: string;
  [key: string]: unknown;
}

const FRONTMATTER_RE = /(?:^|\n)---\s*\n([\s\S]*?)\n---\s*\n/;

function parseFrontmatter(raw: string): { meta: DocFrontmatter; body: string } {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: raw };

  const block = match[1];
  const meta: DocFrontmatter = {};
  for (const line of block.split('\n')) {
    const kv = /^([\w-]+):\s*(.+)$/.exec(line);
    if (kv) {
      meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  // Remove the entire frontmatter block (including any preceding copyright comment)
  const body = raw.replace(/^[\s\S]*?---\s*\n[\s\S]*?\n---\s*\n/, '');
  return { meta, body };
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  planned:       { bg: 'bg-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',     border: 'border-blue-500/20' },
  'in-progress': { bg: 'bg-amber-500/10',  text: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-500/20' },
  complete:      { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  archived:      { bg: 'bg-slate-500/10',   text: 'text-slate-500 dark:text-slate-400',   border: 'border-slate-500/20' },
  abandoned:     { bg: 'bg-red-500/10',     text: 'text-red-600 dark:text-red-400',       border: 'border-red-500/20' },
  superseded:    { bg: 'bg-orange-500/10',  text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20' },
  draft:         { bg: 'bg-purple-500/10',  text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
};

function getStatusStyle(status: string) {
  const key = status.toLowerCase().replace(/\s+/g, '-');
  return STATUS_STYLES[key] ?? { bg: 'bg-muted/60', text: 'text-muted-foreground', border: 'border-border/40' };
}

export function MarkdownRenderer({
  content,
  className,
  enableCallouts = true,
  enableCodeGroups = true,
  enableMermaid = true,
  docPath = '',
  docsBase = '/docs',
  isDirectoryPage = false,
  onLinkClick,
}: MarkdownRendererProps) {
  const navigate = useNavigate();
  const [highlightedCode, setHighlightedCode] = useState<Record<string, string>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>('');

  // Collect code blocks that need highlighting during render, process in useEffect
  const pendingHighlightsRef = useRef<Array<{ hash: string; code: string; lang: string }>>([]);

  useEffect(() => {
    const pending = pendingHighlightsRef.current;
    if (pending.length === 0) return;
    pendingHighlightsRef.current = [];

    let cancelled = false;
    void (async () => {
      try {
        const { codeToHtml } = await import('shiki');
        const currentMode: 'dark' | 'light' =
          typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const theme = currentMode === 'dark' ? 'github-dark' : 'github-light';

        const results: Record<string, string> = {};
        for (const { hash, code, lang } of pending) {
          if (cancelled) return;
          const highlightLang = lang === 'text' ? 'plaintext' : lang;
          try {
            results[hash] = await codeToHtml(code, { lang: highlightLang, theme });
          } catch (langError: unknown) {
            const msg = langError instanceof Error ? langError.message : String(langError);
            if (msg.includes('is not included in this bundle') && highlightLang !== 'plaintext') {
              try {
                results[hash] = await codeToHtml(code, { lang: 'plaintext', theme });
              } catch {
                // Ignore - will render as plain text
              }
            }
          }
        }
        if (!cancelled && Object.keys(results).length > 0) {
          setHighlightedCode((prev) => ({ ...prev, ...results }));
        }
      } catch {
        // Ignore - will render as plain text
      }
    })();

    return () => { cancelled = true; };
  });

  // Parse frontmatter from content
  const { meta, body: markdownBody } = useMemo(() => parseFrontmatter(content), [content]);

  // Track theme changes (html.dark class) so Shiki uses matching colors
  useMountEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    let previousTheme: 'dark' | 'light' = el.classList.contains('dark') ? 'dark' : 'light';
    
    const observer = new MutationObserver(() => {
      const currentTheme: 'dark' | 'light' = el.classList.contains('dark') ? 'dark' : 'light';
      if (previousTheme !== currentTheme) {
        // Clear highlighted code cache when theme changes so it re-highlights with new theme
        setHighlightedCode({});
        previousTheme = currentTheme;
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  });

  // Compute current directory for relative path resolution (used by img and a handlers)
  const currentDir = (() => {
    if (!docPath || docPath === 'README') return '';
    if (isDirectoryPage) return docPath;
    const lastSlash = docPath.lastIndexOf('/');
    return lastSlash >= 0 ? docPath.substring(0, lastSlash) : '';
  })();

  // Memoize components to ensure they update when highlightedCode changes
  const markdownComponents = useMemo(() => {
    const extractTextFromChildren = (children: ReactNode): string => {
      if (typeof children === 'string') {
        return children;
      }
      if (children != null && typeof children !== 'object') {
        return String(children);
      }
      return '';
    };

    return {
      // Headings with IDs for anchor links and TOC
      h1: ({ ...props }: MarkdownHeadingProps) => {
        const children = props.children;
        const text = extractTextFromChildren(children);
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return <h1 id={id} {...props} />;
      },
      h2: ({ ...props }: MarkdownHeadingProps) => {
        const children = props.children;
        const text = extractTextFromChildren(children);
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return <h2 id={id} {...props} />;
      },
      h3: ({ ...props }: MarkdownHeadingProps) => {
        const children = props.children;
        const text = extractTextFromChildren(children);
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return <h3 id={id} {...props} />;
      },
      h4: ({ ...props }: MarkdownHeadingProps) => {
        const children = props.children;
        const text = extractTextFromChildren(children);
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return <h4 id={id} {...props} />;
      },
      h5: ({ ...props }: MarkdownHeadingProps) => {
        const children = props.children;
        const text = extractTextFromChildren(children);
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return <h5 id={id} {...props} />;
      },
      h6: ({ ...props }: MarkdownHeadingProps) => {
        const children = props.children;
        const text = extractTextFromChildren(children);
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return <h6 id={id} {...props} />;
      },
      // Blockquote - Parse for callout boxes
      blockquote: ({ ...props }) => {
        if (!enableCallouts) {
          return <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground" {...props} />;
        }
        const callout = parseCallout(props.children as ReactNode);
        if (callout.type) {
          return (
            <div className="my-4">
              <CalloutBox type={callout.type} title={callout.title}>
                {callout.content}
              </CalloutBox>
            </div>
          );
        }
        // Regular blockquote
        return <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground" {...props} />;
      },
      // GitHub-style <details>/<summary> collapsible sections (raw HTML via rehype-raw)
      details: ({ className: detailsClassName, ...props }: MarkdownBlockProps) => (
        <details
          className={cn('group my-4 rounded-md border border-border bg-muted/30 [&>:not(summary)]:px-4 [&>:not(summary)]:pb-4 [&>:not(summary)]:pt-1 [&>:not(summary)]:pl-6', detailsClassName)}
          {...props}
        />
      ),
      summary: ({ className: summaryClassName, children, ...props }: MarkdownBlockProps) => (
        <summary
          className={cn(
            'flex cursor-pointer list-none items-center gap-2 py-2 pr-2 font-medium [&::-webkit-details-marker]:hidden',
            summaryClassName
          )}
          {...props}
        >
          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
          {children}
        </summary>
      ),
      codegroup: ({ ...props }: MarkdownBlockProps) => {
        if (!enableCodeGroups) {
          return <div {...props} />;
        }
        const itemsJson = (props['data-code-group-items'] as string | undefined) || '[]';
        let items: CodeGroupItem[] = [];
        try {
          const parsed = JSON.parse(itemsJson) as CodeGroupItem[];
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          // ignore
        }

        const labels = items.map((i) => i.label || i.lang || 'text');

        return (
          <CodeGroup languages={labels}>
            {items.map((i, idx) => (
              <code key={idx} className={`language-${String(i.lang || 'text')}`}>
                {i.value}
              </code>
            ))}
          </CodeGroup>
        );
      },
      codeexplorer: (props: MarkdownBlockProps) => {
        const rawPath = (props['data-path'] as string) ?? '';
        const defaultFile = (props['data-default'] as string) ?? '';
        let explorerPath = rawPath;
        if (rawPath.startsWith('github:')) {
          // Build-time fetch: resolve to _github/<org>/<repo>/<ref>/<path>
          // Supports both github:org/repo/path@ref and github:org/repo@ref (repo root)
          let ghMatch = /^github:([^/]+)\/([^/]+)\/(.+?)(?:@(.+))?$/.exec(rawPath);
          if (ghMatch) {
            const org = ghMatch[1], repo = ghMatch[2], ghPath = ghMatch[3], ref = ghMatch[4] ?? 'main';
            explorerPath = `_github/${org}/${repo}/${ref}/${ghPath}`;
          } else {
            // Repo root: github:org/repo@ref or github:org/repo
            ghMatch = /^github:([^/]+)\/([^@]+?)(?:@(.+))?$/.exec(rawPath);
            if (ghMatch) {
              const org = ghMatch[1], repo = ghMatch[2], ref = ghMatch[3] ?? 'main';
              explorerPath = `_github/${org}/${repo}/${ref}`;
            }
          }
        } else if (rawPath.startsWith('./')) {
          explorerPath = currentDir ? `${currentDir}/${rawPath.slice(2)}` : rawPath.slice(2);
        } else if (rawPath.startsWith('../')) {
          const upLevels = (rawPath.match(/\.\.\//g) ?? []).length;
          const dirParts = currentDir ? currentDir.split('/') : [];
          const targetDir = dirParts.slice(0, Math.max(0, dirParts.length - upLevels)).join('/');
          explorerPath = rawPath.replace(/^(\.\.\/)+/, '');
          explorerPath = targetDir ? `${targetDir}/${explorerPath}` : explorerPath;
        }
        return <CodeExplorer path={explorerPath} defaultFile={defaultFile} />;
      },
      codesnippet: (props: MarkdownBlockProps) => {
        const url = (props['data-url'] as string) ?? '';
        return <GitHubSnippet url={url} />;
      },
      // Pre wrapper - handles shiki highlighted code
      pre: ({ children, ...props }: MarkdownPreProps) => {
        // ReactMarkdown wraps code blocks as <pre><code>...</code></pre>
        // Extract code text and language to look up highlighted version
        // children can be a single React element (code) or an array
        
        // Handle single child (most common case)
        let child: ReactNode = children;
        if (Array.isArray(children) && children.length === 1) {
          child = children[0] as ReactNode;
        }
        
        // Helper to check if node is a React element-like object
        const isReactElement = (node: ReactNode): boolean => {
          return typeof node === 'object' && node !== null;
        };
        
        if (isReactElement(child)) {
          const childElement = child as unknown as ReactElementLike;
          // If child is already a shiki-wrapper div, return it directly (no pre wrapper)
          const childType = typeof childElement.type === 'string' ? childElement.type : 
                           (typeof childElement.type === 'object' && childElement.type !== null && 'name' in childElement.type ? childElement.type.name : '');
          const childClassName = typeof childElement.props?.className === 'string' ? childElement.props.className : '';
          
          if (childType === 'div' && childClassName.includes('shiki-wrapper')) {
            return child;
          }
          
          // Check if child is a code element (single child or array element)
          // child.type could be the string 'code' or the React component function
          const isCodeElement = childType === 'code' || 
            (typeof childElement.type === 'function' && childElement.type.name === 'code') ||
            childClassName.includes('language-');
          
          if (isCodeElement) {
            // Extract code text from children
            const extractCodeText = (node: ReactNode): string => {
              if (typeof node === 'string') {
                return node;
              }
              if (Array.isArray(node)) {
                return node.map(extractCodeText).join('');
              }
              if (typeof node === 'object' && node !== null && 'props' in node) {
                const nodeProps = node.props as { children?: ReactNode };
                return extractCodeText(nodeProps.children || '');
              }
              // Handle primitive types safely - avoid String() on objects
              if (node == null) {
                return '';
              }
              return typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean' 
                ? String(node) 
                : '';
            };
            
            const codeText = extractCodeText(childElement.props?.children);
            const codeTextTrimmed = codeText.trim();
            
            // Extract language from className
            const className = typeof childElement.props?.className === 'string' ? childElement.props.className : 
                             Array.isArray(childElement.props?.className) ? childElement.props.className.join(' ') : 
                             String(childElement.props?.className || '');
            let lang = className.replace('language-', '').split(' ')[0] || 'text';
            // Map common language aliases to Shiki language identifiers
            if (lang === 'env') {
              lang = 'dotenv';
            }
            
            // For Mermaid, render diagram (do not use Shiki)
            if (lang === 'mermaid' && enableMermaid) {
              return <MermaidDiagram code={codeTextTrimmed} />;
            }

            // For tree / filetree, render interactive file tree visualization
            if (lang === 'tree' || lang === 'filetree') {
              return <FileTreeViewer content={codeTextTrimmed} />;
            }
            
            // Calculate hash for copy functionality
            const codeHash = hashCode(`${lang}-${codeTextTrimmed.substring(0, 100)}`);
            
            // Display language label (use original lang before mapping for display)
            const displayLang = lang === 'dotenv' ? 'env' : lang;
            
            // For JSON/JSONC, use our existing JsonSyntaxHighlighter instead of Shiki
            if (lang === 'json' || lang === 'jsonc') {
              const codeId = `code-json-${codeHash}`;
              const handleCopy = async () => {
                try {
                  await navigator.clipboard.writeText(codeTextTrimmed);
                  setCopiedCodeId(codeId);
                  setTimeout(() => setCopiedCodeId(null), 2000);
                } catch (err) {
                  console.error('Failed to copy code:', err);
                }
              };

              return (
                <div className="shiki-wrapper">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20" style={{ backgroundColor: 'transparent' }}>
                    <span className="text-sm text-muted-foreground font-mono lowercase">
                      {displayLang}
                    </span>
                    <button
                      onClick={() => { void handleCopy(); }}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      {copiedCodeId === codeId ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy code</span>
                        </>
                      )}
                    </button>
                  </div>
                  <JsonSyntaxHighlighter 
                    json={codeTextTrimmed} 
                    maxHeight="none"
                    className="border-0 bg-transparent"
                    stringColor="green"
                  />
                </div>
              );
            }
            
            // For other languages, use Shiki
            // Check for shiki marker in className OR check highlightedCode state directly
            const hasShikiMarker = className.includes('shiki-code-render');
            const dataShikiHtml = (childElement.props?.['data-shiki-html'] as string | undefined);
            const html = hasShikiMarker ? (dataShikiHtml || highlightedCode[codeHash]) : highlightedCode[codeHash];
            
            if (html && typeof html === 'string' && html.length > 0) {
              const codeId = `code-${codeHash}`;
              const handleCopy = async () => {
                try {
                  await navigator.clipboard.writeText(codeTextTrimmed);
                  setCopiedCodeId(codeId);
                  setTimeout(() => setCopiedCodeId(null), 2000);
                } catch (err) {
                  console.error('Failed to copy code:', err);
                }
              };

              // Display language label (use original lang before mapping for display)
              const displayLang = lang === 'text' ? '' : (lang === 'dotenv' ? 'env' : lang);

              return (
                <div
                  className="shiki-wrapper"
                  data-language={lang}
                >
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20" style={{ backgroundColor: 'transparent' }}>
                    {displayLang && (
                      <span className="text-sm text-muted-foreground font-mono lowercase">
                        {displayLang}
                      </span>
                    )}
                    <button
                      onClick={() => { void handleCopy(); }}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      {copiedCodeId === codeId ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy code</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              );
            }
          }
        }
        
        // Regular pre (not a code block with shiki) - render normally
        return <pre {...props}>{children}</pre>;
      },
      // Code blocks - Use shiki for syntax highlighting (colored text only, no backgrounds)
      code: ({ inline, className, children, ...props }: MarkdownCodeProps) => {
        if (inline) {
          return (
            <code className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-700/30 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded-md text-sm font-mono whitespace-nowrap" {...props}>
              {children}
            </code>
          );
        }

        // Block-level code - highlight with shiki
        let lang = className?.replace('language-', '') || 'text';
        // Map common language aliases to Shiki language identifiers
        if (lang === 'env') {
          lang = 'dotenv';
        }
        // Mermaid is rendered by the pre component; return plain code so pre can replace it
        if (lang === 'mermaid' && enableMermaid) {
          return (
            <code className={`language-mermaid ${className || ''}`} {...props}>
              {children}
            </code>
          );
        }
        
        // Extract text from children - handle arrays and strings
        const extractCodeText = (node: ReactNode): string => {
          if (typeof node === 'string') {
            return node;
          }
          if (Array.isArray(node)) {
            return node.map(extractCodeText).join('');
          }
          if (typeof node === 'object' && node !== null && 'props' in node) {
            const nodeProps = node.props as { children?: ReactNode };
            return extractCodeText(nodeProps.children || '');
          }
          // Handle primitive types safely - avoid String() on objects
          if (node == null) {
            return '';
          }
          return typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean' 
            ? String(node) 
            : '';
        };
        
        const codeTextTrimmed = extractCodeText(children).trim();
        const codeHash = hashCode(`${lang}-${codeTextTrimmed.substring(0, 100)}`);
        
        // If already highlighted, return marker for pre to pick up and replace
        // Note: pre component will replace this entire <pre><code> with a div
        if (highlightedCode[codeHash]) {
          return (
            <code 
              className="shiki-code-render" 
              data-shiki-html={highlightedCode[codeHash]}
            >
              {/* Fallback text - visible until pre replaces with highlighted version */}
              {codeTextTrimmed}
            </code>
          );
        }

        // Queue for highlighting in useEffect (avoid setState during render)
        if (codeTextTrimmed) {
          pendingHighlightsRef.current.push({ hash: codeHash, code: codeTextTrimmed, lang });
        }

        // Fallback while loading - render plain code block (always visible)
        return (
          <code className={`language-${lang} ${className || ''}`} {...props}>
            {children}
          </code>
        );
      },
      // Links - convert internal .md links to /docs/* paths without .md extension
      a: ({ href, ...props }: MarkdownLinkProps) => {
        // If custom link handler provided, use it
        if (onLinkClick && href) {
          return (
            <a
              {...props}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                onLinkClick(href);
              }}
              className="text-primary underline hover:text-primary/80"
            />
          );
        }

        // Check if this is an internal markdown link (for docs viewer)
        // Internal links: end with .md, start with ./ or ../, or are relative paths
        const isInternalLink = href && docPath && (
          href.endsWith('.md') || 
          href.startsWith('./') || 
          href.startsWith('../') ||
          (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:') && !href.startsWith('#') && !href.startsWith('/'))
        );

        if (isInternalLink && href) {
          let path = href;

          // currentDir is computed once outside useMemo and closed over here.
          
          // Resolve relative prefixes
          if (path.startsWith('./')) {
            path = path.slice(2);
            path = currentDir ? `${currentDir}/${path}` : path;
          } else if (path.startsWith('../')) {
            // Count how many ../ we have
            const upLevels = (path.match(/\.\.\//g) || []).length;
            const dirParts = currentDir ? currentDir.split('/') : [];
            const targetDir = dirParts.slice(0, Math.max(0, dirParts.length - upLevels)).join('/');
            path = path.replace(/^(\.\.\/)+/, '');
            path = targetDir ? `${targetDir}/${path}` : path;
          } else {
            // Bare relative path (no ./ or ../), resolve relative to current dir
            path = currentDir ? `${currentDir}/${path}` : path;
          }
          
          // Remove .md extension
          path = path.replace(/\.md$/, '');
          
          // Handle README files (case-insensitive)
          if (/\/?readme$/i.test(path)) {
            path = path.replace(/\/?readme$/i, '');
          }
          
          // Build the /docs/* path
          const to = path === '' || path === 'README' ? docsBase : `${docsBase}/${path}`;
          
          return (
            <a
              {...props}
              href={to}
              onClick={(e) => {
                e.preventDefault();
                void Promise.resolve(navigate(to));
              }}
              className="text-primary underline hover:text-primary/80"
            />
          );
        }
        
        // External link or anchor link - render normally
        return (
          <a
            {...props}
            href={href}
            target={href?.startsWith('http://') || href?.startsWith('https://') ? '_blank' : undefined}
            rel={href?.startsWith('http://') || href?.startsWith('https://') ? 'noopener noreferrer' : undefined}
            className="text-primary underline hover:text-primary/80"
          />
        );
      },
      img: (props: MarkdownImageProps) => (
        <DocImage
          {...props}
          currentDir={currentDir}
          docsBase={docsBase}
          onLightbox={(src, alt) => { setLightboxSrc(src); setLightboxAlt(alt); }}
        />
      ),
      table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
        <div className="overflow-x-auto">
          <table {...props}>{children}</table>
        </div>
      ),
    };
  }, [highlightedCode, docPath, docsBase, navigate, copiedCodeId, enableCallouts, enableCodeGroups, enableMermaid, onLinkClick, currentDir]);

  // Create a key based on highlighted code blocks to force ReactMarkdown to re-render
  // when highlighting completes. ReactMarkdown only re-processes when content changes,
  // so we need a key that changes when highlighting state updates.
  const highlightedKeys = Object.keys(highlightedCode).sort().join(',');
  const markdownKey = `markdown-${highlightedKeys}`;

  // Frontmatter metadata table
  const hasMetaHeader = meta.status || meta.priority || meta.created || meta.updated || meta.author || meta.issue || meta.goal || meta['superseded-by'];
  const metaHeader = hasMetaHeader ? (() => {
    const s = meta.status ? getStatusStyle(String(meta.status)) : null;
    const statusLabel = meta.status ? String(meta.status).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;
    const desc = meta.status_description ? String(meta.status_description) : null;

    const priorityStyles: Record<string, string> = {
      high: 'text-red-600 dark:text-red-400',
      medium: 'text-amber-600 dark:text-amber-400',
      low: 'text-blue-600 dark:text-blue-400',
    };
    const priorityColor = meta.priority
      ? (priorityStyles[String(meta.priority).toLowerCase()] ?? 'text-muted-foreground')
      : '';

    const issueUrl = meta.issue ? String(meta.issue) : null;
    // Extract a short label from the URL (e.g. "org/repo#123" or just the URL)
    const issueLabel = issueUrl ? (() => {
      const ghMatch = /github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/.exec(issueUrl);
      if (ghMatch) return `${ghMatch[1]}#${ghMatch[2]}`;
      return issueUrl;
    })() : null;

    type MetaRow = { label: string; value: React.ReactNode };
    const rows: MetaRow[] = [];

    if (typeof meta['superseded-by'] === 'string' && meta['superseded-by']) {
      const rawPath = meta['superseded-by'];
      // Strip leading "docs/" prefix and ".md" extension to build the route
      const routePath = rawPath.replace(/^docs\//, '').replace(/\.md$/, '');
      const to = `${docsBase}/${routePath}`;
      // Display label: last path segment without extension
      const displayLabel = routePath.split('/').pop() ?? routePath;
      rows.push({
        label: 'Superseded By',
        value: (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/40">
              Superseded
            </span>
            <a
              href={to}
              onClick={(e) => { e.preventDefault(); void navigate(to); }}
              className="text-primary underline hover:text-primary/80 font-mono text-xs"
            >
              {displayLabel}
            </a>
          </span>
        ),
      });
    }
    if (s && statusLabel) {
      rows.push({
        label: 'Status',
        value: (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase border ${s.bg} ${s.text} ${s.border}`}>
              {statusLabel}
            </span>
            {desc && <span className="text-muted-foreground">{desc}</span>}
          </div>
        ),
      });
    }
    if (meta.priority) {
      rows.push({
        label: 'Priority',
        value: <span className={`font-medium ${priorityColor}`}>{String(meta.priority).charAt(0).toUpperCase() + String(meta.priority).slice(1)}</span>,
      });
    }
    if (meta.author) {
      rows.push({ label: 'Author', value: <span className="text-foreground/80">{String(meta.author)}</span> });
    }
    if (issueUrl && issueLabel) {
      rows.push({
        label: 'Issue',
        value: <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{issueLabel}</a>,
      });
    }
    if (meta.goal) {
      rows.push({ label: 'Goal', value: <span className="text-foreground/80">{String(meta.goal)}</span> });
    }
    if (meta.created) {
      rows.push({ label: 'Created', value: <span className="text-foreground/70">{String(meta.created)}</span> });
    }
    if (meta.updated) {
      rows.push({ label: 'Updated', value: <span className="text-foreground/70">{String(meta.updated)}</span> });
    }

    return (
      <div className="mb-6 not-prose rounded-md border border-border/40 overflow-hidden text-sm">
        <table className="w-full">
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                <td className="px-3 py-1.5 text-xs font-medium text-muted-foreground w-24 align-middle">{row.label}</td>
                <td className="px-3 py-1.5 align-middle">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  })() : null;

  return (
    <div className={cn('markdown-content', className)}>
      {metaHeader}
      <ReactMarkdown
        key={markdownKey}
        remarkPlugins={remarkGfm ? [remarkGfm, remarkCodeGroup] : [remarkCodeGroup]}
        remarkRehypeOptions={
          {
            handlers: {
              codeGroup: (_state: unknown, node: unknown) => codeGroupToHast(node),
              codeExplorer: (_state: unknown, node: unknown) => codeExplorerToHast(node),
              codeSnippet: (_state: unknown, node: unknown) => codeSnippetToHast(node),
            },
          } as unknown as Record<string, unknown>
        }
        rehypePlugins={[rehypeRaw]}
        // @ts-expect-error - react-markdown component types are complex and our custom components work correctly
        components={markdownComponents}
      >
        {markdownBody}
      </ReactMarkdown>

      <Dialog open={lightboxSrc !== null} onOpenChange={() => { setLightboxSrc(null); }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          {lightboxSrc && (
            <img
              src={lightboxSrc}
              alt={lightboxAlt}
              className="max-w-full max-h-[86vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
