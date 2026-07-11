// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

function mermaidConfig() {
  return {
    startOnLoad: false,
    // AUD-078: 'strict' sanitizes rendered HTML and disallows click-handlers/script in diagram
    // source, closing a stored-XSS vector (diagrams come from Markdown docs that can be
    // contributed via PR). 'loose' would let a crafted diagram inject markup/handlers.
    securityLevel: 'strict' as const,
    theme: 'dark' as const,
    themeVariables: {
      primaryColor: '#3b82f6',
      primaryTextColor: '#e2e8f0',
      primaryBorderColor: '#64748b',
      lineColor: '#94a3b8',
      secondaryColor: '#1e293b',
      tertiaryColor: '#0f172a',
    },
  };
}

/**
 * Renders Mermaid diagram syntax as an SVG diagram using the mermaid library.
 * Used by DocsViewer for ```mermaid code blocks.
 * In inline mode: click to open an enlarged view in a modal.
 */
export function MermaidDiagram({ code, className = '' }: MermaidDiagramProps) {
  const [expandOpen, setExpandOpen] = useState(false);
  const [id] = useState(() => `mermaid-${Math.random().toString(36).slice(2, 11)}`);

  const { data: svg = null, isLoading: loading, error: renderError } = useQuery({
    queryKey: ['docs-mermaid', id, code],
    queryFn: async (): Promise<string> => {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize(mermaidConfig());
      const result = await mermaid.render(id, code);
      return result.svg;
    },
    enabled: !!code.trim(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  const error = renderError ? (renderError instanceof Error ? renderError.message : String(renderError)) : null;

  if (error) {
    return (
      <div
        className={`my-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400 ${className}`}
      >
        <div className="mb-1 font-semibold">Mermaid diagram error</div>
        <pre className="whitespace-pre-wrap break-words">{error}</pre>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-muted-foreground">
          {code}
        </pre>
      </div>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Click to enlarge diagram"
        onClick={() => { setExpandOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandOpen(true); } }}
        className={`group relative my-4 cursor-pointer rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/50 ${className}`}
        style={{ minHeight: 60 }}
      >
        {loading || !svg ? (
          <div className="flex min-h-[60px] items-center justify-center text-muted-foreground">
            Rendering…
          </div>
        ) : (
          <div
            className="mermaid-diagram flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        <div
          className="absolute right-2 top-2 rounded-sm bg-black/50 p-1.5 text-white/90 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        >
          <Maximize2 className="h-4 w-4" />
        </div>
      </div>
      <Dialog open={expandOpen} onOpenChange={setExpandOpen}>
        <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-auto p-6 pt-12">
          {expandOpen && (
            <MermaidDiagramCore
              code={code}
              id={`${id}-enlarged`}
              className="flex min-h-[120px] justify-center [&_svg]:max-w-full [&_svg]:h-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Renders the mermaid SVG. Only mounted when the enlarge dialog is open. */
function MermaidDiagramCore({ code, id, className = '' }: { code: string; id: string; className?: string }) {
  const { data: svg = null, isLoading: loading, error: renderError } = useQuery({
    queryKey: ['docs-mermaid', id, code],
    queryFn: async (): Promise<string> => {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize(mermaidConfig());
      const result = await mermaid.render(id, code);
      return result.svg;
    },
    enabled: !!code.trim(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  const err = renderError ? (renderError instanceof Error ? renderError.message : String(renderError)) : null;

  if (err) {
    return (
      <div className="rounded-sm border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Failed to render diagram: {err}
      </div>
    );
  }

  if (loading || !svg) {
    return (
      <div className={`flex min-h-[120px] items-center justify-center py-12 text-muted-foreground ${className}`}>
        Rendering…
      </div>
    );
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
