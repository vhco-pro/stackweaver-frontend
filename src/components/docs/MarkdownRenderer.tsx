// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useMemo, useEffect, type ReactNode } from 'react';
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
    if (getNodeType(c) !== 'text') continue;
    if (!isRecord(c)) continue;
    if (typeof c.value === 'string') parts.push(c.value);
  }
  return parts.join('');
}

function isCodeGroupContainerStart(node: unknown): boolean {
  const text = paragraphText(node);
  return typeof text === 'string' && /^:::\s*code-group\s*$/i.test(text.trim());
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
  // Whether the current page loaded a directory README (affects relative link resolution)
  isDirectoryPage?: boolean;
  // Custom link handler (optional, for non-docs contexts)
  onLinkClick?: (href: string) => void;
}

export function MarkdownRenderer({
  content,
  className,
  enableCallouts = true,
  enableCodeGroups = true,
  enableMermaid = true,
  docPath = '',
  isDirectoryPage = false,
  onLinkClick,
}: MarkdownRendererProps) {
  const navigate = useNavigate();
  const [highlightedCode, setHighlightedCode] = useState<Record<string, string>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Track theme changes (html.dark class) so Shiki uses matching colors
  useEffect(() => {
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
  }, []);

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
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
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

        // Highlight on first render
        if (codeTextTrimmed) {
          void (async () => {
            try {
              const { codeToHtml } = await import('shiki');
              
              // Get current theme mode dynamically
              const currentMode: 'dark' | 'light' =
                typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
              
              // Use GitHub themes matching current mode
              const theme = currentMode === 'dark' ? 'github-dark' : 'github-light';
              
              // Try to highlight with the requested language
              const highlightLang = lang === 'text' ? 'plaintext' : lang;
              
              try {
                const html = await codeToHtml(codeTextTrimmed, {
                  lang: highlightLang,
                  theme,
                });
                setHighlightedCode((prev) => ({ ...prev, [codeHash]: html }));
              } catch (langError: unknown) {
                // If language is not supported, fall back to plaintext
                const errorMessage = langError instanceof Error ? langError.message : String(langError);
                if (errorMessage.includes('is not included in this bundle') && highlightLang !== 'plaintext') {
                  console.debug(`Language "${lang}" not supported, falling back to plaintext`);
                  try {
                    const html = await codeToHtml(codeTextTrimmed, {
                      lang: 'plaintext',
                      theme,
                    });
                    setHighlightedCode((prev) => ({ ...prev, [codeHash]: html }));
                  } catch {
                    // Ignore error - will render as plain text
                  }
                }
              }
            } catch {
              // Ignore error - will render as plain text
            }
          })();
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

          // Determine the current directory for relative link resolution.
          // If this is a directory page (loaded a README), docPath IS the directory.
          // If this is a file page (loaded a .md file), strip the last segment.
          const currentDir = (() => {
            if (!docPath || docPath === 'README') return '';
            if (isDirectoryPage) return docPath;
            // File page: strip last segment to get parent directory
            const lastSlash = docPath.lastIndexOf('/');
            return lastSlash >= 0 ? docPath.substring(0, lastSlash) : '';
          })();
          
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
          const to = path === '' || path === 'README' ? '/docs' : `/docs/${path}`;
          
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
    };
  }, [highlightedCode, docPath, isDirectoryPage, navigate, copiedCodeId, enableCallouts, enableCodeGroups, enableMermaid, onLinkClick]);

  // Create a key based on highlighted code blocks to force ReactMarkdown to re-render
  // when highlighting completes. ReactMarkdown only re-processes when content changes,
  // so we need a key that changes when highlighting state updates.
  const highlightedKeys = Object.keys(highlightedCode).sort().join(',');
  const markdownKey = `markdown-${highlightedKeys}`;

  return (
    <div className={cn('markdown-content', className)}>
      <ReactMarkdown
        key={markdownKey}
        remarkPlugins={remarkGfm ? [remarkGfm, remarkCodeGroup] : [remarkCodeGroup]}
        remarkRehypeOptions={
          {
            handlers: {
              codeGroup: (_state: unknown, node: unknown) => codeGroupToHast(node),
            },
          } as unknown as Record<string, unknown>
        }
        rehypePlugins={[rehypeRaw]}
        // @ts-expect-error - react-markdown component types are complex and our custom components work correctly
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
