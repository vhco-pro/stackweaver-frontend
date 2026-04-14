// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Children, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Check, Copy } from 'lucide-react';
import { getLanguageIcon } from './fileTypeIcons';

interface CodeGroupProps {
  children: React.ReactNode;
  /** Language labels for each tab */
  languages?: string[];
  /** Default active tab index */
  defaultTab?: number;
}

/**
 * CodeGroup - Renders tabbed code blocks
 *
 * Usage in markdown (via custom component):
 * <CodeGroup languages={['kubernetes', 'docker-compose']}>
 *   <pre><code className="language-kubernetes">...</code></pre>
 *   <pre><code className="language-docker-compose">...</code></pre>
 * </CodeGroup>
 */
export function CodeGroup({ children, languages, defaultTab = 0 }: CodeGroupProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [highlightedBlocks, setHighlightedBlocks] = useState<Record<number, string>>({});
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const [copied, setCopied] = useState(false);

  // Extract code blocks from children (expects <code className="language-...">...</code> nodes)
  const codeBlocks = Children.toArray(children).filter((child: ReactNode) => {
    if (typeof child === 'object' && child !== null && 'props' in child) {
      const className = (child as { props?: { className?: string | string[] } }).props?.className;
      const classNameStr = Array.isArray(className) ? className.join(' ') : className;
      return typeof classNameStr === 'string' && classNameStr.includes('language-');
    }
    return false;
  });

  // Extract language from className (e.g., "language-kubernetes" -> "kubernetes")
  const getLanguage = (index: number): string => {
    const block = codeBlocks[index] as { props?: { className?: string } };
    const className = block?.props?.className || '';
    const match = className.match(/language-([A-Za-z0-9_-]+)/);
    const lang = match ? match[1] : 'text';
    // Map common aliases to Shiki languages
    return lang === 'env' ? 'dotenv' : lang;
  };

  const getLabel = (index: number): string => {
    const lang = getLanguage(index);
    return (languages?.[index] || lang || 'text').trim();
  };

  const activeCodeText = useMemo(() => {
    const block = codeBlocks[activeTab] as { props?: { children?: React.ReactNode } } | undefined;
    const codeChildren = block?.props?.children;
    const codeText =
      typeof codeChildren === 'string'
        ? codeChildren
        : (codeChildren != null && typeof codeChildren !== 'object' ? String(codeChildren) : '');
    return codeText.trim();
  }, [activeTab, codeBlocks]);

  // Track theme changes (html.dark class) so Shiki uses matching colors
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

  // Highlight code blocks with shiki
  useEffect(() => {
    const highlightCode = async () => {
      // Clear cache on theme change (colors differ between light/dark)
      setHighlightedBlocks({});

      for (let i = 0; i < codeBlocks.length; i++) {
        const block = codeBlocks[i] as { props?: { children?: React.ReactNode } };
        const codeChildren = block?.props?.children;
        const codeText =
          typeof codeChildren === 'string'
            ? codeChildren
            : (codeChildren != null && typeof codeChildren !== 'object' ? String(codeChildren) : '');

        if (!codeText.trim()) continue;

        const lang = getLanguage(i);

        try {
          const { codeToHtml } = await import('shiki');
          const currentMode: 'dark' | 'light' =
            typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

          const html = await codeToHtml(codeText, {
            lang: lang === 'text' ? 'plaintext' : lang,
            theme: currentMode === 'dark' ? 'github-dark' : 'github-light',
          });

          setHighlightedBlocks((prev) => ({ ...prev, [i]: html }));
        } catch (error) {
          console.warn(`Failed to highlight code block ${i} (lang: ${lang}):`, error);
          // Fallback to plain text
          setHighlightedBlocks((prev) => ({
            ...prev,
            [i]: `<pre><code>${codeText}</code></pre>`,
          }));
        }
      }
    };

    void highlightCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeBlocks.length, languages, themeMode]);

  if (codeBlocks.length === 0) {
    return <>{children}</>;
  }

  if (codeBlocks.length === 1) {
    // Single code block - no tabs needed
    const html = highlightedBlocks[0];
    if (html) {
      return (
        <div
          className="my-4 rounded-lg overflow-hidden border border-border"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    return <>{codeBlocks[0]}</>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCodeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="my-4">
      {/* Tab header — plain HTML to avoid shadcn TabsList h-10 override issues */}
      <div className="flex items-center justify-between rounded-t-lg border border-[rgba(203,213,225,0.25)] bg-muted/30 px-2 py-1">
        <div className="flex items-center gap-0.5" role="tablist">
          {codeBlocks.map((_, index) => {
            const displayLang = getLabel(index);
            const iconPath = getLanguageIcon(displayLang) ?? getLanguageIcon(getLanguage(index));
            const isActive = activeTab === index;
            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(index)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {iconPath ? (
                  <img
                    src={iconPath}
                    alt=""
                    aria-hidden
                    className="h-3.5! w-3.5! my-0! rounded-none! opacity-90"
                    loading="lazy"
                  />
                ) : null}
                <span>{displayLang}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { void handleCopy(); }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      {/* Content panes */}
      {codeBlocks.map((_, index) => {
        if (index !== activeTab) return null;
        const html = highlightedBlocks[index];
        return (
          <div
            key={index}
            role="tabpanel"
            className="overflow-hidden rounded-b-lg border border-t-0 border-[rgba(203,213,225,0.25)]"
          >
            {html ? (
              <div
                className="overflow-auto"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Rendering…
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
