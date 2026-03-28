// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useMemo } from 'react';
import { Copy, ChevronRight, ChevronDown, Search, Download, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface JsonViewerProps {
  data: Record<string, unknown> | unknown[] | string;
  title?: string;
  defaultExpanded?: boolean;
  className?: string;
  maxHeight?: string;
  showControls?: boolean;
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  level: number;
  path: string;
  searchTerm?: string;
  defaultExpanded?: boolean;
}

const JsonNode = ({ keyName, value, level, path, searchTerm = '', defaultExpanded = false }: JsonNodeProps) => {
  // If defaultExpanded is true, expand all levels; otherwise only expand first 2 levels
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ? true : level < 2);

  const isMatch = useMemo(() => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const keyMatch = keyName?.toLowerCase().includes(searchLower);
    const valueStr = typeof value === 'string' ? value.toLowerCase() : JSON.stringify(value).toLowerCase();
    const valueMatch = valueStr.includes(searchLower);
    return keyMatch || valueMatch;
  }, [keyName, value, searchTerm]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const isEmptyComposite = (val: unknown): boolean => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object') return Object.keys(val as Record<string, unknown>).length === 0;
    return false;
  };

  const getValueType = (val: unknown): string => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val;
  };

  const getValueColor = (type: string): string => {
    switch (type) {
      case 'string':
        return 'text-green-600 dark:text-green-400';
      case 'number':
        return 'text-blue-600 dark:text-blue-400';
      case 'boolean':
        return 'text-purple-600 dark:text-purple-400';
      case 'null':
        return 'text-gray-500 dark:text-gray-400';
      default:
        return 'text-foreground';
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null) return 'null';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'boolean') return val.toString();
    if (typeof val === 'number') return val.toString();
    return JSON.stringify(val);
  };

  const renderValue = (val: unknown, type: string) => {
    if (type === 'object' && val !== null && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      // Filter out keys whose values are empty objects or empty arrays
      const keys = Object.keys(obj).filter((key) => !isEmptyComposite(obj[key]));
      const hasChildren = keys.length > 0;

      return (
        <div className={cn('relative', !isMatch && 'opacity-50')}>
          <div className="flex items-center gap-1.5">
            {hasChildren && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-0.5 hover:bg-accent rounded transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">{'{'}</span>
            {!isExpanded && hasChildren && (
              <span className="text-muted-foreground text-sm">
                {keys.length} {keys.length === 1 ? 'key' : 'keys'}
              </span>
            )}
            <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">{hasChildren && isExpanded ? '' : '}'}</span>
          </div>
          {isExpanded && hasChildren && (
            <div className="ml-3 mt-1 space-y-0.5 border-l border-border/50 pl-2">
              {keys.map((key) => (
                <JsonNode
                  key={key}
                  keyName={key}
                  value={obj[key]}
                  level={level + 1}
                  path={`${path}.${key}`}
                  searchTerm={searchTerm}
                  defaultExpanded={defaultExpanded}
                />
              ))}
              <div className="flex items-center">
                <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">{'}'}</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (type === 'array') {
      const arr = val as unknown[];
      const hasChildren = arr.length > 0;

      return (
        <div className={cn('relative', !isMatch && 'opacity-50')}>
          <div className="flex items-center gap-1.5">
            {hasChildren && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-0.5 hover:bg-accent rounded transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            <span className="text-purple-600 dark:text-purple-400 font-mono text-sm">{'['}</span>
            {!isExpanded && hasChildren && (
              <span className="text-muted-foreground text-sm">
                {arr.length} {arr.length === 1 ? 'item' : 'items'}
              </span>
            )}
            <span className="text-purple-600 dark:text-purple-400 font-mono text-sm">{hasChildren && isExpanded ? '' : ']'}</span>
          </div>
          {isExpanded && hasChildren && (
            <div className="ml-3 mt-1 space-y-0.5 border-l border-border/50 pl-2">
              {arr.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-muted-foreground font-mono text-xs mt-1">{idx}:</span>
                  <div className="flex-1">
                    <JsonNode
                      value={item}
                      level={level + 1}
                      path={`${path}[${idx}]`}
                      searchTerm={searchTerm}
                      defaultExpanded={defaultExpanded}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center">
                <span className="text-purple-600 dark:text-purple-400 font-mono text-sm">{']'}</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Primitive value
    const valueType = getValueType(val);
    const valueColor = getValueColor(valueType);
    const formatted = formatValue(val);

    return (
      <div className={cn('flex items-center gap-2 group', !isMatch && 'opacity-50')}>
        {keyName && (
          <>
            <span className="text-orange-600 dark:text-orange-400 font-mono text-sm font-medium">
              "{keyName}"
            </span>
            <span className="text-muted-foreground">:</span>
          </>
        )}
        <span className={cn('font-mono text-sm', valueColor)}>
          {formatted}
        </span>
        <button
          onClick={() => { void handleCopy(formatted); }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded transition-all"
          title="Copy value"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  };

  const type = getValueType(value);
  return renderValue(value, type);
};

export function JsonViewer({ 
  data, 
  title = 'JSON Data', 
  defaultExpanded = false,
  className,
  maxHeight = '600px',
  showControls = true
}: JsonViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [visibleItems, setVisibleItems] = useState(100); // Lazy loading: show first 100 items initially

  // Detect if data is a simple { logs: string } wrapper (for backward compatibility)
  const isLogsWrapper = useMemo(() => {
    if (typeof data === 'string') return false;
    if (Array.isArray(data)) return false;
    const obj = data;
    const keys = Object.keys(obj);
    return keys.length === 1 && keys[0] === 'logs' && typeof obj.logs === 'string';
  }, [data]);

  // Extract plain text content (either direct string or from { logs: string } wrapper)
  const plainTextContent = useMemo(() => {
    if (typeof data === 'string') return data;
    if (isLogsWrapper) {
      const obj = data as { logs: string };
      return obj.logs;
    }
    return null;
  }, [data, isLogsWrapper]);

  // Parse JSONL (JSON Lines) format - one JSON object per line
  // TFE returns logs as text/plain but content is JSONL format
  const parsedJsonl = useMemo(() => {
    if (!plainTextContent) return null;
    
    const lines = plainTextContent.split('\n');
    const jsonObjects: unknown[] = [];
    const plainLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        // Skip empty lines but preserve them in output
        continue;
      }
      
      // Try to parse as JSON (JSONL format)
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed = JSON.parse(trimmed);
        jsonObjects.push(parsed);
      } catch {
        // Not JSON, keep as plain text
        plainLines.push(line);
      }
    }
    
    // If we have JSON objects, return them; otherwise return null (show as plain text)
    if (jsonObjects.length > 0) {
      return {
        jsonObjects,
        hasPlainText: plainLines.length > 0,
        plainLines: plainLines.length > 0 ? plainLines : null
      };
    }
    
    return null;
  }, [plainTextContent]);

  // Determine if we should show as plain text (for apply logs)
  // Show as JSONL if we can parse it, otherwise as plain text
  const isPlainText = plainTextContent !== null && parsedJsonl === null;
  const isJsonl = parsedJsonl !== null;

  const handleCopyAll = async () => {
    try {
      const content = isPlainText ? plainTextContent : JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(content);
      toast.success(isPlainText ? 'Copied to clipboard' : 'Copied JSON to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    const content = isPlainText ? plainTextContent : JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: isPlainText ? 'text/plain' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const extension = isPlainText ? 'txt' : 'json';
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(isPlainText ? 'Text downloaded' : 'JSON downloaded');
  };

  const rawJson = useMemo(() => {
    if (isJsonl && parsedJsonl) {
      // Format JSONL: format each JSON object on its own line
      const formatted = parsedJsonl.jsonObjects.map(obj => 
        JSON.stringify(obj, null, 2)
      ).join('\n\n');
      
      // Append plain text lines if any
      if (parsedJsonl.plainLines && parsedJsonl.plainLines.length > 0) {
        return parsedJsonl.plainLines.join('\n') + '\n\n' + formatted;
      }
      return formatted;
    }
    if (isPlainText) return plainTextContent;
    return JSON.stringify(data, null, 2);
  }, [data, isPlainText, isJsonl, plainTextContent, parsedJsonl]);

  return (
    <div className={cn(
      'border rounded-lg bg-background overflow-hidden',
      isFullscreen && 'fixed inset-4 z-50',
      className
    )}>
      {showControls && (
        <div className="border-b bg-muted/30 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <h3 className="font-semibold text-sm">{title}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'tree' ? 'raw' : 'tree')}
                className="px-2 py-1 text-xs rounded-md bg-background hover:bg-accent transition-colors"
              >
                {viewMode === 'tree' ? 'Raw' : 'Tree'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-48 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void handleCopyAll(); }}
              className="h-8"
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void handleDownload(); }}
              className="h-8"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
      <div 
        className="overflow-auto p-4 font-mono text-sm"
        style={isFullscreen ? { height: 'calc(100% - 60px)' } : { maxHeight }}
      >
        {viewMode === 'tree' ? (
          // For JSONL, show as array of JSON objects
          isJsonl && parsedJsonl ? (
            <div className="space-y-4">
              {parsedJsonl.plainLines && parsedJsonl.plainLines.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground mb-2">Plain text output:</div>
                  <pre className="text-sm whitespace-pre-wrap break-words bg-muted/30 p-2 rounded">
                    {parsedJsonl.plainLines.join('\n')}
                  </pre>
                </div>
              )}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-2">
                  JSON structured logs ({parsedJsonl.jsonObjects.length} entries):
                </div>
                {parsedJsonl.jsonObjects.length > visibleItems ? (
                  <>
                    <JsonNode
                      value={parsedJsonl.jsonObjects.slice(0, visibleItems)}
                      level={0}
                      path="root"
                      searchTerm={searchTerm}
                      defaultExpanded={defaultExpanded}
                    />
                    <div className="flex items-center justify-center py-4 border-t">
                      <button
                        onClick={() => setVisibleItems(prev => Math.min(prev + 100, parsedJsonl.jsonObjects.length))}
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Load More ({parsedJsonl.jsonObjects.length - visibleItems} remaining)
                      </button>
                      {visibleItems < parsedJsonl.jsonObjects.length && (
                        <button
                          onClick={() => setVisibleItems(parsedJsonl.jsonObjects.length)}
                          className="ml-2 px-4 py-2 text-sm bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
                        >
                          Show All
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <JsonNode
                    value={parsedJsonl.jsonObjects}
                    level={0}
                    path="root"
                    searchTerm={searchTerm}
                    defaultExpanded={defaultExpanded}
                  />
                )}
              </div>
            </div>
          ) : isPlainText ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">Plain text content:</div>
              <JsonNode
                value={plainTextContent}
                level={0}
                path="root"
                searchTerm={searchTerm}
                defaultExpanded={defaultExpanded}
              />
            </div>
          ) : (
            <JsonNode
              value={data}
              level={0}
              path="root"
              searchTerm={searchTerm}
              defaultExpanded={defaultExpanded}
            />
          )
        ) : (
          <pre className="text-sm whitespace-pre-wrap break-words">
            {rawJson}
          </pre>
        )}
      </div>
    </div>
  );
}

