// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { JsonSyntaxHighlighter } from '@/components/code/JsonSyntaxHighlighter';

interface ResourceDiffViewProps {
  before: unknown;
  after: unknown;
  afterUnknown?: Record<string, unknown>;
  isCreate?: boolean;
  isDelete?: boolean;
  resourceAddress?: string;
}

interface DiffLine {
  type: 'normal' | 'changed' | 'unknown' | 'unchanged-marker';
  line: string;
  indent: string;
  key?: string;
  beforeValue?: string;
  afterValue?: string;
  unchangedKeys?: string[];
  unchangedCount?: number;
  unchangedValues?: Array<{ key: string; value: unknown; isUnknown?: boolean }>;
  isCreate?: boolean; // Track if this is a create operation (no tilde needed)
}

/**
 * Build diff lines with metadata for rendering
 */
function buildDiffLines(
  before: unknown,
  after: unknown,
  afterUnknown?: Record<string, unknown>,
  indent: number = 0,
  showUnchanged: boolean = false,
  isCreate: boolean = false
): DiffLine[] {
  const indentStr = '  '.repeat(indent);
  const lines: DiffLine[] = [];

  // Handle create (only after exists)
  if ((before === null || before === undefined) && after !== null && after !== undefined) {
    return formatObjectLines(after, afterUnknown, indent, isCreate);
  }

  // Handle delete (only before exists)
  if ((after === null || after === undefined) && before !== null && before !== undefined) {
    lines.push({ type: 'normal', line: JSON.stringify(before, null, 2), indent: '' });
    return lines;
  }

  // Handle update (both exist)
  if (typeof before === 'object' && typeof after === 'object' && before !== null && after !== null) {
    if (Array.isArray(before) && Array.isArray(after)) {
      lines.push({ type: 'normal', line: JSON.stringify(after, null, 2), indent: '' });
      return lines;
    }

    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;
    // Include keys from afterUnknown that might not be in afterObj
    const unknownKeys = afterUnknown ? Object.keys(afterUnknown) : [];
    const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj), ...unknownKeys]);
    const changedKeys = new Set<string>();
    const unchangedKeys: string[] = [];
    const unchangedValues: Array<{ key: string; value: unknown; isUnknown?: boolean }> = [];
    
      // Find changed keys
      for (const key of allKeys) {
        const inBefore = key in beforeObj;
        const inAfter = key in afterObj;
        const isUnknown = afterUnknown && key in afterUnknown;
        
        // If key is only in afterUnknown (not in afterObj), it's a new unknown field
        if (!inBefore && !inAfter && isUnknown) {
          changedKeys.add(key);
        } 
        // If key is in before and becomes unknown, it's ALWAYS a change (known -> unknown)
        // Even if the value in afterObj is the same, if it's in after_unknown, it will be recomputed
        else if (inBefore && isUnknown) {
          changedKeys.add(key);
        }
        // Standard change detection
        else if (!inBefore || !inAfter || JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key])) {
          changedKeys.add(key);
        } else {
          unchangedKeys.push(key);
          unchangedValues.push({ key, value: beforeObj[key], isUnknown });
        }
      }

    lines.push({ type: 'normal', line: '{', indent: indentStr });

    // Show changed keys
    for (const key of allKeys) {
      if (!changedKeys.has(key) && !showUnchanged) continue;

      const beforeVal = beforeObj[key];
      const afterVal = afterObj[key];
      const isUnknown = afterUnknown && key in afterUnknown;

      if (!(key in beforeObj)) {
        // Added - check if it's in afterObj or only in afterUnknown
        if (isUnknown) {
          lines.push({
            type: 'unknown',
            line: `"${key}": → unknown (computed at apply time)`,
            indent: indentStr + '  ',
            key
          });
        } else if (key in afterObj) {
          lines.push({
            type: 'normal',
            line: `"${key}": ${formatValue(afterVal, indent + 1)}`,
            indent: indentStr + '  '
          });
        }
        // If key is only in afterUnknown (not in afterObj), it's already handled above
      } else if (!(key in afterObj)) {
        // Removed
        lines.push({
          type: 'normal',
          line: `"${key}": ${formatValue(beforeVal, indent + 1)}`,
          indent: indentStr + '  '
        });
      } else if (isUnknown && (key in beforeObj)) {
        // Changed from known value to unknown - show inline with arrow (and tilde if not create)
        // Handle both primitive and complex values
        if (isPrimitive(beforeVal)) {
          const beforeStr = formatPrimitive(beforeVal);
          lines.push({
            type: 'changed',
            line: `"${key}": ${beforeStr} → unknown (computed at apply time)`,
            indent: indentStr + '  ',
            key,
            beforeValue: beforeStr,
            afterValue: 'unknown (computed at apply time)',
            isCreate
          });
        } else {
          // Complex value becoming unknown - recurse into it to show each field that will change
          // Extract the unknown subset for nested fields
          const unknownSubset = afterUnknown && typeof afterUnknown[key] === 'object' && afterUnknown[key] !== null
            ? afterUnknown[key] as Record<string, unknown>
            : undefined;
          
        // Show the key with opening brace - mark as changed if it's a change (not create)
        lines.push({
          type: isCreate ? 'normal' : 'changed',
          line: `"${key}": {`,
          indent: indentStr + '  ',
          key,
          isCreate
        });
          
          // Recurse into the before value to show each field
          if (typeof beforeVal === 'object' && beforeVal !== null && !Array.isArray(beforeVal)) {
            const beforeObj = beforeVal as Record<string, unknown>;
            const allNestedKeys = new Set([...Object.keys(beforeObj), ...(unknownSubset ? Object.keys(unknownSubset) : [])]);
            
            // Sort keys for consistent display
            const sortedNestedKeys = Array.from(allNestedKeys).sort();
            
            sortedNestedKeys.forEach((nestedKey) => {
              const nestedBeforeVal = beforeObj[nestedKey];
              const nestedIsUnknown = unknownSubset && nestedKey in unknownSubset;
              
              if (nestedIsUnknown) {
                // This nested field is unknown - show it with → indicator
                if (isPrimitive(nestedBeforeVal)) {
                  const nestedBeforeStr = formatPrimitive(nestedBeforeVal);
                  lines.push({
                    type: 'changed',
                    line: `"${nestedKey}": ${nestedBeforeStr} → unknown (computed at apply time)`,
                    indent: indentStr + '    ', // 4 spaces for nested level
                    key: nestedKey,
                    beforeValue: nestedBeforeStr,
                    afterValue: 'unknown (computed at apply time)',
                    isCreate
                  });
                } else {
                  // Nested complex value - recurse further
                  const nestedUnknownSubset = unknownSubset && typeof unknownSubset[nestedKey] === 'object' && unknownSubset[nestedKey] !== null
                    ? unknownSubset[nestedKey] as Record<string, unknown>
                    : undefined;
                  const nestedNestedLines = buildDiffLines(nestedBeforeVal, nestedBeforeVal, nestedUnknownSubset, indent + 2, showUnchanged, isCreate);
                  // Skip the opening brace from nested lines since we're already in an object
                  const nestedLinesToAdd = nestedNestedLines.filter((line, idx) => {
                    // Skip first '{' and last '}'
                    if (idx === 0 && line.line === '{') return false;
                    if (idx === nestedNestedLines.length - 1 && line.line === '}') return false;
                    return true;
                  });
                  
                  nestedLinesToAdd.forEach(nestedNested => {
                    lines.push({
                      ...nestedNested,
                      indent: indentStr + '    ' + nestedNested.indent.substring((indent + 2) * 2),
                      isCreate: nestedNested.isCreate ?? isCreate
                    });
                  });
                }
              } else if (nestedBeforeVal !== undefined) {
                // Nested field is not unknown - show it normally
                lines.push({
                  type: 'normal',
                  line: `"${nestedKey}": ${formatValue(nestedBeforeVal, indent + 2)}`,
                  indent: indentStr + '    ',
                  isCreate
                });
              }
            });
          }
          
          // Close the object
          lines.push({
            type: 'normal',
            line: '}',
            indent: indentStr + '  ',
            isCreate
          });
        }
      } else if (isPrimitive(beforeVal) && isPrimitive(afterVal) && beforeVal !== afterVal) {
        // Changed primitive - show inline with arrow (and tilde if not create)
        const beforeStr = formatPrimitive(beforeVal);
        const afterStr = isUnknown 
          ? 'unknown (computed at apply time)'
          : formatPrimitive(afterVal);
        lines.push({
          type: 'changed',
            line: `"${key}": ${beforeStr} → ${afterStr}`,
          indent: indentStr + '  ',
          key,
          beforeValue: beforeStr,
          afterValue: afterStr,
          isCreate
        });
      } else if (beforeVal !== afterVal) {
        // Changed complex - recurse
        // Extract the unknown subset for this key if it exists
        const unknownSubset = isUnknown && afterUnknown && typeof afterUnknown[key] === 'object' && afterUnknown[key] !== null
          ? afterUnknown[key] as Record<string, unknown>
          : (isUnknown ? afterUnknown : undefined);
        
        const nestedLines = buildDiffLines(beforeVal, afterVal, unknownSubset, indent + 1, showUnchanged, isCreate);
        
        // Check if any nested lines are actually changed or unknown (not just normal)
        const hasNestedChanges = nestedLines.some(nested => 
          nested.type === 'changed' || nested.type === 'unknown'
        );
        
        // Show the key with opening brace
        // Mark parent as changed if:
        // 1. It's not a create operation, AND
        // 2. Either nested content has changes OR the object itself changed
        // This ensures parent blocks show tilde when their children change
        const shouldMarkAsChanged = !isCreate && (hasNestedChanges || beforeVal !== afterVal);
        lines.push({
          type: shouldMarkAsChanged ? 'changed' : 'normal',
          line: `"${key}": {`,
          indent: indentStr + '  ',
          key,
          isCreate
        });
        
        // Add nested lines with proper indentation
        // Nested content should be indented 4 spaces from the parent key (2 for parent level + 2 for nested level)
        const nestedIndentBase = indentStr + '    '; // 4 spaces total for first level of nesting
        
        nestedLines.forEach((nested, nestedIdx) => {
          // Skip the first line if it's just '{'
          if (nestedIdx === 0 && nested.line === '{') {
            return;
          }
          // Skip the last line if it's just '}'
          if (nestedIdx === nestedLines.length - 1 && nested.line === '}') {
            // Add the closing brace with proper indent (2 spaces from parent key)
            lines.push({
              type: 'normal',
              line: '}',
              indent: indentStr + '  ',
              isCreate
            });
            return;
          }
          
          // For nested lines, the indent from buildDiffLines is relative to indent+1
          // We need to convert it to be relative to our current level
          // nested.indent has (indent+1)*2 spaces as base, we want to replace that with nestedIndentBase
          const nestedBaseIndentLength = (indent + 1) * 2;
          
          // Extract any additional indentation beyond the base
          let nestedRelativeIndent = '';
          if (nested.indent.length > nestedBaseIndentLength) {
            nestedRelativeIndent = nested.indent.substring(nestedBaseIndentLength);
          }
          
          // Combine: base indent for nested level (4 spaces from parent key) + any additional relative indent
          const finalIndent = nestedIndentBase + nestedRelativeIndent;
          
          lines.push({
            ...nested,
            indent: finalIndent,
            isCreate: nested.isCreate ?? isCreate
          });
        });
      } else {
        // Unchanged - but only if it's not in after_unknown
        // If it's in after_unknown, it should have been caught as a change above
        if (isUnknown) {
          // This shouldn't happen if logic is correct, but handle it just in case
          // Don't show it as unchanged if it's unknown - it should be a change
          continue; // Skip this key, it should have been handled as a change
        } else {
          lines.push({
            type: 'normal',
            line: `"${key}": ${formatValue(beforeVal, indent + 1)}`,
            indent: indentStr + '  ',
            isCreate
          });
        }
      }
    }

    // Add unchanged marker if there are hidden unchanged keys
    if (unchangedKeys.length > 0 && !showUnchanged) {
      lines.push({
        type: 'unchanged-marker',
        line: `... ${unchangedKeys.length} unchanged attribute${unchangedKeys.length !== 1 ? 's' : ''} hidden`,
        indent: indentStr + '  ',
        unchangedKeys,
        unchangedCount: unchangedKeys.length,
        unchangedValues
      });
    }

    lines.push({ type: 'normal', line: '}', indent: indentStr });
    return lines;
  }

  // Primitives
  if (before !== after) {
    lines.push({
      type: 'changed',
      line: `${formatPrimitive(before)} → ${formatPrimitive(after)}`,
      indent: indentStr,
      beforeValue: formatPrimitive(before),
      afterValue: formatPrimitive(after)
    });
  } else {
    lines.push({ type: 'normal', line: formatPrimitive(before), indent: indentStr });
  }

  return lines;
}

