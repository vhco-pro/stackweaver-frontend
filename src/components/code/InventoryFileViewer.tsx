// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, WrapText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InventoryFileViewerProps {
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
  type: 'section' | 'key' | 'value' | 'string' | 'number' | 'comment' | 'punctuation' | 'indent' | 'text' | 'host';
  value: string;
}

// Detect file format (INI, CSV, or YAML)
function detectFormat(content: string): 'ini' | 'csv' | 'yaml' | 'unknown' {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return 'unknown';
  
  // Check for YAML format: starts with ---, has plugin: key, or has key: value pattern without = signs
  const firstNonComment = lines.find(l => !l.trim().startsWith('#'));
  if (firstNonComment) {
    const trimmed = firstNonComment.trim();
    if (trimmed === '---') return 'yaml';
    // YAML plugin files (dynamic inventory)
    if (/^plugin:\s/.test(trimmed)) return 'yaml';
  }
  // If most lines use key: value (not key=value) and there are no INI sections, it's probably YAML
  const colonLines = lines.filter(l => {
    const t = l.trim();
    return !t.startsWith('#') && /^\s*[\w-]+:/.test(t) && !t.includes('=');
  });
  const sectionLines = lines.filter(l => /^\[.+\]$/.test(l.trim()));
  if (colonLines.length > lines.length * 0.3 && sectionLines.length === 0) return 'yaml';
  
  // Check for INI format (sections like [groupname])
  if (sectionLines.length > 0) return 'ini';
  
  // Check for CSV format (comma-separated values)
  const hasCommas = lines.some(line => {
    const t = line.trim();
    return t.includes(',') && !t.startsWith('#');
  });
  if (hasCommas) return 'csv';
  
  // Default to INI for Ansible inventory files
  return 'ini';
}

