// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Terraform Error Parser
 * 
 * Extracts user-friendly error messages from Terraform JSON logs and plain text output.
 * Filters out trace/debug logs and presents only actionable error information.
 * 
 * Implementation: frontend/src/utils/terraformErrorParser.ts
 */

export interface ParsedError {
  message: string;
  file?: string;
  line?: number;
  resource?: string;
  suggestion?: string;
}

export interface ParsedWarning {
  type: 'warning' | 'deprecation';
  message: string;
  file?: string;
  line?: number;
  resource?: string;
}

export interface ErrorParseResult {
  errors: ParsedError[];
  warnings: ParsedWarning[];
  fullTrace: string;
  hasTrace: boolean;
}

/**
 * Parses Terraform errors from JSON log format (JSONL - one JSON object per line)
 * Extracts errors with @level="error" and formats them for display
 */
function parseJsonLogErrors(logs: string): ParsedError[] {
  const errors: ParsedError[] = [];
  const lines = logs.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const logEntry = JSON.parse(trimmed);
      
      // Check if this is an error-level log
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (logEntry['@level'] === 'error' && logEntry['@message']) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const message = logEntry['@message'];
        
        // Skip diagnostic messages and trace/debug messages that aren't user-facing errors
        // Only include messages that look like actual Terraform errors
         
        if (typeof message === 'string' && 
            !message.includes('vertex') && 
            !message.includes('trace') &&
            !message.includes('diagnostic') &&
            !message.includes('Response contains error')) {
          // Only include if it looks like a real error (starts with "Error:" or contains error keywords)
          const messageStr = String(message);
          if (messageStr.match(/^Error:\s/i) || 
              messageStr.match(/\b(required|expected|invalid|unsupported|missing|failed|unable|cannot)\b/i)) {
            errors.push({
              message: messageStr,
            });
          }
        }
      }
    } catch {
      // Not JSON, skip
      continue;
    }
  }
  
  return errors;
}

/**
 * Parses Terraform errors from plain text format (human-readable)
 * Terraform error structure:
 *   Error: <message>
 *     (optional) with <resource>,
 *     on <file> line <line>, in <resource>:
 *     <line number>: <code>
 *     <detail lines>
 *   ╵
 */