/**
 * Format an object into lines with unknown markers
 */
function formatObjectLines(
  obj: unknown,
  afterUnknown?: Record<string, unknown>,
  indent: number = 0,
  isCreate: boolean = false
): DiffLine[] {
  const lines: DiffLine[] = [];
  const indentStr = '  '.repeat(indent);

  if (typeof obj !== 'object' || obj === null) {
    lines.push({ type: 'normal', line: JSON.stringify(obj), indent: '' });
    return lines;
  }

  if (Array.isArray(obj)) {
    lines.push({ type: 'normal', line: JSON.stringify(obj, null, 2), indent: '' });
    return lines;
  }

  const objRecord = obj as Record<string, unknown>;
  const objKeys = Object.keys(objRecord);
  // Include keys from afterUnknown that might not be in the object
  const unknownKeys = afterUnknown ? Object.keys(afterUnknown) : [];
  const allKeys = new Set([...objKeys, ...unknownKeys]);
  
  if (allKeys.size === 0) {
    lines.push({ type: 'normal', line: '{}', indent: indentStr });
    return lines;
  }

  lines.push({ type: 'normal', line: '{', indent: indentStr });
  
  // Sort keys for consistent display
  const sortedKeys = Array.from(allKeys).sort();
  
  sortedKeys.forEach((key) => {
    const isUnknown = afterUnknown && key in afterUnknown;
    if (isUnknown) {
      lines.push({
        type: 'unknown',
        line: `"${key}": → unknown (computed at apply time)`,
        indent: indentStr + '  ',
        key,
        isCreate
      });
    } else if (key in objRecord) {
      lines.push({
        type: 'normal',
        line: `"${key}": ${formatValue(objRecord[key], indent + 1)}`,
        indent: indentStr + '  ',
        isCreate
      });
    }
  });

  lines.push({ type: 'normal', line: '}', indent: indentStr });
  return lines;
}