// Tokenize an INI-style inventory line
function tokenizeIniLine(line: string): Token[] {
  const tokens: Token[] = [];
  
  // Handle empty lines
  if (line.trim() === '') {
    tokens.push({ type: 'text', value: line });
    return tokens;
  }
  
  const trimmed = line.trim();
  
  // Handle comments (full line or inline)
  const commentMatch = trimmed.match(/^([^#]*)(#.*)$/);
  if (commentMatch && commentMatch[2]) {
    // Has comment
    const mainPart = commentMatch[1].trimEnd();
    const comment = commentMatch[2];
    
    if (mainPart) {
      // Process main part first
      if (mainPart.startsWith('[') && mainPart.endsWith(']')) {
        // Section header
        tokens.push({ type: 'section', value: mainPart });
      } else {
        // Key-value or host
        const kvMatch = mainPart.match(/^([^=\s]+)\s*[=:]\s*(.*)$/);
        if (kvMatch) {
          tokens.push({ type: 'key', value: kvMatch[1] });
          tokens.push({ type: 'punctuation', value: mainPart.substring(kvMatch[1].length, mainPart.indexOf(kvMatch[2])) });
          tokenizeValue(kvMatch[2], tokens);
        } else {
          // Just a host name
          tokens.push({ type: 'host', value: mainPart });
        }
      }
    }
    
    tokens.push({ type: 'comment', value: comment });
    return tokens;
  }
  
  // Handle section headers [groupname] or [groupname:children]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const sectionContent = trimmed.slice(1, -1);
    const colonIdx = sectionContent.indexOf(':');
    
    if (colonIdx > -1) {
      // Has children
      tokens.push({ type: 'punctuation', value: '[' });
      tokens.push({ type: 'section', value: sectionContent.substring(0, colonIdx) });
      tokens.push({ type: 'punctuation', value: ':' });
      tokens.push({ type: 'text', value: sectionContent.substring(colonIdx + 1) });
      tokens.push({ type: 'punctuation', value: ']' });
    } else {
      // Regular section
      tokens.push({ type: 'section', value: trimmed });
    }
    return tokens;
  }
  
  // Handle key-value pairs (host variables)
  const kvMatch = trimmed.match(/^([^=\s]+)\s*[=:]\s*(.*)$/);
  if (kvMatch) {
    tokens.push({ type: 'key', value: kvMatch[1] });
    tokens.push({ type: 'punctuation', value: trimmed.substring(kvMatch[1].length, trimmed.indexOf(kvMatch[2])) });
    tokenizeValue(kvMatch[2], tokens);
    return tokens;
  }
  
  // Default: treat as host name
  tokens.push({ type: 'host', value: trimmed });
  return tokens;
}

// Tokenize a CSV-style line
function tokenizeCsvLine(line: string): Token[] {
  const tokens: Token[] = [];
  
  // Handle empty lines
  if (line.trim() === '') {
    tokens.push({ type: 'text', value: line });
    return tokens;
  }
  
  // Handle comments
  if (line.trim().startsWith('#')) {
    tokens.push({ type: 'comment', value: line });
    return tokens;
  }
  
  // Simple CSV parsing (split by comma, handle quoted values)
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  
  // Tokenize each part
  parts.forEach((part, idx) => {
    if (part.startsWith('"') && part.endsWith('"')) {
      tokens.push({ type: 'string', value: part });
    } else if (/^\d+(\.\d+)?$/.test(part)) {
      tokens.push({ type: 'number', value: part });
    } else {
      tokens.push({ type: 'text', value: part });
    }
    
    if (idx < parts.length - 1) {
      tokens.push({ type: 'punctuation', value: ', ' });
    }
  });
  
  return tokens;
}

// Tokenize a YAML line (for dynamic inventory plugin files)
function tokenizeYamlLine(line: string): Token[] {
  const tokens: Token[] = [];
  
  // Handle empty lines
  if (line.trim() === '') {
    tokens.push({ type: 'text', value: line });
    return tokens;
  }
  
  const trimmed = line.trim();
  
  // Handle document markers
  if (trimmed === '---' || trimmed === '...') {
    tokens.push({ type: 'punctuation', value: line });
    return tokens;
  }
  
  // Handle full-line comments
  if (trimmed.startsWith('#')) {
    tokens.push({ type: 'comment', value: line });
    return tokens;
  }
  
  // Preserve leading whitespace
  const indent = line.match(/^(\s*)/)?.[1] || '';
  if (indent) {
    tokens.push({ type: 'indent', value: indent });
  }
  
  const rest = line.slice(indent.length);
  
  // Handle list items (- value)
  if (rest.startsWith('- ')) {
    tokens.push({ type: 'punctuation', value: '- ' });
    const listValue = rest.slice(2);
    // Check if list item has a key: value
    const kvMatch = listValue.match(/^([\w][\w.-]*)\s*:\s*(.*?)(\s*#.*)?$/);
    if (kvMatch) {
      tokens.push({ type: 'key', value: kvMatch[1] });
      tokens.push({ type: 'punctuation', value: ': ' });
      if (kvMatch[2]) tokenizeYamlValue(kvMatch[2], tokens);
      if (kvMatch[3]) tokens.push({ type: 'comment', value: kvMatch[3] });
    } else {
      tokenizeYamlValue(listValue, tokens);
    }
    return tokens;
  }
  
  // Handle key: value
  const kvMatch = rest.match(/^([\w][\w.-]*)\s*:\s*(.*?)(\s*#.*)?$/);
  if (kvMatch) {
    tokens.push({ type: 'key', value: kvMatch[1] });
    tokens.push({ type: 'punctuation', value: ': ' });
    if (kvMatch[2]) tokenizeYamlValue(kvMatch[2], tokens);
    if (kvMatch[3]) tokens.push({ type: 'comment', value: kvMatch[3] });
    return tokens;
  }
  
  // Handle key-only (e.g., a mapping key with value on next line)
  const keyOnly = rest.match(/^([\w][\w.-]*):\s*$/);
  if (keyOnly) {
    tokens.push({ type: 'key', value: keyOnly[1] });
    tokens.push({ type: 'punctuation', value: ':' });
    return tokens;
  }
  
  // Handle inline comment after other content
  const commentMatch = rest.match(/^(.*?)\s+(#.*)$/);
  if (commentMatch) {
    tokenizeYamlValue(commentMatch[1], tokens);
    tokens.push({ type: 'comment', value: ' ' + commentMatch[2] });
    return tokens;
  }
  
  // Default: treat as value
  tokenizeYamlValue(rest, tokens);
  return tokens;
}

function tokenizeYamlValue(value: string, tokens: Token[]): void {
  value = value.trim();
  if (!value) return;
  
  // Boolean
  if (/^(true|false|yes|no|on|off)$/i.test(value)) {
    tokens.push({ type: 'number', value: value });
    return;
  }
  // Null
  if (/^(null|~)$/i.test(value)) {
    tokens.push({ type: 'number', value: value });
    return;
  }
  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    tokens.push({ type: 'number', value: value });
    return;
  }
  // Quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    tokens.push({ type: 'string', value: value });
    return;
  }
  // Jinja2 expressions {{ ... }}
  if (value.includes('{{')) {
    const parts = value.split(/({{.*?}})/);
    for (const part of parts) {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        tokens.push({ type: 'section', value: part });
      } else if (part) {
        tokens.push({ type: 'value', value: part });
      }
    }
    return;
  }
  // Plugin names (e.g., azure.azcollection.azure_rm)
  if (/^[\w]+\.[\w]+\.[\w]+$/.test(value)) {
    tokens.push({ type: 'section', value: value });
    return;
  }
  // Flow sequences/mappings
  if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
    tokens.push({ type: 'string', value: value });
    return;
  }
  // Comparison expressions (e.g., powerstate == "running")
  if (/==|!=|>=|<=|>|</.test(value)) {
    tokens.push({ type: 'string', value: value });
    return;
  }
  // Default: plain value
  tokens.push({ type: 'value', value: value });
}

function tokenizeValue(value: string, tokens: Token[]): void {
  value = value.trim();
  
  if (value.startsWith('"') || value.startsWith("'")) {
    tokens.push({ type: 'string', value: value });
  } else if (/^-?\d+(\.\d+)?$/.test(value)) {
    tokens.push({ type: 'number', value: value });
  } else {
    tokens.push({ type: 'value', value: value });
  }
}

// Color classes for different token types
const tokenColors: Record<Token['type'], string> = {
  section: 'text-purple-400 font-semibold',  // Section headers - purple
  key: 'text-sky-400',                        // Keys - blue
  value: 'text-gray-100',                     // Values - white
  string: 'text-emerald-400',                 // Quoted strings - green
  number: 'text-purple-400',                  // Numbers - purple
  comment: 'text-gray-500 italic',            // Comments - gray italic
  punctuation: 'text-gray-400',               // Punctuation - gray
  indent: '',                                 // Indentation - no color
  text: 'text-white',                         // Normal text - white
  host: 'text-blue-300',                      // Host names - light blue
};

export function InventoryFileViewer({
  content,
  className,
  maxHeight = '600px',
  showLineNumbers = true,
  showCopyButton = true,
  showWrapToggle = true,
}: InventoryFileViewerProps) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  
  const format = useMemo(() => detectFormat(content), [content]);
  
  const tokenizedLines = useMemo<TokenizedLine[]>(() => {
    const lines = content.split('\n');
    return lines.map((line, index) => ({
      lineNumber: index + 1,
      tokens: format === 'csv' ? tokenizeCsvLine(line) : format === 'yaml' ? tokenizeYamlLine(line) : tokenizeIniLine(line),
    }));
  }, [content, format]);
  
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

