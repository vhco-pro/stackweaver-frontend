// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, WrapText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface YamlViewerProps {
  content: string;
  className?: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
  showCopyButton?: boolean;
  showWrapToggle?: boolean;
}

interface TokenizedLine {
  lineNumber: number;
  tokens: Token[];
}

interface Token {
  type: 'key' | 'value' | 'string' | 'number' | 'boolean' | 'null' | 'comment' | 'anchor' | 'alias' | 'tag' | 'punctuation' | 'indent' | 'text';
  value: string;
}

// Tokenize a YAML line for syntax highlighting
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  
  // Handle empty lines
  if (line.trim() === '') {
    tokens.push({ type: 'text', value: line });
    return tokens;
  }
  
  // Capture leading whitespace
  const indentMatch = line.match(/^(\s*)/);
  if (indentMatch && indentMatch[1]) {
    tokens.push({ type: 'indent', value: indentMatch[1] });
    line = line.slice(indentMatch[1].length);
  }
  
  // Handle comments (full line)
  if (line.startsWith('#')) {
    tokens.push({ type: 'comment', value: line });
    return tokens;
  }
  
  // Handle document markers
  if (line === '---' || line === '...') {
    tokens.push({ type: 'punctuation', value: line });
    return tokens;
  }
  
  // Handle list items
  if (line.startsWith('- ') || line === '-') {
    tokens.push({ type: 'punctuation', value: '-' });
    if (line.length > 1) {
      line = line.slice(1);
      // Continue processing the rest
    } else {
      return tokens;
    }
  }
  
  // Check for key: value pattern
  const keyValueMatch = line.match(/^(\s*)([^\s:]+)(\s*:\s*)(.*)$/);
  if (keyValueMatch) {
    const [, leadingSpace, key, colon, value] = keyValueMatch;
    
    if (leadingSpace) {
      tokens.push({ type: 'indent', value: leadingSpace });
    }
    
    tokens.push({ type: 'key', value: key });
    tokens.push({ type: 'punctuation', value: colon.trim() });
    
    if (value) {
      // Add space before value
      const spaceMatch = colon.match(/:(\s+)/);
      if (spaceMatch) {
        tokens.push({ type: 'text', value: ' ' });
      }
      
      // Tokenize value
      tokenizeValue(value.trim(), tokens);
    }
    
    return tokens;
  }
  
  // Handle quoted strings at start
  if (line.startsWith('"') || line.startsWith("'")) {
    tokens.push({ type: 'string', value: line });
    return tokens;
  }
  
  // Default: just add as text
  tokenizeValue(line, tokens);
  return tokens;
}

function tokenizeValue(value: string, tokens: Token[]): void {
  // Handle inline comments
  const commentIdx = value.indexOf(' #');
  let mainValue = value;
  let comment = '';
  
  if (commentIdx > -1) {
    mainValue = value.slice(0, commentIdx);
    comment = value.slice(commentIdx);
  }
  
  // Handle different value types
  if (mainValue.startsWith('"') || mainValue.startsWith("'")) {
    // Quoted string
    tokens.push({ type: 'string', value: mainValue });
  } else if (mainValue.startsWith('&')) {
    // Anchor
    tokens.push({ type: 'anchor', value: mainValue });
  } else if (mainValue.startsWith('*')) {
    // Alias
    tokens.push({ type: 'alias', value: mainValue });
  } else if (mainValue.startsWith('!')) {
    // Tag
    const spaceIdx = mainValue.indexOf(' ');
    if (spaceIdx > -1) {
      tokens.push({ type: 'tag', value: mainValue.slice(0, spaceIdx) });
      tokens.push({ type: 'text', value: ' ' });
      tokenizeValue(mainValue.slice(spaceIdx + 1), tokens);
    } else {
      tokens.push({ type: 'tag', value: mainValue });
    }
  } else if (/^-?\d+(\.\d+)?$/.test(mainValue)) {
    // Number
    tokens.push({ type: 'number', value: mainValue });
  } else if (/^(true|false|yes|no|on|off)$/i.test(mainValue)) {
    // Boolean
    tokens.push({ type: 'boolean', value: mainValue });
  } else if (/^(null|~)$/i.test(mainValue)) {
    // Null
    tokens.push({ type: 'null', value: mainValue });
  } else if (mainValue.startsWith('[') || mainValue.startsWith('{')) {
    // Inline array or object - highlight as value
    tokens.push({ type: 'value', value: mainValue });
  } else if (mainValue.startsWith('|') || mainValue.startsWith('>')) {
    // Multi-line string indicator
    tokens.push({ type: 'punctuation', value: mainValue.charAt(0) });
    if (mainValue.length > 1) {
      tokens.push({ type: 'text', value: mainValue.slice(1) });
    }
  } else if (mainValue) {
    // Regular string value (unquoted)
    tokens.push({ type: 'value', value: mainValue });
  }
  
  // Add comment if present
  if (comment) {
    tokens.push({ type: 'comment', value: comment });
  }
}

