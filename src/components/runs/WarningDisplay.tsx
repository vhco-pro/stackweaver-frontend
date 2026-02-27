// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Warning Display Component
 *
 * Displays parsed Terraform warnings and deprecations in a collapsible banner.
 * Completely independent from ErrorDisplay — parses warnings from plan-phase
 * sources only (apply of a saved plan does not re-emit config warnings):
 *   1. Plan JSON diagnostics (primary — has file/line info)
 *   2. Human-readable plan logs (fallback)
 *
 * Implementation: frontend/src/components/runs/WarningDisplay.tsx
 */

import { useState, useMemo } from 'react';
import { AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import type React from 'react';
import { parseTerraformErrors, type ParsedWarning } from '@/utils/terraformErrorParser';

interface WarningDisplayProps {
  /** Plan JSON output (with diagnostics array) */
  planOutput?: Record<string, unknown> | null;
  /** Human-readable plan phase logs */
  planLogs?: string | null;
  className?: string;
}

/**
 * Parse warnings from Terraform plan JSON diagnostics array.
 * See: https://developer.hashicorp.com/terraform/internals/json-format
 */
function parseWarningsFromPlanJson(planOutput: Record<string, unknown>): ParsedWarning[] {
  const result: ParsedWarning[] = [];
  const diagnostics = planOutput.diagnostics as Array<{
    severity?: string;
    summary?: string;
    detail?: string;
    range?: {
      filename?: string;
      start?: { line?: number };
    };
  }> | undefined;

  if (!diagnostics || !Array.isArray(diagnostics)) return result;

  for (const diag of diagnostics) {
    if (diag.severity !== 'warning') continue;

    const summary = diag.summary || '';
    const detail = diag.detail || '';
    const fullMessage = `${summary} ${detail}`.trim();
    if (!fullMessage) continue;

    const isDeprecation =
      summary.toLowerCase().includes('deprecated') ||
      summary.toLowerCase().includes('deprecation') ||
      detail.toLowerCase().includes('deprecated') ||
      detail.toLowerCase().includes('deprecation');

    result.push({
      type: isDeprecation ? 'deprecation' : 'warning',
      message: fullMessage.replace(/\s+/g, ' '),
      file: diag.range?.filename,
      line: diag.range?.start?.line,
    });
  }
  return result;
}

export function WarningDisplay({ planOutput, planLogs, className }: WarningDisplayProps) {
  const [expanded, setExpanded] = useState(true);

  const warnings = useMemo(() => {
    const all: ParsedWarning[] = [];

    // 1. Plan JSON diagnostics (richest source — has file/line info)
    if (planOutput) {
      all.push(...parseWarningsFromPlanJson(planOutput));
    }

    // 2. Plan phase logs (human-readable fallback)
    if (planLogs) {
      const { warnings: planLogWarnings } = parseTerraformErrors(planLogs);
      all.push(...planLogWarnings);
    }

    // Note: apply-phase logs are not parsed for warnings because
    // `terraform apply plan.out` (saved plan) does not re-evaluate
    // the configuration and does not emit configuration-level warnings.

    // Deduplicate by normalised message (first 120 chars, lowercased)
    const seen = new Set<string>();
    return all.filter(w => {
      const key = w.message.substring(0, 120).toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [planOutput, planLogs]);

  if (warnings.length === 0) return null;

  const warningCount = warnings.filter(w => w.type === 'warning').length;
  const deprecationCount = warnings.filter(w => w.type === 'deprecation').length;

  // Build a nice title like "3 Warnings" or "2 Warnings / 1 Deprecation"
  const parts: string[] = [];
  if (warningCount > 0) parts.push(`${warningCount} Warning${warningCount > 1 ? 's' : ''}`);
  if (deprecationCount > 0) parts.push(`${deprecationCount} Deprecation${deprecationCount > 1 ? 's' : ''}`);
  const title = parts.join(' / ');

  return (
    <div className={`border border-yellow-500/30 bg-yellow-500/5 rounded-lg overflow-hidden ${className || ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-yellow-500/10 transition-colors"
      >
        <div className="flex items-center gap-2 text-yellow-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-yellow-600" />
          : <ChevronDown className="h-4 w-4 text-yellow-600" />
        }
      </button>
      {expanded && (
        <div className="border-t border-yellow-500/20 px-3 py-3 max-h-64 overflow-y-auto space-y-2">
          {warnings.map((warning, idx) => (
            <WarningCard key={idx} warning={warning} />
          ))}
        </div>
      )}
    </div>
  );
}

function WarningCard({ warning }: { warning: ParsedWarning }) {
  const isDeprecation = warning.type === 'deprecation';

  const formatText = (text: string): React.ReactNode => {
    if (!text) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        <code
          key={match.index}
          className={`px-1.5 py-0.5 rounded text-xs font-mono ${isDeprecation
            ? 'bg-orange-100/80 dark:bg-muted/40 text-orange-950 dark:text-foreground'
            : 'bg-yellow-100/80 dark:bg-muted/40 text-yellow-950 dark:text-foreground'
          }`}
        >
          {match[1]}
        </code>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? <>{parts}</> : text;
  };

  return (
    <div className={`border rounded-md p-3 ${isDeprecation
      ? 'bg-orange-500/5 border-orange-500/20'
      : 'bg-yellow-500/5 border-yellow-500/20'
    }`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isDeprecation
          ? 'text-orange-600 dark:text-orange-500'
          : 'text-yellow-600 dark:text-yellow-500'
        }`} />
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Badge */}
          <span className={`inline-block shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${isDeprecation
            ? 'bg-orange-500/20 text-orange-700 dark:text-orange-400'
            : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
          }`}>
            {isDeprecation ? 'DEPRECATED' : 'WARNING'}
          </span>

          {/* Message */}
          <div className={`text-sm leading-relaxed ${isDeprecation
            ? 'text-orange-900/90 dark:text-gray-100'
            : 'text-yellow-900/90 dark:text-gray-100'
          }`}>
            {formatText(warning.message)}
          </div>

          {/* Location (file / line / resource) */}
          {(warning.file || warning.resource) && (
            <div className={`text-xs space-y-1 mt-1 pt-1.5 border-t ${isDeprecation
              ? 'border-orange-500/15 text-orange-900/80 dark:text-gray-300'
              : 'border-yellow-500/15 text-yellow-900/80 dark:text-gray-300'
            }`}>
              {warning.file && (
                <div className="flex items-center gap-2">
                  <span className="opacity-60 min-w-[2rem]">on</span>
                  <code className={`font-mono px-1.5 py-0.5 rounded ${isDeprecation
                    ? 'bg-orange-100/80 dark:bg-muted/40'
                    : 'bg-yellow-100/80 dark:bg-muted/40'
                  }`}>
                    {warning.file}
                  </code>
                  {warning.line && (
                    <span className="opacity-60">line {warning.line}</span>
                  )}
                </div>
              )}
              {warning.resource && (
                <div className="flex items-center gap-2">
                  <span className="opacity-60 min-w-[2rem]">in</span>
                  <code className={`font-mono px-1.5 py-0.5 rounded ${isDeprecation
                    ? 'bg-orange-100/80 dark:bg-muted/40'
                    : 'bg-yellow-100/80 dark:bg-muted/40'
                  }`}>
                    {warning.resource}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
