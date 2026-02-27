// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface HclSyntaxHighlighterProps {
  code: string;
  className?: string;
}

interface Token {
  type: 'keyword' | 'string' | 'number' | 'comment' | 'operator' | 'identifier' | 'punctuation' | 'whitespace';
  value: string;
}

function tokenizeHcl(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < code.length) {
    const char = code[i];
    
    // Whitespace
    if (/\s/.test(char)) {
      let whitespace = '';
      while (i < code.length && /\s/.test(code[i])) {
        whitespace += code[i];
        i++;
      }
      tokens.push({ type: 'whitespace', value: whitespace });
      continue;
    }
    
    // Comments
    if (char === '#' && (i === 0 || code[i - 1] === '\n' || code[i - 1] === '\r')) {
      let comment = '';
      while (i < code.length && code[i] !== '\n' && code[i] !== '\r') {
        comment += code[i];
        i++;
      }
      tokens.push({ type: 'comment', value: comment });
      continue;
    }
    
    // Strings (quoted)
    if (char === '"') {
      let str = '"';
      i++;
      let escaped = false;
      while (i < code.length) {
        if (escaped) {
          str += code[i];
          escaped = false;
          i++;
        } else if (code[i] === '\\') {
          str += code[i];
          escaped = true;
          i++;
        } else if (code[i] === '"') {
          str += '"';
          i++;
          break;
        } else {
          str += code[i];
          i++;
        }
      }
      tokens.push({ type: 'string', value: str });
      continue;
    }
    
    // Numbers
    if (/[\d-]/.test(char)) {
      let num = '';
      while (i < code.length && /[\d.eE+-]/.test(code[i])) {
        num += code[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }
    
    // Operators (=, {, }, [, ])
    // eslint-disable-next-line no-useless-escape
    if (/[={}\[\]]/.test(char)) {
      tokens.push({ type: 'operator', value: char });
      i++;
      continue;
    }
    
    // Punctuation (commas, colons, dots)
    if (/[,:.]/.test(char)) {
      tokens.push({ type: 'punctuation', value: char });
      i++;
      continue;
    }
    
    // Keywords and identifiers
    let word = '';
    while (i < code.length && /[a-zA-Z0-9_-]/.test(code[i])) {
      word += code[i];
      i++;
    }
    
    if (word) {
      const keywords = ['module', 'source', 'version', 'credentials', 'terraform', 'required_providers', 'provider', 'variable', 'output', 'resource', 'data', 'locals'];
      const isKeyword = keywords.includes(word.toLowerCase());
      tokens.push({ 
        type: isKeyword ? 'keyword' : 'identifier', 
        value: word 
      });
      continue;
    }
    
    // Unknown character
    tokens.push({ type: 'punctuation', value: char });
    i++;
  }
  
  return tokens;
}

const tokenColors: Record<Token['type'], string> = {
  keyword: 'text-orange-600 dark:text-orange-400',        // Keywords (module, source, etc.) - orange (like JSON keys)
  string: 'text-foreground',                               // Strings - white/foreground (flipped from green)
  number: 'text-blue-600 dark:text-blue-400',            // Numbers - blue (like JSON numbers)
  comment: 'text-gray-500 dark:text-gray-400',            // Comments - gray
  operator: 'text-blue-600 dark:text-blue-400',          // Operators (=, {}, []) - blue
  identifier: 'text-gray-500 dark:text-gray-400',         // Identifiers - gray (same as comments)
  punctuation: 'text-muted-foreground',                  // Punctuation - muted
  whitespace: '',                                         // Whitespace - no color
};

export function HclSyntaxHighlighter({ 
  code, 
  className 
}: HclSyntaxHighlighterProps) {
  const tokens = useMemo(() => tokenizeHcl(code), [code]);
  
  return (
    <div 
      className={cn('overflow-auto bg-muted/10 p-4 font-mono text-sm', className)}
    >
      <pre className="whitespace-pre">
        {tokens.map((token, idx) => (
          <span key={idx} className={tokenColors[token.type]}>
            {token.value}
          </span>
        ))}
      </pre>
    </div>
  );
}

