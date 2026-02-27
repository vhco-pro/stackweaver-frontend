// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Children, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Check, Copy } from 'lucide-react';

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

  const getIconPath = (label: string): string | null => {
    const name = label.trim().toLowerCase();
    if (name.endsWith('.sh') || name.includes('bash') || name.includes('shell')) return '/icons/code-group/bash.svg';
    if (name.endsWith('.ps1') || name.includes('pwsh') || name.includes('powershell')) return '/icons/code-group/powershell.svg';
    if (name.endsWith('.go') || name === 'go' || name.includes('golang')) return '/icons/code-group/go.svg';
    if (name.includes('docker') || name.includes('docker-compose')) return '/icons/code-group/docker.svg';
    if (name.includes('kubectl') || name.includes('kubernetes') || name.includes('k8s')) return '/icons/code-group/kubernetes.svg';
    return null;
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
      <Tabs value={String(activeTab)} onValueChange={(v) => setActiveTab(Number(v))}>
        <div className="flex items-center justify-between rounded-t-lg border border-[rgba(203,213,225,0.25)] bg-muted/30 px-2 py-1">
          <TabsList className="h-auto bg-transparent p-0 text-muted-foreground">
          {codeBlocks.map((_, index) => {
            const displayLang = getLabel(index);
            const iconPath = getIconPath(displayLang);
            return (
              <TabsTrigger
                key={index}
                value={String(index)}
                className="gap-2 rounded-md px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
              >
                {iconPath ? (
                  <img
                    src={iconPath}
                    alt=""
                    aria-hidden
                    className="h-[17px] w-[17px] opacity-90"
                    loading="lazy"
                  />
                ) : null}
                <span>{displayLang}</span>
              </TabsTrigger>
            );
          })}
          </TabsList>
          <button
            type="button"
            onClick={() => { void handleCopy(); }}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        {codeBlocks.map((_, index) => {
          const html = highlightedBlocks[index];
          return (
            <TabsContent
              key={index}
              value={String(index)}
              className="mt-0 overflow-hidden rounded-b-lg border border-t-0 border-[rgba(203,213,225,0.25)]"
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
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
