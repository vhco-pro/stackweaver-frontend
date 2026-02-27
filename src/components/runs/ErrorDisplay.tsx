// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Error Display Component
 * 
 * Displays parsed Terraform errors in a user-friendly format with option to download full trace.
 * Matches Terraform Enterprise's error display style.
 * 
 * Implementation: frontend/src/components/runs/ErrorDisplay.tsx
 */

import { XCircle, Download, AlertTriangle, Lightbulb } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { parseTerraformErrors, type ParsedError } from '@/utils/terraformErrorParser';

interface ErrorDisplayProps {
  logs: string;
  title?: string;
  className?: string;
}

export function ErrorDisplay({ logs, title = 'Error', className }: ErrorDisplayProps) {
  const parseResult = parseTerraformErrors(logs);
  const { errors, warnings, fullTrace, hasTrace } = parseResult;
  
  const handleDownload = () => {
    const blob = new Blob([fullTrace], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terraform-error-trace-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Only show errors here — warnings are displayed in the top-level banner in RunDetail
  // If no errors found (only warnings, or nothing), don't show the error panel at all
  if (errors.length === 0) {
    // If there are no warnings either, show the fallback "unable to parse" message
    if (warnings.length === 0) {
      return (
        <div className={`border border-red-500/50 rounded-lg p-4 bg-red-500/10 ${className || ''}`}>
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">{title}</h3>
              <p className="text-red-800 dark:text-red-300 text-sm mb-3">
                Unable to parse error details. Use the download button to view the full error trace.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="text-xs"
              >
                <Download className="h-3 w-3 mr-1.5" />
                Download Full Trace
              </Button>
            </div>
          </div>
        </div>
      );
    }
    // Only warnings, no errors — don't render any error panel
    return null;
  }
  
  return (
    <div className={`border border-red-500/50 rounded-lg overflow-hidden bg-red-500/10 ${className || ''}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 flex-1">
            <XCircle className="h-5 w-5 text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-700 dark:text-red-400">
                {title}{errors.length > 1 ? ` (${errors.length})` : ''}
              </h3>
            </div>
          </div>
          {hasTrace && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs h-7 shrink-0"
            >
              <Download className="h-3 w-3 mr-1.5" />
              Download Full Trace
            </Button>
          )}
        </div>
        
        <div className="space-y-4">
          {errors.map((error, index) => (
            <ErrorCard key={index} error={error} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ error }: { error: ParsedError }) {
  // Extract the main error type and detail
  // Error messages are typically: "ErrorType. Detail text here"
  // Examples:
  // - "Missing required argument. The argument "hostnames" is required, but no definition was found."
  // - "Unsupported argument. An argument named "hostname" is not expected here."
  
  // Find where the detail starts (after first period, or after error type if no period)
  let errorType = error.message;
  let errorDetail = '';
  
  // Look for patterns like "ErrorType. The..." or "ErrorType. An..."
  const detailMatch = error.message.match(/^([^.]+?)(?:\.\s+(The|An|with|on)(.+))?$/);
  if (detailMatch) {
    errorType = detailMatch[1].trim();
    if (detailMatch[2] && detailMatch[3]) {
      // We have detail text starting with "The", "An", etc.
      errorDetail = (detailMatch[2] + detailMatch[3]).trim();
      // Remove suggestion text if it's embedded
      if (errorDetail.includes('Did you mean')) {
        errorDetail = errorDetail.split('Did you mean')[0].trim();
      }
    }
  }
  
  // Fallback: if no detail found with regex, try simple split
  if (!errorDetail && error.message.includes('.')) {
    const parts = error.message.split(/\.\s+/);
    if (parts.length > 1) {
      errorType = parts[0];
      errorDetail = parts.slice(1).join('. ').trim();
      if (errorDetail.includes('Did you mean')) {
        errorDetail = errorDetail.split('Did you mean')[0].trim();
      }
    }
  }
  
  // Final fallback: if we still don't have detail but message is longer than error type,
  // show everything after the error type
  if (!errorDetail && error.message.length > errorType.length) {
    const remaining = error.message.substring(errorType.length).trim();
    if (remaining && !remaining.match(/^(on|in)\s/)) {
      errorDetail = remaining.replace(/^\.\s*/, '').trim();
      if (errorDetail.includes('Did you mean')) {
        errorDetail = errorDetail.split('Did you mean')[0].trim();
      }
    }
  }

  // Format text to highlight quoted strings in grey code blocks (like TFE)
  const formatText = (text: string): React.ReactNode => {
    if (!text) return null;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Match quoted strings like "hostnames" or "hostname"
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Add the quoted string as code with grey background (like TFE)
      parts.push(
        <code key={match.index} className="bg-red-100/80 dark:bg-muted/40 px-1.5 py-0.5 rounded text-xs font-mono text-red-950 dark:text-foreground">
          {match[1]}
        </code>
      );
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? <>{parts}</> : text;
  };

  return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-500/30 rounded-md p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          {/* Error Type - red text */}
          <div className="font-semibold text-red-700 dark:text-red-400 text-sm">
            Error: {errorType}
          </div>
          
          {/* Error Details - dark text in light mode, light text in dark mode */}
          {errorDetail && (
            <div className="text-sm text-red-900/90 dark:text-gray-100 leading-relaxed">
              {formatText(errorDetail)}
            </div>
          )}
          
          {/* Location Information - dark text in light mode, light text in dark mode */}
          {(error.file || error.resource) && (
            <div className="text-xs text-red-900/90 dark:text-gray-100 space-y-1.5 mt-3 pt-3 border-t border-red-500/20">
              {error.file && error.line && (
                <div className="flex items-start gap-2">
                  <span className="text-red-800/80 dark:text-gray-300/70 min-w-[2.5rem]">on</span>
                  <code className="text-red-950 dark:text-gray-100 font-mono bg-red-100/80 dark:bg-muted/40 px-1.5 py-0.5 rounded">
                    {error.file}
                  </code>
                  <span className="text-red-800/80 dark:text-gray-300/70">line {error.line}</span>
                </div>
              )}
              {error.resource && (
                <div className="flex items-start gap-2">
                  <span className="text-red-800/80 dark:text-gray-300/70 min-w-[2.5rem]">in</span>
                  <code className="text-red-950 dark:text-gray-100 font-mono bg-red-100/80 dark:bg-muted/40 px-1.5 py-0.5 rounded">
                    {error.resource}
                  </code>
                </div>
              )}
            </div>
          )}
          
          {/* Suggestion - styled distinctly with light background and icon */}
          {error.suggestion && (
            <div className="mt-3 pt-3 border-t border-red-500/20">
              <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 dark:border-amber-500/10 rounded-md p-3 flex items-start gap-2.5">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-300 flex-shrink-0 mt-0.5 fill-amber-400/20 dark:fill-amber-300/20" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-200 mb-1.5">
                    Suggestion
                  </div>
                  <div className="text-sm text-amber-900 dark:text-gray-100 leading-relaxed">
                    Did you mean {formatText(`"${error.suggestion}"`)}?
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
