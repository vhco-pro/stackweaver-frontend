// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface JsonSyntaxHighlighterProps {
  json: string;
  maxHeight?: string;
  className?: string;
  stringColor?: 'green' | 'white'; // Color for string values (default: green)
}

interface Token {
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'objectBracket' | 'arrayBracket' | 'punctuation' | 'whitespace';
  value: string;
}

function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < json.length) {
    const char = json[i];
    
    // Whitespace
    if (/\s/.test(char)) {
      let whitespace = '';
      while (i < json.length && /\s/.test(json[i])) {
        whitespace += json[i];
        i++;
      }
      tokens.push({ type: 'whitespace', value: whitespace });
      continue;
    }
    
    // Object brackets
    if (char === '{' || char === '}') {
      tokens.push({ type: 'objectBracket', value: char });
      i++;
      continue;
    }
    
    // Array brackets
    if (char === '[' || char === ']') {
      tokens.push({ type: 'arrayBracket', value: char });
      i++;
      continue;
    }
    
    // Other punctuation (colons, commas)
    if (/[,:]/.test(char)) {
      tokens.push({ type: 'punctuation', value: char });
      i++;
      continue;
    }
    
    // String (quoted)
    if (char === '"') {
      let str = '"';
      i++;
      let escaped = false;
      while (i < json.length) {
        if (escaped) {
          str += json[i];
          escaped = false;
          i++;
        } else if (json[i] === '\\') {
          str += json[i];
          escaped = true;
          i++;
        } else if (json[i] === '"') {
          str += '"';
          i++;
          break;
        } else {
          str += json[i];
          i++;
        }
      }
      // Check if this string is a key (followed by colon) or a value
      let j = i;
      while (j < json.length && /\s/.test(json[j])) j++;
      const isKey = j < json.length && json[j] === ':';
      tokens.push({ type: isKey ? 'key' : 'string', value: str });
      continue;
    }
    
    // Number
    if (/[\d-]/.test(char)) {
      let num = '';
      while (i < json.length && /[\d.eE+-]/.test(json[i])) {
        num += json[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }
    
    // Boolean or null
    if (char === 't' && json.slice(i, i + 4) === 'true') {
      tokens.push({ type: 'boolean', value: 'true' });
      i += 4;
      continue;
    }
    if (char === 'f' && json.slice(i, i + 5) === 'false') {
      tokens.push({ type: 'boolean', value: 'false' });
      i += 5;
      continue;
    }
    if (char === 'n' && json.slice(i, i + 4) === 'null') {
      tokens.push({ type: 'null', value: 'null' });
      i += 4;
      continue;
    }
    
    // Unknown character - just add it
    tokens.push({ type: 'punctuation', value: char });
    i++;
  }
  
  return tokens;
}

const getTokenColors = (stringColor: 'green' | 'white' = 'green'): Record<Token['type'], string> => ({
  key: 'text-orange-600 dark:text-orange-400',           // Keys - orange (exact same as JsonViewer)
  string: stringColor === 'white' 
    ? 'text-foreground'                                   // Strings - white (better visibility/accessibility)
    : 'text-green-600 dark:text-green-400',              // Strings - green (default)
  number: 'text-blue-600 dark:text-blue-400',             // Numbers - blue (exact same as JsonViewer)
  boolean: 'text-purple-600 dark:text-purple-400',        // Booleans - purple (exact same as JsonViewer)
  null: 'text-gray-500 dark:text-gray-400',               // Null - gray (exact same as JsonViewer)
  objectBracket: 'text-blue-600 dark:text-blue-400',     // Object brackets {} - blue (exact same as JsonViewer)
  arrayBracket: 'text-purple-600 dark:text-purple-400', // Array brackets [] - purple (exact same as JsonViewer)
  punctuation: 'text-muted-foreground',                  // Colons, commas - muted (exact same as JsonViewer)
  whitespace: '',                                         // Whitespace - no color
});

export function JsonSyntaxHighlighter({ 
  json, 
  maxHeight = '500px',
  className,
  stringColor = 'green'
}: JsonSyntaxHighlighterProps) {
  const tokens = useMemo(() => tokenizeJson(json), [json]);
  const tokenColors = useMemo(() => getTokenColors(stringColor), [stringColor]);
  
  const style = maxHeight === 'none' || maxHeight === '' 
    ? {} 
    : { maxHeight };
  
  const hasNoPadding = className?.includes('p-0');
  
  return (
    <div 
      className={cn('overflow-auto bg-transparent font-mono', className)}
      style={{ 
        ...style,
        margin: '0',
        backgroundColor: 'transparent',
        border: 'none',
        padding: '0'
      }}
    >
      <pre 
        className="whitespace-pre"
        style={{
          margin: '0',
          padding: hasNoPadding ? '0' : '0.75rem',
          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
          fontSize: '0.875rem',
          lineHeight: '1.5',
          overflowX: 'auto',
          backgroundColor: 'transparent',
          border: 'none'
        }}
      >
        {tokens.map((token, idx) => (
          <span key={idx} className={tokenColors[token.type]}>
            {token.value}
          </span>
        ))}
      </pre>
    </div>
  );
}