function isPrimitive(value: unknown): boolean {
  return value === null || value === undefined || 
         typeof value === 'string' || typeof value === 'number' || 
         typeof value === 'boolean';
}

function formatPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
}

function formatValue(value: unknown, indent: number): string {
  if (isPrimitive(value)) {
    return formatPrimitive(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const indentStr = '  '.repeat(indent);
    const items = value.map(item => `${indentStr}  ${formatValue(item, indent + 1)}`).join(',\n');
    return `[\n${items}\n${indentStr}]`;
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Render diff lines with syntax highlighting and interactive elements
 */
function DiffLinesRenderer({ 
  lines, 
  onToggleUnchanged
}: { 
  lines: DiffLine[];
  onToggleUnchanged: () => void;
}) {
  const [expandedUnchanged, setExpandedUnchanged] = useState<Set<string>>(new Set());

  const handleToggleUnchanged = (markerKey: string) => {
    const newExpanded = new Set(expandedUnchanged);
    if (newExpanded.has(markerKey)) {
      newExpanded.delete(markerKey);
    } else {
      newExpanded.add(markerKey);
    }
    setExpandedUnchanged(newExpanded);
    onToggleUnchanged();
  };

  // Build expanded lines including unchanged attributes when expanded
  const expandedLines: DiffLine[] = [];
  lines.forEach((line) => {
    if (line.type === 'unchanged-marker' && line.unchangedKeys && line.unchangedValues) {
      const markerKey = line.unchangedKeys.join(',');
      const isExpanded = expandedUnchanged.has(markerKey);
      
      // Add the marker line
      expandedLines.push(line);
      
      // If expanded, add the unchanged attributes inline with proper indentation
      if (isExpanded) {
        line.unchangedValues.forEach(({ key, value, isUnknown }) => {
          // Use the same indent as the marker line (which is already at the correct level)
          const valueIndent = line.indent;
          
          if (isUnknown) {
            expandedLines.push({
              type: 'unknown',
              line: `"${key}": → unknown (computed at apply time)`,
              indent: valueIndent,
              key
            });
          } else {
            // For primitive values, format inline; for complex, use JSON.stringify with proper indentation
            if (isPrimitive(value)) {
              expandedLines.push({
                type: 'normal',
                line: `"${key}": ${formatPrimitive(value)}`,
                indent: valueIndent
              });
            } else {
              // For complex values, format them with proper indentation
              const indentLevel = valueIndent.length / 2;
              const formattedValue = formatValue(value, indentLevel + 1);
              // Split the formatted value into lines
              const valueLines = formattedValue.split('\n');
              if (valueLines.length === 1) {
                // Single line value
                expandedLines.push({
                  type: 'normal',
                  line: `"${key}": ${formattedValue}`,
                  indent: valueIndent
                });
              } else {
                // Multi-line value - format it properly using JSON.stringify
                const jsonString = JSON.stringify(value, null, 2);
                const jsonLines = jsonString.split('\n');
                
                if (jsonLines.length === 1) {
                  // Single line
                  expandedLines.push({
                    type: 'normal',
                    line: `"${key}": ${jsonString}`,
                    indent: valueIndent
                  });
                } else {
                  // Multi-line: first line with key and opening brace/bracket
                  expandedLines.push({
                    type: 'normal',
                    line: `"${key}": ${jsonLines[0]}`,
                    indent: valueIndent
                  });
                  // Add remaining lines - JSON.stringify already provides proper 2-space indentation
                  // Each line will have the base indent (valueIndent) plus its JSON indentation
                  jsonLines.slice(1).forEach(jsonLine => {
                    expandedLines.push({
                      type: 'normal',
                      line: jsonLine, // jsonLine already has its own indentation from JSON.stringify
                      indent: valueIndent // base indent is added separately in rendering
                    });
                  });
                }
              }
            }
          }
        });
      }
    } else {
      expandedLines.push(line);
    }
  });

  return (
    <div className="font-mono text-sm">
      <pre className="whitespace-pre">
        {expandedLines.map((line, idx) => {
          // Unchanged marker - make it clickable
          if (line.type === 'unchanged-marker' && line.unchangedKeys) {
            const markerKey = line.unchangedKeys.join(',');
            const isExpanded = expandedUnchanged.has(markerKey);
            return (
              <div 
                key={idx} 
                className="flex items-center cursor-pointer hover:bg-muted/50 px-1 rounded-sm group"
                onClick={() => handleToggleUnchanged(markerKey)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground mr-1" />
                )}
                <span className="text-muted-foreground italic">{line.indent}{line.line}</span>
              </div>
            );
          }

          // Unknown value line
          if (line.type === 'unknown') {
            const keyMatch = line.line.match(/^"([^"]+)":\s*→\s*unknown \(computed at apply time\)/);
            if (keyMatch) {
              const [, key] = keyMatch;
              const showTilde = !line.isCreate;
              return (
                <div key={idx} className="flex items-center">
                  <span className="text-muted-foreground whitespace-pre">{line.indent}</span>
                  {/* Reserve space for tilde - always show space, tilde only when needed */}
                  <span className="inline-block w-3 mr-2 text-right">
                    {showTilde && (
                      <span className="text-blue-400 dark:text-blue-300 font-mono">~</span>
                    )}
                  </span>
                  <span className="text-orange-600 dark:text-orange-400">"{key}"</span>
                  <span className="text-muted-foreground">: </span>
                  <span className="text-blue-500 dark:text-blue-400 mx-1">→</span>
                  <span className="text-yellow-600 dark:text-yellow-400 italic">unknown (computed at apply time)</span>
                </div>
              );
            }
          }

          // Changed line - check if it's a key with opening brace first (parent blocks)
          if (line.type === 'changed' && line.line.match(/^"([^"]+)":\s*\{$/)) {
            const keyMatch = line.line.match(/^"([^"]+)":\s*\{$/);
            if (keyMatch) {
              const [, key] = keyMatch;
              const showTilde = !line.isCreate;
              return (
                <div key={idx} className="flex items-center">
                  <span className="text-muted-foreground whitespace-pre">{line.indent}</span>
                  {/* Reserve space for tilde - always show space, tilde only when needed */}
                  <span className="inline-block w-3 mr-2 text-right">
                    {showTilde && (
                      <span className="text-blue-400 dark:text-blue-300 font-mono">~</span>
                    )}
                  </span>
                  <span className="text-orange-600 dark:text-orange-400">"{key}"</span>
                  <span className="text-muted-foreground">: </span>
                  <span className="text-blue-600 dark:text-blue-400">{'{'}</span>
                </div>
              );
            }
          }

          // Changed line with arrow
          if (line.type === 'changed') {
            // Show tilde character for change diffs (not creates)
            const showTilde = !line.isCreate;
            
            // Always try to parse from line first (most reliable)
            // Match pattern: "key": beforeValue → afterValue
            const match = line.line.match(/^"([^"]+)":\s*(.+?)\s*→\s*(.+)$/);
            if (match) {
              const [, key, beforeVal, afterVal] = match;
              return (
                <div key={idx} className="flex items-center flex-wrap">
                  <span className="text-muted-foreground whitespace-pre">{line.indent}</span>
                  {/* Reserve space for tilde - always show space, tilde only when needed */}
                  <span className="inline-block w-3 mr-2 text-right">
                    {showTilde && (
                      <span className="text-blue-400 dark:text-blue-300 font-mono">~</span>
                    )}
                  </span>
                  <span className="text-orange-600 dark:text-orange-400">"{key}"</span>
                  <span className="text-muted-foreground">: </span>
                  <span className="inline-block">
                    <JsonSyntaxHighlighter 
                      json={beforeVal.trim()} 
                      maxHeight="none"
                      className="bg-transparent p-0 inline"
                    />
                  </span>
                  <span className="text-blue-500 dark:text-blue-400 mx-1">→</span>
                  <span className="inline-block">
                    {afterVal.includes('unknown') ? (
                      <span className="text-yellow-600 dark:text-yellow-400 italic">{afterVal}</span>
                    ) : (
                      <JsonSyntaxHighlighter 
                        json={afterVal.trim()} 
                        maxHeight="none"
                        className="bg-transparent p-0 inline"
                      />
                    )}
                  </span>
                </div>
              );
            }
            // Fallback: use stored values if available
            if (line.beforeValue !== undefined && line.afterValue !== undefined && line.key) {
              return (
                <div key={idx} className="flex items-center flex-wrap">
                  <span className="text-muted-foreground whitespace-pre">{line.indent}</span>
                  {/* Reserve space for tilde - always show space, tilde only when needed */}
                  <span className="inline-block w-3 mr-2 text-right">
                    {showTilde && (
                      <span className="text-blue-400 dark:text-blue-300 font-mono">~</span>
                    )}
                  </span>
                  <span className="text-orange-600 dark:text-orange-400">"{line.key}"</span>
                  <span className="text-muted-foreground">: </span>
                  <span className="inline-block">
                    <JsonSyntaxHighlighter 
                      json={line.beforeValue.trim()} 
                      maxHeight="none"
                      className="bg-transparent p-0 inline"
                    />
                  </span>
                  <span className="text-blue-500 dark:text-blue-400 mx-1">→</span>
                  <span className="inline-block">
                    {line.afterValue.includes('unknown') ? (
                      <span className="text-yellow-600 dark:text-yellow-400 italic">{line.afterValue}</span>
                    ) : (
                      <JsonSyntaxHighlighter 
                        json={line.afterValue.trim()} 
                        maxHeight="none"
                        className="bg-transparent p-0 inline"
                      />
                    )}
                  </span>
                </div>
              );
            }
            // Final fallback: render the whole line (shouldn't happen)
            return (
              <div key={idx} className="flex items-center">
                <span className="text-muted-foreground">{line.indent}</span>
                <JsonSyntaxHighlighter 
                  json={line.line} 
                  maxHeight="none"
                  className="bg-transparent p-0"
                />
              </div>
            );
          }

          // Regular line - check if it contains an arrow for inline diff
          // Check if line has format: "key": value or just value
          const keyValueMatch = line.line.match(/^"([^"]+)":\s*(.+)$/);
          if (keyValueMatch) {
            const [, key, value] = keyValueMatch;
            // Check if value contains arrow (for changed values)
            if (value.includes('→')) {
              const parts = value.split('→').map(s => s.trim());
              if (parts.length === 2) {
                // Show tilde for change diffs (not creates)
                const showTilde = !line.isCreate;
                return (
                  <div key={idx} className="flex items-center flex-wrap">
                    <span className="text-muted-foreground whitespace-pre">{line.indent}</span>
                    {/* Reserve space for tilde - always show space, tilde only when needed */}
                    <span className="inline-block w-3 mr-1 text-right">
                      {showTilde && (
                        <span className="text-blue-400 dark:text-blue-300 font-mono">~</span>
                      )}
                    </span>
                    <span className="text-orange-600 dark:text-orange-400">"{key}"</span>
                    <span className="text-muted-foreground">: </span>
                    <span className="inline-block">
                      <JsonSyntaxHighlighter 
                        json={parts[0].trim()} 
                        maxHeight="none"
                        className="bg-transparent p-0 inline"
                      />
                    </span>
                    <span className="text-blue-500 dark:text-blue-400 mx-1">→</span>
                    <span className="inline-block">
                      {parts[1].includes('unknown') ? (
                        <span className="text-yellow-600 dark:text-yellow-400 italic">{parts[1]}</span>
                      ) : (
                        <JsonSyntaxHighlighter 
                          json={parts[1].trim()} 
                          maxHeight="none"
                          className="bg-transparent p-0 inline"
                        />
                      )}
                    </span>
                  </div>
                );
              }
            }
          }
          
          // Regular line - check if it starts with a key (to reserve tilde space)
          const keyMatch = (line.line).match(/^"([^"]+)":/);
          const isKeyLine = keyMatch !== null;
          
          return (
            <div key={idx} className="flex items-start">
              <span className="text-muted-foreground whitespace-pre">{line.indent}</span>
              {/* Reserve space for tilde on key lines to maintain alignment */}
              {isKeyLine && (
                <span className="inline-block w-3 mr-2"></span>
              )}
              <div className="flex-1">
                <JsonSyntaxHighlighter 
                  json={line.line} 
                  maxHeight="none"
                  className="bg-transparent p-0"
                />
              </div>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

export function ResourceDiffView({ 
  before, 
  after, 
  afterUnknown,
  isCreate = false
}: ResourceDiffViewProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);

  const diffLines = useMemo(() => {
    return buildDiffLines(before, after, afterUnknown, 0, showUnchanged, isCreate);
  }, [before, after, afterUnknown, showUnchanged, isCreate]);

  const handleToggleUnchanged = () => {
    // Toggle showUnchanged to show/hide the unchanged attributes
    setShowUnchanged(!showUnchanged);
  };

  // Only render if there's actual content to show
  if (!before && !after) {
    return null;
  }

  return (
    <div className="mt-3">
      {/* Diff Content with Syntax Highlighting - No header, always expanded */}
      <div className="bg-muted/30 border rounded-md overflow-hidden">
        <div className="p-4 overflow-auto max-h-[500px] relative">
          <DiffLinesRenderer
            lines={diffLines}
            onToggleUnchanged={handleToggleUnchanged}
          />
        </div>
      </div>
    </div>
  );
}
