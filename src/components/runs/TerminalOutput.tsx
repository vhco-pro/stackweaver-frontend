// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef, useEffect, useState, useMemo } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TerminalOutputProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * TerminalOutput component displays plain text terminal output with auto-scroll
 * 
 * Features:
 * - Shows plain text output (what you'd see in a terminal when running terraform)
 * - Extracts plain text lines from JSONL format (separates JSON objects from plain text)
 * - Auto-scroll to bottom when new content arrives
 * - User can scroll up to view history (auto-scroll pauses)
 * - Copy to clipboard functionality
 * - Scroll to bottom button when user has scrolled up
 */
export function TerminalOutput({ content, isStreaming, className }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  // Strip ANSI escape codes from content
  // ANSI escape codes are used for terminal formatting (colors, bold, etc.)
  // Pattern matches: \x1b[ followed by numbers/semicolons and ending with 'm'
  const cleanedContent = useMemo(() => {
    if (!content.trim()) return content;
    // eslint-disable-next-line no-control-regex
    return content.replace(/\x1b\[[0-9;]*m/g, '');
  }, [content]);

  // Extract plain text lines from content (similar to JsonViewer logic)
  // If content is JSONL format, extract only the plain text lines
  // If content is pure plain text, use it as-is
  const plainTextLines = useMemo(() => {
    if (!cleanedContent.trim()) return [];
    
    const lines = cleanedContent.split('\n');
    const plainLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines but preserve them
      if (!trimmed) {
        plainLines.push('');
        continue;
      }
      
      // Try to parse as JSON (JSONL format)
      try {
        JSON.parse(trimmed);
        // This line is JSON, skip it (we only want plain text for terminal view)
        continue;
      } catch {
        // Not JSON, keep as plain text
        plainLines.push(line);
      }
    }
    
    // If we found plain text lines, return them
    // If all lines were JSON (plainLines is empty or only empty strings), 
    // return original content as plain text (fallback for pure plain text logs)
    if (plainLines.length > 0 && plainLines.some(l => l.trim())) {
      return plainLines;
    }
    
    // Fallback: return original content as-is (pure plain text logs)
    return lines;
  }, [cleanedContent]);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (shouldAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [plainTextLines, shouldAutoScroll]);

  // Detect user scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setShouldAutoScroll(isAtBottom);
  };

  // Scroll to bottom manually
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setShouldAutoScroll(true);
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      const textToCopy = plainTextLines.join('\n');
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Lazy rendering: only render first 1000 lines initially to prevent UI hanging
  const MAX_INITIAL_LINES = 1000;
  const linesToRender = plainTextLines.length > MAX_INITIAL_LINES 
    ? plainTextLines.slice(0, MAX_INITIAL_LINES)
    : plainTextLines;
  const remainingCount = plainTextLines.length - linesToRender.length;

  return (
    <div className={cn("relative border rounded-lg overflow-hidden", className)}>
      {/* Terminal content - plain text output (what you'd see in a terminal) */}
      {/* AUD-127: the streaming run/job log is the product's core output; expose it as a live
          region so screen readers announce appended lines while a run is in progress. */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        aria-live={isStreaming ? 'polite' : 'off'}
        aria-busy={isStreaming}
        aria-label="Run output log"
        className="bg-muted/10 font-mono text-sm overflow-auto"
        style={{ maxHeight: '600px', minHeight: '200px' }}
      >
        <pre className="whitespace-pre p-4">
          {linesToRender.map((line, idx) => (
            <span key={idx}>
              {line || '\u00A0'}{'\n'}
            </span>
          ))}
          {remainingCount > 0 && (
            <>
              <span className="text-muted-foreground italic">
              {'\n'}... {remainingCount} more lines (scroll to view) ...{'\n'}
              </span>
            </>
          )}
          {isStreaming && (
            <span className="inline-flex items-center gap-1">
              <span className="animate-pulse">▋</span>
            </span>
          )}
        </pre>
      </div>

      {/* Action buttons - positioned absolutely in top-right */}
      <div className="absolute top-2 right-2 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { void handleCopy(); }}
          className="h-7 px-2 text-xs bg-background/80 hover:bg-background"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
        {!shouldAutoScroll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToBottom}
            className="h-7 px-2 text-xs bg-background/80 hover:bg-background"
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            Scroll to bottom
          </Button>
        )}
      </div>
    </div>
  );
}