function parsePlainTextErrors(logs: string): ParsedError[] {
  const errors: ParsedError[] = [];
  
  // Strip all ANSI escape codes from the entire log first
  // eslint-disable-next-line no-control-regex
  let cleanLogs = logs.replace(/\x1b\[[0-9;]*m/g, '');
  // Remove box drawing characters from start/end of lines
  cleanLogs = cleanLogs.replace(/^[╷│╵]\s*/gm, '').replace(/[╷│╵]\s*$/gm, '');
  const lines = cleanLogs.split('\n');
  
  let currentError: Partial<ParsedError> | null = null;
  let collectingDetail = false;
  let detailLines: string[] = [];
  let seenCodeLine = false;
  
  for (let i = 0; i < lines.length; i++) {
    // eslint-disable-next-line no-control-regex
    let line = lines[i].replace(/\x1b\[[0-9;]*m/g, ''); // Remove any remaining ANSI codes
    line = line.replace(/^[╷│╵\s]*/, '').replace(/[╷│╵\s]*$/, '').trim();
    
    // Skip JSON log lines
    if (line.startsWith('{') && (line.includes('"@level"') || line.includes('"@message"'))) {
      // End current error if we hit JSON logs
      if (currentError) {
        finishError(currentError, detailLines, errors);
        currentError = null;
        collectingDetail = false;
        detailLines = [];
        seenCodeLine = false;
      }
      continue;
    }
    
    // Treat Warning: as a boundary — stop collecting detail for current error
    const warningBoundary = line.match(/^Warning:\s/i);
    if (warningBoundary) {
      if (currentError) {
        finishError(currentError, detailLines, errors);
        currentError = null;
        collectingDetail = false;
        detailLines = [];
        seenCodeLine = false;
      }
      continue;
    }

    // Match error start: "Error: <message>"
    const errorMatch = line.match(/^Error:\s*(.+)$/i);
    if (errorMatch) {
      // Finish previous error if exists
      if (currentError) {
        finishError(currentError, detailLines, errors);
      }
      
      // Start new error
      currentError = {
        message: errorMatch[1] || '',
      };
      collectingDetail = false;
      detailLines = [];
      seenCodeLine = false;
      continue;
    }
    
    if (!currentError) continue;
    
    // Match "with" line: "with data.proxmox_virtual_environment_version.version,"
    if (line.includes('with ') && line.includes(',')) {
      const withMatch = line.match(/with\s+(.+?),/);
      if (withMatch && !currentError.resource) {
        currentError.resource = withMatch[1] || undefined;
      }
      continue;
    }
    
    // Match location: "on <file> line <line>, in <resource>:"
    if (line.includes('on ') && line.includes('line ')) {
      const locationMatch = line.match(/on\s+(.+?)\s+line\s+(\d+)(?:,\s+in\s+(.+?))?:/);
      if (locationMatch) {
        currentError.file = locationMatch[1] || undefined;
        currentError.line = parseInt(locationMatch[2] || '0', 10) || undefined;
        // Extract resource from "in resource "type" "name"" or "in data "type" "name"" format
        const resourceMatch = locationMatch[3]?.match(/(?:resource|data)\s+"([^"]+)"\s+"([^"]+)"/);
        if (resourceMatch) {
          currentError.resource = `${resourceMatch[1]}.${resourceMatch[2]}`;
        } else if (locationMatch[3] && !currentError.resource) {
          currentError.resource = locationMatch[3];
        }
      }
      continue;
    }
    
    // Match code line: "<line number>: <code>"
    if (/^\d+:\s+/.test(line)) {
      seenCodeLine = true;
      collectingDetail = true; // Start collecting detail after code line
      continue;
    }
    
    // Match suggestion: "Did you mean <suggestion>?"
    // IMPORTANT: Extract suggestion but still add the detail part to detailLines
    if (line.includes('Did you mean')) {
      // Extract suggestion from this line or next line
      const suggestionMatch = line.match(/Did you mean\s+"(.+?)"\?/);
      if (suggestionMatch) {
        currentError.suggestion = suggestionMatch[1] || undefined;
        // Extract the detail part BEFORE "Did you mean"
        const detailPart = line.split('Did you mean')[0].trim();
        if (detailPart && collectingDetail) {
          detailLines.push(detailPart);
        }
      } else {
        // Check if suggestion is on next line (format: "Did you mean\n"hostnames"?")
        const nextLine = i < lines.length - 1 ? lines[i + 1]?.replace(/^[╷│╵\s]*/, '').trim() : '';
        if (nextLine && (nextLine.startsWith('"') && nextLine.endsWith('"?'))) {
          currentError.suggestion = nextLine.slice(1, -2);
          // Add the current line (which contains "Did you mean") as detail
          if (line.trim() && collectingDetail) {
            detailLines.push(line.trim());
          }
          i++; // Skip next line (the suggestion)
        } else {
          // No suggestion found, add the whole line as detail
          if (line.trim() && collectingDetail) {
            detailLines.push(line.trim());
          }
        }
      }
      continue;
    }
    
    // End marker: "╵"
    if (line === '╵' || line.startsWith('╵')) {
      finishError(currentError, detailLines, errors);
      currentError = null;
      collectingDetail = false;
      detailLines = [];
      seenCodeLine = false;
      continue;
    }
    
    // Collect detail lines - everything after code line until end marker
    // OR if we haven't seen a code line yet, collect lines that look like detail
    if (collectingDetail || (seenCodeLine === false && line.length > 0 && !line.match(/^Error:/i))) {
      // Skip empty lines at the start
      if (detailLines.length === 0 && !line.trim()) {
        continue;
      }
      // Add non-empty lines as detail
      if (line.trim()) {
        detailLines.push(line.trim());
      }
    }
  }
  
  // Finish last error if exists
  if (currentError) {
    finishError(currentError, detailLines, errors);
  }
  
  return errors;
}

/**
 * Finishes processing an error by appending detail lines to the message
 */
function finishError(
  error: Partial<ParsedError>,
  detailLines: string[],
  errors: ParsedError[]
): void {
  if (!error.message) return;
  
  // Join detail lines with spaces
  if (detailLines.length > 0) {
    const detail = detailLines.join(' ').trim();
    if (detail) {
      // Append detail to message if not already included
      const messageLower = error.message.toLowerCase();
      const detailLower = detail.toLowerCase();
      if (!messageLower.includes(detailLower)) {
        // Add period if message doesn't end with punctuation
        const separator = error.message.match(/[.!?]$/) ? ' ' : '. ';
        error.message = error.message + separator + detail;
      }
    }
  }
  
  errors.push({
    message: error.message.trim(),
    file: error.file,
    line: error.line,
    resource: error.resource,
    suggestion: error.suggestion,
  });
}

/**
 * Parses Terraform warnings from plain text format (human-readable)
 * Warning structure is similar to errors:
 *   Warning: <summary>
 *     (optional) on <file> line <line>, in <resource>:
 *     <detail lines>
 *   ╵
 */
function parsePlainTextWarnings(logs: string): ParsedWarning[] {
  const warnings: ParsedWarning[] = [];

  // Strip all ANSI escape codes
  // eslint-disable-next-line no-control-regex
  let cleanLogs = logs.replace(/\x1b\[[0-9;]*m/g, '');
  cleanLogs = cleanLogs.replace(/^[╷│╵]\s*/gm, '').replace(/[╷│╵]\s*$/gm, '');
  const lines = cleanLogs.split('\n');

  let currentWarning: Partial<ParsedWarning> | null = null;
  let detailLines: string[] = [];

  for (const rawLine of lines) {
    // eslint-disable-next-line no-control-regex
    let line = rawLine.replace(/\x1b\[[0-9;]*m/g, '');
    line = line.replace(/^[╷│╵\s]*/, '').replace(/[╷│╵\s]*$/, '').trim();

    // Skip JSON log lines
    if (line.startsWith('{') && (line.includes('"@level"') || line.includes('"@message"'))) {
      if (currentWarning) {
        finishWarning(currentWarning, detailLines, warnings);
        currentWarning = null;
        detailLines = [];
      }
      continue;
    }

    // Match warning start: "Warning: <message>"
    const warningMatch = line.match(/^Warning:\s*(.+)$/i);
    if (warningMatch) {
      if (currentWarning) {
        finishWarning(currentWarning, detailLines, warnings);
      }
      const summary = warningMatch[1] || '';
      const isDeprecation = summary.toLowerCase().includes('deprecated') || summary.toLowerCase().includes('deprecation');
      currentWarning = {
        type: isDeprecation ? 'deprecation' : 'warning',
        message: summary,
      };
      detailLines = [];
      continue;
    }

    // If we hit an Error: line while collecting a warning, finish the warning
    if (line.match(/^Error:\s/i)) {
      if (currentWarning) {
        finishWarning(currentWarning, detailLines, warnings);
        currentWarning = null;
        detailLines = [];
      }
      continue;
    }

    if (!currentWarning) continue;

    // Match location: "on <file> line <line>, in <resource>:"
    if (line.includes('on ') && line.includes('line ')) {
      const locationMatch = line.match(/on\s+(.+?)\s+line\s+(\d+)(?:,\s+in\s+(.+?))?:/);
      if (locationMatch) {
        currentWarning.file = locationMatch[1] || undefined;
        currentWarning.line = parseInt(locationMatch[2] || '0', 10) || undefined;
        const resourceMatch = locationMatch[3]?.match(/(?:resource|data)\s+"([^"]+)"\s+"([^"]+)"/);
        if (resourceMatch) {
          currentWarning.resource = `${resourceMatch[1]}.${resourceMatch[2]}`;
        } else if (locationMatch[3]) {
          currentWarning.resource = locationMatch[3];
        }
      }
      continue;
    }

    // Skip code lines (e.g. "23: provider "azurerm"")
    if (/^\d+:\s+/.test(line)) continue;

    // End marker
    if (line === '╵' || line.startsWith('╵')) {
      finishWarning(currentWarning, detailLines, warnings);
      currentWarning = null;
      detailLines = [];
      continue;
    }
    // Stop collecting at horizontal rules or Terraform output lines that follow warnings
    if (/^[─━─]{3,}/.test(line) || line.startsWith('Saved the plan to:') || line.startsWith('To perform exactly these actions')) {
      finishWarning(currentWarning, detailLines, warnings);
      currentWarning = null;
      detailLines = [];
      continue;
    }
    // Collect detail lines
    if (line.trim()) {
      detailLines.push(line.trim());
    }
  }

  if (currentWarning) {
    finishWarning(currentWarning, detailLines, warnings);
  }

  return warnings;
}

/**
 * Finishes processing a warning by appending detail lines
 */
function finishWarning(
  warning: Partial<ParsedWarning>,
  detailLines: string[],
  warnings: ParsedWarning[]
): void {
  if (!warning.message) return;

  if (detailLines.length > 0) {
    const detail = detailLines.join(' ').trim();
    if (detail) {
      const messageLower = warning.message.toLowerCase();
      const detailLower = detail.toLowerCase();
      if (!messageLower.includes(detailLower)) {
        const separator = warning.message.match(/[.!?]$/) ? ' ' : '. ';
        warning.message = warning.message + separator + detail;
      }
    }
  }

  warnings.push({
    type: warning.type || 'warning',
    message: warning.message.trim(),
    file: warning.file,
    line: warning.line,
    resource: warning.resource,
  });
}

/**
 * Fallback: extract errors from JSON logs that contain error messages
 */
function extractErrorsFromJsonLogs(logs: string): ParsedError[] {
  const errors: ParsedError[] = [];
  const lines = logs.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) continue;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const logEntry = JSON.parse(trimmed);
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const level = logEntry['@level'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const message = logEntry['@message'];
      
      // Look for error-level logs that contain actual Terraform errors
       
      if (level === 'error' && typeof message === 'string' && message.includes('Error:')) {
        // Try to extract the error message from the JSON log message
        const errorMatch = String(message).match(/Error:\s*(.+?)(?:\n|$)/);
        if (errorMatch) {
          errors.push({
            message: errorMatch[1] || String(message),
          });
        }
      }
    } catch {
      // Not valid JSON, skip
      continue;
    }
  }
  
  return errors;
}

/**
 * Main function to parse Terraform errors from logs
 * Tries plain text parsing first (most reliable), falls back to JSON parsing
 */
export function parseTerraformErrors(logs: string): ErrorParseResult {
  if (!logs || logs.trim().length === 0) {
    return {
      errors: [],
      warnings: [],
      fullTrace: logs,
      hasTrace: false,
    };
  }

  // Parse warnings from plain text (always, regardless of error source)
  const plainTextWarnings = parsePlainTextWarnings(logs);
  
  // Try plain text parsing first (most reliable for human-readable Terraform output)
  const plainTextErrors = parsePlainTextErrors(logs);
  
  // If we found errors in plain text, prioritize those and skip JSON parsing
  // (JSON logs often contain diagnostic messages that aren't user-facing errors)
  if (plainTextErrors.length > 0) {
    // Only use plain text errors, skip JSON log parsing to avoid false positives
    return {
      errors: plainTextErrors,
      warnings: plainTextWarnings,
      fullTrace: logs,
      hasTrace: logs.includes('"@level":"trace"') || 
               logs.includes('"@level":"debug"') ||
               logs.split('\n').length > 100,
    };
  }
  
  // Fallback: try JSON log parsing if no plain text errors found
  const jsonErrors = parseJsonLogErrors(logs);
  const fallbackErrors = extractErrorsFromJsonLogs(logs);
  
  // Combine and deduplicate errors
  const allErrors = [...jsonErrors, ...fallbackErrors];
  const uniqueErrors: ParsedError[] = [];
  const seenMessages = new Set<string>();
  
  for (const error of allErrors) {
    // Create a unique key based on message, file, and line
    const messageKey = error.message.substring(0, 100).toLowerCase().trim(); // Use first 100 chars for comparison
    const key = `${messageKey}|${error.file || ''}|${error.line || ''}`;
    if (!seenMessages.has(key)) {
      seenMessages.add(key);
      uniqueErrors.push(error);
    }
  }
  
  // Determine if there's a full trace (lots of JSON log entries or trace messages)
  const hasTrace = logs.includes('"@level":"trace"') || 
                   logs.includes('"@level":"debug"') ||
                   logs.split('\n').length > 100;
  
  return {
    errors: uniqueErrors,
    warnings: plainTextWarnings,
    fullTrace: logs,
    hasTrace,
  };
}