// Color classes for different token types - matching app styling
const tokenColors: Record<Token['type'], string> = {
  key: 'text-sky-400',            // Keys/params - dark vibrant blue
  value: 'text-gray-100',         // Unquoted values - white/light gray
  string: 'text-emerald-400',     // Quoted strings - green
  number: 'text-purple-400',      // Numbers - purple
  boolean: 'text-amber-400',      // Booleans - amber
  null: 'text-red-400',           // Null values - red
  comment: 'text-gray-500 italic', // Comments - gray italic
  anchor: 'text-pink-400',        // YAML anchors - pink
  alias: 'text-pink-400',         // YAML aliases - pink
  tag: 'text-cyan-400',           // YAML tags - cyan
  punctuation: 'text-gray-400',   // Punctuation - gray
  indent: '',                     // Indentation - no color
  text: 'text-white',             // Normal text - white
};

export function YamlViewer({
  content,
  className,
  maxHeight = '600px',
  showLineNumbers = true,
  showCopyButton = true,
  showWrapToggle = true,
}: YamlViewerProps) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  
  const tokenizedLines = useMemo<TokenizedLine[]>(() => {
    const lines = content.split('\n');
    return lines.map((line, index) => ({
      lineNumber: index + 1,
      tokens: tokenizeLine(line),
    }));
  }, [content]);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={cn('relative rounded-lg bg-[#1e1e2e] overflow-hidden', className)}>
      {/* Toolbar */}
      {(showCopyButton || showWrapToggle) && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {showWrapToggle && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle word wrap"
              className={cn(
                "h-7 w-7 text-gray-400 hover:text-gray-100 hover:bg-white/10",
                wordWrap && "bg-white/10 text-gray-100"
              )}
              onClick={() => setWordWrap(!wordWrap)}
              title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
            >
              <WrapText className="h-4 w-4" />
            </Button>
          )}
          {showCopyButton && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy to clipboard"
              className="h-7 w-7 text-gray-400 hover:text-gray-100 hover:bg-white/10"
              onClick={() => { void handleCopy(); }}
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      )}
      
      {/* Code content */}
      <div 
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <div className="p-4 font-mono text-sm">
          {tokenizedLines.map((line) => (
            <div 
              key={line.lineNumber} 
              className={cn(
                "flex",
                !wordWrap && "whitespace-nowrap"
              )}
            >
              {showLineNumbers && (
                <span className="select-none text-gray-600 text-right pr-4 min-w-[3rem]">
                  {line.lineNumber}
                </span>
              )}
              <span className={wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}>
                {line.tokens.map((token, tokenIndex) => (
                  <span key={tokenIndex} className={tokenColors[token.type]}>
                    {token.value}
                  </span>
                ))}
                {line.tokens.length === 0 && '\n'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
